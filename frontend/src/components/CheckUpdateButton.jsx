import React, { useState } from 'react';
import ReactDOM from 'react-dom';

// IMPORTANT: This version must match package.json
const APP_VERSION = "1.0.0"; 
// const APP_VERSION = window.electronAPI ? window.electronAPI.getVersion() : "1.0.0";

const CheckUpdateButton = () => {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCheckUpdate = async () => {
    if (loading || isUpdating) return;
    setLoading(true);
    try {
      if (!window.electron || !window.electron.checkUpdate) {
        alert('更新功能不可用 (Electron environment missing)');
        return;
      }

      console.log('Checking update for version:', APP_VERSION);
      const result = await window.electron.checkUpdate(APP_VERSION);
      console.log('Update check result:', result);

      if (result.success) {
        if (result.data.has_update) {
          // Map API fields (download_url, package_hash) to internal fields (url, hash)
          const downloadUrl = result.data.download_url || result.data.url;
          const fileHash = result.data.package_hash || result.data.hash;

          if (!downloadUrl) {
            console.error('Update check returned success but no URL:', result.data);
            alert('检测到新版本，但下载地址无效。请联系客服。');
            return;
          }
          setUpdateInfo({
            version: result.data.version,
            url: downloadUrl,
            hash: fileHash
          });
          setShowModal(true);
        } else {
          alert('当前已是最新版本');
        }
      } else {
        alert('检查更新失败: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Check update error:', error);
      alert('检查更新出错: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUpdate = () => {
    if (updateInfo && window.electron && window.electron.startUpdate) {
      setIsUpdating(true);
      window.electron.startUpdate({
        url: updateInfo.url,
        hash: updateInfo.hash
      });
      // Do NOT close modal immediately, let user see "Starting..."
      // The app will likely quit shortly after.
    }
  };

  const modalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999, // Ensure it's on top of everything
    backdropFilter: 'blur(2px)'
  };

  const contentStyle = {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '12px',
    minWidth: '320px',
    maxWidth: '400px',
    color: '#333',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    textAlign: 'center'
  };

  const buttonStyle = {
    padding: '8px 20px', 
    border: 'none', 
    borderRadius: '6px', 
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  };

  const cancelBtnStyle = {
    ...buttonStyle,
    background: '#f5f7fa',
    color: '#606266',
    border: '1px solid #dcdfe6'
  };

  const confirmBtnStyle = {
    ...buttonStyle,
    background: '#409eff',
    color: '#fff',
    marginLeft: '12px'
  };

  const modalContent = showModal ? (
    <div style={modalStyle}>
      <div style={contentStyle}>
        <h3 style={{marginTop:0, marginBottom: '16px', fontSize: '18px', color: '#303133'}}>
          发现新版本 {updateInfo?.version}
        </h3>
        {isUpdating ? (
          <div style={{padding: '20px 0'}}>
            <div className="spinner" style={{
              width: '24px', height: '24px', 
              border: '3px solid #f3f3f3', borderTop: '3px solid #409eff', 
              borderRadius: '50%', margin: '0 auto 15px',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <p style={{color: '#606266', fontSize: '14px', margin: 0}}>
              正在启动更新程序，请留意 UAC 弹窗...<br/>
              <span style={{fontSize: '12px', color: '#909399'}}>程序将自动关闭以完成安装</span>
            </p>
          </div>
        ) : (
          <>
            <p style={{color: '#606266', marginBottom: '24px'}}>是否立即更新？</p>
            <div style={{display: 'flex', justifyContent: 'center'}}>
              <button 
                onClick={() => setShowModal(false)} 
                style={cancelBtnStyle}
              >
                取消
              </button>
              <button 
                onClick={handleConfirmUpdate} 
                style={confirmBtnStyle}
              >
                立即更新
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  // Use Portal to render outside the sidebar structure
  return (
    <>
      <div 
        className="sidebar-item" 
        onClick={handleCheckUpdate}
        style={{ cursor: (loading || isUpdating) ? 'wait' : 'pointer' }}
      >
        <span>{loading ? '检查更新中...' : (isUpdating ? '正在更新...' : '检查更新')}</span>
        <span style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: 'auto' }}>v{APP_VERSION}</span>
      </div>
      
      {showModal && ReactDOM.createPortal(modalContent, document.body)}
    </>
  );
};

export default CheckUpdateButton;
