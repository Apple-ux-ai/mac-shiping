﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ActionBar,
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal,
  SettingsPanel,
  SettingSlider,
  SettingPresets
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import { api } from '../../services/api';

import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const LocalSettingSelect = ({ label, value, options, onChange, disabled }) => {
  return (
    <div className="setting-item">
      <div className="setting-header">
        <span className="setting-label">{label}</span>
      </div>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-color)',
          color: 'var(--text-primary)',
          fontSize: '13px',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          height: '36px',
          opacity: disabled ? 0.6 : 1
        }}
      >
        {options.map((opt, index) => (
          <option key={index} value={typeof opt === 'object' ? opt.value : opt}>
            {typeof opt === 'object' ? opt.label : opt}
          </option>
        ))}
      </select>
    </div>
  );
};

const PRESET_CONFIGS = {
  '低质量': { quality: 10, audioBitrate: '96k', resolution: '640x360' },
  '中等质量': { quality: 23, audioBitrate: '128k', resolution: '1280x720' },
  '高质量': { quality: 30, audioBitrate: '320k', resolution: '1920x1080' },
  '社交媒体': { quality: 25, audioBitrate: '192k', resolution: '1080x1920' }
};

const AVIToMPEGUI = ({ onBack }) => {
  const breadcrumbItems = [
    { label: 'AVI 转换器', onClick: onBack },
    { label: 'AVI To MPE' }
  ];
  // State for settings
  const [quality, setQuality] = useState(70); 
  const [audioBitrate, setAudioBitrate] = useState('128k');
  const [resolution, setResolution] = useState('1280x720'); 
  const [audioTrack, setAudioTrack] = useState(0);
  const [preset, setPreset] = useState('中等质量');

  const resolutionOptions = [
    { label: '保持原样', value: 'original' },
    { label: '1280x720 (HD)', value: '1280x720' },
    { label: '1920x1080 (FHD)', value: '1920x1080' },
    { label: '640x360 (SD)', value: '640x360' },
    { label: '320x180 (LD)', value: '320x180' },
    { label: '720x1280 (HD) - 9:16', value: '720x1280' },
    { label: '1080x1920 (FHD) - 9:16', value: '1080x1920' },
    { label: '360x640 (SD) - 9:16', value: '360x640' },
    { label: '180x320 (LD) - 9:16', value: '180x320' }
  ];

  const bitrateOptions = [
    { label: '96 kbps', value: '96k' },
    { label: '128 kbps', value: '128k' },
    { label: '192 kbps', value: '192k' },
    { label: '256 kbps', value: '256k' },
    { label: '320 kbps', value: '320k' },
  ];

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileInfos, setFileInfos] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertCount, setConvertCount] = useState({ current: 0, total: 0 });
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [globalPath, setGlobalPath] = useState(api.isElectron() ? '' : 'browser-downloads');
  const [customPaths, setCustomPaths] = useState({});
  const [results, setResults] = useState({});

  const currentVideoInfo = activeFile ? fileInfos[activeFile] : null;
  const trackCount = currentVideoInfo?.audio_tracks_count || 1;
  const trackOptions = Array.from({ length: trackCount }, (_, i) => ({
    label: `音轨 ${i + 1} ${i === 0 ? '(默认)' : ''}`,
    value: i
  }));

  const handlePresetSelect = (label) => {
    setPreset(label);
    const config = PRESET_CONFIGS[label];
    if (config) {
      if (config.quality !== undefined) setQuality(config.quality);
      if (config.audioBitrate !== undefined) setAudioBitrate(config.audioBitrate);
      if (config.resolution !== undefined) setResolution(config.resolution);
    }
  };

  // Alert Modal state
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    onClose: null,
    buttonText: '确定'
  });

  const handleAlertOnlyClose = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
  };

  const showAlert = (title, message, onConfirm = null, buttonText = '确定', onClose = null) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      onConfirm: onConfirm || (() => setAlertModal(prev => ({ ...prev, isOpen: false }))),
      onClose: onClose || (() => setAlertModal(prev => ({ ...prev, isOpen: false }))),
      buttonText
    });
  };

  const handleCloseAlert = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
    if (alertModal.onConfirm) {
      alertModal.onConfirm();
    }
  };

  const isCancelledRef = useRef(false);
  const currentFileIndexRef = useRef(0);
  const currentFileRef = useRef(null);
  const currentTargetsRef = useRef(null);

  // Setup progress listener
  useEffect(() => {
      if (!api.isAvailable()) return;
      
      const handleProgress = (data) => {
          if (data && data.type === 'output') {
              let output = null;
              if (Array.isArray(data.targets) && data.targets.length > 0) {
                  currentTargetsRef.current = data.targets;
                  output = data.output || data.outputPath || data.targets[0];
              } else if (data.output) {
                  currentTargetsRef.current = [data.output];
                  output = data.output;
              }
              if (currentFileRef.current && output) {
                  const key = typeof currentFileRef.current === 'string' ? currentFileRef.current : currentFileRef.current.path;
                  setResults(prev => ({
                      ...prev,
                      [key]: output
                  }));
              }
              return;
          }
          if (data.percent !== undefined && selectedFiles.length > 0) {
              const currentFilePercent = data.percent;
              const total = selectedFiles.length;
              const currentIdx = currentFileIndexRef.current;
              
              const globalPercent = Math.round(((currentIdx * 100) + currentFilePercent) / total);
              setConvertProgress(globalPercent);
          }
      };

      api.onProgress(handleProgress);
      return () => {
          api.removeProgressListener();
      };
  }, [selectedFiles.length]);

  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);

  const handlePreview = async (file) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
    setPreviewInfo(null); 

    if (api.isAvailable() && typeof file === 'string') {
      try {
        const result = await api.getVideoInfo(file);
        if (result.success) {
          setPreviewInfo(result.info);
        }
      } catch (err) {
        console.error('Failed to get video info:', err);
      }
    }
  };

  const processFiles = async (files) => {
    if (files && files.length > 0) {
        // Filter out already selected files
        const newFiles = files.filter(f => !selectedFiles.includes(f));
        if (newFiles.length === 0) return;

        // Filter by extension if needed (simple check)
        const validFiles = newFiles.filter(f => f.toLowerCase().endsWith('.avi'));
        if (validFiles.length < newFiles.length) {
             showAlert('提示', `部分文件已忽略，仅支持 AVI 格式`);
        }
        if (validFiles.length === 0) return;

        setSelectedFiles(prev => [...prev, ...validFiles]);
        if (!activeFile && validFiles.length > 0) setActiveFile(validFiles[0]);

        // Automatically fetch info for new files
        for (const file of validFiles) {
            try {
                const result = await api.getVideoInfo(file);
                if (result.success) {
                    setFileInfos(prev => ({
                        ...prev,
                        [file]: result.info
                    }));
                }
            } catch (error) {
                console.error('Failed to get info for', file, error);
            }
        }
    }
  };

  const handleFileSelect = async () => {
    // Check if running in Electron
    if (api.isAvailable()) {
      const files = await api.openFileDialog([
        { name: 'AVI Videos', extensions: ['avi'] }
      ]);
      await processFiles(files);
    } else {
        // Fallback for web preview (won't get full paths)
        document.getElementById('file-input').click();
    }
  };
    
    // Handle web file input change (fallback)
  const handleWebFileChange = (e) => {
      // For web mode simulation
      const newFiles = Array.from(e.target.files).map(f => f.name); // Just store names for demo
      setSelectedFiles(prev => [...prev, ...newFiles]);
      if (!activeFile && newFiles.length > 0) setActiveFile(newFiles[0]);
  };

  const handleRemoveFile = (index) => {
    const fileToRemove = selectedFiles[index];
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    const newFileInfos = { ...fileInfos };
    delete newFileInfos[fileToRemove];
    setFileInfos(newFileInfos);
    
    if (activeFile === fileToRemove) {
      setActiveFile(newFiles.length > 0 ? newFiles[0] : null);
    }
  };

  const handleSetGlobalPath = async () => {
    if (api.isAvailable()) {
      const path = await api.openDirectoryDialog();
      if (path) {
        setGlobalPath(path);
      }
    } else {
      showAlert('提示', 'Web 模式下无法选择目录');
    }
  };

  const handleSetCustomPath = async (filesToSet) => {
    if (!filesToSet || filesToSet.length === 0) return;
    if (api.isAvailable()) {
      const path = await api.openDirectoryDialog();
      if (path) {
        setCustomPaths(prev => {
          const next = { ...prev };
          filesToSet.forEach(file => {
            const filePath = typeof file === 'string' ? file : file.path;
            next[filePath] = path;
          });
          return next;
        });
      }
    }
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) {
      showAlert('提示', '请先选择要转换的文件');
      return;
    }

    const missingPath = selectedFiles.some(file => {
      const key = typeof file === 'string' ? file : file.path;
      return !customPaths[key] && !globalPath;
    });
    if (api.isElectron() && missingPath) {
      showAlert('提示', '请设置输出路径（全局或自定义）');
      return;
    }

    isCancelledRef.current = false;
    setConvertProgress(0);
    setConvertCount({ current: 0, total: selectedFiles.length });

    setIsConverting(true);
    try {
      if (api.isAvailable()) {
        for (let i = 0; i < selectedFiles.length; i++) {
          if (isCancelledRef.current) break;

          currentFileIndexRef.current = i;
          const filePath = selectedFiles[i];
          currentFileRef.current = filePath;
          currentTargetsRef.current = null;
          const key = typeof filePath === 'string' ? filePath : filePath.path;
          const outputDir = customPaths[key] || globalPath;
          setConvertCount({ current: i + 1, total: selectedFiles.length });

          const result = await api.convert('convert-avi-to-mpe', {
            sourcePath: filePath,
            outputDir: outputDir,
            params: {
              quality,
              audioBitrate,
              resolution,
              audioTrack,
              preset
            }
          });

          if (isCancelledRef.current) break;

          if (!result.success && !isCancelledRef.current) {
            if (result.error === 'Cancelled') break;
            applyConversionNotificationRule({
              scene: ConversionScenario.ERROR_SINGLE,
              ui: { showAlert },
              data: {
                filePath: key,
                errorMessage: result.error || result.message
              }
            });
            break;
          }
        }

        if (!isCancelledRef.current) {
          setConvertProgress(0);
          setTimeout(() => {
            applyConversionNotificationRule({
              scene: ConversionScenario.SUCCESS_BATCH_ALL,
              ui: { showAlert },
              data: {
                customTitle: '完成',
                customMessage: '所有任务处理完成！',
                buttonText: '确定',
                onClose: handleAlertOnlyClose
              }
            });
          }, 100);
        }
      }
    } catch (err) {
      showAlert('错误', `转换过程中出现错误: ${err.message}`);
    } finally {
      if (api.isAvailable()) {
        setIsConverting(false);
      }
      currentFileRef.current = null;
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setActiveFile(null);
    setFileInfos({});
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setCustomPaths({});
    setResults({});
  };

  const handleCancel = () => {
    setIsCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    isCancelledRef.current = true;
    setIsCancelModalOpen(false);
    
    try {
      let targetPath = null;
      if (Array.isArray(currentTargetsRef.current) && currentTargetsRef.current.length > 0) {
        targetPath = currentTargetsRef.current;
      } else if (currentFileRef.current) {
        const key = typeof currentFileRef.current === 'string' ? currentFileRef.current : currentFileRef.current.path;
        const outputDir = customPaths[key] || globalPath;
        if (outputDir) {
          const pathParts = key.split(/[\\/]/);
          const filenameWithExt = pathParts[pathParts.length - 1];
          const filename = filenameWithExt.replace(/\.[^/.]+$/, '');
          const sep = key.includes('\\') ? '\\' : '/';
          targetPath = `${outputDir}${sep}${filename}.mpe`;
        }
      }
      if (api.isAvailable()) {
        await api.cancelConversion(targetPath ? { targetPath } : undefined);
      }
    } catch (err) {
      console.error('Cancel failed:', err);
    }
    
    setIsConverting(false);
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    applyConversionNotificationRule({
      scene: ConversionScenario.CANCELLED_USER,
      ui: { showAlert },
      data: {
        customTitle: '已取消',
        customMessage: '转换任务已取消，相关文件已清理。',
        buttonText: '确定'
      }
    });
  };

  const navigate = useNavigate();

  return (
    <div className="tool-container-full">
      <div style={{ marginBottom: '16px', padding: '0 40px', marginTop: '12px' }}>
        <div className="tool-breadcrumbs">
          {breadcrumbItems.map((item, index) => (
            <span key={index} style={{ display: 'flex', alignItems: 'center' }}>
               {index > 0 && <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>/</span>}
               {item.onClick ? (
                  <a onClick={item.onClick}>{item.label}</a>
               ) : (
                  <span className="current">{item.label}</span>
               )}
            </span>
          ))}
        </div>
        <div className="header-text" style={{ marginTop: '8px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
             <div 
               onClick={onBack}
               style={{ 
                 cursor: 'pointer', 
                 display: 'flex', 
                 alignItems: 'center', 
                 justifyContent: 'center',
                 width: '32px', 
                 height: '32px', 
                 borderRadius: '50%', 
                 background: 'var(--bg-secondary)', 
                 color: 'var(--text-primary)' 
               }}
             >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M19 12H5M12 19l-7-7 7-7"/>
               </svg>
             </div>
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>AVI To MPE 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px' }}>一款专业工具，可将AVI 视频文件转换为MPE视频格式，并支持自定义编码参数。</div>
        </div>
      </div>
      <div className="tool-content-scroll">
        <div className="tool-main-layout">
          <div className="tool-left-panel">
            <FileUploaderV2
              files={selectedFiles}
              fileInfos={fileInfos}
              onAddFile={handleFileSelect}
              onRemoveFile={handleRemoveFile}
              onPreview={handlePreview}
              activeFile={activeFile}
              onSelectFile={setActiveFile}
              onDropFiles={(files) => processFiles(files.map(f => f.path))}
              showAudioInfo={true}
              uploadPlaceholder="将您的 AVI 文件拖拽到此处"
              globalPath={globalPath}
              onSetGlobalPath={handleSetGlobalPath}
              customPaths={customPaths}
              onSetCustomPath={handleSetCustomPath}
              results={results}
            />
            <ActionBar 
              onConvert={handleConvert} 
              onClear={handleClear} 
              onCancel={handleCancel}
              progress={convertProgress}
              isConverting={isConverting}
              convertCount={convertCount}
            />
          </div>

          <div className="tool-right-panel">
            <SettingsPanel title="转换选项">
              <SettingPresets 
                label="快速预设"
                presets={['低质量', '中等质量', '高质量', '社交媒体']}
                currentPreset={preset}
                onSelect={handlePresetSelect}
                columns={2}
              />

              <SettingSlider 
                label="质量" 
                value={quality} 
                unit="%" 
                min={1} 
                max={100} 
                step={1}
                onChange={(val) => {
                  setQuality(val);
                  setPreset('自定义');
                }}
              />

              <LocalSettingSelect 
                label="分辨率" 
                value={resolution} 
                options={resolutionOptions}
                onChange={(val) => {
                  setResolution(val);
                  setPreset('自定义');
                }}
                disabled={isConverting}
              />

              <LocalSettingSelect 
                label="音频比特率" 
                value={audioBitrate} 
                options={bitrateOptions}
                onChange={(val) => {
                  setAudioBitrate(val);
                  setPreset('自定义');
                }}
                disabled={isConverting}
              />

              <LocalSettingSelect 
                label="选择音轨" 
                value={audioTrack} 
                options={trackOptions}
                onChange={(val) => {
                  setAudioTrack(Number(val));
                  setPreset('自定义');
                }}
                disabled={isConverting}
              />
            </SettingsPanel>
          </div>
        </div>
      </div>

      <VideoPreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
        videoInfo={previewInfo}
      />

      <ConfirmationModal 
        isOpen={isCancelModalOpen}
        title="取消转换"
        message="确定要取消当前的转换任务吗？"
        onConfirm={confirmCancel}
        onCancel={() => setIsCancelModalOpen(false)}
      />

      <AlertModal 
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={handleCloseAlert}
        onClose={handleAlertOnlyClose}
        buttonText={alertModal.buttonText}
      />
    </div>
  );
};

export default AVIToMPEGUI;

