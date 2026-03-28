﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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

const MP4ToGIFGUI = ({ onBack }) => {
  const navigate = useNavigate();
  // State for settings
  const [quality, setQuality] = useState(90);
  const [fps, setFps] = useState(24);
  const [interval, setInterval] = useState(100);
  const [preset, setPreset] = useState('高质量');
  const [selectedFiles, setSelectedFiles] = useState([]);
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

  // Alert Modal state
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

  // Preview state
  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handlePresetSelect = (p) => {
    setPreset(p);
    switch(p) {
      case '低质量':
        setQuality(40);
        setFps(10);
        setInterval(50);
        break;
      case '中等质量':
        setQuality(70);
        setFps(15);
        setInterval(100);
        break;
      case '高质量':
        setQuality(90);
        setFps(24);
        setInterval(100);
        break;
      case '社交媒体':
        setQuality(80);
        setFps(20);
        setInterval(100);
        break;
      default:
        break;
    }
  };

  // Handlers
  const handlePreview = async (file) => {
    const filePath = typeof file === 'string' ? file : file.path;
    setPreviewFile(filePath);
    setIsPreviewOpen(true);
    setPreviewInfo(null);

    if (api.isAvailable() && filePath) {
      try {
        const result = await api.getVideoInfo(filePath);
        if (result.success) {
          setPreviewInfo(result.info);
        } else {
          console.error('Failed to get video info:', result.message);
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
              [filePath]: settings
          }));
      }
  };

  const processFiles = async (files) => {
    if (files && files.length > 0) {
      const newFiles = files.filter(f => !selectedFiles.includes(f));
      if (newFiles.length === 0) return;
      const validFiles = newFiles.filter(f => f.toLowerCase().endsWith('.mp4'));
      if (validFiles.length < newFiles.length) {
        showAlert('提示', `部分文件已忽略，仅支持 MP4 格式`);
      }
      if (validFiles.length === 0) return;
      
      setSelectedFiles(prev => [...prev, ...validFiles]);

      for (const file of validFiles) {
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
  };

  const handleFileSelect = async (newFiles) => {
    let filesToProcess = [];
    if (newFiles && Array.isArray(newFiles) && newFiles.length > 0) {
      filesToProcess = newFiles;
    } else if (api.isAvailable()) {
      const files = await api.openFileDialog([
        { name: 'MP4 Videos', extensions: ['mp4'] }
      ]);
      if (files && files.length > 0) {
        filesToProcess = files;
      }
    } else {
      document.getElementById('file-input').click();
      return;
    }
    await processFiles(filesToProcess);
  };
    
  const handleWebFileChange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        handleFileSelect(files);
      }
  };

  const handleRemoveFile = (index) => {
      const fileToRemove = selectedFiles[index];
      const path = typeof fileToRemove === 'string' ? fileToRemove : fileToRemove.path;
      
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
      setFileInfos(prev => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      setResults(prev => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
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

    try {
        if (api.isAvailable()) {
            for (let index = 0; index < selectedFiles.length; index++) {
                if (isCancelledRef.current) break;

                currentFileIndexRef.current = index;
                const file = selectedFiles[index];
                const path = typeof file === 'string' ? file : file.path;
                currentFileRef.current = path;
                currentTargetsRef.current = null;
                
                const outputDir = customPaths[path] || globalPath || lastOutputDir;
                const cropSettings = fileSettings[path] || {};
                
                const result = await api.convert('convert-mp4-to-gif', {
                    sourcePath: path,
                    outputDir: outputDir,
                    params: { 
                        quality, 
                        fps, 
                        interval,
                        startTime: cropSettings.startTime,
                        endTime: cropSettings.endTime
                    }
                });
                
                if (isCancelledRef.current) break;

                if (result.success) {
                    successCount++;
                    if (result.outputPath || result.output) {
                      const out = result.outputPath || result.output;
                      setResults(prev => ({
                        ...prev,
                        [path]: out
                      }));
                    }
                } else {
                    failCount++;
                    if (result.error === 'Cancelled') break;
                    applyConversionNotificationRule({
                      scene: ConversionScenario.ERROR_SINGLE,
                      ui: { showAlert },
                      data: {
                        filePath: path,
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
                   const msg = failCount > 0 
                     ? `处理完成！成功: ${successCount} 个，失败: ${failCount} 个。`
                     : `成功转换 ${successCount} 个文件！`;
                   
                   applyConversionNotificationRule({
                     scene: ConversionScenario.SUCCESS_BATCH_ALL,
                     ui: { showAlert },
                     data: {
                       customTitle: '完成',
                       customMessage: msg,
                       buttonText: '确定',
                       onConfirm: () => {
                         setConvertProgress(0);
                         setConvertCount({ current: 0, total: 0 });
                       },
                       onClose: handleAlertOnlyClose,
                       totalCount: selectedFiles.length,
                       finishedCount: successCount
                     }
                   });
                }, 100);
            }
        }
    } catch (error) {
        console.error('Conversion failed:', error);
        if (error.message !== 'Cancelled' && !isCancelledRef.current) {
            showAlert('错误', '转换过程中发生错误: ' + error.message, () => {
                setAlertModal(prev => ({ ...prev, isOpen: false }));
                setConvertProgress(0);
                setConvertCount({ current: 0, total: 0 });
            });
        }
    } finally {
        setIsConverting(false);
        setConvertProgress(0);
        currentTargetsRef.current = null;
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setFileInfos({});
    setFileSettings({});
    setResults({});
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    isCancelledRef.current = true;
    setIsConverting(false);
    setIsCancelModalOpen(false);
    setConvertProgress(0);
    
    let targetPath = null;
    if (Array.isArray(currentTargetsRef.current) && currentTargetsRef.current.length > 0) {
      targetPath = currentTargetsRef.current;
    } else if (currentFileRef.current) {
      const key = currentFileRef.current;
      const outputDir = customPaths[key] || globalPath || lastOutputDir;
      
      if (key && outputDir) {
        const pathParts = key.split(/[\\/]/);
        const filenameWithExt = pathParts[pathParts.length - 1];
        const filename = filenameWithExt.replace(/\.[^/.]+$/, "");
        const sep = key.includes('\\') ? '\\' : '/';
        targetPath = `${outputDir}${sep}${filename}.gif`;
      }
    }

    if (api.isAvailable()) {
      try {
        const result = await api.cancelConversion(targetPath ? { targetPath } : undefined);
        if (result.success) {
          applyConversionNotificationRule({
            scene: ConversionScenario.CANCELLED_USER,
            ui: { showAlert },
            data: {
              customTitle: '已取消',
              customMessage: '转换任务已取消，相关文件已清理。',
              buttonText: '确定'
            }
          });
        }
      } catch (error) {
        console.error('Cancel failed:', error);
      }
    }
    setConvertCount({ current: 0, total: 0 });
  };

  return (
    <div style={{ width: '100%', position: 'relative', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      <div style={{ marginBottom: '16px', padding: '0 40px', marginTop: '12px' }}>
        <div className="tool-breadcrumbs">
          <a onClick={onBack}>MP4 转换器</a>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>/</span>
            <span className="current">MP4 To GIF</span>
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>MP4 To GIF 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>—— 将 MP4 视频转换为高质量 GIF 动图，支持自定义质量、帧率和时间范围。</div>
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
                activeFile={selectedFiles[0]}
                onSelectFile={() => {}}
                onDropFiles={(files) => processFiles(files.map(f => f.path))}
                showAudioInfo={false}
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
              <SettingSlider 
                label="帧率" 
                value={fps} 
                unit=" FPS" 
                min={1} 
                max={60} 
                step={1}
                onChange={(val) => {
                  setFps(val);
                  setPreset('自定义');
                }}
              />
              <SettingSlider 
                label="提取密度" 
                value={interval} 
                unit="" 
                min={1} 
                max={100} 
                step={1}
                onChange={(val) => {
                  setInterval(val);
                  setPreset('自定义');
                }}
                valueDisplay={`提取原视频的 ${interval}% 帧`}
              />
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

export default MP4ToGIFGUI;
