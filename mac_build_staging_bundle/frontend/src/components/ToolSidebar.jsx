import { useState, useEffect, useRef, useMemo } from 'react';
import FeedbackButton from './FeedbackButton';
import '../App.css';

function ToolSidebar({ sections, activeSection, onSectionClick, onToolClick }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim() || !sections) return [];

    const results = [];
    sections.forEach(section => {
      if (section.tools) {
        section.tools.forEach(tool => {
          if (tool.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            results.push({ ...tool, section });
          }
        });
      }
    });
    return results;
  }, [searchTerm, sections]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchResultClick = (result) => {
    // 1. Clear search
    setSearchTerm('');
    setShowDropdown(false);
    
    // 2. Notify parent
    if (onToolClick) {
      onToolClick(result, result.section);
    }
  };

  if (!sections) return null;

  return (
    <aside className="sidebar">
      {/* Search Box */}
      <div className="sidebar-search-wrapper" ref={searchRef}>
        <div className="sidebar-search-input-container">
          <svg className="sidebar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="搜索功能..."
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              if (!value.trim()) {
                setShowDropdown(false);
                return;
              }
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (searchTerm.trim()) setShowDropdown(true);
            }}
          />
        </div>

        {/* Dropdown Results */}
        {showDropdown && (
          <div className="search-results-dropdown">
            {searchResults.length > 0 ? (
              searchResults.map((result, index) => (
                <div 
                  key={`${result.section.name}-${result.name}-${index}`}
                  className="search-result-item"
                  onClick={() => handleSearchResultClick(result)}
                >
                  <span className="search-result-name">
                    {result.name.split(new RegExp(`(${searchTerm})`, 'gi')).map((part, i) => 
                      part.toLowerCase() === searchTerm.toLowerCase() ? <span key={i} className="search-result-match">{part}</span> : part
                    )}
                  </span>
                  <span className="search-result-category">{result.section.name}</span>
                </div>
              ))
            ) : (
              <div className="search-no-results">未找到相关功能</div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-list">
        {sections.map((section, index) => (
          <div key={section.name}>
            <div
              className={`sidebar-item ${activeSection?.name === section.name ? 'active' : ''}`}
              onClick={() => onSectionClick(section)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {section.icon && (
                  // Handle Ant Design Icons (which are objects with render function or functional components)
                  typeof section.icon === 'function' ? <section.icon /> : (
                    section.icon.render ? <section.icon /> : null
                  )
                )}
                <span>{section.name}</span>
              </div>
              {activeSection?.name === section.name && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-color)' }}>
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              )}
            </div>
            {/* 如果是“最近使用”且不是最后一项，添加分隔线 */}
            {section.name === '最近使用' && index < sections.length - 1 && (
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 16px', opacity: 0.5 }}></div>
            )}
          </div>
        ))}
      </div>

      <FeedbackButton />
    </aside>
  );
}

export default ToolSidebar;
