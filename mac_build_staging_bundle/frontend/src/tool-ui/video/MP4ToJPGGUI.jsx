import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { 
  FileUploader, 
  ActionBar,
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import JPGParamConfig from '../../components/converter/JPGParamConfig';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const MP4ToJPGGUI = ({ onBack }) => {
  const navigate = useNavigate();
  // State for settings
  const [quality, setQuality] = useState(90); // Default 90 for High Quality
  const [fps, setFps] = useState(24);
  const [interval, setInterval] = useState(100);
  const [preset, setPreset] = useState('高质量');
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
          if (isCancelledRef.current) return;

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
        const newFiles = files.filter(f => !selectedFiles.includes(f));
        if (newFiles.length === 0) return;
        const validFiles = newFiles.filter(f => f.toLowerCase().endsWith('.mp4'));
        if (validFiles.length < newFiles.length) {
            showAlert('提示', `部分文件已忽略，仅支持 MP4 格式`);
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
                console.error('Failed to get info for', file, error);
            }
        }
    }
  };

  const handleFileSelect = async (newFiles) => {
    // Check if running in Electron
    if (newFiles && Array.isArray(newFiles) && newFiles.length > 0) {
        await processFiles(newFiles);
        return;
    }
    
    if (api.isAvailable()) {
        const files = await api.openFileDialog([
            { name: 'MP4 Videos', extensions: ['mp4'] }
        ]);
        if (files && files.length > 0) {
            await processFiles(files);
        }
    } else {
        // Fallback for web preview (won't get full paths)
        document.getElementById('file-input').click();
    }
  };
    
    // Handle web file input change (fallback)
  const handleWebFileChange = (e) => {
      const newFiles = Array.from(e.target.files).map(f => f.name);
      setSelectedFiles(prev => [...prev, ...newFiles]);
      if (!activeFile && newFiles.length > 0) setActiveFile(newFiles[0]);
  };

  const handleRemoveFile = (index) => {
      const fileToRemove = selectedFiles[index];
      const newFiles = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(newFiles);
      if (activeFile === fileToRemove) {
        setActiveFile(newFiles.length > 0 ? newFiles[0] : null);
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
    if (!api.isAvailable()) return;
    const path = await api.openDirectoryDialog();
    if (path) {
      setCustomPaths(prev => {
        const next = { ...prev };
        filesToSet.forEach(file => {
          const key = typeof file === 'string' ? file : file.path;
          next[key] = path;
        });
        return next;
      });
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
    try {
        if (api.isAvailable()) {
            for (let index = 0; index < selectedFiles.length; index++) {
                if (isCancelledRef.current) break;

                currentFileIndexRef.current = index;
                const file = selectedFiles[index];
                currentFileRef.current = file;
                currentTargetsRef.current = null;
                
                const key = typeof file === 'string' ? file : file.path;
                const cropSettings = fileSettings[key] || {};
                const outputDir = customPaths[key] || globalPath || lastOutputDir;
                
                const result = await api.convert('convert-mp4-to-jpg', {
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
                    if (result.outputPath || result.output) {
                      const out = result.outputPath || result.output;
                      setResults(prev => ({
                        ...prev,
                        [key]: out
                      }));
                    }
                } else {
                    if (result.error === 'Cancelled') {
                        break;
                    }
                    console.error('Error:', result.error || result.message);
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
                const finished = index + 1;
                setConvertCount({ current: finished, total: selectedFiles.length });
            }
            
            if (!isCancelledRef.current) {
                setConvertProgress(0);
                setConvertCount({ current: 0, total: 0 });
                setTimeout(() => {
                   applyConversionNotificationRule({
                     scene: ConversionScenario.SUCCESS_BATCH_ALL,
                     ui: { showAlert },
                     data: {
                       customTitle: '完成',
                       customMessage: '所有任务处理完成！',
                       buttonText: '确定',
                       onConfirm: () => {
                         setAlertModal(prev => ({ ...prev, isOpen: false }));
                       },
                       onClose: handleAlertOnlyClose,
                       totalCount: selectedFiles.length,
                       finishedCount: selectedFiles.length
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
    setActiveFile(null);
    setFileInfos({});
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setFileSettings({});
    setResults({});
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
    if (targetPaths.length === 0 && currentFileRef.current) {
      const key = typeof currentFileRef.current === 'string' ? currentFileRef.current : currentFileRef.current.path;
      const baseDir = customPaths[key] || globalPath || lastOutputDir;
      if (baseDir && key) {
        const pathParts = key.split(/[\\/]/);
        const filenameWithExt = pathParts[pathParts.length - 1];
        const filename = filenameWithExt.replace(/\.[^/.]+$/, "");
        const sep = baseDir.includes('\\') ? '\\' : '/';
        const folderPath = `${baseDir}${sep}${filename}`;
        const zipPath = `${baseDir}${sep}${filename}.zip`;
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
  };

  return (
    <div style={{ width: '100%', position: 'relative', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '16px', padding: '0 40px', marginTop: '12px' }}>
        <div className="tool-breadcrumbs">
          <a onClick={onBack}>MP4 转换器</a>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>/</span>
            <span className="current">MP4 To JPG</span>
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>MP4 To JPG 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>—— 从 MP4 视频中提取高质量 JPG 序列，支持自定义提取间隔和质量。</div>
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
              onDropFiles={(files) => processFiles(files.map(f => f.path))}
              showAudioInfo={false}
              uploadPlaceholder="将您的 MP4 文件拖拽到此处"
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
              onCancel={handleCancelClick}
              progress={convertProgress}
              isConverting={isConverting}
              convertCount={convertCount}
            />
          </div>

          <div className="tool-right-panel">
            <JPGParamConfig 
              quality={quality} 
              setQuality={setQuality}
              fps={fps}
              setFps={setFps}
              interval={interval}
              setInterval={setInterval}
              preset={preset}
              setPreset={setPreset}
            />
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
        title="取消转换"
        message="确定要取消当前的转换任务吗？已生成的文件将被删除。"
        onConfirm={handleCancelConfirm}
        onCancel={handleCancelDismiss}
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

export default MP4ToJPGGUI;
