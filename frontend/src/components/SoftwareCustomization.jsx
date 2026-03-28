import React, { useState } from 'react';
import { message } from 'antd';
import { AuthService } from '../services/auth';
import '../App.css';

const SoftwareCustomization = () => {
  const [isHovered, setIsHovered] = useState(false);

  const handleCustomizationClick = async () => {
    try {
      const url = await AuthService.fetchCustomUrl();
      if (url) {
        // Use window.open for external links
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        console.error('Failed to get customization URL');
        message.error('暂时无法打开软件定制，请稍后重试');
      }
    } catch (error) {
      console.error('Error opening customization URL:', error);
      message.error('软件定制打开失败，请检查网络后重试');
    }
  };

  return (
    <div className="software-customization-container" style={{ marginBottom: '8px' }}>
      <button
        onClick={handleCustomizationClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="software-customization-btn"
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: '16px',
          border: 'none',
          background: isHovered ? 'var(--hover-bg)' : 'transparent',
          color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontSize: '15px',
          fontWeight: '500',
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          transform: isHovered ? 'translateX(4px)' : 'none',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ color: 'var(--primary-color)' }}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span>软件定制</span>
        </div>
        
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{ opacity: 0.6 }}
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </button>
    </div>
  );
};

export default SoftwareCustomization;
