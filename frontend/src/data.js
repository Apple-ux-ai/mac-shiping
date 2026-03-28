import { 
  VideoCameraOutlined,
  FileImageOutlined,
  FileOutlined,
  PlaySquareOutlined,
  FilePdfOutlined
} from '@ant-design/icons';

// 侧边栏菜单配置
export const categories = {
  '视频处理': [
    {
      name: 'AVI 转换器',
      icon: VideoCameraOutlined,
      description: 'AVI 格式视频转换工具集',
      tools: [
        { name: 'AVI To JPG', icon: FileImageOutlined, description: '将 AVI 视频转换为 JPG 图片序列' },
        { name: 'AVI To MP4', icon: PlaySquareOutlined, description: '将 AVI 视频转换为 MP4 格式' },
        { name: 'AVI To GIF', icon: FileImageOutlined, description: '将 AVI 视频转换为 GIF 动图' },
        { name: 'AVI To PNG', icon: FileImageOutlined, description: '将 AVI 视频转换为 PNG 图片序列' },
        { name: 'AVI To MP3', icon: FileOutlined, description: '从 AVI 视频提取 MP3 音频' },
        { name: 'AVI To WEBM', icon: VideoCameraOutlined, description: '将 AVI 视频转换为 WEBM 格式' },
        { name: 'AVI To H264', icon: VideoCameraOutlined, description: '将 AVI 视频转换为 H.264 编码' },
        { name: 'AVI To MPF', icon: FileOutlined, description: '将 AVI 视频转换为 MPF 格式' },
        { name: 'AVI To MKV', icon: VideoCameraOutlined, description: '将 AVI 视频转换为 MKV 格式' },
        { name: 'AVI To MPE', icon: VideoCameraOutlined, description: '将 AVI 视频转换为 MPE 格式' },
        { name: 'AVI To MOV', icon: VideoCameraOutlined, description: '将 AVI 视频转换为 MOV 格式' },
        { name: 'AVI To WAV', icon: FileOutlined, description: '从 AVI 视频提取 WAV 音频' }
      ]
    },
    {
      name: 'GIF 转换器',
      icon: FileImageOutlined,
      description: 'GIF 动图转换工具集',
      tools: [
        { name: 'GIF To MP4', icon: PlaySquareOutlined, description: '将 GIF 动图转换为 MP4 视频' },
        { name: 'GIF To HTML', icon: FileOutlined, description: '将 GIF 转换为 HTML 动画' },
        { name: 'GIF To PNG', icon: FileImageOutlined, description: '将 GIF 动图转换为 PNG 图片序列' },
        { name: 'GIF To MOV', icon: VideoCameraOutlined, description: '将 GIF 动图转换为 MOV 视频' },
        { name: 'GIF To PDF', icon: FilePdfOutlined, description: '将 GIF 动图转换为 PDF 文档' },
        { name: 'GIF To BASE64', icon: FileOutlined, description: '将 GIF 转换为 Base64 编码' },
        { name: 'GIF To WEBP', icon: FileImageOutlined, description: '将 GIF 转换为 WEBP 格式' },
        { name: 'GIF To JPG', icon: FileImageOutlined, description: '将 GIF 转换为 JPG 图片序列' },
        { name: 'GIF To WEBM', icon: VideoCameraOutlined, description: '将 GIF 转换为 WEBM 视频' },
        { name: 'GIF To AVI', icon: VideoCameraOutlined, description: '将 GIF 转换为 AVI 视频' }
      ]
    },
    {
      name: 'WEBM 转换器',
      icon: VideoCameraOutlined,
      description: 'WEBM 格式视频转换工具集',
      tools: [
        { name: 'WEBM To PNG', icon: FileImageOutlined, description: '将 WEBM 视频转换为 PNG 图片序列' },
        { name: 'WEBM To GIF', icon: FileImageOutlined, description: '将 WEBM 视频转换为 GIF 动图' },
        { name: 'WEBM To JPG', icon: FileImageOutlined, description: '将 WEBM 视频转换为 JPG 图片序列' },
        { name: 'WEBM To MP4', icon: PlaySquareOutlined, description: '将 WEBM 视频转换为 MP4 格式' },
        { name: 'WEBM To MP3', icon: FileOutlined, description: '从 WEBM 视频提取 MP3 音频' },
        { name: 'WEBM To MOV', icon: VideoCameraOutlined, description: '将 WEBM 视频转换为 MOV 格式' },
        { name: 'WEBM To AVI', icon: VideoCameraOutlined, description: '将 WEBM 视频转换为 AVI 格式' },
        { name: 'WEBM To WAV', icon: FileOutlined, description: '从 WEBM 视频提取 WAV 音频' }
      ]
    },
    {
      name: 'MOV 转换器',
      icon: VideoCameraOutlined,
      description: 'MOV 格式视频转换工具集',
      tools: [
        { name: 'MOV To PNG', icon: FileImageOutlined, description: '将 MOV 视频转换为 PNG 图片序列' },
        { name: 'MOV To MP4', icon: PlaySquareOutlined, description: '将 MOV 视频转换为 MP4 格式' },
        { name: 'MOV To JPG', icon: FileImageOutlined, description: '将 MOV 视频转换为 JPG 图片序列' },
        { name: 'MOV To GIF', icon: FileImageOutlined, description: '将 MOV 视频转换为 GIF 动图' },
        { name: 'MOV To AVI', icon: VideoCameraOutlined, description: '将 MOV 视频转换为 AVI 格式' },
        { name: 'MOV To PDF', icon: FilePdfOutlined, description: '将 MOV 视频转换为 PDF 文档' },
        { name: 'MOV To MP3', icon: FileOutlined, description: '从 MOV 视频提取 MP3 音频' },
        { name: 'MOV To WEBM', icon: VideoCameraOutlined, description: '将 MOV 视频转换为 WEBM 格式' },
        { name: 'MOV To WAV', icon: FileOutlined, description: '从 MOV 视频提取 WAV 音频' }
      ]
    },
    {
      name: 'MP4 转换器',
      icon: PlaySquareOutlined,
      description: 'MP4 格式视频转换工具集',
      tools: [
        { name: 'MP4 To AVI', icon: VideoCameraOutlined, description: '将 MP4 视频转换为 AVI 格式' },
        { name: 'MP4 To MP3', icon: FileOutlined, description: '从 MP4 视频提取 MP3 音频' },
        { name: 'MP4 To GIF', icon: FileImageOutlined, description: '将 MP4 视频转换为 GIF 动图' },
        { name: 'MP4 To MOV', icon: VideoCameraOutlined, description: '将 MP4 视频转换为 MOV 格式' },
        { name: 'MP4 To WEBM', icon: VideoCameraOutlined, description: '将 MP4 视频转换为 WEBM 格式' },
        { name: 'MP4 To JPG', icon: FileImageOutlined, description: '将 MP4 视频转换为 JPG 图片序列' },
        { name: 'MP4 To PNG', icon: FileImageOutlined, description: '将 MP4 视频转换为 PNG 图片序列' }
      ]
    }
  ]
};

export default categories;
