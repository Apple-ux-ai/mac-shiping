import { useState } from 'react';
import { Button, Card, Typography, Space, Upload, message } from 'antd';
import { UploadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { UnifiedToolHeader } from '../../tool-ui/common/SharedUI';

const { Title, Text, Paragraph } = Typography;

// 这是一个示例业务组件
// 你可以复制此文件并根据具体需求修改，例如实现 PDF 转 Word 的逻辑
const DemoFeature = ({ toolName }) => {
  const [processing, setProcessing] = useState(false);
  const [fileList, setFileList] = useState([]);

  const breadcrumbItems = [
    { label: '示例工具' },
    { label: toolName }
  ];

  const handleUpload = () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }
    
    setProcessing(true);
    // 模拟处理过程
    setTimeout(() => {
      setProcessing(false);
      message.success(`${toolName} 处理完成！`);
    }, 2000);
  };

  const uploadProps = {
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      setFileList([...fileList, file]);
      return false;
    },
    fileList,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="feature-container"
      style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      <UnifiedToolHeader
        breadcrumbs={breadcrumbItems}
        title={toolName}
        description={`这是一个专业工具，用于 ${toolName}，支持批量处理和自定义参数设置。`}
      />

      <div style={{ padding: '24px', flex: 1 }}>
        <Card
          title="功能演示区域"
          bordered={false}
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '2px dashed var(--border-color)',
              }}
            >
              <Paragraph>
                这是一个通用模板组件。当前选中的工具是：
                <Text strong>{toolName}</Text>
              </Paragraph>
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                loading={processing}
                onClick={handleUpload}
                style={{ minWidth: '200px' }}
              >
                开始处理
              </Button>
            </div>

            <div
              className="developer-hint"
              style={{
                marginTop: '40px',
                padding: '16px',
                background: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
              }}
            >
              <Text strong style={{ color: '#0369a1' }}>👨‍💻 开发者提示:</Text>
              <Paragraph style={{ color: '#0c4a6e', marginTop: '8px' }}>
                此组件位于 <code>src/components/features/DemoFeature.jsx</code>。<br />
                请根据你的实际业务逻辑（如 PDF 处理、图像转换等）修改此文件，或创建新的组件并在 <code>MainPage.jsx</code> 中进行路由映射。
              </Paragraph>
            </div>
          </Space>
        </Card>
      </div>
    </motion.div>
  );
};

export default DemoFeature;
