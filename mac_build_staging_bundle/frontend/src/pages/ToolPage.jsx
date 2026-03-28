import { useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { categories } from '../data';
import '../App.css';

// Slug to Category Name mapping
const slugMap = {
  'video': '视频类',
  'image': '图片类',
  'doc': '文档类',
  'audio': '音频类'
};

function ToolPageInner({ currentCategoryName }) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(() => categories[currentCategoryName]?.[0] ?? null);

  const handleSectionClick = (section) => {
    setActiveSection(section);
  };

  // Helper to parse tool name
  const parseToolName = (toolName) => {
    const parts = toolName.split(' To ');
    if (parts.length === 2) {
      return { source: parts[0], target: parts[1] };
    }
    return { source: 'FILE', target: 'FILE' };
  };

  // Helper to generate description
  const generateDescription = (toolName, source, target) => {
    return `一款在线${source}转${target}转换器，支持自定义参数，提供多种分辨率选项，助您轻松完成格式转换。`;
  };

  if (!activeSection) return null;

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-left">
          <div className="nav-logo-placeholder">LOGO区域</div>
          <button className="nav-back-btn" onClick={() => navigate('/')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>返回首页</span>
          </button>
        </div>
        
        <div className="nav-right">
          <div className="ad-banner-top">
            AD (4:1)
          </div>
          <button className="login-btn">登录</button>
        </div>
      </nav>

      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-list">
            {categories[currentCategoryName].map((section) => (
              <div
                key={section.name}
                className={`sidebar-item ${activeSection.name === section.name ? 'active' : ''}`}
                onClick={() => handleSectionClick(section)}
              >
                {section.name}
              </div>
            ))}
          </div>
          
        </aside>

        {/* Content Area */}
        <main className="content-area">
          <div className="content-wrapper">
            <h2 className="section-title">{activeSection.name.replace(' 转换器', ' 工具')}</h2>
            
            <div className="card-grid">
              {activeSection.tools.map((tool) => {
                const { source, target } = parseToolName(tool);
                return (
                  <div key={tool} className="tool-card">
                    <div className="card-header">
                      <div className="format-icon">
                        <span className="format-source">{source}</span>
                        <span className="format-target">{target}</span>
                      </div>
                      <div className="tool-info">
                        <div className="tool-title">{tool}</div>
                        <span className="tool-badge">{source} TOOLS</span>
                      </div>
                    </div>
                    <div className="card-desc">
                      {generateDescription(tool, source, target)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ToolPage() {
  const { type } = useParams();
  const currentCategoryName = slugMap[type] || '视频类';

  if (!categories[currentCategoryName]) {
    return <Navigate to="/" replace />;
  }

  return <ToolPageInner key={currentCategoryName} currentCategoryName={currentCategoryName} />;
}

export default ToolPage;
