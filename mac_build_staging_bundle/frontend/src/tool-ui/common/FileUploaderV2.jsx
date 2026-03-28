import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { api } from '../../services/api';

export const FileUploaderV2 = ({ 
  files = [], 
  fileInfos = {}, 
  onAddFile, 
  onAddFolder, 
  onRemoveFile, 
  onSetGlobalPath,
  onSetCustomPath,
  onPreview, 
  activeFile, 
  onSelectFile, // External selection if needed, but we'll handle multi-select internally for path setting
  onDropFiles, // New prop for drag and drop
  results = {}, // { filePath: resultDirPath }
  customPaths = {}, // { filePath: customPath }
  globalPath = '',
  showAudioInfo = true,
  hidePreview = false,
  uploadPlaceholder = "将您的文件拖拽到此处"
}) => {
  const { t } = useI18n();
  const hasFiles = files && files.length > 0;
  const isWebMode = !api.isElectron();
  const [isDragging, setIsDragging] = useState(false);
  const [batchError, setBatchError] = useState('');
  const resultEntries = Object.entries(results || {}).filter(([, value]) => !!value);
  const batchReady = isWebMode && resultEntries.length > 1;

  const buildBatchArchiveName = () => {
    const firstFile = files[0];
    const firstPath = typeof firstFile === 'string' ? firstFile : firstFile?.path || firstFile?.name || 'results';
    const firstName = firstPath.split(/[/\\]/).pop() || 'results';
    const baseName = firstName.replace(/\.[^/.]+$/, '') || 'results';
    const extraCount = Math.max(0, resultEntries.length - 1);
    return extraCount > 0
      ? `${baseName}-and-${extraCount}-more.zip`
      : `${baseName}-result.zip`;
  };
  
  // Internal selection state for path setting operations
  const [selectedForPath, setSelectedForPath] = useState(new Set());

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
      // If we're in Electron, we can get the path directly.
      // If web, we might just get File objects (which is fine for preview if handled)
      // But typically we want paths for backend processing.
      // Assuming parent component handles path extraction or File object usage.
      onDropFiles(droppedFiles);
    }
  };


  const handleItemClick = (file, e) => {
    // Prevent triggering if clicking actions
    e.stopPropagation();
    
    // Toggle selection
    const newSelection = new Set(selectedForPath);
    if (newSelection.has(file)) {
      newSelection.delete(file);
    } else {
      newSelection.add(file);
    }
    setSelectedForPath(newSelection);
    
    // Also trigger external select if provided (for preview etc)
    if (onSelectFile) {
      onSelectFile(file);
    }
  };

  const handleSetPath = (e) => {
    e.stopPropagation();
    if (selectedForPath.size > 0 && onSetCustomPath) {
      onSetCustomPath(Array.from(selectedForPath));
      // Optional: Clear selection after setting path? Let's keep it for now user might want to change it again
      setSelectedForPath(new Set());
    }
  };
  
  const handleOpenResult = (path, e) => {
    e.stopPropagation();
    if (!path) return;

    let target = path;
    if (typeof target === 'object') {
      target = target.path || target.output || target.outputPath || '';
    }

    api.openPath(target);
  };

  const handleDownloadAllResults = async (e) => {
    e.stopPropagation();
    const downloadPaths = resultEntries.map(([, value]) => {
      if (typeof value === 'string') {
        return value;
      }
      return value?.path || value?.output || value?.outputPath || '';
    }).filter(Boolean);

    try {
      setBatchError('');
      await api.downloadBatchResults(downloadPaths, buildBatchArchiveName());
    } catch (error) {
      console.error('Batch download failed', error);
      setBatchError('批量下载失败，请稍后重试');
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
                   <span>📂</span> 导入文件夹
                 </button>
               )}
               
                {!isWebMode && (
                  <button 
                    className="header-btn" 
                    onClick={onSetGlobalPath}
                    title={globalPath ? t('当前全局路径: {{globalPath}}', { globalPath }) : t('设置全局输出路径')}
                  >
                    <span>🌐</span> {t('全局配置')}
                  </button>
                )}

                {!isWebMode && (
                  <button 
                    className={`header-btn ${selectedForPath.size === 0 ? 'disabled' : ''}`} 
                    onClick={handleSetPath}
                    disabled={selectedForPath.size === 0}
                    style={{ opacity: selectedForPath.size === 0 ? 0.5 : 1 }}
                  >
                    <span>📍</span> {t('__set_path_count', { count: selectedForPath.size })}
                  </button>
                )}

                {batchReady && (
                  <button className="header-btn" onClick={handleDownloadAllResults}>
                    <span>⬇️</span> {t('下载批量结果')}
                  </button>
                )}
              </div>
           </div>
          <div className="file-list">
            {files.map((file, index) => {
              const isSelected = selectedForPath.has(file);
              const isActive = activeFile === file; // Keep original active concept for preview if needed
              const filePath = typeof file === 'string' ? file : file.path;
              const info = fileInfos[filePath];
              const trackCount = info?.audio_tracks_count;
              const hasCustomPath = customPaths[filePath];
              const resultPath = results[filePath];
              
              return (
                <div 
                  key={index} 
                  className={`file-item ${isSelected ? 'selected-for-path' : ''} ${isActive ? 'active' : ''}`}
                  onClick={(e) => handleItemClick(file, e)}
                  style={{ 
                    cursor: 'pointer',
                    border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    margin: isSelected ? '0px' : '1px', // Compensate for border width difference to prevent layout shift
                    backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.05)' : undefined,
                    outline: 'none',
                    userSelect: 'none'
                  }}
                >
                  <div className="file-icon">🎬</div>
                  <div className="file-info">
                    <div className="file-name">
                        {typeof file === 'string' ? file.split(/[/\\]/).pop() : file.name}
                        {hasCustomPath && <span className="path-badge custom" title={t('已设置自定义路径')}>📍</span>}
                    </div>
                    <div className="file-path">{filePath}</div>
                  </div>
                  <div className="file-actions-inline">
                      {/* Result action button */}
                      {resultPath && (
                         <button 
                             className="btn-preview-small" 
                             onClick={(e) => handleOpenResult(resultPath, e)}
                             title={isWebMode ? t('下载结果文件') : t('打开结果文件夹')}
                             style={{ marginRight: '8px', color: 'var(--primary-color)', borderColor: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: isWebMode ? '0 10px' : undefined }}
                         >
                           {isWebMode ? (
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                               <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                               <polyline points="7 10 12 15 17 10"></polyline>
                               <line x1="12" y1="15" x2="12" y2="3"></line>
                             </svg>
                           ) : (
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                               <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                             </svg>
                           )}
                           {isWebMode && <span style={{ fontSize: '12px' }}>{t('下载')}</span>}
                         </button>
                      )}

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
          {batchError && (
            <div style={{ color: '#f87171', fontSize: '12px', padding: '10px 16px 0' }}>
              {batchError}
            </div>
          )}
        </>
      )}
    </div>
  );
};
