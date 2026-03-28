﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import {
  ActionBar,
  AlertModal,
  ConfirmationModal,
  SettingsPanel,
  SettingSlider,
  SettingPresets,
  VideoPreviewModal
} from '../common/SharedUI';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const PRESET_CONFIGS = {
  '低质量': { quality: 40, fps: 10, interval: 50 },
  '中等质量': { quality: 70, fps: 15, interval: 100 },
  '高质量': { quality: 90, fps: 24, interval: 100 },
  '社交媒体': { quality: 80, fps: 20, interval: 100 }
};

const WEBMToJPGGUI = ({ onBack }) => {
  const navigate = useNavigate();
  const breadcrumbItems = [
    { label: 'WEBM 转换器', onClick: onBack },
    { label: 'WEBM To JPG' }
  ];
  
  // State refactoring for FileUploaderV2
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileInfos, setFileInfos] = useState({}); // Stores duration etc.
  const [trimSettings, setTrimSettings] = useState({}); // Stores startTime, endTime per file
  
  // Path management
  const [globalPath, setGlobalPath] = useState(api.isElectron() ? '' : 'browser-downloads');
  const [customPaths, setCustomPaths] = useState({});
  const [results, setResults] = useState({});
  const [lastOutputDir, setLastOutputDir] = useState(null);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0); // Total progress
  const [convertCount, setConvertCount] = useState({ current: 0, total: 0 });
  
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    onClose: null,
    buttonText: '确定'
  });
  const [confirm, setConfirm] = useState(null);
  const [notification, setNotification] = useState(null);

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
    setProgress(0);
    setConvertCount({ current: 0, total: 0 });
  };

  const handleCloseAlert = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
    if (alertModal.onConfirm) {
      alertModal.onConfirm();
    }
  };
  
  // Settings state
  const [preset, setPreset] = useState('高质量');
  const [quality, setQuality] = useState(90);
  const [fps, setFps] = useState(24);
  const [interval, setInterval] = useState(100);
  
  // Preview state
  const [previewFile, setPreviewFile] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isCancelledRef = useRef(false);
  const currentFileIndexRef = useRef(0);
  const currentFileRef = useRef(null);
  const currentTargetsRef = useRef(null);

  const applyPreset = (label) => {
    setPreset(label);
    const config = PRESET_CONFIGS[label];
    if (config) {
      setQuality(config.quality);
      setFps(config.fps);
      setInterval(config.interval);
    }
  };

  const processFiles = async (files) => {
    if (files && files.length > 0) {
      const newFiles = files.filter(f => !selectedFiles.includes(f));
      if (newFiles.length === 0) return;

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
            setTrimSettings(prev => ({
                ...prev,
                [file]: { startTime: 0, endTime: result.info.duration }
            }));
          }
        } catch (error) {
          console.error('无法获取文件信息:', file, error);
        }
      }
    }
  };

  const handleAddFiles = async () => {
    if (api.isAvailable()) {
        const files = await api.openFileDialog([
            { name: 'WEBM 视频', extensions: ['webm'] }
        ]);
        if (files && files.length > 0) {
            await processFiles(files);
        }
    } else {
        document.getElementById('file-input')?.click();
    }
  };

  const handleRemoveFile = (index) => {
    const fileToRemove = selectedFiles[index];
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    // Optional: cleanup other states if needed, but keeping them is fine too
  };

  const handleClearAll = () => {
    if (selectedFiles.length > 0) {
      setConfirm({
        title: '确认清空',
        message: '确定要移除所有文件吗？',
        onConfirm: () => {
          setSelectedFiles([]);
          setResults({});
          setCustomPaths({});
          setProgress(0);
          setConfirm(null);
        }
      });
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
      showAlert('提示', '请先选择 WEBM 文件');
      return;
    }

    const missingPath = selectedFiles.some(file => {
      return !customPaths[file] && !globalPath && !lastOutputDir;
    });

    if (api.isElectron() && missingPath) {
      showAlert('提示', '请设置输出路径（全局或自定义）');
      return;
    }

    setProcessing(true);
    isCancelledRef.current = false;
    setProgress(0);
    setConvertCount({ current: 0, total: selectedFiles.length });
    
    for (let i = 0; i < selectedFiles.length; i++) {
      if (isCancelledRef.current) break;
      const file = selectedFiles[i];
      
      currentFileIndexRef.current = i;
      currentFileRef.current = file;
      currentTargetsRef.current = null;

      const outputDir = customPaths[file] || globalPath || lastOutputDir;
      
      if (!outputDir) {
         applyConversionNotificationRule({
           scene: ConversionScenario.ERROR_SINGLE,
           ui: { showAlert },
           data: {
             filePath: file,
             errorMessage: '未设置输出路径'
           }
         });
         continue;
      }

      if (!customPaths[file] && !globalPath) {
         setLastOutputDir(outputDir);
      }

      try {
        const trim = trimSettings[file] || { startTime: 0, endTime: 0 };
        
        const result = await api.convert('convert-webm-to-jpg', {
          sourcePath: file,
          outputDir: outputDir,
          params: {
            quality,
            fps,
            interval,
            startTime: trim.startTime,
            endTime: trim.endTime
          }
        });

        if (isCancelledRef.current) break;

        if (result.success) {
          setResults(prev => ({ ...prev, [file]: result.output }));
          setConvertCount(prev => ({ ...prev, current: i + 1 }));
        } else {
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
      } catch (error) {
        console.error(`Exception converting ${file}: ${error.message}`);
        applyConversionNotificationRule({
          scene: ConversionScenario.ERROR_SINGLE,
          ui: { showAlert },
          data: {
            filePath: file,
            errorMessage: '转换过程中发生错误: ' + error.message
          }
        });
        break;
      }
    }

    setProcessing(false);
    setProgress(0);
    setConvertCount({ current: 0, total: 0 });

    if (!isCancelledRef.current) {
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
    }
  };

  const handleCancel = async () => {
    isCancelledRef.current = true;
    
    let targetPaths = [];
    if (currentTargetsRef.current && currentTargetsRef.current.length > 0) {
        targetPaths = currentTargetsRef.current;
    } else if (currentFileRef.current) {
        const file = currentFileRef.current;
        const outputDir = customPaths[file] || globalPath || lastOutputDir;
        if (outputDir) {
            const pathParts = file.split(/[\\/]/);
            const filenameWithExt = pathParts[pathParts.length - 1];
            const filename = filenameWithExt.replace(/\.[^/.]+$/, '');
            const sep = file.includes('\\') ? '\\' : '/';
            const folderPath = `${outputDir}${sep}${filename}`;
            const zipPath = `${outputDir}${sep}${filename}.zip`;
            targetPaths = [folderPath, zipPath];
        }
    }

    if (api.isAvailable() && targetPaths.length > 0) {
      try {
        const result = await api.cancelConversion({ targetPath: targetPaths });
        if (!result || !result.success) {
          applyConversionNotificationRule({
            scene: ConversionScenario.ERROR_SINGLE,
            ui: { showAlert },
            data: {
              errorMessage: '取消转换时发生错误'
            }
          });
        }
      } catch (error) {
        console.error('取消失败:', error);
        applyConversionNotificationRule({
          scene: ConversionScenario.ERROR_SINGLE,
          ui: { showAlert },
          data: {
            errorMessage: '取消转换时发生错误: ' + error.message
          }
        });
      }
    }
    setProcessing(false);
    setProgress(0);
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
  
  const handleOpenOutput = async () => {
    if (api.isAvailable()) {
        if (globalPath) {
             await api.openPath(globalPath);
        } else if (lastOutputDir) {
            await api.openPath(lastOutputDir);
        }
    }
  };

  useEffect(() => {
    if (!api.isAvailable()) return;

    const handleProgress = (data) => {
        if (isCancelledRef.current) return;
        
        if (data && data.type === 'output') {
             // Handle output event from backend
             let output = null;
             if (Array.isArray(data.targets) && data.targets.length > 0) {
               currentTargetsRef.current = data.targets;
               output = data.output || data.outputPath || data.targets[0];
             } else if (data.output) {
               currentTargetsRef.current = [data.output];
               output = data.output;
             }
             
             if (currentFileRef.current && output) {
               setResults(prev => ({ ...prev, [currentFileRef.current]: output }));
             }
             return;
        }

        if (data && typeof data.percent === 'number' && selectedFiles.length > 0) {
            const currentFilePercent = data.percent;
            const total = selectedFiles.length;
            const currentIdx = currentFileIndexRef.current;
            const globalPercent = Math.round(((currentIdx * 100) + currentFilePercent) / total);
            setProgress(globalPercent);
        }
    };

    api.onProgress(handleProgress);
    return () => api.removeProgressListener();
  }, [selectedFiles.length]);

  const handleTrimChange = (file, start, end) => {
    setTrimSettings(prev => ({
        ...prev,
        [file]: { startTime: start, endTime: end }
    }));
  };

  const handlePreview = (file) => {
      // file is a string path
      setPreviewFile(file);
      setIsPreviewOpen(true);
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>WEBM To JPG 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>从 WEBM 视频中提取高质量 JPG 序列，支持自定义提取间隔和质量。</div>
        </div>
      </div>

      <div className='tool-content-scroll'>
        <div className="tool-main-layout">
          <div className="tool-left-panel">
            <FileUploaderV2
              files={selectedFiles}
              fileInfos={fileInfos}
              onAddFile={() => handleAddFiles()}
              onRemoveFile={handleRemoveFile}
              onSetGlobalPath={handleSetGlobalPath}
              onSetCustomPath={handleSetCustomPath}
              onPreview={handlePreview}
              results={results}
              customPaths={customPaths}
              globalPath={globalPath}
              showAudioInfo={false}
              uploadPlaceholder="将您的 WEBM 文件拖拽到此处"
              onDropFiles={(files) => processFiles(files.map(f => f.path))}
            />
            
            <ActionBar
              onConvert={handleConvert}
              onClear={handleClearAll}
              onCancel={handleCancel}
              isConverting={processing}
              progress={progress}
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

      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={handleCloseAlert}
        onClose={handleAlertOnlyClose}
        buttonText={alertModal.buttonText}
      />

      {confirm && (
        <ConfirmationModal
          isOpen={!!confirm}
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <VideoPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
            setIsPreviewOpen(false);
            setPreviewFile(null);
        }}
        file={previewFile}
        videoInfo={fileInfos[previewFile]}
        initialSettings={previewFile && trimSettings[previewFile] ? {
            startTime: trimSettings[previewFile].startTime,
            endTime: trimSettings[previewFile].endTime
        } : null}
        onConfirm={({ startTime, endTime }) => {
          if (previewFile) handleTrimChange(previewFile, startTime, endTime);
        }}
      />
    </div>
  );
};

export default WEBMToJPGGUI;

