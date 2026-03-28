import { useRecentToolsStore } from '../stores/useRecentToolsStore';
import { categories } from '../data';
import { CloseCircleFilled, ClockCircleOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import './RecentToolsBar.css';

const RecentToolsBar = ({ onToolClick }) => {
  const { recentTools, removeTool } = useRecentToolsStore();

  const tools = useMemo(() => {
    if (recentTools.length === 0) return [];
    
    const allCategories = Object.values(categories).flat();
    return recentTools.map(name => {
      for (const section of allCategories) {
        const tool = section.tools.find(t => t.name === name);
        if (tool) return { ...tool, sectionName: section.name };
      }
      return null;
    }).filter(Boolean);
  }, [recentTools]);

  if (tools.length === 0) return null;

  return (
    <div className="recent-tools-bar">
      <div className="recent-tools-header">
        <ClockCircleOutlined style={{ marginRight: 6 }} />
        <span className="recent-tools-title">最近使用</span>
      </div>
      <div className="recent-tools-list">
        {tools.map((tool) => (
          <div 
            key={tool.name} 
            className="recent-tool-chip"
            onClick={() => onToolClick(tool)}
          >
            {tool.icon && <tool.icon className="recent-tool-icon" />}
            <span className="recent-tool-name">{tool.name}</span>
            <span 
              className="recent-tool-remove"
              onClick={(e) => {
                e.stopPropagation();
                removeTool(tool.name);
              }}
              title="移除"
            >
              <CloseCircleFilled />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentToolsBar;
