﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import {
  ActionBar,
  AlertModal,
  ConfirmationModal,
  SettingsPanel,
  SettingSlider,
  SettingPresets
} from '../common/SharedUI';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const PRESET_CONFIGS = {
  '低质量': { quality: 40, fps: 15, resolution: '640x360' },
  '中等质量': { quality: 70, fps: 24, resolution: '1280x720' },
  '高质量': { quality: 90, fps: 30, resolution: 'original' },
  '社交媒体': { quality: 80, fps: 24, resolution: '720x1280' }
};

const GIFToWEBMGUI = ({ onBack }) => {
  const navigate = useNavigate();
  const breadcrumbItems = [
    { label: 'GIF 转换器', onClick: onBack },
    { label: 'GIF To WEBM' }
  ];
  const [fps, setFps] = useState(24);
  const [quality, setQuality] = useState(70);
  const [resolution, setResolution] = useState('1280x720');
  const [preset, setPreset] = useState('中等质量');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [globalPath, setGlobalPath] = useState(api.isElectron() ? '' : 'browser-downloads');
  const [customPaths, setCustomPaths] = useState({});
  const [results, setResults] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [lastOutputDir, setLastOutputDir] = useState(null);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertCount, setConvertCount] = useState({ current: 0, total: 0 });
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [fileInfos, setFileInfos] = useState({});

  const processFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    // Filter duplicates
    const uniqueFiles = files.filter(f => !selectedFiles.includes(f));
    if (uniqueFiles.length === 0) return;
    
    // Filter by extension
    const validFiles = uniqueFiles.filter(f => f.toLowerCase().endsWith('.gif'));

    if (validFiles.length < uniqueFiles.length) {
      showAlert('提示', '部分文件已忽略，仅支持 GIF 格式');
    }

    if (validFiles.length === 0) return;

    setSelectedFiles(prev => [...prev, ...validFiles]);
    
    // Fetch info
    if (api.isAvailable()) {
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
          console.error('Failed to get video info:', error);
        }
      }
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

  const isCancelledRef = useRef(false);
  const currentFileIndexRef = useRef(0);
  const currentFileRef = useRef(null);
  const currentTargetsRef = useRef(null);

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
          const key = typeof currentFileRef.current === 'string'
            ? currentFileRef.current
            : currentFileRef.current.path;
          setResults(prev => ({ ...prev, [key]: output }));
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

  const handleFileSelect = async () => {
    if (api.isAvailable()) {
      const files = await api.openFileDialog([
        { name: 'GIF 图像', extensions: ['gif'] }
      ]);
      if (files && files.length > 0) {
        const newFiles = files.filter(f => !selectedFiles.includes(f));
        if (newFiles.length === 0) return;
        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    } else {
      document.getElementById('file-input').click();
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const applyPreset = (label) => {
    setPreset(label);
    const config = PRESET_CONFIGS[label];
    if (config) {
      if (config.fps !== undefined) setFps(config.fps);
      if (config.quality !== undefined) setQuality(config.quality);
      if (config.resolution !== undefined) setResolution(config.resolution);
    }
  };

  const handleSettingChange = (setter, value) => {
    setter(value);
    setPreset('');
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) {
      showAlert('提示', '请先选择 GIF 文件');
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
          const outputDir = customPaths[key] || globalPath || lastOutputDir;

          if (!outputDir) {
             showAlert('错误', `未设置输出路径: ${file}`);
             break;
          }

          if (!customPaths[key] && !globalPath) {
             setLastOutputDir(outputDir);
          }

          const result = await api.convert('convert-gif-to-webm', {
            sourcePath: file,
            outputDir: outputDir,
            params: {
              fps,
              quality,
              resolution
            }
          });

          if (isCancelledRef.current) break;

          if (!result.success) {
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
          applyConversionNotificationRule({
            scene: ConversionScenario.SUCCESS_BATCH_ALL,
            ui: { showAlert },
            data: {
              customTitle: '完成',
              customMessage: '所有 GIF 已成功转换为 WEBM！',
              buttonText: '确定',
              onClose: handleAlertOnlyClose
            }
          });
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
      setConvertProgress(0);
      setConvertCount({ current: 0, total: 0 });
    } finally {
      if (api.isAvailable()) {
        setIsConverting(false);
      }
    }
  };

  const handleCancel = () => {
    setIsCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    isCancelledRef.current = true;
    setIsCancelModalOpen(false);
    
    let targetPaths = [];
    if (Array.isArray(currentTargetsRef.current) && currentTargetsRef.current.length > 0) {
      targetPaths = currentTargetsRef.current;
    } else if (currentTargetsRef.current) {
      targetPaths = [currentTargetsRef.current];
    } else if (currentFileRef.current) {
      const key = typeof currentFileRef.current === 'string' ? currentFileRef.current : currentFileRef.current.path;
      const outputDir = customPaths[key] || globalPath || lastOutputDir;
      
      if (outputDir) {
        const pathParts = key.split(/[\\/]/);
        const filenameWithExt = pathParts[pathParts.length - 1];
        const filename = filenameWithExt.replace(/\.[^/.]+$/, '');
        const sep = key.includes('\\') ? '\\' : '/';
        const base = `${outputDir}${sep}${filename}.webm`;
        const candidates = [base];
        for (let i = 1; i <= 50; i++) {
          candidates.push(`${outputDir}${sep}${filename}_${i}.webm`);
        }
        targetPaths = candidates;
      }
    }

    if (api.isAvailable()) {
      try {
        const result = await api.cancelConversion(
          targetPaths.length ? { targetPath: targetPaths } : undefined
        );
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
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setCustomPaths({});
    setResults({});
    setActiveFile(null);
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>GIF To WEBM 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>—— 一款专业工具，可将 GIF 动图转换为 WEBM 视频格式，并支持自定义参数。</div>
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
              onSetGlobalPath={handleSetGlobalPath}
              onSetCustomPath={handleSetCustomPath}
              activeFile={activeFile}
              onSelectFile={setActiveFile}
              onDropFiles={(files) => processFiles(files.map(f => f.path))}
              results={results}
              customPaths={customPaths}
              globalPath={globalPath}
              showAudioInfo={false}
              hidePreview={true}
              uploadPlaceholder="将您的 GIF 文件拖拽到此处"
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
                label="帧率"
                value={fps}
                min={1}
                max={60}
                step={1}
                unit="fps"
                onChange={(v) => handleSettingChange(setFps, v)}
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

export default GIFToWEBMGUI;

