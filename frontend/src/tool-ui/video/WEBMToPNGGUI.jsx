﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
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

const WEBMToPNGGUI = ({ onBack }) => {
  const navigate = useNavigate();
  const breadcrumbItems = [
    { label: 'WEBM 转换器', onClick: onBack },
    { label: 'WEBM To PNG' }
  ];
  const [quality, setQuality] = useState(90);
  const [fps, setFps] = useState(24);
  const [interval, setInterval] = useState(100);
  const [preset, setPreset] = useState('高质量');

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileInfos, setFileInfos] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [lastOutputDir, setLastOutputDir] = useState(null);
  
  // New path management
  const [globalPath, setGlobalPath] = useState(api.isElectron() ? '' : 'browser-downloads');
  const [customPaths, setCustomPaths] = useState({});
  const [results, setResults] = useState({});

  const [convertProgress, setConvertProgress] = useState(0);
  const [convertCount, setConvertCount] = useState({ current: 0, total: selectedFiles.length });
  const [fileSettings, setFileSettings] = useState({});
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Preview state
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

  useEffect(() => {
    if (!api.isAvailable()) return;

    const handleProgress = (data) => {
      if (isCancelledRef.current) return;
      
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
            setResults(prev => ({ ...prev, [currentFileRef.current]: output }));
        }
        return;
      }

      if (data && data.percent !== undefined && selectedFiles.length > 0) {
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
            setFileSettings(prev => ({
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

          const settings = fileSettings[file] || {};

          const result = await api.convert('convert-webm-to-png', {
            sourcePath: file,
            outputDir: outputDir,
            params: {
              quality,
              fps,
              interval,
              startTime: settings.startTime,
              endTime: settings.endTime
            }
          });

          if (isCancelledRef.current) break;

          if (!result.success) {
            applyConversionNotificationRule({
              scene: ConversionScenario.ERROR_SINGLE,
              ui: { showAlert },
              data: {
                filePath: file,
                errorMessage: result.error || result.message
              }
            });
            break;
          } else {
            setResults(prev => ({ ...prev, [file]: result.output }));
          }

          const finished = index + 1;
          setConvertCount({ current: finished, total: selectedFiles.length });
        }

        if (!isCancelledRef.current) {
          const anyOutput = Object.values(results).length > 0 || lastOutputDir || globalPath;
          setConvertProgress(0);
          setConvertCount({ current: 0, total: 0 });
          if (anyOutput) {
            applyConversionNotificationRule({
              scene: ConversionScenario.SUCCESS_BATCH_ALL,
              ui: { showAlert },
              data: {
                customTitle: '完成',
                customMessage: '所有 WEBM 已成功转换为 PNG 序列并打包！',
                buttonText: '确定',
                onConfirm: () => {
                  setAlertModal(prev => ({ ...prev, isOpen: false }));
                },
                onClose: handleAlertOnlyClose,
                totalCount: selectedFiles.length,
                finishedCount: selectedFiles.length
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Conversion failed:', error);
      applyConversionNotificationRule({
        scene: ConversionScenario.ERROR_SINGLE,
        ui: { showAlert },
        data: {
          errorMessage: '转换过程中发生错误: ' + error.message
        }
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleCancel = () => {
    if (isConverting) {
      setIsCancelModalOpen(true);
    }
  };

  const confirmCancel = async () => {
    isCancelledRef.current = true;
    setIsCancelModalOpen(false);
    
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
        console.error('Failed to cancel conversion:', error);
        applyConversionNotificationRule({
          scene: ConversionScenario.ERROR_SINGLE,
          ui: { showAlert },
          data: {
            errorMessage: '取消转换时发生错误: ' + error.message
          }
        });
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

  const handleClear = () => {
    setSelectedFiles([]);
    setFileInfos({});
    setFileSettings({});
    setResults({});
    setCustomPaths({});
    setActiveFile(null);
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
  };

  const handlePreview = async (file) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
    setPreviewInfo(fileInfos[file] || null);

    if (api.isAvailable() && typeof file === 'string' && !fileInfos[file]) {
      try {
        const result = await api.getVideoInfo(file);
        if (result.success) {
          setPreviewInfo(result.info);
          setFileInfos(prev => ({ ...prev, [file]: result.info }));
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
        [previewFile]: {
          ...(prev[previewFile] || {}),
          ...settings
        }
      }));
    }
  };

  const applyPreset = (p) => {
    setPreset(p);
    const config = PRESET_CONFIGS[p];
    if (config) {
      setQuality(config.quality);
      setFps(config.fps);
      setInterval(config.interval);
    }
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>WEBM To PNG 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>从 WEBM 视频中提取高质量 PNG 序列，支持自定义提取间隔和质量。</div>
        </div>
      </div>

      <div className='tool-content-scroll'>
        <div className="tool-main-layout">
          <div className="tool-left-panel">
            <FileUploaderV2
              files={selectedFiles}
              fileInfos={fileInfos}
              onAddFile={handleFileSelect}
              onRemoveFile={handleRemoveFile}
              onSetGlobalPath={handleSetGlobalPath}
              onSetCustomPath={handleSetCustomPath}
              onPreview={handlePreview}
              results={results}
              customPaths={customPaths}
              globalPath={globalPath}
              activeFile={activeFile}
              onSelectFile={setActiveFile}
              showAudioInfo={false}
              uploadPlaceholder="将您的 WEBM 文件拖拽到此处"
              onDropFiles={(files) => processFiles(files.map(f => f.path))}
            />
            <input
              type="file"
              id="file-input"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const newFiles = Array.from(e.target.files).map(f => f.name);
                setSelectedFiles(prev => [...prev, ...newFiles]);
                e.target.value = '';
              }}
            />
            <ActionBar
              isConverting={isConverting}
              progress={convertProgress}
              onConvert={handleConvert}
              onClear={handleClear}
              onCancel={handleCancel}
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

      <VideoPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
        videoInfo={previewInfo}
        initialSettings={fileSettings[previewFile]}
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
        message="您确定要取消当前的转换任务吗？未完成的文件将被删除。"
        onConfirm={confirmCancel}
        onCancel={() => setIsCancelModalOpen(false)}
      />
    </div>
  );
};

export default WEBMToPNGGUI;
