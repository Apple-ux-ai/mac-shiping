import React from 'react';
import { 
  SettingsPanel, 
  SettingSlider,
  SettingSelect,
  SettingPresets
} from '../../tool-ui/common/SharedUI';

const ParamConfig = ({ 
  quality, setQuality, 
  audioBitrate, setAudioBitrate, 
  resolution, setResolution, 
  audioTrack, setAudioTrack, 
  preset, setPreset,
  availableTracks = 1
}) => {

  const handlePresetSelect = (presetName) => {
    setPreset(presetName);
    switch(presetName) {
        case '低质量':
            setQuality(40);
            setAudioBitrate('96k');
            setResolution('640x360');
            break;
        case '中等质量':
            setQuality(70);
            setAudioBitrate('128k');
            setResolution('1280x720');
            break;
        case '高质量':
            setQuality(90);
            setAudioBitrate('192k');
            setResolution('1920x1080');
            break;
        case '社交媒体':
            setQuality(80);
            setAudioBitrate('128k');
            setResolution('720x1280');
            break;
        default:
            break;
    }
  };

  // Generate audio track options based on availableTracks
  const audioTrackOptions = [];
  for (let i = 0; i < availableTracks; i++) {
    audioTrackOptions.push({
      label: i === 0 ? `音轨 1 (默认)` : `音轨 ${i + 1}`,
      value: i
    });
  }

  return (
    <SettingsPanel title="转换选项">
      <SettingPresets 
        label="快速预设"
        presets={['低质量', '中等质量', '高质量', '社交媒体']}
        currentPreset={preset}
        onSelect={handlePresetSelect}
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

      <SettingSelect 
        label="分辨率"
        value={resolution}
        options={[
          { label: '保持原样', value: 'original' },
          { label: '1280x720 (HD)', value: '1280x720' },
          { label: '1920x1080 (FHD)', value: '1920x1080' },
          { label: '640x360 (SD)', value: '640x360' },
          { label: '320x180 (LD)', value: '320x180' },
          { label: '720x1280 (HD) - 9:16', value: '720x1280' },
          { label: '1080x1920 (FHD) - 9:16', value: '1080x1920' },
          { label: '360x640 (SD) - 9:16', value: '360x640' },
          { label: '180x320 (LD) - 9:16', value: '180x320' },
          { label: '160x128 (AMV)', value: '160x128' },
          { label: '320x240 (AMV)', value: '320x240' }
        ]}
        onChange={(val) => {
          setResolution(val);
          setPreset('自定义');
        }}
      />

      <SettingSelect 
        label="音频比特率"
        value={audioBitrate}
        options={[
          { label: '96 kbps', value: '96k' },
          { label: '128 kbps', value: '128k' },
          { label: '192 kbps', value: '192k' },
          { label: '256 kbps', value: '256k' },
          { label: '320 kbps', value: '320k' }
        ]}
        onChange={(val) => {
          setAudioBitrate(val);
          setPreset('自定义');
        }}
      />

      <SettingSelect 
        label="选择音轨"
        value={audioTrack}
        options={audioTrackOptions}
        onChange={(val) => {
          setAudioTrack(Number(val));
          setPreset('自定义');
        }}
      />
    </SettingsPanel>
  );
};

export default ParamConfig;
