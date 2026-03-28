import React, { useState } from 'react';
import { message } from 'antd';
import { AuthService } from '../services/auth';
import '../App.css';

const FeedbackButton = () => {
  const [isHovered, setIsHovered] = useState(false);

  const handleFeedbackClick = async () => {
    try {
      const url = await AuthService.fetchFeedbackUrl();
      if (url) {
        // Use window.open for external links
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        console.error('Failed to get feedback URL');
        message.error('暂时无法打开问题反馈，请稍后重试');
      }
    } catch (error) {
      console.error('Error opening feedback URL:', error);
      message.error('问题反馈打开失败，请检查网络后重试');
    }
  };

  return (
    <div className="feedback-button-container" style={{ marginBottom: '8px' }}>
      <button
        onClick={handleFeedbackClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="feedback-btn"
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
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span>问题反馈</span>
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

export default FeedbackButton;
