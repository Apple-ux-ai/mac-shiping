import React from 'react';
import { 
  SettingsPanel, 
  SettingSlider,
  SettingPresets
} from '../../tool-ui/common/SharedUI';

const JPGParamConfig = ({ 
  quality, setQuality, 
  fps, setFps, 
  interval, setInterval,
  preset, setPreset
}) => {

  const handlePresetSelect = (p) => {
    setPreset(p);
    switch(p) {
      case '低质量':
        setQuality(40);
        setFps(10);
        setInterval(50);
        break;
      case '中等质量':
        setQuality(70);
        setFps(15);
        setInterval(100);
        break;
      case '高质量':
        setQuality(90);
        setFps(24);
        setInterval(100);
        break;
      case '社交媒体':
        setQuality(80);
        setFps(20);
        setInterval(100);
        break;
      default:
        break;
    }
  };

  return (
    <SettingsPanel title="转换选项">
      <SettingPresets 
        label="快速预设"
        presets={['低质量', '中等质量', '高质量', '社交媒体']}
        currentPreset={preset}
        onSelect={handlePresetSelect}
        columns={2}
      />
      <SettingSlider 
        label="质量" 
        value={quality} 
        unit="%" 
        min={1} 
        max={100} 
        step={1}
        onChange={(val) => {
          setQuality(val);
          setPreset('自定义');
        }}
      />
      <SettingSlider 
        label="帧率" 
        value={fps} 
        unit=" FPS" 
        min={1} 
        max={60} 
        step={1}
        onChange={(val) => {
          setFps(val);
          setPreset('自定义');
        }}
      />
      <SettingSlider 
        label="提取密度" 
        value={interval} 
        unit="" 
        min={1} 
        max={100} 
        step={1}
        onChange={(val) => {
          setInterval(val);
          setPreset('自定义');
        }}
        valueDisplay={`提取原视频的 ${interval}% 帧`}
      />
    </SettingsPanel>
  );
};

export default JPGParamConfig;
