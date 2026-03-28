import { useNavigate } from 'react-router-dom';
import '../App.css'; // Reuse basic vars

// Map display names to URL slugs
const categoryMap = {
  '视频类': 'video'
};

function Home() {
  const navigate = useNavigate();
  const categories = Object.keys(categoryMap);

  const getIcon = (cat) => {
    switch(cat) {
      case '视频类': return '🎬';
      case '图片类': return '🖼️';
      case '文档类': return '📄';
      case '音频类': return '🎵';
      default: return '📁';
    }
  };

  const getDescription = (cat) => {
    switch(cat) {
      case '视频类': return 'AVI, MP4, GIF 等视频格式互转';
      case '图片类': return 'JPG, PNG, SVG 等图片处理工具';
      case '文档类': return 'PDF, DOCX, JSON 等文档转换';
      case '音频类': return 'MP3, WAV 等音频格式转换';
      default: return '各种格式转换工具';
    }
  };

  return (
    <div className="app-container" style={{ background: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
      <div className="home-wrapper">
        <h1 className="home-title">ConvertTool</h1>
        <p className="home-subtitle">简单、高效的在线文件格式转换工具集</p>
        
        <div className="home-grid">
          {categories.map((cat) => (
            <div 
              key={cat} 
              className="home-card"
              onClick={() => navigate(`/tools/${categoryMap[cat]}`)}
            >
              <div className="home-card-icon">{getIcon(cat)}</div>
              <h3 className="home-card-title">{cat}</h3>
              <p className="home-card-desc">{getDescription(cat)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
