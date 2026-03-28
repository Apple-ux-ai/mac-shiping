import React from 'react';
import { 
  SettingsPanel, 
  SettingSelect,
  SettingSlider,
  SettingPresets
} from '../../tool-ui/common/SharedUI';

const MP3ParamConfig = ({ 
  audioBitrate, setAudioBitrate,
  audioTrack, setAudioTrack,
  preset, setPreset,
  videoInfo
}) => {
  const bitrateOptions = [
    { label: '96 kbps', value: '96k' },
    { label: '128 kbps', value: '128k' },
    { label: '192 kbps', value: '192k' },
    { label: '256 kbps', value: '256k' },
    { label: '320 kbps', value: '320k' }
  ];

  const presets = ['低质量', '中等质量', '高质量', '社交媒体'];

  const handlePresetSelect = (p) => {
    setPreset(p);
    if (p === '低质量') {
      setAudioBitrate('96k');
    } else if (p === '中等质量') {
      setAudioBitrate('128k');
    } else if (p === '高质量') {
      setAudioBitrate('320k');
    } else if (p === '社交媒体') {
      setAudioBitrate('192k');
    }
  };

  // Generate audio track options based on video info
  const trackCount = videoInfo?.audio_tracks_count || 1;
  const trackOptions = Array.from({ length: trackCount }, (_, i) => ({
    label: `音轨 ${i + 1}`,
    value: i
  }));

  return (
    <SettingsPanel title="转换选项">
      <SettingPresets 
        label="快速预设"
        presets={presets}
        currentPreset={preset}
        onSelect={handlePresetSelect}
      />

      <SettingSelect 
        label="音频比特率" 
        value={audioBitrate} 
        options={bitrateOptions}
        onChange={(val) => {
          setAudioBitrate(val);
          setPreset('自定义');
        }}
      />
      
      <SettingSelect 
        label="选择音轨" 
        value={audioTrack} 
        options={trackOptions}
        onChange={(val) => {
          setAudioTrack(Number(val));
          setPreset('自定义');
        }}
      />

      <div className="setting-info-box" style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '6px', fontSize: '12px', color: '#0369a1', border: '1px solid #bae6fd' }}>
        提示：较高的比特率通常意味着更好的音质，但文件体积也会相应增大。
      </div>
    </SettingsPanel>
  );
};

export default MP3ParamConfig;
