﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
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
  SettingPresets
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const PRESET_CONFIGS = {
  '低质量': { quality: 40, audioBitrate: '96k', resolution: '640x360' },
  '中等质量': { quality: 70, audioBitrate: '128k', resolution: '1280x720' },
  '高质量': { quality: 90, audioBitrate: '320k', resolution: '1920x1080' },
  '社交媒体': { quality: 80, audioBitrate: '192k', resolution: '1080x1920' },
};

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

const MP4ToAVIGUI = ({ onBack }) => {
  const navigate = useNavigate();
  const [quality, setQuality] = useState(90);
  const [audioBitrate, setAudioBitrate] = useState('128k');
  const [resolution, setResolution] = useState('original');
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
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
  };

  const isCancelledRef = useRef(false);
  const currentFileIndexRef = useRef(0);
  const currentFileRef = useRef(null);
  const currentTargetsRef = useRef(null);

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
          startTime: settings.startTime,
          endTime: settings.endTime
        }
      }));
    }
    setIsPreviewOpen(false);
  };

  const processFiles = async (files) => {
    if (files && files.length > 0) {
        // Filter out already selected files
        const newFiles = files.filter(f => !selectedFiles.includes(f));
        if (newFiles.length === 0) return;

        // Filter by extension if needed (simple check)
        const validFiles = newFiles.filter(f => f.toLowerCase().endsWith('.mp4'));
        if (validFiles.length < newFiles.length) {
             showAlert('提示', `部分文件已忽略，仅支持 MP4 格式`);
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

  const handleFileSelect = async (newFiles) => {
    let filesToProcess = [];

    if (newFiles && Array.isArray(newFiles) && newFiles.length > 0) {
      filesToProcess = newFiles;
    } else if (api.isAvailable()) {
      const files = await api.openFileDialog([
        { name: 'MP4 视频', extensions: ['mp4'] }
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
    const validFiles = files.filter(file => file.name.toLowerCase().endsWith('.mp4'));
    if (validFiles.length < files.length) {
      showAlert('提示', '只支持 MP4 文件');
    }
    handleFileSelect(validFiles);
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setFileInfos({});
    setFileSettings({});
  };

  const applyPreset = (presetName) => {
    const config = PRESET_CONFIGS[presetName];
    if (config) {
      setPreset(presetName);
      setQuality(config.quality);
      setAudioBitrate(config.audioBitrate);
      setResolution(config.resolution);
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

    try {
      if (api.isAvailable()) {
        for (let index = 0; index < selectedFiles.length; index++) {
          if (isCancelledRef.current) break;

          currentFileIndexRef.current = index;
          const file = selectedFiles[index];
          const key = typeof file === 'string' ? file : file.path;
          currentFileRef.current = file;
          currentTargetsRef.current = null;

          const outputDir = customPaths[key] || globalPath || lastOutputDir;
          const settings = fileSettings[file] || {};

          const result = await api.convert('convert-mp4-to-avi', {
            sourcePath: file,
            outputDir: outputDir,
            params: {
              quality,
              audioBitrate,
              resolution,
              startTime: settings.startTime,
              endTime: settings.endTime,
              useVBR: true
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

          successCount += 1;
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
          applyConversionNotificationRule({
            scene: ConversionScenario.SUCCESS_BATCH_ALL,
            ui: { showAlert },
            data: {
              customTitle: '完成',
              customMessage: `成功转换 ${successCount} 个文件！`,
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
        }
      }
    } catch (error) {
      console.error('Conversion failed:', error);
      if (error.message !== 'Cancelled' && !isCancelledRef.current) {
        showAlert('错误', '转换过程中发生错误: ' + error.message);
        setConvertProgress(0);
        setConvertCount({ current: 0, total: 0 });
      }
    } finally {
      if (api.isAvailable()) {
        setIsConverting(false);
      }
    }
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    isCancelledRef.current = true;
    setIsCancelModalOpen(false);

    let targetPath = null;
    if (currentTargetsRef.current && currentTargetsRef.current.length > 0) {
      targetPath = currentTargetsRef.current;
    } else if (currentFileRef.current) {
      const key = typeof currentFileRef.current === 'string' ? currentFileRef.current : currentFileRef.current.path;
      const outputDir = customPaths[key] || globalPath || lastOutputDir;
      if (outputDir) {
        const pathParts = key.split(/[\\/]/);
        const filenameWithExt = pathParts[pathParts.length - 1];
        const filename = filenameWithExt.replace(/\.[^/.]+$/, '');
        const sep = key.includes('\\') ? '\\' : '/';
        targetPath = [`${outputDir}${sep}${filename}.avi`];
      }
    }

    if (api.isAvailable() && targetPath) {
      try {
        await api.cancelConversion({ targetPath });
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
    <div style={{ width: '100%', position: 'relative', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '16px', padding: '0 40px', marginTop: '12px' }}>
        <div className="tool-breadcrumbs">
          <a onClick={onBack}>MP4 转换器</a>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>/</span>
            <span className="current">MP4 To AVI</span>
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>MP4 To AVI 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>—— 专业级 MP4 转 AVI 工具，支持批量转换和高质量输出。</div>
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
              activeFile={activeFile}
              onSelectFile={setActiveFile}
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

          <div className="tool-right">
            <SettingsPanel title="转换选项">
              <SettingPresets
                label="快速预设"
                presets={['低质量', '中等质量', '高质量', '社交媒体']}
                currentPreset={preset}
                onSelect={applyPreset}
                columns={2}
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

              <SettingSlider
                label="质量"
                value={quality}
                min={1}
                max={100}
                step={1}
                unit="%"
                onChange={(val) => {
                  setQuality(val);
                  setPreset('自定义');
                }}
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
        message="是否取消转换？"
        confirmText="是"
        cancelText="否"
        onConfirm={handleCancelConfirm}
        onCancel={() => setIsCancelModalOpen(false)}
      />

      <VideoPreviewModal
        key={`${typeof previewFile === 'string' ? previewFile : (previewFile?.path ?? '')}-${previewInfo?.duration ?? ''}`}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
        videoInfo={previewInfo}
        initialSettings={previewFile ? (fileSettings[typeof previewFile === 'string' ? previewFile : previewFile.path] || null) : null}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
};

export default MP4ToAVIGUI;

