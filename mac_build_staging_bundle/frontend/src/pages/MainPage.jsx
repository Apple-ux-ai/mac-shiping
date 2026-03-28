import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { categories } from '../data';
import ToolHeader from '../components/ToolHeader';
import ToolSidebar from '../components/ToolSidebar';
import RecentToolsBar from '../components/RecentToolsBar';
import { useRecentToolsStore } from '../stores/useRecentToolsStore';
// 导入组件映射
import { componentMap } from '../componentMap';
// 导入示例业务组件
import DemoFeature from '../components/features/DemoFeature';
import '../App.css';

// 辅助函数：在所有分类中查找工具
function findToolGlobal(toolName) {
  if (!toolName) return null;
  const allCategories = Object.values(categories).flat();
  for (const section of allCategories) {
    const tool = section.tools.find(t => t.name === toolName);
    if (tool) return tool;
  }
  return null;
}

function findToolSelection(categoryData, source, target) {
  const initialSection = categoryData && categoryData.length > 0 ? categoryData[0] : null;
  if (!source || !target || !categoryData) {
    return { initialSection, initialSelectedTool: null };
  }

  const toolName = `${source.toUpperCase()} To ${target.toUpperCase()}`;
  for (const section of categoryData) {
    const tool = section.tools.find(t => t.name.toLowerCase() === toolName.toLowerCase());
    if (tool) {
      return { initialSection: section, initialSelectedTool: tool.name };
    }
  }
  return { initialSection, initialSelectedTool: null };
}

function MainPageContent({ categoryData, source, target }) {
  const { initialSection, initialSelectedTool } = findToolSelection(categoryData, source, target);
  
  const { addTool } = useRecentToolsStore();
  const [activeSection, setActiveSection] = useState(() => initialSection);
  const [selectedTool, setSelectedTool] = useState(() => initialSelectedTool);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const electronApi = window.electron;
    if (!electronApi) return;

    electronApi.isWindowMaximized?.().then(setIsMaximized).catch(() => {});

    const handleMaximizedStateChange = (state) => {
      setIsMaximized(Boolean(state));
    };
    electronApi.onWindowMaximizedStateChanged?.(handleMaximizedStateChange);
    return () => {
      electronApi.removeWindowMaximizedStateChangedListener?.();
    };
  }, []);

  const handleBackToGrid = () => {
    setSelectedTool(null);
  };

  // 渲染具体业务组件的函数
  // 你应该在这里根据 selectedTool 渲染不同的组件
  const renderFeatureComponent = () => {
    if (!selectedTool) return null;

    const ToolComponent = componentMap[selectedTool];
    if (ToolComponent) {
      return <ToolComponent onBack={handleBackToGrid} />;
    }

    return (
      <DemoFeature 
        toolName={selectedTool} 
        onBack={handleBackToGrid}
      />
    );
  };

  if (!activeSection) return null;

  return (
    <div className={`app-container ${isMaximized ? 'maximized' : ''}`}>
      <ToolHeader />
      <div className="main-layout">
        <ToolSidebar 
          sections={categoryData} 
          activeSection={activeSection} 
          onSectionClick={(section) => {
            setActiveSection(section);
            setSelectedTool(null);
          }} 
          onToolClick={(tool, section) => {
            addTool(tool.name);
            setActiveSection(section);
            setSelectedTool(tool.name);
          }}
        />
        <main className="content-area">
          <div className="content-wrapper">
            {!selectedTool && (
              <RecentToolsBar 
                onToolClick={(tool) => {
                  const section = categoryData.find(s => s.name === tool.sectionName) || categoryData[0];
                  addTool(tool.name);
                  setActiveSection(section);
                  setSelectedTool(tool.name);
                }} 
              />
            )}
            {selectedTool ? (
              renderFeatureComponent()
            ) : (
              <>
                <div className="section-header">
                  <div className="section-divider"></div>
                  <h2 className="section-title">{activeSection.name}</h2>
                </div>
                
                {/* 网格视图 */}
                <div className="card-grid">
                  {activeSection.tools.map((tool) => {
                    // 解析工具名称，提取源格式和目标格式 (例如 "AVI To JPG")
                    const nameParts = tool.name.split(' To ');
                    const sourceFormat = nameParts[0];
                    const targetFormat = nameParts[1];

                    return (
                      <div 
                        key={tool.name} 
                        className="tool-card"
                        onClick={() => {
                          addTool(tool.name);
                          setSelectedTool(tool.name);
                        }}
                      >
                        <div className="tool-card-icon">
                          {targetFormat ? (
                            <>
                              <span className="format-text source">{sourceFormat}</span>
                              <div className="format-divider"></div>
                              <span className="format-text target">{targetFormat}</span>
                            </>
                          ) : (
                            <tool.icon className="tool-icon" />
                          )}
                        </div>
                        <div className="card-content">
                          <div className="card-header-row">
                            <h3 className="card-title">{tool.name}</h3>
                            <div className="card-tags">
                              <span className="tag">{activeSection.name.split(' ')[0]} TOOLS</span>
                            </div>
                          </div>
                          <p className="card-desc">{tool.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function MainPage() {
  const { source, target } = useParams();
  const categoryKeys = Object.keys(categories);
  const firstCategoryKey = categoryKeys.length > 0 ? categoryKeys[0] : null;
  const categoryData = firstCategoryKey ? categories[firstCategoryKey] : [];

  return (
    <MainPageContent
      key={`${source ?? ''}:${target ?? ''}`}
      categoryData={categoryData}
      source={source}
      target={target}
    />
  );
}

export default MainPage;
