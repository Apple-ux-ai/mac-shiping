import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { categories } from '../data';
import ToolHeader from '../components/ToolHeader';
import ToolSidebar from '../components/ToolSidebar';
import AVIToJPGUI from '../tool-ui/video/AVIToJPGUI'; // Import the tool UI directly
import AVIToMPEGUI from '../tool-ui/video/AVIToMPEGUI'; // Import AVI To MPE UI
import '../App.css';

function VideoTools() {
  const categoryData = categories['视频类'];
  const [activeSection, setActiveSection] = useState(() => categoryData?.[0] ?? null);
  
  // Determine if we are showing a specific tool or the list
  const [currentTool, setCurrentTool] = useState(null);

  // Handle back button or direct navigation logic if needed
  const handleBackToList = () => {
    setCurrentTool(null);
  };

  if (!categoryData?.length) return <Navigate to="/" replace />;
  if (!activeSection) return null;

  return (
    <div className="app-container">
      <ToolHeader />
      <div className="main-layout">
        <ToolSidebar 
          sections={categoryData} 
          activeSection={activeSection} 
          onSectionClick={(section) => {
            setActiveSection(section);
            setCurrentTool(null); // Reset to list view when changing sections
          }} 
        />
        <main className="content-area">
          <div className="content-wrapper">
            {currentTool === 'AVI To JPG' ? (
              // Render the specific tool UI inside the content area
              <AVIToJPGUI onBack={handleBackToList} />
            ) : currentTool === 'AVI To MPE' ? (
              // Render the specific tool UI inside the content area
              <AVIToMPEGUI onBack={handleBackToList} />
            ) : (
              // Render the list of tools
              <>
                <div className="section-header">
                  <div className="section-divider"></div>
                  <h2 className="section-title">{activeSection.name}</h2>
                </div>
                
                <div className="card-grid">
                  {activeSection.tools.map((tool) => (
                    <div 
                      key={tool} 
                      className="tool-card"
                      onClick={() => {
                        if (tool === "AVI To JPG" || tool === "AVI To MPE" || tool === "AVI To MOV" || tool === "AVI To WAV") {
                            setCurrentTool(tool);
                        } else {
                            alert("该功能尚未实现 UI，请先试用 AVI To JPG");
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="card-icon-wrapper">
                        <div className="file-icon source">AVI</div>
                        <div className="arrow-icon">→</div>
                        <div className="file-icon target">MP4</div>
                      </div>
                      <div className="card-content">
                        <h3 className="card-title">{tool}</h3>
                        <div className="card-tags">
                          <span className="tag">AVI TOOLS</span>
                        </div>
                        <p className="card-desc">
                          一款在线{tool}转换器，支持自定义参数，提供多种分辨率选项，助您轻松完成格式转换。
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default VideoTools;
