﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  ActionBar,
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal,
  SettingsPanel,
  SettingSlider,
  SettingSelect,
  SettingPresets,
  SettingCheckbox,
  SettingInput,
  UnifiedToolHeader
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const PRESET_CONFIGS = {
  '低质量': { audioBitrate: '96k' },
  '中等质量': { audioBitrate: '128k' },
  '高质量': { audioBitrate: '320k' },
  '社交媒体': { audioBitrate: '192k' },
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

const MOVToMP3GUI = ({ onBack }) => {
  const navigate = useNavigate();
  const [audioBitrate, setAudioBitrate] = useState('128k');
  const [audioTrack, setAudioTrack] = useState(0);
  const [preset, setPreset] = useState('中等质量');
  
  const [enableCustomAudio, setEnableCustomAudio] = useState(false);
  const [audioSampleRate, setAudioSampleRate] = useState('44100');
  const [audioChannels, setAudioChannels] = useState('2');

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileInfos, setFileInfos] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertCount, setConvertCount] = useState({ current: 0, total: 0 });
  const [fileSettings, setFileSettings] = useState({});
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const [globalPath, setGlobalPath] = useState(api.isElectron() ? '' : 'browser-downloads');
  const [lastOutputDir, setLastOutputDir] = useState(null);
  const [customPaths, setCustomPaths] = useState({});
  const [results, setResults] = useState({});

  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

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
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
  };

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

  const handlePreview = async (file) => {
    const filePath = typeof file === 'string' ? file : file.path;
    setPreviewFile(file);
    setIsPreviewOpen(true);
    setPreviewInfo(fileInfos[filePath] || null);

    if (api.isAvailable() && filePath && !fileInfos[filePath]) {
      try {
        const result = await api.getVideoInfo(filePath);
        if (result.success) {
          setPreviewInfo(result.info);
          setFileInfos(prev => ({ ...prev, [filePath]: result.info }));
        }
      } catch (error) {
        console.error('Failed to get video info:', error);
      }
    }
  };

  const handleCropConfirm = (settings) => {
    const filePath = typeof previewFile === 'string' ? previewFile : previewFile?.path;
    if (filePath) {
      setFileSettings(prev => ({
        ...prev,
        [filePath]: {
          ...(prev[filePath] || {}),
          ...settings
        }
      }));
    }
  };

  const applyPreset = (label) => {
    setPreset(label);
    const config = PRESET_CONFIGS[label];
    if (config) {
      if (config.audioBitrate !== undefined) setAudioBitrate(config.audioBitrate);
    }
  };

  const processFiles = async (files) => {
    if (files && files.length > 0) {
        // Filter out already selected files
        const newFiles = files.filter(f => !selectedFiles.includes(f));
        if (newFiles.length === 0) return;

        // Filter by extension if needed (simple check)
        const validFiles = newFiles.filter(f => f.toLowerCase().endsWith('.mov'));
        if (validFiles.length < newFiles.length) {
             showAlert('提示', `部分文件已忽略，仅支持 MOV 格式`);
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
        { name: 'MOV Videos', extensions: ['mov'] }
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
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (activeFile === fileToRemove) {
      setActiveFile(selectedFiles.length > 1 ? selectedFiles[index === 0 ? 1 : 0] : null);
    }
  };

  const handleSetGlobalPath = async () => {
    if (api.isAvailable()) {
      const path = await api.openDirectoryDialog();
      if (path) {
        setGlobalPath(path);
        setLastOutputDir(path);
      }
    } else {
      showAlert('提示', '在 Web 模式下无法选择目录');
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
      showAlert('提示', '请先选择 MOV 文件');
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

          const fileInfo = fileInfos[file];
          if (fileInfo && fileInfo.audio_tracks_count === 0) {
              showAlert('提示', `文件 ${file.split(/[\\/]/).pop()} 没有音轨，无法转换为音频格式。`);
              const finished = index + 1;
              setConvertCount({ current: finished, total: selectedFiles.length });
              continue;
          }

          currentFileRef.current = file;
          currentTargetsRef.current = null;

          const settings = fileSettings[file] || {};
          const key = typeof file === 'string' ? file : file.path;
          const outputDir = customPaths[key] || globalPath || lastOutputDir;

          processedCount++;
          const result = await api.convert('convert-mov-to-mp3', {
            sourcePath: file,
            outputDir: outputDir,
            params: {
              audioBitrate,
              audioTrack,
              startTime: settings.startTime,
              endTime: settings.endTime,
              audioSampleRate: enableCustomAudio ? audioSampleRate : null,
              audioChannels: enableCustomAudio ? audioChannels : null
            }
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
            if (result.error === 'Cancelled') break;
            applyConversionNotificationRule({
              scene: ConversionScenario.ERROR_SINGLE,
              ui: { showAlert },
              data: {
                filePath: file,
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
      }
    } catch (error) {
      console.error('Conversion failed:', error);
      if (error.message !== 'Cancelled' && !isCancelledRef.current) {
        applyConversionNotificationRule({
          scene: ConversionScenario.ERROR_SINGLE,
          ui: { showAlert },
          data: {
            customTitle: '错误',
            customMessage: '转换过程中发生错误: ' + error.message,
            errorMessage: '转换过程中发生错误: ' + error.message,
            onConfirm: () => {
              setConvertProgress(0);
              setConvertCount({ current: 0, total: 0 });
            },
            onClose: handleAlertOnlyClose
          }
        });
      }
    } finally {
      if (api.isAvailable()) {
        setIsConverting(false);
      }
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setFileInfos({});
    setFileSettings({});
    setActiveFile(null);
    setCustomPaths({});
    setResults({});
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    isCancelledRef.current = true;
    setIsCancelModalOpen(false);
    
    let targetPath = null;
    if (Array.isArray(currentTargetsRef.current) && currentTargetsRef.current.length > 0) {
      targetPath = currentTargetsRef.current;
    }
    if (!targetPath && currentFileRef.current) {
      const key = typeof currentFileRef.current === 'string' ? currentFileRef.current : currentFileRef.current.path;
      const outputDir = customPaths[key] || globalPath || lastOutputDir;
      if (outputDir) {
        const pathParts = key.split(/[\\/]/);
        const filenameWithExt = pathParts[pathParts.length - 1];
        const filename = filenameWithExt.replace(/\.[^/.]+$/, '');
        const sep = key.includes('\\') ? '\\' : '/';
        targetPath = `${outputDir}${sep}${filename}.mp3`;
      }
    }

    if (api.isAvailable()) {
      try {
        await api.cancelConversion(targetPath ? { targetPath } : undefined);
      } catch (error) {
        console.error('Cancel failed:', error);
      }
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

  return (
    <div style={{ width: '100%', position: 'relative', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '16px', padding: '0 40px', marginTop: '12px' }}>
        <div className="tool-breadcrumbs">
          <a onClick={onBack}>MOV 转换器</a>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>/</span>
            <span className="current">MOV To MP3</span>
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>MOV To MP3 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>—— 专业级 MOV 转 MP3 工具，支持批量提取音频和高质量输出。</div>
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
                onSetGlobalPath={handleSetGlobalPath}
                onSetCustomPath={handleSetCustomPath}
                onPreview={handlePreview}
                activeFile={activeFile}
                onSelectFile={setActiveFile}
                onDropFiles={(files) => processFiles(files.map(f => f.path))}
                showAudioInfo={true}
                uploadPlaceholder="将您的MOV文件拖拽到此处"
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

              <LocalSettingSelect 
                label="固定比特率"
                value={audioBitrate}
                options={[
                  { label: '96 kbps', value: '96k' },
                  { label: '128 kbps', value: '128k' },
                  { label: '192 kbps', value: '192k' },
                  { label: '256 kbps', value: '256k' },
                  { label: '320 kbps', value: '320k' },
                ]}
                onChange={setAudioBitrate}
                disabled={isConverting}
              />

              <LocalSettingSelect 
                label="选择音轨"
                value={audioTrack}
                options={(() => {
                  const info = activeFile ? fileInfos[activeFile] : null;
                  const trackCount = info?.audio_tracks_count || 1;
                  return Array.from({ length: trackCount }, (_, i) => ({
                    label: `音轨 ${i + 1}`,
                    value: i
                  }));
                })()}
                onChange={(val) => setAudioTrack(Number(val))}
                disabled={isConverting}
              />

              <SettingCheckbox 
                label="自定义采样率和声道"
                checked={enableCustomAudio}
                onChange={setEnableCustomAudio}
              />
              {enableCustomAudio && (
                <>
                  <LocalSettingSelect 
                    label="采样率"
                    value={audioSampleRate}
                    options={[
                      { label: '44100 Hz', value: '44100' },
                      { label: '48000 Hz', value: '48000' },
                      { label: '32000 Hz', value: '32000' },
                      { label: '22050 Hz', value: '22050' },
                    ]}
                    onChange={setAudioSampleRate}
                    disabled={isConverting}
                  />
                  <LocalSettingSelect 
                    label="声道"
                    value={audioChannels}
                    options={[
                      { label: '立体声 (Stereo)', value: '2' },
                      { label: '单声道 (Mono)', value: '1' },
                    ]}
                    onChange={setAudioChannels}
                    disabled={isConverting}
                  />
                </>
              )}
            </SettingsPanel>
          </div>
        </div>
      </div>

      <VideoPreviewModal 
        key={`${typeof previewFile === 'string' ? previewFile : (previewFile?.name ?? '')}-${previewInfo?.duration ?? ''}`}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
        videoInfo={previewInfo}
        initialSettings={previewFile ? fileSettings[previewFile] : null}
        onConfirm={handleCropConfirm}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={handleCloseAlert}
        onClose={handleAlertOnlyClose}
        buttonText={alertModal.buttonText}
      />

      <ConfirmationModal
        isOpen={isCancelModalOpen}
        title="确认取消"
        message="是否取消转换？"
        confirmText="是"
        cancelText="否"
        onConfirm={handleCancelConfirm}
        onCancel={() => setIsCancelModalOpen(false)}
      />
    </div>
  );
};

export default MOVToMP3GUI;
