import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { api } from '../../services/api';
import '../tool-ui.css';

// 面包屑导航
export const ToolBreadcrumbs = ({ items }) => {
  const navigate = useNavigate();
  return (
    <div className="tool-breadcrumbs">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span>/</span>}
          {item.onClick ? (
            <a onClick={item.onClick}>{item.label}</a>
          ) : item.link ? (
             <a onClick={() => navigate(item.link)}>{item.label}</a>
          ) : (
            <span className="current">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// 页面头部
export const ToolHeader = ({ title, description }) => {
  return (
    <div className="tool-header">
      <h1 className="tool-title">{title}</h1>
      <p className="tool-desc">{description}</p>
    </div>
  );
};

// 统一的现代化头部组件
export const UnifiedToolHeader = ({ breadcrumbs, title, description, icon }) => {
  const navigate = useNavigate();
  return (
    <div className="unified-tool-header">
       {/* Breadcrumbs Area */}
       <div className="tool-breadcrumbs">
          {breadcrumbs.map((item, index) => (
             <React.Fragment key={index}>
                {index > 0 && <span>/</span>}
                {item.onClick ? (
                   <a onClick={item.onClick}>{item.label}</a>
                ) : item.link ? (
                   <a onClick={() => navigate(item.link)}>{item.label}</a>
                ) : (
                   <span className="current">{item.label}</span>
                )}
             </React.Fragment>
          ))}
       </div>
       
       {/* Title Area */}
       <div className="header-main">
          {icon && <div className="header-icon">{icon}</div>}
          <div className="header-text">
             <h1 className="header-title">{title}</h1>
             <div className="header-desc">{description}</div>
          </div>
       </div>
    </div>
  );
};

// 文件上传区域
export const FileUploader = ({ 
  files = [], 
  fileInfos = {}, 
  onAddFile, 
  onAddFolder, 
  onRemoveFile, 
  onOpenOutput, 
  onPreview, 
  activeFile, 
  onSelectFile,
  onDropFiles, // New prop
  showAudioInfo = true,
  hidePreview = false,
  uploadPlaceholder = "将您的文件拖拽到此处"
}) => {
  const { t } = useI18n();
  const hasFiles = files && files.length > 0;
  const isWebMode = !api.isElectron();
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (onDropFiles && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = api.normalizeFiles(Array.from(e.dataTransfer.files));
      onDropFiles(droppedFiles);
    }
  };

  return (
    <div 
      className={`file-uploader ${hasFiles ? 'has-files' : ''} ${isDragging ? 'dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!hasFiles ? (
        <div className="file-uploader-empty" onClick={onAddFile}>
          <input type="file" id="file-input" multiple style={{ display: 'none' }} />
          <div className="upload-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19a5.5 5.5 0 0 0 0-11h-1.2a7 7 0 1 0-13.8 2.5 5.5 5.5 0 0 0 0 8.5"></path>
              <polyline points="12 13 12 7 15 10"></polyline>
              <polyline points="12 7 9 10"></polyline>
              <path d="M12 7v12"></path>
            </svg>
          </div>
          <div className="upload-text">{uploadPlaceholder}</div>
          <div className="upload-subtext">或者点击浏览文件</div>
          <div className="upload-actions">
            <button className="upload-btn" onClick={(e) => { e.stopPropagation(); onAddFile(); }}><span>+</span> 选择文件</button>
          </div>
        </div>
      ) : (
        <>
          <div className="file-uploader-header">
             <div className="header-actions">
               <button className="header-btn primary" onClick={onAddFile}>
                  <span>+</span> {t('__continue_import')}
                </button>
                {onAddFolder && (
                  <button className="header-btn" onClick={onAddFolder}>
                    <span>📂</span> {t('导入文件夹')}
                  </button>
                )}
                <button className="header-btn" onClick={onOpenOutput}>
                  <span>{isWebMode ? '⬇️' : '📂'}</span> {t(isWebMode ? '下载结果' : '结果文件夹')}
                </button>
             </div>
          </div>
          <div className="file-list">
            {files.map((file, index) => {
              const filePath = typeof file === 'string' ? file : file.path;
              const info = fileInfos[filePath];
              const trackCount = info?.audio_tracks_count;
              const isActive = activeFile === file;
              
              return (
                <div 
                  key={index} 
                  className={`file-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectFile && onSelectFile(file)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="file-icon">🎬</div>
                  <div className="file-info">
                     <div className="file-name">{typeof file === 'string' ? file.split(/[/\\]/).pop() : file.name}</div>
                     <div className="file-path">{filePath}</div>
                  </div>
                  <div className="file-actions-inline">
                     {showAudioInfo && trackCount !== undefined && (
                        <div className="audio-track-badge" title={t('__video_has_tracks', { count: trackCount })}>
                           <span>🎧</span> {t('__audio_track_count', { count: trackCount })}
                        </div>
                     )}
                     {!hidePreview && (
                        <button 
                           className="btn-preview-small" 
                           onClick={(e) => { e.stopPropagation(); onPreview && onPreview(file); }}
                           title={t('预览视频')}
                         >
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                             <circle cx="12" cy="12" r="3"></circle>
                           </svg>
                        </button>
                     )}
                     <div className="file-remove" onClick={(e) => { e.stopPropagation(); onRemoveFile(index); }} title={t('移除文件')}>
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                         <line x1="18" y1="6" x2="6" y2="18"></line>
                         <line x1="6" y1="6" x2="18" y2="18"></line>
                       </svg>
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// 设置面板容器
export const SettingsPanel = ({ title = "转换选项", children }) => {
  return (
    <div className="settings-panel">
      <div className="settings-title">
        <span className="settings-icon">⚙️</span>
        {title}
      </div>
      <div className="settings-content">
        {children}
      </div>
    </div>
  );
};

// 滑块组件
export const SettingSlider = ({ label, value, unit, min, max, step, onChange, valueDisplay }) => {
  return (
    <div className="setting-item">
      <div className="setting-header">
        <span className="setting-label">{label}</span>
        <span className="setting-value">{valueDisplay || `${value}${unit}`}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="custom-slider"
      />
    </div>
  );
};

// 下拉选择组件
export const SettingSelect = ({ label, value, options, onChange, disabled }) => {
  return (
    <div className="setting-item" style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <div className="setting-header">
        <span className="setting-label">{label}</span>
      </div>
      <select 
        className="custom-select" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
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
        {options.map((opt, index) => (
          <option 
            key={index} 
            value={typeof opt === 'object' ? opt.value : opt}
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)'
            }}
          >
            {typeof opt === 'object' ? opt.label : opt}
          </option>
        ))}
      </select>
    </div>
  );
};

export const SettingCheckbox = ({ label, checked, onChange, inline = false, children }) => {
  return (
    <div className={`setting-item setting-checkbox ${inline ? 'setting-checkbox-inline' : ''}`}>
      <label className="setting-checkbox-main">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {children && (
        <div className="setting-sub-row">
          {children}
        </div>
      )}
    </div>
  );
};

export const SettingInput = ({ label, value, onChange, suffix, placeholder, type = "text" }) => {
  return (
    <div className="setting-item">
      <div className="setting-header">
        <span className="setting-label">{label}</span>
      </div>
      <div className="setting-sub-row">
        <input
          className="custom-input"
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="setting-input-suffix">{suffix}</span>}
      </div>
    </div>
  );
};

export const SettingPresets = ({ label, presets, currentPreset, onSelect, columns }) => {
  return (
    <div className="setting-item">
      <div className="setting-header">
        <span className="setting-label">{label}</span>
      </div>
      <div className={`preset-buttons ${columns ? `preset-columns-${columns}` : ''}`}>
        {presets.map((preset, index) => (
          <button 
            key={index} 
            className={`preset-btn ${currentPreset === preset ? 'active' : ''}`}
            onClick={() => onSelect(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
};

// 底部操作栏
const normalizeProgressValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  if (value && typeof value === 'object') {
    return normalizeProgressValue(value.percent ?? value.progress ?? value.value);
  }

  return 0;
};

export const ActionBar = ({ onConvert, onClear, onCancel, progress, isConverting, convertCount }) => {
  const { t } = useI18n();
  const totalCount = convertCount?.total || 0;
  const completedCount = convertCount?.current || 0;
  const displayCurrent = isConverting && totalCount > 0 && completedCount < totalCount
    ? completedCount + 1
    : completedCount;
  const safeProgress = Math.max(0, Math.min(100, Math.round(normalizeProgressValue(progress))));

  return (
    <div className="action-bar">
      <div className="action-buttons">
        <button className="btn-convert" onClick={onConvert} disabled={isConverting}>
          <span>⚡</span> {isConverting ? t('转换中...') : t('全部转换')}
        </button>
        <button className="btn-clear" onClick={onClear} disabled={isConverting}>
          <span>🗑️</span> {t('__clear_all')}
        </button>
      </div>
      
      {/* 只有在转换中或进度不为 0 时显示 */}
      {isConverting && (
        <div className="action-progress-container">
          <div className="action-progress">
             <div className="action-progress-info">
                <span className="progress-text">
                  {isConverting 
                    ? t('__progress_converting', { current: displayCurrent, total: totalCount }) 
                    : safeProgress === 100 
                      ? t('转换完成') 
                      : t('准备就绪')}
                </span>
             </div>
              <div className="action-progress-bar">
                <div 
                  className="action-progress-inner" 
                 style={{ transform: `scaleX(${safeProgress / 100})` }}
                ></div>
              </div>
          </div>
          {isConverting && (
            <button className="btn-cancel-task" onClick={onCancel} title={t('取消转换')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// 主布局容器
export const ToolLayout = ({ children }) => {
  return <div className="tool-container">{children}</div>;
};

// 确认对话框组件
export const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "是", cancelText = "否" }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 2000 }}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-header">
          <div className="confirm-title">{title}</div>
        </div>
        <div className="confirm-body">
          <p>{message}</p>
        </div>
        <div className="confirm-footer">
          <button className="btn-confirm-yes primary" onClick={onConfirm}>{confirmText}</button>
          {cancelText && <button className="btn-confirm-no" onClick={onCancel}>{cancelText}</button>}
        </div>
      </div>
    </div>
  );
};

export const AlertModal = ({ isOpen, title, message, onConfirm, onClose, buttonText = "确定", onCancel }) => {
  if (!isOpen) return null;
  const handleClose = onClose || onCancel || (() => {});
  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="confirm-title">{title}</div>
          <button 
            onClick={handleClose} 
            className="modal-close-btn"
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '20px', 
              cursor: 'pointer',
              color: '#64748b',
              padding: '0 4px',
              lineHeight: 1,
              marginTop: '-4px'
            }}
          >
            &times;
          </button>
        </div>
        <div className="confirm-body">
          <p>{message}</p>
        </div>
        <div className="confirm-footer center">
          <button className="btn-confirm-yes primary" onClick={onConfirm}>{buttonText}</button>
        </div>
      </div>
    </div>
  );
};

// 视频预览模态框
const RangeSlider = ({ min, max, start, end, onStartChange, onEndChange }) => {
  const minVal = parseFloat(min);
  const maxVal = parseFloat(max);
  const startVal = parseFloat(start);
  const endVal = parseFloat(end);

  const getPercent = (value) => ((value - minVal) / (maxVal - minVal)) * 100;

  return (
    <div className="range-slider-container">
      <div className="range-slider-track" />
      <div 
        className="range-slider-selection" 
        style={{ 
          left: `${getPercent(startVal)}%`, 
          width: `${getPercent(endVal) - getPercent(startVal)}%` 
        }} 
      />
      <input
        type="range"
        min={minVal}
        max={maxVal}
        step="0.1"
        value={startVal}
        onChange={(e) => {
          const value = Math.min(parseFloat(e.target.value), endVal - 0.1);
          onStartChange(value);
        }}
        className="range-handle"
        style={{ zIndex: startVal > (maxVal / 2) ? "5" : "4" }}
      />
      <input
        type="range"
        min={minVal}
        max={maxVal}
        step="0.1"
        value={endVal}
        onChange={(e) => {
          const value = Math.max(parseFloat(e.target.value), startVal + 0.1);
          onEndChange(value);
        }}
        className="range-handle"
      />
    </div>
  );
};

export const VideoPreviewModal = ({ file, isOpen, onClose, videoInfo, initialSettings, onConfirm }) => {
  const { t } = useI18n();
  const videoRef = React.useRef(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [browserVideoSrc, setBrowserVideoSrc] = useState(null);

  // Reset state when opening a new file
  React.useEffect(() => {
      if (isOpen && videoInfo) {
          // Use initialSettings if available, otherwise default to full duration
          if (initialSettings) {
              setStartTime(initialSettings.startTime ?? 0);
              setEndTime(initialSettings.endTime ?? videoInfo.duration ?? 0);
          } else {
              setStartTime(0);
              setEndTime(videoInfo.duration || 0);
          }
          setVideoError(false);
          setPreviewSrc(null);
          setIsLoadingPreview(false);

           // Check if we need to generate a preview (for AVI/MKV etc.)
           const filePath = typeof file === 'string' ? file : file?.name;
           const ext = filePath?.split('.').pop()?.toLowerCase();
           
            if (['avi', 'mkv', 'flv', 'mov', 'wmv'].includes(ext)) {
                generatePreview(filePath);
            }
      }
  }, [isOpen, videoInfo, file, initialSettings]);

  React.useEffect(() => {
      if (!isOpen || window.electron) {
          setBrowserVideoSrc(null);
          return undefined;
      }

      const resolvedFile = api.resolveFile(file);
      if (!(resolvedFile instanceof File)) {
          setBrowserVideoSrc(null);
          return undefined;
      }

      const objectUrl = URL.createObjectURL(resolvedFile);
      setBrowserVideoSrc(objectUrl);

      return () => {
          URL.revokeObjectURL(objectUrl);
      };
  }, [file, isOpen]);

  const generatePreview = async (filePath) => {
      setIsLoadingPreview(true);
      try {
          const result = await api.generatePreview(file);
          
          if (result.success && (result.previewUrl || result.previewPath)) {
              const nextSrc = result.previewUrl || (window.electron ? `media://${result.previewPath}` : '');
              setPreviewSrc(nextSrc);
              setVideoError(false);
          } else {
              console.error("Preview generation failed:", result.error);
              setVideoError(true);
          }
      } catch (err) {
          console.error("Preview generation error:", err);
          setVideoError(true);
      } finally {
          setIsLoadingPreview(false);
      }
  };

  if (!isOpen || !file) return null;

  // 如果是 Electron 且 file 是路径字符串，则构造 media:// 协议 URL
  // Priority: Generated Preview > Direct File Path (if supported) > Blob URL
  const resolvedPreviewFile = api.resolveFile(file);
  const videoSrc = previewSrc || (window.electron && typeof file === 'string'
    ? `media://${file}`
    : (resolvedPreviewFile instanceof File ? browserVideoSrc : ''));

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (seconds === undefined || seconds === null || seconds === 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleStartChange = (e) => {
    const val = parseFloat(e.target.value);
    if (val >= 0 && val < endTime) {
      setStartTime(val);
    }
  };

  const handleEndChange = (e) => {
    const val = parseFloat(e.target.value);
    if (val > startTime && val <= (videoInfo?.duration || 100000)) {
      setEndTime(val);
    }
  };

  const handleConfirm = () => {
      if (onConfirm) {
          onConfirm({ startTime, endTime });
      }
      onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="preview-modal" onClick={e => e.stopPropagation()} style={{ zIndex: 10000 }}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon">🎬</span>
            {t('视频预览与信息')}
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-content">
          <div className="preview-player-container">
            {isLoadingPreview ? (
                <div className="preview-loading">
                    <div className="spinner"></div>
                    <p>{t('正在生成预览...')}</p>
                </div>
            ) : videoError && !previewSrc ? (
              <div className="video-error-message">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <p>{t('浏览器不支持直接播放此 AVI 编码格式')}</p>
                <p className="small">{t('预览生成失败，但您可以正常查看信息并设置裁剪范围')}</p>
              </div>
            ) : (
              <video 
                ref={videoRef}
                src={videoSrc} 
                controls 
                className="preview-video"
                // autoPlay // Don't autoplay to avoid sudden noise
                onError={() => {
                    // Only set error if we are not loading a generated preview
                    if (!previewSrc) setVideoError(true);
                }}
              />
            )}
          </div>
          
          <div className="preview-info-container">
            <div className="info-grid">
              <div className="info-item">
                <div className="info-label">{t('文件名')}</div>
                <div className="info-value">{videoInfo?.name || (typeof file === 'string' ? file.split(/[/\\]/).pop() : file?.name)}</div>
              </div>
              <div className="info-item">
                <div className="info-label">{t('总时长')}</div>
                <div className="info-value">{formatDuration(videoInfo?.duration)}</div>
              </div>
              <div className="info-item">
                <div className="info-label">{t('分辨率')}</div>
                <div className="info-value">{videoInfo?.width ? `${videoInfo.width}×${videoInfo.height}` : '-'}</div>
              </div>
              <div className="info-item">
                <div className="info-label">{t('文件大小')}</div>
                <div className="info-value">{formatSize(videoInfo?.size)}</div>
              </div>
              <div className="info-item">
                <div className="info-label">{t('视频编码')}</div>
                <div className="info-value">{videoInfo?.codec || '-'}</div>
              </div>
              <div className="info-item">
                <div className="info-label">{t('音频编码')}</div>
                <div className="info-value">
                  {videoInfo?.audio_codec || t('未知')} 
                  {videoInfo?.audio_tracks_count > 0 && ` ${t('({{videoInfo.audio_tracks_count}} 条音轨)', { 'videoInfo.audio_tracks_count': videoInfo.audio_tracks_count })}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
           <div className="trim-section">
              <div className="trim-left">
                <div className="trim-title">{t('视频裁剪')}</div>
                <div className="trim-inputs">
                   <div className="trim-input-group">
                      <label>{t('开始时间 (秒)')}</label>
                      <input 
                        type="number" 
                        value={startTime.toFixed(2)} 
                        onChange={handleStartChange}
                        step="0.1"
                        min="0"
                        max={endTime - 0.1}
                      />
                   </div>
                   <div className="trim-input-group">
                      <label>{t('结束时间 (秒)')}</label>
                      <input 
                        type="number" 
                        value={endTime.toFixed(2)} 
                        onChange={handleEndChange}
                        step="0.1"
                        min={startTime + 0.1}
                        max={videoInfo?.duration || 100000}
                      />
                   </div>
                </div>
              </div>
              <div className="trim-right">
                <div className="range-labels">
                  <span>0.00s</span>
                  <span>{formatDuration(videoInfo?.duration)}</span>
                </div>
                {videoInfo?.duration > 0 ? (
                  <RangeSlider 
                    min={0}
                    max={videoInfo?.duration || 100}
                    start={startTime}
                    end={endTime}
                    onStartChange={(val) => {
                      setStartTime(val);
                      if (videoRef.current) {
                        videoRef.current.pause();
                        videoRef.current.currentTime = val;
                      }
                    }}
                    onEndChange={(val) => {
                      setEndTime(val);
                      if (videoRef.current) {
                        videoRef.current.pause();
                        videoRef.current.currentTime = val;
                      }
                    }}
                  />
                ) : (
                  <div className="range-slider-placeholder">
                    {t('无法获取视频时长，暂不支持裁剪')}
                  </div>
                )}
                <button className="btn-confirm" onClick={handleConfirm} disabled={!(videoInfo?.duration > 0)}>
                    {t('确定裁剪')}
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

