﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  FileUploader,
  ActionBar,
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal,
  SettingsPanel,
  SettingSlider,
  SettingPresets,
  UnifiedToolHeader
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const MOVToGIFGUI = ({ onBack }) => {
  const navigate = useNavigate();
  const [quality, setQuality] = useState(90);
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
  const [convertCount, setConvertCount] = useState({ current: 0, total: selectedFiles.length });
  const [fileSettings, setFileSettings] = useState({});
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const [previewFile, setPreviewFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

  const handleCloseAlert = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
    if (alertModal.onConfirm) {
      alertModal.onConfirm();
    }
  };

  const handleAlertOnlyClose = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
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
        filesToSet.forEach(f => {
          next[f] = path;
        });
        return next;
      });
    }
  };

  const handleOpenOutput = async () => {
    if (api.isAvailable()) {
      if (!lastOutputDir) {
        showAlert('提示', '请先转换文件以确定输出目录');
        return;
      }
      await api.openPath(lastOutputDir);
    } else {
      showAlert('提示', '在 Web 模式下无法打开本地文件夹');
    }
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) {
      showAlert('提示', '请先选择 MOV 文件');
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

          const settings = fileSettings[file] || {};
          const outputDir = customPaths[file] || globalPath || lastOutputDir;

          const result = await api.convert('convert-mov-to-gif', {
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
          applyConversionNotificationRule({
            scene: ConversionScenario.SUCCESS_BATCH_ALL,
            ui: { showAlert },
            data: {
              customTitle: '完成',
              customMessage: '所有 MOV 已成功转换为 GIF！',
              buttonText: '确定',
              onConfirm: () => {
                setAlertModal(prev => ({ ...prev, isOpen: false }));
                setConvertProgress(0);
                setConvertCount({ current: 0, total: 0 });
              },
              onClose: handleAlertOnlyClose,
              totalCount: selectedFiles.length,
              finishedCount: selectedFiles.length
            }
          });
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
            errorMessage: '转换过程中发生错误: ' + error.message
          }
        });
        setConvertProgress(0);
        setConvertCount({ current: 0, total: 0 });
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
    if (targetPaths.length === 0 && currentFileRef.current) {
      const file = currentFileRef.current;
      const outDir = customPaths[file] || globalPath || lastOutputDir;
      if (outDir) {
        const filename = file.split(/[\\/]/).pop().replace(/\.[^/.]+$/, '');
        const sep = file.includes('\\') ? '\\' : '/';
        targetPaths = [`${outDir}${sep}${filename}.gif`];
      }
    }

    if (api.isAvailable()) {
      try {
        await api.cancelConversion({ targetPath: targetPaths });
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
    <div className="tool-container-full">
      <div style={{ marginBottom: '16px', padding: '0 40px', marginTop: '12px' }}>
        <div className="tool-breadcrumbs">
          <a onClick={onBack}>MOV 转换器</a>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>/</span>
            <span className="current">MOV To GIF</span>
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>MOV To GIF 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>—— 将 MOV 视频转换为高质量 GIF 动图，支持自定义质量、帧率和时间范围。</div>
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
              uploadPlaceholder="将您的 MOV 文件拖拽到此处"
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

      {isPreviewOpen && (
        <VideoPreviewModal
          file={previewFile}
          isOpen={isPreviewOpen}
          videoInfo={previewInfo}
          onClose={() => setIsPreviewOpen(false)}
          onConfirm={handleCropConfirm}
          initialSettings={fileSettings[typeof previewFile === 'string' ? previewFile : previewFile?.path] || {}}
        />
      )}

      {isCancelModalOpen && (
        <ConfirmationModal
          isOpen={isCancelModalOpen}
          title="确认取消"
          message="是否取消当前转换任务并删除未完成文件？"
          onConfirm={handleCancelConfirm}
          onCancel={() => setIsCancelModalOpen(false)}
          confirmText="是"
          cancelText="否"
        />
      )}

      {alertModal.isOpen && (
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          onConfirm={handleCloseAlert}
          onClose={handleAlertOnlyClose}
          buttonText={alertModal.buttonText}
        />
      )}
    </div>
  );
};

export default MOVToGIFGUI;
