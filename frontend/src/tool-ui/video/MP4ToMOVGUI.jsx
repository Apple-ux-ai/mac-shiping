﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { 
  VideoPreviewModal,
  ConfirmationModal,
  AlertModal,
  ActionBar,
  SettingsPanel,
  SettingPresets,
  SettingSlider
} from '../common/SharedUI';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import MOVParamConfig from '../../components/converter/MOVParamConfig';
import { api } from '../../services/api';

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

const MP4ToMOVGUI = ({ onBack }) => {
  const navigate = useNavigate();
  // State for settings
  const [quality, setQuality] = useState(70); 
  const [audioBitrate, setAudioBitrate] = useState('128k');
  const [resolution, setResolution] = useState('original'); 
  const [audioTrack, setAudioTrack] = useState(0);
  const [preset, setPreset] = useState('中等质量');
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileInfos, setFileInfos] = useState({});
  const [fileSettings, setFileSettings] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [lastOutputDir, setLastOutputDir] = useState(null);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertCount, setConvertCount] = useState({ current: 0, total: 0 });
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [globalPath, setGlobalPath] = useState(null);
  const [customPaths, setCustomPaths] = useState({});
  const [results, setResults] = useState({});

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
              if (Array.isArray(data.targets) && data.targets.length > 0) {
                  currentTargetsRef.current = data.targets;
              } else if (data.output) {
                  currentTargetsRef.current = [data.output];
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
    setPreviewInfo(null); 

    if (api.isAvailable() && typeof file === 'string') {
      try {
        const result = await api.getVideoInfo(file);
        if (result.success) {
          setPreviewInfo(result.info);
        }
      } catch (err) {
        console.error('Failed to get video info:', err);
      }
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
        
        // Get info for each new file
        for (const file of validFiles) {
          try {
            const result = await api.getVideoInfo(file);
            if (result.success) {
              setFileInfos(prev => ({ ...prev, [file]: result.info }));
            }
          } catch (err) {
            console.error('Failed to get video info:', err);
          }
        }
    }
  };

  const handleFileSelect = async (newFiles) => {
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
      document.getElementById('file-input').click();
    }
  };

  const handleWebFileChange = (e) => {
    const newFiles = Array.from(e.target.files).map(f => f.name);
    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (!activeFile && newFiles.length > 0) setActiveFile(newFiles[0]);
    e.target.value = ''; // Reset input
  };

  const handleRemoveFile = (index) => {
    const fileToRemove = selectedFiles[index];
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    if (activeFile === fileToRemove) {
      setActiveFile(newFiles.length > 0 ? newFiles[0] : null);
    }

    setFileInfos(prev => {
      const next = { ...prev };
      delete next[fileToRemove];
      return next;
    });

    setFileSettings(prev => {
      const next = { ...prev };
      delete next[fileToRemove];
      return next;
    });

    setCustomPaths(prev => {
      const next = { ...prev };
      delete next[fileToRemove];
      return next;
    });

    setResults(prev => {
      const next = { ...prev };
      delete next[fileToRemove];
      return next;
    });
  };

  const handleCropConfirm = (startTime, endTime) => {
    if (activeFile) {
        setFileSettings(prev => ({
            ...prev,
            [activeFile]: {
                ...prev[activeFile],
                startTime,
                endTime
            }
        }));
    }
    setIsPreviewOpen(false);
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

    if (!api.isAvailable()) {
      showAlert('提示', '在 Web 模式下无法选择输出文件夹');
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
          const key = typeof file === 'string' ? file : file.path;
          currentFileRef.current = file;
          currentTargetsRef.current = null;
          setConvertCount({ current: index + 1, total: selectedFiles.length });

          const settings = fileSettings[key] || {};
          const outputDir = customPaths[key] || globalPath || lastOutputDir;

          const result = await api.convert('convert-mp4-to-mov', {
            sourcePath: file,
            outputDir: outputDir,
            params: {
              quality,
              audioBitrate,
              resolution,
              audioTrack,
              preset,
              startTime: settings.startTime,
              endTime: settings.endTime
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
            if (result.error === 'Cancelled') break;
            showAlert('错误', `转换文件失败: ${result.error || result.message}`);
            break;
          }
        }

        if (!isCancelledRef.current) {
          setConvertProgress(0);
          setConvertCount({ current: 0, total: 0 });
          setTimeout(() => {
            showAlert('完成', '所有文件转换完成', () => {
              setAlertModal(prev => ({ ...prev, isOpen: false }));
            }, '确定', handleAlertOnlyClose);
          }, 100);
        }
      }
    } catch (err) {
      showAlert('错误', `转换过程中发生错误: ${err.message}`, () => {
        setAlertModal(prev => ({ ...prev, isOpen: false }));
        setConvertProgress(0);
        setConvertCount({ current: 0, total: 0 });
      });
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
    
    try {
        let targetPath = null;
        if (Array.isArray(currentTargetsRef.current) && currentTargetsRef.current.length > 0) {
            targetPath = currentTargetsRef.current;
        } else if (currentFileRef.current) {
            const key = typeof currentFileRef.current === 'string' ? currentFileRef.current : currentFileRef.current.path;
            let baseDir = customPaths[key] || globalPath || lastOutputDir;
            if (baseDir) {
              const sep = window.process?.platform === 'win32' ? '\\' : '/';
              const filename = key.split(/[\\/]/).pop().split('.')[0];
              targetPath = `${baseDir}${sep}${filename}.mov`;
            }
        }
        await api.cancelConversion(targetPath ? { targetPath } : undefined);
    } catch (err) {
        console.error('Failed to cancel conversion:', err);
    }
    
    setIsConverting(false);
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    showAlert('已取消', '转换任务已取消并清理临时文件', () => {
      setAlertModal(prev => ({ ...prev, isOpen: false }));
    });
  };

  return (
    <div style={{ width: '100%', position: 'relative', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '16px', padding: '0 40px', marginTop: '12px' }}>
        <div className="tool-breadcrumbs">
          <a onClick={onBack}>MP4 转换器</a>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>/</span>
            <span className="current">MP4 To MOV</span>
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>MP4 To MOV 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>—— 专业级 MP4 转 MOV 工具，支持批量转换和高质量输出。</div>
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
              onClear={() => {
                setSelectedFiles([]);
                setActiveFile(null);
                setFileInfos({});
                setFileSettings({});
                setGlobalPath(null);
                setCustomPaths({});
                setResults({});
                setLastOutputDir(null);
                setConvertProgress(0);
                setConvertCount({ current: 0, total: 0 });
              }} 
              onCancel={handleCancel}
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
                onSelect={(p) => {
                  setPreset(p);
                  if (p === '低质量') { setQuality(40); setAudioBitrate('96k'); setResolution('640x360'); }
                  else if (p === '中等质量') { setQuality(70); setAudioBitrate('128k'); setResolution('1280x720'); }
                  else if (p === '高质量') { setQuality(90); setAudioBitrate('320k'); setResolution('1920x1080'); }
                  else if (p === '社交媒体') { setQuality(80); setAudioBitrate('192k'); setResolution('1080x1920'); }
                }}
                columns={2}
              />

              <div className="settings-group">
                <LocalSettingSelect
                  label="分辨率"
                  value={resolution}
                  options={[
                    { label: '保持原样', value: 'original' },
                    { label: '1280x720 (HD)', value: '1280x720' },
                    { label: '1920x1080 (FHD)', value: '1920x1080' },
                    { label: '640x360 (SD)', value: '640x360' },
                    { label: '320x180 (LD)', value: '320x180' }
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

                <LocalSettingSelect
                  label="选择音轨"
                  value={audioTrack}
                  options={Array.from({ length: (activeFile && fileInfos[activeFile]?.streams ? fileInfos[activeFile].streams.filter(s => s.codec_type === 'audio').length : 1) }, (_, i) => ({
                    label: `音轨 ${i + 1} ${i === 0 ? '(默认)' : ''}`,
                    value: i
                  }))}
                  onChange={(val) => {
                    setAudioTrack(Number(val));
                    setPreset('自定义');
                  }}
                  disabled={isConverting}
                />
              </div>
            </SettingsPanel>
          </div>
        </div>
      </div>

      <VideoPreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
        videoInfo={previewInfo}
        onConfirm={handleCropConfirm}
        initialStartTime={activeFile && fileSettings[activeFile]?.startTime}
        initialEndTime={activeFile && fileSettings[activeFile]?.endTime}
      />

      <ConfirmationModal 
        isOpen={isCancelModalOpen}
        title="取消转换"
        message="确定要取消当前的转换任务吗？"
        onConfirm={confirmCancel}
        onCancel={() => setIsCancelModalOpen(false)}
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

export default MP4ToMOVGUI;
