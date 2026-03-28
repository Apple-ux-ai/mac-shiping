import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  FileUploader, 
  ActionBar,
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal,
  UnifiedToolHeader,
  SettingsPanel,
  SettingSlider,
  SettingPresets
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';

const { Title } = Typography;
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const AVIToJPGUI = ({ onBack }) => {
  const navigate = useNavigate();
  const breadcrumbItems = [
    { label: 'AVI 转换器', onClick: onBack },
    { label: 'AVI To JPG' }
  ];
  // State for settings
  const [quality, setQuality] = useState(90);
  const [fps, setFps] = useState(24);
  const [interval, setInterval] = useState(100);
  const [preset, setPreset] = useState('高质量');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileInfos, setFileInfos] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  
  // Path management state
  const [globalPath, setGlobalPath] = useState(api.isElectron() ? '' : 'browser-downloads');
  const [customPaths, setCustomPaths] = useState({}); // { filePath: customPath }
  const [results, setResults] = useState({}); // { filePath: resultDirPath }
  
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertCount, setConvertCount] = useState({ current: 0, total: 0 });
  const [fileSettings, setFileSettings] = useState({});
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Preset configurations
  const PRESET_CONFIGS = {
    '低质量': { quality: 40, fps: 10, interval: 50 },
    '中等质量': { quality: 70, fps: 15, interval: 100 },
    '高质量': { quality: 90, fps: 24, interval: 100 },
    '社交媒体': { quality: 80, fps: 20, interval: 100 }
  };

  const handlePresetSelect = (presetName) => {
    setPreset(presetName);
    const config = PRESET_CONFIGS[presetName];
    if (config) {
      setQuality(config.quality);
      setFps(config.fps);
      setInterval(config.interval);
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
                  // For JPG sequence, output is a directory usually
                  // Assuming the first item is the folder or representative
                  output = data.outputDir || (data.targets[0] ? data.targets[0].split(/[/\\]/).slice(0, -1).join('/') : null);
              } else if (data.output) {
                  currentTargetsRef.current = [data.output];
                  output = data.output; // Might be file or dir depending on backend
              }
              
              // If we have a current file being processed, record its result
              if (currentFileRef.current && output) {
                   // Ensure we point to the directory containing the images if possible
                   // Backend might return the directory itself for sequence tasks
                   setResults(prev => ({
                       ...prev,
                       [currentFileRef.current]: output
                   }));
              }
              return;
          }
          if (data.percent !== undefined && selectedFiles.length > 0) {
              const currentFilePercent = data.percent;
              const total = selectedFiles.length;
              const currentIdx = currentFileIndexRef.current;
              
              // Calculate global percent based on current file index and its progress
              const globalPercent = Math.round(((currentIdx * 100) + currentFilePercent) / total);
              setConvertProgress((prev) => Math.max(prev, globalPercent));
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
    setPreviewInfo(null); // Clear previous info

    if (api.isAvailable() && typeof file === 'string') {
      try {
        const result = await api.getVideoInfo(file);
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
      if (previewFile && typeof previewFile === 'string') {
          setFileSettings(prev => ({
              ...prev,
              [previewFile]: settings
          }));
          console.log('Saved crop settings for', previewFile, settings);
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
  };


  const handleRemoveFile = (index) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // New Path Handlers
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
                  const newPaths = { ...prev };
                  filesToSet.forEach(file => {
                      // Handle both string paths and file objects (though logic mainly uses string paths here)
                      const filePath = typeof file === 'string' ? file : file.path;
                      newPaths[filePath] = path;
                  });
                  return newPaths;
              });
          }
      }
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) {
        showAlert('提示', '请先选择文件');
        return;
    }

    // Validation: Ensure we have somewhere to output
    // If no global path and no custom paths for ANY file, prompt for global path
    // OR if some files miss custom path and no global path exists
    const missingPath = selectedFiles.some(file => !customPaths[file] && !globalPath);
    
    if (api.isElectron() && missingPath) {
         showAlert('提示', '请设置输出路径（全局或自定义）');
         return;
    }

    isCancelledRef.current = false;
    setConvertProgress(0);
    setConvertCount({ current: 0, total: selectedFiles.length });
    
    // Clear previous results for selected files
    setResults(prev => {
        const next = { ...prev };
        selectedFiles.forEach(f => delete next[f]);
        return next;
    });

    setIsConverting(true);
    try {
        if (api.isAvailable()) {
            for (let index = 0; index < selectedFiles.length; index++) {
                if (isCancelledRef.current) break;

                currentFileIndexRef.current = index;
                setConvertCount({ current: index, total: selectedFiles.length });
                const file = selectedFiles[index];
                currentFileRef.current = file;
                currentTargetsRef.current = null;
                console.log('Converting:', file);
                
                // Determine Output Path
                // Priority: Custom > Global > Default (if implemented in backend, but we pass explicit here)
                let outputDir = customPaths[file] || globalPath;
                
                // Get crop settings if available
                const cropSettings = fileSettings[file] || {};
                
                const result = await api.convert('convert-avi-to-jpg', {
                    sourcePath: file,
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
                    if (result.outputDir || outputDir) {
                         setResults(prev => ({
                             ...prev,
                             [file]: result.outputDir || outputDir
                         }));
                    }
                } else {
                    if (result.error === 'Cancelled') {
                        break;
                    }
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
                // Don't set progress here, let the event listener handle it
                setConvertCount({ current: finished, total: selectedFiles.length });
            }
            
            if (!isCancelledRef.current) {
                setConvertProgress(100);
                setConvertCount({ current: selectedFiles.length, total: selectedFiles.length });
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
        } else {
            // Web environment simulation
            let progress = 0;
            const intervalId = setInterval(() => {
                if (isCancelledRef.current) {
                    clearInterval(intervalId);
                    return;
                }
                progress += 5;
                if (progress > 100) {
                    clearInterval(intervalId);
                    setIsConverting(false);
                setConvertCount({ current: selectedFiles.length, total: selectedFiles.length });
                setConvertProgress(100);
                applyConversionNotificationRule({
                  scene: ConversionScenario.SUCCESS_BATCH_ALL,
                  ui: { showAlert },
                  data: {
                    customTitle: '完成',
                    customMessage: '所有任务处理完成！',
                    buttonText: '确定',
                    totalCount: selectedFiles.length,
                    finishedCount: selectedFiles.length
                  }
                });
                } else {
                    setConvertProgress(progress);
                }
            }, 100);
            return; // Exit early for web sim
        }
    } catch (error) {
        console.error('Conversion failed:', error);
        // Don't show alert if it was likely a cancellation
        if (error.message !== 'Cancelled' && !isCancelledRef.current) {
            applyConversionNotificationRule({
              scene: ConversionScenario.ERROR_SINGLE,
              ui: { showAlert },
              data: {
                errorMessage: '转换过程中发生错误: ' + error.message,
                customTitle: '错误',
                customMessage: '转换过程中发生错误: ' + error.message,
                onConfirm: () => {
                  setAlertModal(prev => ({ ...prev, isOpen: false }));
                  setConvertProgress(0);
                  setConvertCount({ current: 0, total: 0 });
                }
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
    setCustomPaths({});
    setResults({});
    console.log('Clear clicked');
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    isCancelledRef.current = true;
    setIsCancelModalOpen(false);
    
    let targetPaths = [];
    if (Array.isArray(currentTargetsRef.current) && currentTargetsRef.current.length > 0) {
      targetPaths = currentTargetsRef.current;
    }
    // Try to cleanup if we have active file info
    if (targetPaths.length === 0 && currentFileRef.current) {
        const file = currentFileRef.current;
        const outputDir = customPaths[file] || globalPath; // Use current determined path
        if (outputDir) {
            // 提取不带扩展名的文件名 (匹配后端逻辑)
            const pathParts = file.split(/[\\/]/);
            const filenameWithExt = pathParts[pathParts.length - 1];
            const filename = filenameWithExt.replace(/\.[^/.]+$/, "");
            
            const sep = file.includes('\\') ? '\\' : '/';
            const folderPath = `${outputDir}${sep}${filename}`;
            const zipPath = `${outputDir}${sep}${filename}.zip`;
            targetPaths = [folderPath, zipPath];
        }
    }

    if (api.isAvailable()) {
      try {
        // 调用 Electron 杀死进程并删除文件
        await api.cancelConversion({
          targetPath: targetPaths
        });
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

  const handleCancelDismiss = () => {
    setIsCancelModalOpen(false);
    // Clicking "No" should just continue the conversion as normal
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="tool-container-full"
    >
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>AVI To JPG 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px' }}>一款专业工具，可将AVI 视频文件转换为JPG图像序列，并支持自定义提取参数。</div>
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
              activeFile={previewFile}
              onSelectFile={setPreviewFile}
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
                disabled={isConverting}
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
                disabled={isConverting}
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
                disabled={isConverting}
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

      <ConfirmationModal 
        isOpen={isCancelModalOpen}
        title="确认取消"
        message="确定要取消当前的转换任务吗？"
        onConfirm={handleCancelConfirm}
        onCancel={() => setIsCancelModalOpen(false)}
      />

      <AlertModal 
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={handleCloseAlert}
        onCancel={handleAlertOnlyClose}
        buttonText={alertModal.buttonText}
      />
    </motion.div>
  );
};

export default AVIToJPGUI;
