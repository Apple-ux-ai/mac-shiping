import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { 
  ActionBar,
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal,
  SettingsPanel,
  SettingPresets
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import WAVParamConfig from '../../components/converter/WAVParamConfig';
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
  { label: '320 kbps', value: '320k' }
];

const WEBMToWAVGUI = ({ onBack }) => {
  const navigate = useNavigate();
  const [audioBitrate, setAudioBitrate] = useState('128k');
  const [audioTrack, setAudioTrack] = useState(0);
  const [preset, setPreset] = useState('默认');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileInfos, setFileInfos] = useState({});
  const [activeFile, setActiveFile] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [lastOutputDir, setLastOutputDir] = useState(null);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertCount, setConvertCount] = useState({ current: 0, total: 0 });
  const [fileSettings, setFileSettings] = useState({});
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
    if (config && config.audioBitrate !== undefined) {
      setAudioBitrate(config.audioBitrate);
    }
  };

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
    setPreviewFile(file);
    setIsPreviewOpen(true);
    setPreviewInfo(null);

    if (api.isAvailable() && typeof file === 'string') {
      try {
        const result = await api.getVideoInfo(file);
        if (result.success) {
          setPreviewInfo(result.info);
        } else {
          console.error('获取视频信息失败:', result.message);
        }
      } catch (error) {
        console.error('获取视频信息失败:', error);
      }
    }
  };

  const handleCropConfirm = (settings) => {
      if (previewFile && typeof previewFile === 'string') {
          setFileSettings(prev => ({
              ...prev,
              [previewFile]: {
                ...(prev[previewFile] || {}),
                ...settings
              }
          }));
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
          console.error('获取文件信息失败:', file, error);
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
      if (!activeFile) setActiveFile(newFiles[0]);
  };

  const handleRemoveFile = (index) => {
      const fileToRemove = selectedFiles[index];
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
      if (activeFile === fileToRemove) {
        setActiveFile(selectedFiles[index + 1] || selectedFiles[index - 1] || null);
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
                
                const cropSettings = fileSettings[file] || {};
                const outputDir = customPaths[file] || globalPath || lastOutputDir;
                
                processedCount++;
                const result = await api.convert('convert-webm-to-wav', {
                    sourcePath: file,
                    outputDir: outputDir,
                    params: { 
                        audioBitrate, 
                        audioTrack: cropSettings.audioTrack !== undefined ? cropSettings.audioTrack : audioTrack,
                        startTime: cropSettings.startTime,
                        endTime: cropSettings.endTime
                    }
                });
                
                if (isCancelledRef.current) break;

                if (result.success) {
                    successCount++;
                    console.log('转换成功:', result);
                } else {
                    failCount++;
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
    setActiveFile(null);
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setResults({});
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

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
             fallbackPath = `${outputDir}/${fileName}.wav`;
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
            customMessage: '已取消转换并删除本地文件',
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

  const breadcrumbItems = [
     { label: 'WEBM 转换器', onClick: onBack },
     { label: 'WEBM To WAV' }
   ];

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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>WEBM To WAV 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px' }}>从 WEBM 视频中提取无损 WAV 音频，支持批量转换和音频设置。</div>
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
                presets={presets}
                currentPreset={preset}
                onSelect={handlePresetSelect}
                columns={2}
                disabled={isConverting}
              />

              <LocalSettingSelect 
                label="音频比特率 (kbps)" 
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

              <div className="setting-info-box" style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                提示：WAV 格式通常存储为无损 PCM 音频，提供最高保真度，完美还原原始音质。
              </div>
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
        message="是否取消转换并删除本地文件？"
        confirmText="是"
        cancelText="否"
        onConfirm={handleCancelConfirm}
        onCancel={() => setIsCancelModalOpen(false)}
      />
    </div>
  );
};

export default WEBMToWAVGUI;
