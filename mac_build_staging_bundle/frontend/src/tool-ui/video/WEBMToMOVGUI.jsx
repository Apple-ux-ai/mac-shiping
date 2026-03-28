import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { 
  ToolLayout, 
  FileUploader, 
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
  '低质量': { quality: 40, audioBitrate: '96k', resolution: '640x360' },
  '中等质量': { quality: 70, audioBitrate: '128k', resolution: 'original' },
  '高质量': { quality: 90, audioBitrate: '320k', resolution: '1920x1080' },
  '社交媒体': { quality: 80, audioBitrate: '192k', resolution: '1080x1920' }
};

const WEBMToMOVGUI = ({ onBack }) => {
  const navigate = useNavigate();
  // 设置状态（与“中等质量”预设保持一致）
  const [quality, setQuality] = useState(70);
  const [audioBitrate, setAudioBitrate] = useState('128k');
  const [resolution, setResolution] = useState('original');
  const [preset, setPreset] = useState('中等质量');
  
  const [audioTrack, setAudioTrack] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileInfos, setFileInfos] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [lastOutputDir, setLastOutputDir] = useState(null);
  
  // Path management
  const [globalPath, setGlobalPath] = useState(api.isElectron() ? '' : 'browser-downloads');
  const [customPaths, setCustomPaths] = useState({});
  const [results, setResults] = useState({});

  const [convertProgress, setConvertProgress] = useState(0);
  const [convertCount, setConvertCount] = useState({ current: 0, total: 0 });
  const [fileSettings, setFileSettings] = useState({}); // { [filePath]: { startTime, endTime, quality, audioBitrate, resolution } }
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // 提示框状态
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    onClose: null,
    buttonText: '确定'
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
  
  // Path management handlers
  const handleSetGlobalPath = async () => {
    if (api.isAvailable()) {
      const path = await api.openDirectoryDialog();
      if (path) setGlobalPath(path);
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

  const isCancelledRef = useRef(false);
  const currentFileIndexRef = useRef(0);
  const currentFileRef = useRef(null);
  const currentTargetsRef = useRef(null);

  const currentVideoInfo = activeFile ? fileInfos[activeFile] : null;
  const trackCount = currentVideoInfo?.audio_tracks_count || 1;

  // 设置进度监听器
  useEffect(() => {
      if (!api.isAvailable()) return;
      
      const handleProgress = (data) => {
          if (data && data.type === 'output') {
              if (Array.isArray(data.targets) && data.targets.length > 0) {
                  currentTargetsRef.current = data.targets;
              } else if (data.output) {
                  currentTargetsRef.current = [data.output];
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

  // 预览状态
  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // 处理器
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
      setQuality(config.quality);
      setAudioBitrate(config.audioBitrate);
      setResolution(config.resolution);
    }
  };

  const processFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    // Filter for .webm files
    const validFiles = files.filter(file => {
      const ext = file.toLowerCase().split('.').pop();
      return ext === 'webm';
    });

    if (validFiles.length < files.length) {
      showAlert('提示', '部分文件已忽略，仅支持 WEBM 格式');
    }

    if (validFiles.length === 0) return;

    const newFiles = validFiles.filter(f => !selectedFiles.includes(f));
    if (newFiles.length === 0) return;

    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (!activeFile) setActiveFile(newFiles[0]);

    if (api.isAvailable()) {
      for (const file of newFiles) {
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

    setIsConverting(true);
    try {
        if (api.isAvailable()) {
            for (let index = 0; index < selectedFiles.length; index++) {
                if (isCancelledRef.current) break;

                currentFileIndexRef.current = index;
                const file = selectedFiles[index];
                const key = typeof file === 'string' ? file : file.path;
                currentFileRef.current = file;
                currentTargetsRef.current = null;
                
                const settings = fileSettings[key] || {};
                const outputDir = customPaths[key] || globalPath || lastOutputDir;
                
                const result = await api.convert('convert-webm-to-mov', {
                  sourcePath: file,
                  outputDir: outputDir,
                  params: { 
                    quality, 
                    audioBitrate,
                    resolution,
                    audioTrack,
                    startTime: settings.startTime,
                    endTime: settings.endTime
                  }
                });
                
                if (isCancelledRef.current) break;

                if (!result.success) {
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

                if (result.outputPath || result.output) {
                    const out = result.outputPath || result.output;
                    setResults(prev => ({
                        ...prev,
                        [key]: out
                    }));
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

  const handleCancelConfirm = async () => {
    isCancelledRef.current = true;
    setIsCancelModalOpen(false);
    
    let targetPaths = currentTargetsRef.current || [];
    if (targetPaths.length === 0 && currentFileRef.current && lastOutputDir) {
      const filename = currentFileRef.current.split(/[\\/]/).pop().replace(/\.[^/.]+$/, '');
      const sep = currentFileRef.current.includes('\\') ? '\\' : '/';
      targetPaths = [`${lastOutputDir}${sep}${filename}.mov`];
    }

    if (api.isAvailable()) {
      try {
        await api.cancelConversion({ targetPath: targetPaths });
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
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{ marginBottom: '16px', padding: '0 40px', marginTop: '12px' }}>
        <div className="tool-breadcrumbs">
           {[
             { label: 'WEBM 转换器', onClick: onBack },
             { label: 'WEBM To MOV' }
           ].map((item, index) => (
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>WEBM To MOV 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px' }}>将 WebM 视频转换为 Apple 设备兼容性更好的 MOV 格式，支持自定义质量、分辨率和音频比特率。</div>
        </div>
      </div>

      <ToolLayout>
        <div className="tool-main">
          <div className="tool-left">
             <FileUploaderV2 
                files={selectedFiles} 
                fileInfos={fileInfos}
                onAddFile={handleFileSelect} 
                onRemoveFile={handleRemoveFile} 
                onPreview={handlePreview}
                activeFile={activeFile}
                onSelectFile={setActiveFile}
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
                id="hidden-file-input" 
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
                label="预设"
                presets={Object.keys(PRESET_CONFIGS)}
                currentPreset={preset}
                onSelect={applyPreset}
                columns={2}
                disabled={isConverting}
              />
              
              <SettingSlider 
                label="视频质量" 
                value={quality} 
                min={1} 
                max={100} 
                step={1}
                unit="%"
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
                  { label: '保持原样', value: 'original' },
                  { label: '1280x720 (HD)', value: '1280x720' },
                  { label: '1920x1080 (FHD)', value: '1920x1080' },
                  { label: '640x360 (SD)', value: '640x360' },
                  { label: '320x180 (LD)', value: '320x180' },
                  { label: '720x1280 (HD) - 9:16', value: '720x1280' },
                  { label: '1080x1920 (FHD) - 9:16', value: '1080x1920' },
                  { label: '360x640 (SD) - 9:16', value: '360x640' },
                  { label: '180x320 (LD) - 9:16', value: '180x320' },
                  { label: '160x128 (AMV)', value: '160x128' },
                  { label: '320x240 (AMV)', value: '320x240' }
                ]}
                onChange={(val) => {
                  setResolution(val);
                  setPreset('自定义');
                }}
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
                onChange={(val) => {
                  setAudioBitrate(val);
                  setPreset('自定义');
                }}
                disabled={isConverting}
              />

              <LocalSettingSelect 
                label="选择音轨"
                value={audioTrack}
                options={Array.from({ length: trackCount }, (_, index) => ({
                  label: `音轨 ${index + 1} ${index === 0 ? '(默认)' : ''}`,
                  value: index
                }))}
                onChange={(val) => {
                  setAudioTrack(Number(val));
                  setPreset('自定义');
                }}
                disabled={isConverting}
              />
            </SettingsPanel>
          </div>
        </div>
      </ToolLayout>

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
    </div>
  );
};

export default WEBMToMOVGUI;
