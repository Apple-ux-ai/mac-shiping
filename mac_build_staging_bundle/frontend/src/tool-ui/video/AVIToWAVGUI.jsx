﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ActionBar,
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal,
  SettingsPanel,
  SettingPresets
} from '../common/SharedUI';
import WAVParamConfig from '../../components/converter/WAVParamConfig';
import { api } from '../../services/api';
import { FileUploaderV2 } from '../common/FileUploaderV2';
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

const AVIToWAVGUI = ({ onBack }) => {
  const navigate = useNavigate();

  const breadcrumbItems = [
    { label: 'AVI 转换器', onClick: onBack },
    { label: 'AVI To WAV' }
  ];

  const presets = ['低质量', '中等质量', '高质量', '社交媒体'];
  const PRESET_CONFIGS = {
    '低质量': { audioBitrate: '96k' },
    '中等质量': { audioBitrate: '128k' },
    '高质量': { audioBitrate: '320k' },
    '社交媒体': { audioBitrate: '192k' }
  };

  const bitrateOptions = [
    { label: '96 kbps', value: '96k' },
    { label: '128 kbps', value: '128k' },
    { label: '192 kbps', value: '192k' },
    { label: '256 kbps', value: '256k' },
    { label: '320 kbps', value: '320k' },
  ];

  // State for settings
  const [audioBitrate, setAudioBitrate] = useState('128k');
  const [audioTrack, setAudioTrack] = useState(0);
  const [preset, setPreset] = useState('中等质量');
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileInfos, setFileInfos] = useState({});
  const [activeFile, setActiveFile] = useState(null);
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
      if (config.audioBitrate !== undefined) setAudioBitrate(config.audioBitrate);
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
  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Handlers
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
      } catch (error) {
        console.error('Failed to get video info:', error);
      }
    }
  };

  const processFiles = async (files) => {
    if (files && files.length > 0) {
      // Filter out already selected files
      const newFiles = files.filter(f => !selectedFiles.includes(f));
      if (newFiles.length === 0) return;

      // Filter by extension if needed
      const validFiles = newFiles.filter(f => f.toLowerCase().endsWith('.avi'));
      if (validFiles.length < newFiles.length) {
        showAlert('提示', '部分文件已忽略，仅支持 AVI 格式');
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
      // Fallback for web preview
      document.getElementById('file-input').click();
    }
  };

  const handleWebFileChange = (e) => {
    const newFiles = Array.from(e.target.files).map(f => f.name);
    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (!activeFile && newFiles.length > 0) setActiveFile(newFiles[0]);
    e.target.value = ''; // Reset input
  };

  const handleRemoveFile = (index) => {
    const fileToRemove = selectedFiles[index];
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    if (activeFile === fileToRemove) {
      setActiveFile(newFiles.length > 0 ? newFiles[0] : null);
    }
    
    const newFileInfos = { ...fileInfos };
    delete newFileInfos[fileToRemove];
    setFileInfos(newFileInfos);
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

    try {
      setIsConverting(true);
      setConvertProgress(0);
      setConvertCount({ current: 0, total: selectedFiles.length });
      isCancelledRef.current = false;

      for (let i = 0; i < selectedFiles.length; i++) {
        if (isCancelledRef.current) break;

        currentFileIndexRef.current = i;
        const filePath = selectedFiles[i];
        const key = typeof filePath === 'string' ? filePath : filePath.path;
        const outputDir = customPaths[key] || globalPath;

        const fileInfo = fileInfos[filePath];
        if (fileInfo && fileInfo.audio_tracks_count === 0) {
            showAlert('提示', `文件 ${filePath.split(/[\\/]/).pop()} 没有音轨，无法转换为音频格式。`);
            const finished = i + 1;
            setConvertCount({ current: finished, total: selectedFiles.length });
            continue;
        }

        currentFileRef.current = filePath;
        currentTargetsRef.current = null;
        setConvertCount({ current: i + 1, total: selectedFiles.length });

        const result = await api.convert('convert-avi-to-wav', {
          sourcePath: filePath,
          outputDir: outputDir,
          params: {
            audioBitrate,
            audioTrack,
            preset
          }
        });

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

      setIsConverting(false);
    } catch (error) {
      console.error('Conversion failed:', error);
      setIsConverting(false);
      showAlert('错误', '转换过程中发生错误: ' + error.message, () => {
        setAlertModal(prev => ({ ...prev, isOpen: false }));
        setConvertProgress(0);
        setConvertCount({ current: 0, total: 0 });
      });
    }
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
              const filename = key.split(/[\\/]/).pop().split('.')[0];
              const sep = key.includes('\\') ? '\\' : '/';
              targetPath = `${outputDir}${sep}${filename}.wav`;
            }
        }
        await api.cancelConversion(targetPath ? { targetPath } : undefined);
    } catch (error) {
        console.error('Failed to cancel conversion:', error);
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

  const handleClear = () => {
    setSelectedFiles([]);
    setActiveFile(null);
    setFileInfos({});
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setCustomPaths({});
    setResults({});
  };

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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>AVI To WAV 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px' }}>一款专业工具，可从AVI视频中提取WAV音频，并支持自定义编码参数。</div>
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
            <input 
              type="file" 
              id="file-input" 
              multiple 
              style={{ display: 'none' }} 
              onChange={handleWebFileChange} 
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
                presets={presets}
                currentPreset={preset}
                onSelect={handlePresetSelect}
                columns={2}
              />

              <LocalSettingSelect 
                label="音频比特率 (kbps)" 
                value={audioBitrate} 
                options={bitrateOptions}
                onChange={(val) => {
                  setAudioBitrate(val);
                  setPreset('自定义');
                }}
              />
              
              <LocalSettingSelect 
                label="选择音轨" 
                value={audioTrack} 
                options={trackOptions}
                onChange={(val) => {
                  setAudioTrack(Number(val));
                  setPreset('自定义');
                }}
              />

              <div className="setting-info-box" style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                提示：WAV 格式通常存储为无损 PCM 音频，提供最高保真度，完美还原原始音质。
              </div>
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
        message="确定要取消当前的转换任务吗？已转换的部分将被删除。"
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

export default AVIToWAVGUI;

