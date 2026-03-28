﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
import { 
  FileUploader, 
  ActionBar,
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal,
  SettingsPanel,
  SettingSlider,
  SettingPresets,
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const LocalSettingSelect = ({ label, value, options, onChange, disabled }) => {
  return (
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
        {options.map((opt, index) => (
          <option 
            key={index} 
            value={typeof opt === 'object' ? opt.value : opt}
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)'
            }}
          >
            {typeof opt === 'object' ? opt.label : opt}
          </option>
        ))}
      </select>
    </div>
  );
};

const PRESET_CONFIGS = {
  '低质量': { quality: 40, audioBitrate: '96k', resolution: '854:480', useVBR: true },
  '中等质量': { quality: 70, audioBitrate: '128k', resolution: '1280:720', useVBR: true },
  '高质量': { quality: 90, audioBitrate: '320k', resolution: '1920:1080', useVBR: true },
  '社交媒体': { quality: 80, audioBitrate: '192k', resolution: '1080:1920', useVBR: true }
};

const WEBMToAVIGUI = ({ onBack }) => {
  const navigate = useNavigate();
  const breadcrumbItems = [
    { label: 'WEBM 转换器', onClick: onBack },
    { label: 'WEBM To AVI' }
  ];
  // State for settings
  const [quality, setQuality] = useState(70);
  const [audioBitrate, setAudioBitrate] = useState('128k');
  const [resolution, setResolution] = useState('original');
  const [preset, setPreset] = useState('中等质量');
  
  // Advanced Compression
  const [useVBR, setUseVBR] = useState(true);
  const [videoBitrate, setVideoBitrate] = useState('2000k');
  const [keyframeInterval, setKeyframeInterval] = useState(24);
  const [audioSampleRate, setAudioSampleRate] = useState('44100');
  const [audioChannels, setAudioChannels] = useState('2');
  const [audioTrack, setAudioTrack] = useState(0);
  
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
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);

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

  const handleAlertOnlyClose = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
  };

  const handleCloseAlert = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
    if (alertModal.onConfirm) {
      alertModal.onConfirm();
    }
  };

  const handleSetGlobalPath = async () => {
    if (api.isAvailable()) {
      const path = await api.openDirectoryDialog();
      if (path) setGlobalPath(path);
    } else {
      showAlert('提示', 'Web 模式下无法选择目录');
    }
  };

  const handleSetCustomPath = async (file) => {
    if (api.isAvailable()) {
      const path = await api.openDirectoryDialog();
      if (path) {
        setCustomPaths(prev => ({ ...prev, [file]: path }));
      }
    } else {
      showAlert('提示', 'Web 模式下无法选择目录');
    }
  };

  const isCancelledRef = useRef(false);
  const currentFileIndexRef = useRef(0);
  const currentFileRef = useRef(null);
  const currentTargetsRef = useRef(null);

  useEffect(() => {
      if (!api.isAvailable()) return;
      
      const handleProgress = (data) => {
          if (data && data.type === 'output') {
              if (Array.isArray(data.targets) && data.targets.length > 0) {
                  currentTargetsRef.current = data.targets;
              } else if (data.output) {
                  currentTargetsRef.current = [data.output];
              }

              // Update per-file result
              if (data.output && currentFileRef.current) {
                  setResults(prev => ({
                      ...prev,
                      [currentFileRef.current]: data.output
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

  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
        console.error('无法获取视频信息:', error);
      }
    }
  };

  const handleCropConfirm = (settings) => {
      const filePath = typeof previewFile === 'string' ? previewFile : previewFile.path;
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
      if (config.quality !== undefined) setQuality(config.quality);
      if (config.audioBitrate !== undefined) setAudioBitrate(config.audioBitrate);
      if (config.resolution !== undefined) setResolution(config.resolution);

      // Reset advanced settings when applying a preset
      setUseVBR(true);
      setKeyframeInterval(24);
      setAudioSampleRate('44100');
      setAudioChannels('2');

      if (config.useVBR !== undefined) setUseVBR(config.useVBR);
    }
  };

  const handleSettingChange = (setter, value) => {
    setter(value);
    setPreset('');
  };

  const processFiles = async (files) => {
    if (files && files.length > 0) {
      const newFiles = files.filter(f => !selectedFiles.includes(f));
      if (newFiles.length === 0) return;

      // 验证文件扩展名
      const validFiles = newFiles.filter(f => f.toLowerCase().endsWith('.webm'));

      if (validFiles.length < newFiles.length) {
        showAlert('提示', `部分文件已忽略，仅支持 WEBM 格式`);
      }

      if (validFiles.length === 0) return;

      setSelectedFiles(prev => [...prev, ...validFiles]);
      if (!activeFile) setActiveFile(validFiles[0]);

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
          console.error('无法获取文件信息:', file, error);
        }
      }
    }
  };

  const handleFileSelect = async () => {
    if (api.isAvailable()) {
        const files = await api.openFileDialog([
            { name: 'WEBM 视频', extensions: ['webm'] }
        ]);
        if (files && files.length > 0) {
            await processFiles(files);
        }
    } else {
        document.getElementById('file-input').click();
    }
  };
    
  const handleWebFileChange = (e) => {
      const newFiles = Array.from(e.target.files).map(f => f.name);
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

  const handleConvert = async () => {
    if (selectedFiles.length === 0) {
      showAlert('提示', '请先选择文件');
      return;
    }

    const missingPath = selectedFiles.some(file => {
      return !customPaths[file] && !globalPath && !lastOutputDir;
    });

    if (api.isElectron() && missingPath) {
      showAlert('提示', '请设置输出路径（全局或自定义）');
      return;
    }

    isCancelledRef.current = false;
    setConvertProgress(0);
    setConvertCount({ current: 0, total: selectedFiles.length });
    setResults({});

    setIsConverting(true);
    try {
        if (api.isAvailable()) {
            for (let index = 0; index < selectedFiles.length; index++) {
                if (isCancelledRef.current) break;

                currentFileIndexRef.current = index;
                const file = selectedFiles[index];
                currentFileRef.current = file;
                currentTargetsRef.current = null;
                
                const settings = fileSettings[file] || {};
                const outputDir = customPaths[file] || globalPath || lastOutputDir;
                
                const result = await api.convert('convert-webm-to-avi', {
                  sourcePath: file,
                  outputDir: outputDir,
                  params: {
                    quality,
                    audioBitrate,
                    resolution,
                    audioTrack,
                    startTime: settings.startTime,
                    endTime: settings.endTime,
                    useVBR,
                    videoBitrate: useVBR ? null : videoBitrate,
                    keyframeInterval,
                    audioSampleRate,
                    audioChannels
                  }
                });
                
                if (isCancelledRef.current) break;

                if (!result.success) {
                    if (result.error === 'Cancelled') break;
                    applyConversionNotificationRule({
                      scene: ConversionScenario.ERROR_SINGLE,
                      ui: { showAlert },
                      data: {
                        filePath: file,
                        errorMessage: result.error || result.message
                      }
                    });
                    break;
                }
                const finished = index + 1;
                setConvertCount({ current: finished, total: selectedFiles.length });
            }
            
            if (!isCancelledRef.current) {
                setConvertProgress(100);
                setTimeout(() => {
                  applyConversionNotificationRule({
                    scene: ConversionScenario.SUCCESS_BATCH_ALL,
                    ui: { showAlert },
                    data: {
                      customTitle: '完成',
                      customMessage: '所有任务处理完成！',
                      buttonText: '确定',
                      onClose: handleAlertOnlyClose,
                      totalCount: selectedFiles.length,
                      finishedCount: selectedFiles.length
                    }
                  });
                }, 100);
            }
        }
    } catch (error) {
        console.error('转换失败:', error);
        if (error.message !== 'Cancelled' && !isCancelledRef.current) {
            applyConversionNotificationRule({
              scene: ConversionScenario.ERROR_SINGLE,
              ui: { showAlert },
              data: {
                errorMessage: '转换过程中发生错误: ' + error.message,
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
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const currentVideoInfo = activeFile ? fileInfos[typeof activeFile === 'string' ? activeFile : activeFile.path] : null;
  const trackCount = currentVideoInfo?.audio_tracks_count || 1;

  const handleCancelConfirm = async () => {
    isCancelledRef.current = true;
    setIsCancelModalOpen(false);
    
    if (api.isAvailable()) {
      // Prioritize backend targets
      const targets = currentTargetsRef.current;
      
      // Fallback logic
      let fallbackPath = null;
      if (currentFileRef.current) {
          const fileName = currentFileRef.current.split(/[/\\]/).pop().split('.')[0];
          // Use outputDir logic: custom > global > default(lastOutputDir)
          const outputDir = customPaths[currentFileRef.current] || globalPath || lastOutputDir;
          if (outputDir) {
             // Assuming .avi extension for this tool
             fallbackPath = `${outputDir}/${fileName}.avi`;
          }
      }
      
      try {
        await api.cancelConversion({
          targets,
          targetPath: fallbackPath 
        });
        applyConversionNotificationRule({
          scene: ConversionScenario.CANCELLED_USER,
          ui: { showAlert },
          data: {
            customTitle: '已取消',
            customMessage: '已取消转换并删除未完成文件',
            buttonText: '确定',
            onClose: handleAlertOnlyClose
          }
        });
      } catch (error) {
        console.error('取消失败:', error);
      }
    }

    setIsConverting(false);
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
  };

  return (
    <div style={{ width: '100%', position: 'relative', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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
               <ArrowLeft size={20} />
             </div>
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>WEBM To AVI 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px' }}>专业级 WEBM 转 AVI 工具，支持批量转换和高质量输出。</div>
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
                onPreview={handlePreview}
                activeFile={activeFile}
                onSelectFile={setActiveFile}
                showAudioInfo={true}
                uploadPlaceholder="将您的 WEBM 文件拖拽到此处"
                globalPath={globalPath}
                onSetGlobalPath={handleSetGlobalPath}
                customPaths={customPaths}
                onSetCustomPath={handleSetCustomPath}
                results={results}
                onDropFiles={(files) => processFiles(files.map(f => f.path))}
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
                disabled={isConverting}
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
                disabled={isConverting}
              />
              <LocalSettingSelect 
                label="分辨率" 
                value={resolution} 
                options={[
                  { label: '原视频分辨率', value: 'original' },
                  { label: '1920x1080 (1080p)', value: '1920:1080' },
                  { label: '1280x720 (720p)', value: '1280:720' },
                  { label: '854x480 (480p)', value: '854:480' },
                  { label: '640x360 (360p)', value: '640:360' },
                ]}
                onChange={(v) => handleSettingChange(setResolution, v)}
                disabled={isConverting}
              />
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
                onChange={(v) => handleSettingChange(setAudioBitrate, v)}
                disabled={isConverting}
              />
              <LocalSettingSelect 
                label="选择音轨" 
                value={audioTrack} 
                options={Array.from({ length: trackCount }, (_, i) => ({
                  label: `音轨 ${i + 1} ${i === 0 ? '(默认)' : ''}`,
                  value: i
                }))}
                onChange={(v) => setAudioTrack(Number(v))}
                disabled={isConverting}
              />

              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => setShowAdvancedModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--bg-color)';
                    e.currentTarget.style.color = 'var(--primary-color)';
                    e.currentTarget.style.borderColor = 'var(--primary-color)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  高级设置
                </button>
              </div>
            </SettingsPanel>
          </div>
        </div>
      </div>

      <VideoPreviewModal 
        key={`${typeof previewFile === 'string' ? previewFile : (previewFile?.path ?? '')}-${previewInfo?.duration ?? ''}`}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
        videoInfo={previewInfo}
        initialSettings={previewFile ? (fileSettings[typeof previewFile === 'string' ? previewFile : previewFile.path] || null) : null}
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

      {/* 高级设置弹窗 */}
      <div className={`modal-overlay ${showAdvancedModal ? 'show' : ''}`} onClick={() => setShowAdvancedModal(false)} style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: showAdvancedModal ? 'flex' : 'none',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '8vh',
        zIndex: 2000,
        backdropFilter: 'blur(4px)'
      }}>
        <div className="confirm-modal" onClick={e => e.stopPropagation()} style={{ 
          width: '600px', 
          maxWidth: '90vw',
          background: 'var(--card-bg)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'visible',
          border: '1px solid var(--border-color)'
        }}>
          <div className="confirm-header" style={{ 
            padding: '20px 24px', 
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px', 
                background: 'var(--bg-color)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--primary-color)'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </div>
              <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>高级编码参数</span>
            </div>
            <button onClick={() => setShowAdvancedModal(false)} style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              padding: '4px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div className="confirm-body" style={{ padding: '24px', background: 'var(--card-bg)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              {/* Column 1: Video Compression */}
              <div className="setting-group">
                <div className="setting-header" style={{ marginBottom: '16px' }}>
                  <span className="setting-label" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>视频压缩模式</span>
                </div>
                <div className="mode-toggle-group" style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--bg-color)', padding: '4px', borderRadius: '8px' }}>
                  <button 
                    className={`mode-toggle-btn ${useVBR ? 'active' : ''}`}
                    onClick={() => handleSettingChange(setUseVBR, true)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: '6px',
                      border: 'none',
                      background: useVBR ? 'var(--card-bg)' : 'transparent',
                      boxShadow: useVBR ? 'var(--shadow-sm)' : 'none',
                      color: useVBR ? 'var(--primary-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: useVBR ? '600' : '400',
                      transition: 'all 0.2s'
                    }}
                  >
                    动态码率 (VBR)
                  </button>
                  <button 
                    className={`mode-toggle-btn ${!useVBR ? 'active' : ''}`}
                    onClick={() => handleSettingChange(setUseVBR, false)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: '6px',
                      border: 'none',
                      background: !useVBR ? 'var(--card-bg)' : 'transparent',
                      boxShadow: !useVBR ? 'var(--shadow-sm)' : 'none',
                      color: !useVBR ? 'var(--primary-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: !useVBR ? '600' : '400',
                      transition: 'all 0.2s'
                    }}
                  >
                    固定码率 (CBR)
                  </button>
                </div>
                <div className="compression-mode-content" style={{ minHeight: '80px' }}>
                  {useVBR ? (
                    <SettingSlider 
                      label="质量" 
                      value={quality} 
                      min={1} 
                      max={100} 
                      step={1}
                      unit="%"
                      onChange={(v) => handleSettingChange(setQuality, v)}
                    />
                  ) : (
                    <div className="setting-sub-item">
                      <div className="setting-sub-label" style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text-secondary)' }}>目标视频码率</div>
                      <select
                        className="custom-select"
                        style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                        value={videoBitrate}
                        onChange={(e) => {
                          setVideoBitrate(e.target.value);
                          setPreset('');
                        }}
                      >
                        <option value="1000k">1000k (低质量)</option>
                        <option value="2000k">2000k (中等质量)</option>
                        <option value="4000k">4000k (高质量)</option>
                        <option value="6000k">6000k (超清)</option>
                        <option value="8000k">8000k (极清)</option>
                        <option value="12000k">12000k (4K级别)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Keyframe & Audio */}
              <div className="setting-group" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div className="setting-header" style={{ marginBottom: '16px' }}>
                    <span className="setting-label" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>关键帧与音频控制</span>
                  </div>
                  
                  <div className="keyframe-setting-content">
                    <SettingSlider 
                      label="关键帧间隔 (帧)" 
                      value={keyframeInterval} 
                      min={1} 
                      max={250} 
                      step={1}
                      unit=""
                      onChange={(v) => handleSettingChange(setKeyframeInterval, v)}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div className="audio-setting-content">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="setting-sub-item">
                        <div className="setting-sub-label" style={{ fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>音频采样率</div>
                        <select
                          className="custom-select"
                          style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '13px' }}
                          value={audioSampleRate}
                          onChange={(e) => handleSettingChange(setAudioSampleRate, e.target.value)}
                        >
                          <option value="44100">44.1 kHz</option>
                          <option value="48000">48.0 kHz</option>
                          <option value="32000">32.0 kHz</option>
                        </select>
                      </div>
                      <div className="setting-sub-item">
                        <div className="setting-sub-label" style={{ fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>声道配置</div>
                        <select
                          className="custom-select"
                          style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '13px' }}
                          value={audioChannels}
                          onChange={(e) => handleSettingChange(setAudioChannels, e.target.value)}
                        >
                          <option value="2">立体声 (2.0)</option>
                          <option value="1">单声道 (1.0)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="confirm-footer" style={{ 
            padding: '16px 24px', 
            borderTop: '1px solid var(--border-color)', 
            display: 'flex', 
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'var(--bg-color)'
          }}>
            <button 
              onClick={() => setShowAdvancedModal(false)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button 
              onClick={() => setShowAdvancedModal(false)}
              style={{
                padding: '8px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary-color)',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              应用配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WEBMToAVIGUI;

