﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { 
  FileUploader, 
  ActionBar,
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal,
  SettingsPanel,
  SettingPresets
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const PRESET_CONFIGS = {
  '低质量': { audioBitrate: '96k' },
  '中等质量': { audioBitrate: '128k' },
  '高质量': { audioBitrate: '320k' },
  '社交媒体': { audioBitrate: '192k' }
};

const LocalSettingSelect = ({ label, value, options, onChange, disabled }) => (
  <div className="setting-item" style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
    <div className="setting-header">
      <span className="setting-label">{label}</span>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="custom-select"
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--card-bg)',
        color: 'var(--text-primary)',
        fontSize: '13px',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        backgroundSize: '16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        colorScheme: 'dark light'
      }}
    >
      {options.map((opt) => (
        <option 
          key={opt.value} 
          value={opt.value}
          style={{
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-primary)'
          }}
        >
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const MP4ToMP3GUI = ({ onBack }) => {
  const navigate = useNavigate();
  const [audioBitrate, setAudioBitrate] = useState('128k');
  const [audioTrack, setAudioTrack] = useState(0);
  const [preset, setPreset] = useState('中等质量');

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileInfos, setFileInfos] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [lastOutputDir, setLastOutputDir] = useState(null);
  const [globalPath, setGlobalPath] = useState(api.isElectron() ? '' : 'browser-downloads');
  const [customPaths, setCustomPaths] = useState({});
  const [results, setResults] = useState({});
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertCount, setConvertCount] = useState({ current: 0, total: 0 });
  const [fileSettings, setFileSettings] = useState({});
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const applyPreset = (presetName) => {
    setPreset(presetName);
    const config = PRESET_CONFIGS[presetName];
    if (config) {
      setAudioBitrate(config.audioBitrate);
    }
  };

  const bitrateOptions = [
    { label: '96 kbps', value: '96k' },
    { label: '128 kbps', value: '128k' },
    { label: '192 kbps', value: '192k' },
    { label: '256 kbps', value: '256k' },
    { label: '320 kbps', value: '320k' }
  ];

  const currentVideoInfo = activeFile ? fileInfos[typeof activeFile === 'string' ? activeFile : activeFile.path] : null;
  const trackCount = currentVideoInfo?.audio_tracks_count || 1;
  const trackOptions = Array.from({ length: trackCount }, (_, i) => ({
    label: `音轨 ${i + 1}`,
    value: i
  }));

  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    onClose: null,
    buttonText: '确定'
  });

  const isCancelledRef = useRef(false);
  const currentFileIndexRef = useRef(0);
  const currentFileRef = useRef(null);
  const currentTargetsRef = useRef(null);

  useEffect(() => {
    if (!api.isAvailable()) return;

    const handleProgress = (data) => {
      if (data && data.type === 'output') {
        let output = null;
        if (Array.isArray(data.targets) && data.targets.length > 0) {
          currentTargetsRef.current = data.targets;
          output = data.output || data.targets[0];
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

  useEffect(() => {
    const fetchInfos = async () => {
      if (!api.isAvailable()) return;
      
      const newInfos = { ...fileInfos };
      let hasUpdates = false;

      for (const file of selectedFiles) {
        const path = typeof file === 'string' ? file : file.path;
        if (!newInfos[path]) {
          const result = await api.getVideoInfo(path);
          if (result && result.success && result.info) {
            newInfos[path] = result.info;
            hasUpdates = true;
          }
        }
      }

      if (hasUpdates) {
        setFileInfos(newInfos);
      }
    };

    fetchInfos();
  }, [selectedFiles, fileInfos]);

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

  const handleAlertOnlyClose = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
    if (alertModal.onClose) {
      alertModal.onClose();
    }
  };

  const processFiles = async (files) => {
    if (files && files.length > 0) {
      // Filter for MP4 files
      const validFiles = files.filter(file => {
        const path = typeof file === 'string' ? file : file.path;
        return path && path.toLowerCase().endsWith('.mp4');
      });

      if (validFiles.length < files.length) {
        showAlert('提示', '部分文件已忽略，仅支持 MP4 格式');
      }

      if (validFiles.length === 0) return;

      // Remove duplicates
      const uniqueNewFiles = validFiles.filter(file => {
        const filePath = typeof file === 'string' ? file : file.path;
        return !selectedFiles.some(existing => {
          const existingPath = typeof existing === 'string' ? existing : existing.path;
          return existingPath === filePath;
        });
      });

      if (uniqueNewFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...uniqueNewFiles]);
        if (!activeFile) {
          setActiveFile(uniqueNewFiles[0]);
        }

        // Fetch info
        if (api.isAvailable()) {
            for (const file of uniqueNewFiles) {
                const path = typeof file === 'string' ? file : file.path;
                try {
                    const result = await api.getVideoInfo(path);
                    if (result.success) {
                        setFileInfos(prev => ({
                            ...prev,
                            [path]: result.info
                        }));
                    }
                } catch (error) {
                    console.error('Failed to get info for', path, error);
                }
            }
        }
      }
    }
  };

  const handleFileSelect = async () => {
    if (api.isAvailable()) {
      const files = await api.openFileDialog([{ name: 'MP4 视频', extensions: ['mp4'] }]);
      if (files && files.length > 0) {
        await processFiles(files);
      }
    } else {
      document.getElementById('file-input').click();
    }
  };

  const handleWebFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      processFiles(files);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    const fileToRemove = selectedFiles[index];
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    if (activeFile === fileToRemove) {
      setActiveFile(newFiles.length > 0 ? newFiles[0] : null);
    }
    
    const newInfos = { ...fileInfos };
    delete newInfos[typeof fileToRemove === 'string' ? fileToRemove : fileToRemove.path];
    setFileInfos(newInfos);

    const newSettings = { ...fileSettings };
    delete newSettings[fileToRemove];
    setFileSettings(newSettings);
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setActiveFile(null);
    setFileInfos({});
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setFileSettings({});
  };

  const handlePreview = async (file) => {
    if (!api.isAvailable()) {
      showAlert('提示', 'Web 模式下暂不支持预览');
      return;
    }

    const filePath = typeof file === 'string' ? file : file.path;
    setPreviewFile(filePath);
    
    if (fileInfos[filePath]) {
      setPreviewInfo(fileInfos[filePath]);
    } else {
      const info = await api.getVideoInfo(filePath);
      setPreviewInfo(info);
    }
    
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setPreviewFile(null);
    setPreviewInfo(null);
  };

  const handleCropConfirm = (settings) => {
    const filePath = typeof previewFile === 'string' ? previewFile : previewFile?.path;
    if (filePath) {
      setFileSettings(prev => ({
        ...prev,
        [filePath]: {
          ...(prev[filePath] || {}),
          startTime: settings.startTime,
          endTime: settings.endTime
        }
      }));
    }
    setIsPreviewOpen(false);
  };

  const handleSetGlobalPath = async () => {
    if (api.isAvailable()) {
      const path = await api.openDirectoryDialog();
      if (path) {
        setGlobalPath(path);
        setLastOutputDir(path);
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
      showAlert('提示', '请先选择 MP4 文件');
      return;
    }

    const missingPath = selectedFiles.some(file => {
      const key = typeof file === 'string' ? file : file.path;
      return !customPaths[key] && !globalPath && !lastOutputDir;
    });

    if (api.isElectron() && missingPath) {
      showAlert('提示', '请设置输出路径（全局或自定义）');
      return;
    }

    isCancelledRef.current = false;
    setConvertProgress(0);
    setConvertCount({ current: 0, total: selectedFiles.length });

    setIsConverting(true);
    let successCount = 0;
    let failCount = 0;
    let processedCount = 0;

    try {
      if (api.isAvailable()) {
        for (let index = 0; index < selectedFiles.length; index++) {
          if (isCancelledRef.current) break;

          currentFileIndexRef.current = index;
          const file = selectedFiles[index];
          const key = typeof file === 'string' ? file : file.path;

          const fileInfo = fileInfos[key];
          if (fileInfo && fileInfo.audio_tracks_count === 0) {
            showAlert('提示', `文件 ${key.split(/[\\/]/).pop()} 没有音轨，无法转换为音频格式。`);
            const finished = index + 1;
            setConvertCount({ current: finished, total: selectedFiles.length });
            continue;
          }

          currentFileRef.current = file;
          currentTargetsRef.current = null;

          const outputDir = customPaths[key] || globalPath || lastOutputDir;
          const settings = fileSettings[key] || {};

          const params = {
            audioBitrate,
            audioTrack,
            startTime: settings.startTime,
            endTime: settings.endTime
          };

          processedCount++;
          const result = await api.convert('convert-mp4-to-mp3', {
            sourcePath: file,
            outputDir: outputDir,
            params: params
          });

          if (isCancelledRef.current) break;

          if (result.success) {
            successCount += 1;
            if (result.outputPath || result.output) {
              const out = result.outputPath || result.output;
              setResults(prev => ({
                ...prev,
                [key]: out
              }));
            }
          } else {
            failCount += 1;
            console.error('Conversion failed for', file, result.message);
            if (result.error === 'Cancelled') break;
            applyConversionNotificationRule({
              scene: ConversionScenario.ERROR_SINGLE,
              ui: { showAlert },
              data: {
                filePath: key,
                errorMessage: result.error || result.message
              }
            });
          }
          const finished = index + 1;
          setConvertCount({ current: finished, total: selectedFiles.length });
        }

        if (!isCancelledRef.current && processedCount > 0) {
          setConvertProgress(100);
          setTimeout(() => {
            const msg = failCount > 0
              ? `处理完成！成功: ${successCount} 个，失败: ${failCount} 个。`
              : '所有任务处理完成！';

            applyConversionNotificationRule({
              scene: ConversionScenario.SUCCESS_BATCH_ALL,
              ui: { showAlert },
              data: {
                customTitle: '完成',
                customMessage: msg,
                buttonText: '确定',
                onConfirm: () => {
                  setAlertModal(prev => ({ ...prev, isOpen: false }));
                  setConvertProgress(0);
                  setConvertCount({ current: 0, total: 0 });
                },
                onClose: handleAlertOnlyClose,
                totalCount: processedCount,
                finishedCount: successCount
              }
            });
          }, 100);
        }
      } else {
        // Web mode simulation
        for (let i = 0; i < selectedFiles.length; i++) {
          if (isCancelledRef.current) break;
          currentFileIndexRef.current = i;
          
          for (let p = 0; p <= 100; p += 5) {
            setConvertProgress(p);
            await new Promise(r => setTimeout(r, 100));
          }
          setConvertCount(prev => ({ ...prev, current: prev.current + 1 }));
        }
        showAlert('完成', '转换完成（演示模式）');
      }
    } catch (error) {
      console.error('Convert error:', error);
      showAlert('错误', '转换过程中发生错误: ' + error.message);
    } finally {
      setIsConverting(false);
      setConvertProgress(0);
      currentTargetsRef.current = null;
    }
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    isCancelledRef.current = true;
    setIsConverting(false);
    setIsCancelModalOpen(false);
    setConvertProgress(0);

    let targetPath = null;
    if (Array.isArray(currentTargetsRef.current) && currentTargetsRef.current.length > 0) {
      targetPath = currentTargetsRef.current;
    } else if (currentFileRef.current) {
      const fileValue = currentFileRef.current;
      const key = typeof fileValue === 'string' ? fileValue : fileValue.path;
      const outputDir = customPaths[key] || globalPath || lastOutputDir;
      
      if (key && outputDir) {
        const parts = key.split(/[\\/]/);
        const filenameWithExt = parts[parts.length - 1] || '';
        const filename = filenameWithExt.replace(/\.[^/.]+$/, '');
        const sep = key.includes('\\') ? '\\' : '/';
        targetPath = `${outputDir}${sep}${filename}.mp3`;
      }
    }

    if (api.isAvailable() && typeof api.cancelConversion === 'function') {
      try {
        await api.cancelConversion(targetPath ? { targetPath } : undefined);
      } catch (error) {
        console.error('Cancel conversion error:', error);
      }
    }
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

  return (
    <div style={{ width: '100%', position: 'relative', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      <div style={{ marginBottom: '16px', padding: '0 40px', marginTop: '12px' }}>
        <div className="tool-breadcrumbs">
          <a onClick={onBack}>MP4 转换器</a>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>/</span>
            <span className="current">MP4 To MP3</span>
          </span>
        </div>
        <div className="header-text" style={{ marginTop: '12px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
             <div 
               onClick={onBack}
               className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
               style={{ 
                 cursor: 'pointer', 
                 display: 'flex', 
                 alignItems: 'center', 
                 justifyContent: 'center',
                 width: '32px', 
                 height: '32px', 
                 borderRadius: '50%', 
                 color: 'var(--text-primary)' 
               }}
             >
               <ArrowLeft className="w-5 h-5" />
             </div>
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>MP4 To MP3 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>—— 专业级 MP4 转 MP3 工具，支持批量提取音频和高质量输出。</div>
        </div>
      </div>

      <div className='tool-ui-container' style={{ padding: '24px', flex: 1 }}>
        <div className="tool-main-content">
          <div className="tool-left-panel">
            <FileUploaderV2
                files={selectedFiles} 
                fileInfos={fileInfos}
                onAddFile={handleFileSelect} 
                onRemoveFile={handleRemoveFile} 
                onDropFiles={(files) => processFiles(files.map(f => f.path))} 
                onSetGlobalPath={handleSetGlobalPath}
                onSetCustomPath={handleSetCustomPath}
                onPreview={handlePreview}
                activeFile={activeFile}
                onSelectFile={setActiveFile}
                showAudioInfo={true}
                uploadPlaceholder="将您的 MP4 文件拖拽到此处"
                results={results}
                customPaths={customPaths}
                globalPath={globalPath}
            />
             <input
                type="file"
                id="file-input"
                multiple
                style={{ display: 'none' }}
                onChange={handleWebFileChange}
                accept=".mp4"
             />
             <ActionBar 
                onConvert={handleConvert} 
                onClear={handleClear}
                onCancel={handleCancelClick}
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
                onSelect={applyPreset}
                columns={2}
              />
              
              <div className="settings-group">
                <LocalSettingSelect
                  label="音频比特率"
                  value={audioBitrate}
                  options={[
                    { label: '96 kbps', value: '96k' },
                    { label: '128 kbps', value: '128k' },
                    { label: '192 kbps', value: '192k' },
                    { label: '256 kbps', value: '256k' },
                    { label: '320 kbps', value: '320k' }
                  ]}
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
              </div>

              <div className="setting-info-box" style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '6px', fontSize: '12px', color: '#0369a1', border: '1px solid #bae6fd' }}>
                提示：较高的比特率通常意味着更好的音质，但文件体积也会相应增大。
              </div>
            </SettingsPanel>
          </div>
        </div>
      </div>

      <VideoPreviewModal
        key={`${previewFile}-${previewInfo?.duration}`}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        file={previewFile}
        videoInfo={previewInfo}
        initialSettings={previewFile ? fileSettings[previewFile] : null}
        onConfirm={handleCropConfirm}
      />

      <ConfirmationModal
        isOpen={isCancelModalOpen}
        title="取消转换"
        message="确定要取消当前的转换任务吗？已生成的文件将保留。"
        onConfirm={handleConfirmCancel}
        onCancel={() => setIsCancelModalOpen(false)}
        confirmText="终止任务"
        cancelText="继续转换"
        isDanger={true}
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

export default MP4ToMP3GUI;

