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
  SettingSlider
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const LocalSettingSelect = ({ label, value, options, onChange, disabled }) => (
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
      {options.map((opt) => (
        <option
          key={opt.value}
          value={opt.value}
          style={{
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-primary)'
          }}
        >
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const MOVToPDFGUI = ({ onBack }) => {
  const navigate = useNavigate();
  const [orientation, setOrientation] = useState('Original');
  const [quality, setQuality] = useState(70);
  const [frameRate, setFrameRate] = useState(12);
  const [frameInterval, setFrameInterval] = useState(50);

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

  const showAlert = (title, message, onConfirm, buttonText = '确定', onClose) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      onConfirm:
        onConfirm ||
        (() => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
        }),
      onClose:
        onClose ||
        (() => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
        }),
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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/mov-converter');
    }
  };

  useEffect(() => {
    if (!api.isAvailable()) return;

    const handleProgress = data => {
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

  const handlePreview = async file => {
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

  const handleCropConfirm = settings => {
    const filePath = typeof previewFile === 'string' ? previewFile : previewFile?.path;
    if (!filePath) return;
    setFileSettings(prev => ({
      ...prev,
      [filePath]: {
        ...(prev[filePath] || {}),
        ...settings
      }
    }));
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

  const handleRemoveFile = index => {
    const fileToRemove = selectedFiles[index];
    const remaining = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(remaining);
    if (activeFile === fileToRemove) {
      setActiveFile(remaining.length > 0 ? remaining[0] : null);
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
        filesToSet.forEach(f => {
          const filePath = typeof f === 'string' ? f : f.path;
          next[filePath] = path;
        });
        return next;
      });
    }
  };

  const handleOpenOutput = async () => {
    if (api.isAvailable() && lastOutputDir) {
      await api.openPath(lastOutputDir);
    } else {
      showAlert('提示', '请先选择输出目录或进行转换');
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

          const result = await api.convert('convert-mov-to-pdf', {
            sourcePath: file,
            outputDir,
            params: {
              orientation,
              quality,
              frameRate,
              frameInterval,
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
              customMessage: '所有 MOV 已成功转换为 PDF 文件！',
              buttonText: '确定',
              onConfirm: () => {
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
            errorMessage: '转换过程中发生错误: ' + error.message,
            onClose: handleAlertOnlyClose
          }
        });
      }
    } finally {
      setIsConverting(false);
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
        targetPaths = [`${outDir}${sep}${filename}.pdf`];
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
            <span className="current">MOV To PDF</span>
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
            <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>
              MOV To PDF 转换器
            </h1>
          </div>
          <div
            className="header-desc"
            style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}
          >
            —— 将 MOV 视频帧提取并转换为 PDF 文档，支持自定义页面方向与批量处理。
          </div>
        </div>
      </div>

      <div className="tool-ui-container" style={{ padding: '24px', flex: 1 }}>
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
              <LocalSettingSelect
                label="方向"
                value={orientation}
                options={[
                  { label: '原始方向 (Original)', value: 'Original' },
                  { label: '强制纵向 (Portrait)', value: 'Portrait' },
                  { label: '强制横向 (Landscape)', value: 'Landscape' }
                ]}
                onChange={setOrientation}
                disabled={isConverting}
              />

              <SettingSlider
                label="质量"
                value={quality}
                unit="%"
                min={1}
                max={100}
                step={1}
                onChange={val => {
                  setQuality(val);
                }}
              />

              <SettingSlider
                label="帧率"
                value={frameRate}
                unit=" FPS"
                min={1}
                max={60}
                step={1}
                onChange={val => {
                  setFrameRate(val);
                }}
              />

              <SettingSlider
                label="提取密度"
                value={frameInterval}
                unit=""
                min={1}
                max={100}
                step={1}
                onChange={val => {
                  setFrameInterval(val);
                }}
                valueDisplay={`提取原视频的 ${frameInterval}% 帧`}
              />
            </SettingsPanel>
          </div>
        </div>
      </div>

      {isPreviewOpen && (
        <VideoPreviewModal
          key={`preview-${typeof previewFile === 'string' ? previewFile : previewFile?.path || ''}`}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          file={previewFile}
          videoInfo={previewInfo}
          initialSettings={
            previewFile
              ? fileSettings[typeof previewFile === 'string' ? previewFile : previewFile.path] || null
              : null
          }
          onConfirm={handleCropConfirm}
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

      {isCancelModalOpen && (
        <ConfirmationModal
          isOpen={isCancelModalOpen}
          title="确认取消"
          message="是否取消当前转换任务？"
          confirmText="是"
          cancelText="否"
          onConfirm={handleCancelConfirm}
          onCancel={() => setIsCancelModalOpen(false)}
        />
      )}
    </div>
  );
};

export default MOVToPDFGUI;
