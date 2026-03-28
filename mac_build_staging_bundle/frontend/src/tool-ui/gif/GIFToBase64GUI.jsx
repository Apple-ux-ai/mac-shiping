﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { FileUploaderV2 } from '../common/FileUploaderV2';
import {
  ActionBar,
  AlertModal,
  ConfirmationModal,
  SettingsPanel
} from '../common/SharedUI';
import { api } from '../../services/api';
import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';

const GIFToBase64GUI = ({ onBack }) => {
  const breadcrumbItems = [
    { label: 'GIF 转换器', onClick: onBack },
    { label: 'GIF To BASE64' }
  ];
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
        { name: 'GIF Images', extensions: ['gif'] }
      ]);
      if (files && files.length > 0) {
        processFiles(files);
      }
    } else {
      document.getElementById('file-input').click();
    }
  };

  const handleWebFileChange = (e) => {
    const newFiles = Array.from(e.target.files).map(f => f.name);
    setSelectedFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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

          // Update lastOutputDir to keep legacy behavior working for next files if needed
          if (!customPaths[key] && !globalPath) {
             setLastOutputDir(outputDir);
          }

          const result = await api.convert('convert-gif-to-base64', {
            sourcePath: file,
            outputDir: outputDir,
            params: {}
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
              customMessage: '所有 GIF 已成功转换为 BASE64 文件！',
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

  const handleClear = () => {
    setSelectedFiles([]);
    setConvertProgress(0);
    setConvertCount({ current: 0, total: 0 });
    setCustomPaths({});
    setResults({});
    setActiveFile(null);
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
        const base = `${outputDir}${sep}${filename}.base64`;
        const candidates = [base];
        for (let i = 1; i <= 50; i++) {
          candidates.push(`${outputDir}${sep}${filename}_${i}.base64`);
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
             <h1 className="header-title" style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>GIF To BASE64 转换器</h1>
           </div>
           <div className="header-desc" style={{ fontSize: '14px', paddingLeft: '44px', color: 'var(--text-secondary)' }}>—— 一款专业工具，可将 GIF 动图转换为 Base64 编码字符串，方便在代码中直接引用。</div>
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
              onChange={handleWebFileChange}
            />
            <ActionBar 
              onConvert={handleConvert}
              onClear={handleClear}
              onCancel={handleCancel}
              progress={convertProgress}
              isConverting={isConverting}
              convertCount={convertCount}
            />
          </div>

          <div className="tool-right-panel">
            <SettingsPanel title="转换说明">
              <div className="settings-info-box">
                <h4>关于 GIF 转 BASE64</h4>
                <p>Base64 编码可以将图片数据直接嵌入到 HTML 或 CSS 中，减少 HTTP 请求，提高页面加载速度。</p>
                <p>生成的 <code>.base64</code> 文件包含完整的 Data URL（例如：<code>data:image/gif;base64,...</code>），您可以直接将其复制到代码中使用。</p>
                <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                  提示：Base64 编码会使文件体积增大约 33%，建议仅对较小的 GIF 或需要减少请求数的场景使用。
                </p>
              </div>
            </SettingsPanel>
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
          title="取消转换"
          message="确定要取消当前的转换任务吗？已生成的文件将被删除。"
          onConfirm={confirmCancel}
          onCancel={() => setIsCancelModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default GIFToBase64GUI;
