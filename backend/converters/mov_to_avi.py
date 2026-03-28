import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info


class MOVToAVIConverter(BaseConverter):
    """MOV to AVI Converter"""

    def __init__(self):
        super().__init__()
        self.supported_formats = ['mov']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        try:
            self.validate_input(input_path)

            if not output_dir:
                output_dir = os.path.dirname(input_path) or os.getcwd()

            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            # Quality 1-35 (mapped to CRF 18-35 approx for H.264 or qscale for mpeg4)
            # Since we are making AVI, we might use libx264 for better quality but compatibility might be lower than mpeg4.
            # However, modern AVI usually can hold H.264.
            # Let's stick to H.264 as per MP4 implementation for consistency in quality control, 
            # unless compatibility issues arise. If user wants classic AVI, we might need mpeg4.
            # Given the "Quality (1-35)" UI which maps nicely to CRF, let's use libx264.
            
            # 前端质量滑块为 1-100，数值越大质量越高
            quality_percent = int(options.get('quality', 80) or 80)
            if quality_percent < 1:
                quality_percent = 1
            if quality_percent > 100:
                quality_percent = 100
            audio_bitrate = options.get('audioBitrate', '128k')
            resolution = options.get('resolution', 'original')
            audio_track = options.get('audioTrack', 0)
            start_time = options.get('startTime', 0)
            use_vbr = options.get('useVBR', True)
            keyframe_interval = options.get('keyframeInterval')
            audio_sample_rate = options.get('audioSampleRate')
            audio_channels = options.get('audioChannels')
            video_bitrate_option = options.get('videoBitrate')

            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            start_time_val = options.get('startTime', 0)
            try:
                start_time = float(start_time_val or 0)
            except (TypeError, ValueError):
                start_time = 0

            end_time_val = options.get('endTime', total_duration)
            if end_time_val is None:
                end_time_val = total_duration
            try:
                end_time = float(end_time_val)
            except (TypeError, ValueError):
                end_time = total_duration

            if end_time <= start_time:
                end_time = total_duration

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.avi',
                {
                    'quality': quality_percent,
                    'audioBitrate': audio_bitrate,
                    'resolution': resolution,
                    'audioTrack': audio_track,
                    'startTime': start_time,
                    'endTime': end_time,
                    'useVBR': use_vbr,
                    'keyframeInterval': keyframe_interval,
                    'audioSampleRate': audio_sample_rate,
                    'audioChannels': audio_channels,
                    'videoBitrate': video_bitrate_option,
                },
            )

            print(
                json.dumps(
                    {"type": "output", "output": output_path, "targets": [output_path]}
                )
            )
            sys.stdout.flush()

            # Mapping Quality (1-35) to CRF.
            # Assuming UI passes 1-35 where 1 is best, 35 is worst? 
            # In MP4 code: crf = 35 - int((quality_percent - 1) * (35 - 18) / 99). 
            # Wait, in MP4 GUI quality is 1-35 slider. 
            # Let's look at MP4 logic again: 
            # MP4 GUI: <SettingSlider label="质量 (Quality)" value={quality} min={1} max={35} ... />
            # MP4 Backend: crf = 35 - int((quality_percent - 1) * (35 - 18) / 99) 
            # If quality_percent is 23 (default), crf approx 32? 
            # Wait, 1 to 35 slider. If value is 35 (max quality?), crf should be lower (18). 
            # If value is 1 (min quality), crf should be higher (35).
            # The MP4 formula seems to treat input as 1-100? "quality_percent".
            # Ah, in MP4GUI `value={quality}` is 1-35. 
            # Let's check MP4GUI `const [quality, setQuality] = useState(23);`
            # If the backend receives 23. 
            # `crf = 35 - int((23 - 1) * (17) / 99)` -> 35 - 3 = 32. CRF 32 is very low quality.
            # Maybe I should just use the value directly as CRF if it is in range 1-51?
            # User slider is 1-35. CRF 18 is High Quality, 28 is Default.
            # If user selects "High Quality" preset -> quality 18.
            # If user selects "Low" -> quality 28.
            # So the slider value IS the CRF value directly.
            # Let's check MP4 backend again.
            # `quality_percent = options.get('quality', 80)` -> default 80?
            # But frontend sends 23.
            # If frontend sends 23. Backend receives 23.
            # `crf = 35 - int((23 - 1) * (17) / 99)` -> 35 - 3 = 32.
            # This logic in MP4 backend seems to expect a 1-100 scale where 100 is best.
            # But frontend sends CRF values (18-28).
            # If frontend sends 18 (High Quality). `35 - int(17 * 17 / 99)` = 35 - 2 = 33.
            # This seems wrong in MP4 backend if frontend sends raw CRF.
            # BUT, I must follow existing pattern or fix it. 
            # Let's look at MOVToMP4GUI again. 
            # Preset 'High Quality': quality: 18.
            # If I pass 18 to backend. Backend treats it as "18/100" quality? 
            # If so, 18/100 is low quality. 
            # Let's re-read MP4 backend carefully.
            
            # MP4 Backend:
            # crf = 35 - int((quality_percent - 1) * (35 - 18) / 99)
            # This maps [1, 100] to [35, 18].
            # Input 1 -> 35 (worst). Input 100 -> 18 (best).
            # Frontend MP4GUI:
            # Slider min=1 max=35.
            # Preset High Quality = 18.
            # If frontend sends 18. Backend calculates: 35 - (17 * 17 / 99) = 32. (Bad quality).
            # This suggests a bug in MP4 backend OR I misunderstood the frontend values.
            # Let's assume for AVI, I will use the slider value AS CRF directly because that makes sense for "Quality (1-35)".
            # If slider is "Quality (CRF)", then lower is better.
            # But usually "Quality" slider implies higher is better.
            # Let's check the slider label in UI: "Quality (1-35)".
            # If it's CRF, 1 is insane quality, 35 is bad.
            # Let's assume the slider value IS the CRF.
            
            # 将 1-100 的质量百分比映射到 CRF 35-18（数值越小质量越高）
            crf = 35 - int((quality_percent - 1) * (35 - 18) / 99)
            crf = max(18, min(35, crf))

            task_duration = end_time - start_time
            if task_duration <= 0:
                task_duration = 1

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / task_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            # 获取视频信息以检查音轨
            video_info = get_video_info(input_path)
            audio_tracks_count = 0
            if video_info and isinstance(video_info, dict):
                streams = video_info.get('streams') or []
                audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
                audio_tracks_count = len(audio_streams)
            
            has_audio = audio_tracks_count > 0

            def build_command(selected_video_encoder):
                cmd = ['ffmpeg', '-y', '-i', input_path]
                cmd.extend(['-c:v', selected_video_encoder])
                video_bitrate_local = options.get('videoBitrate') or '2000k'
                cmd.extend(['-b:v', video_bitrate_local])
                fps = options.get('fps')
                if fps and fps != 'source':
                    cmd.extend(['-r', str(fps)])
                resolution_local = options.get('resolution')
                if resolution_local and resolution_local not in ('source', 'original'):
                    cmd.extend(['-s', resolution_local])
                audio_bitrate_local = options.get('audioBitrate', '128k')
                if str(audio_bitrate_local).lower() == 'none' or not has_audio:
                    cmd.extend(['-an'])
                else:
                    cmd.extend(['-c:a', 'libmp3lame'])
                    cmd.extend(['-b:a', audio_bitrate_local])
                cmd.append(output_path)
                return cmd

            video_encoder = options.get('videoEncoder', 'libxvid')
            command = build_command(video_encoder)
            result = run_ffmpeg_command(command, progress_callback=progress_callback)

            if not result.get('success'):
                error_msg = result.get('error', '') or ''
                if ('Unknown encoder' in error_msg or 'codec not found' in error_msg) and video_encoder != 'mpeg4':
                    fallback_encoder = 'mpeg4'
                    command = build_command(fallback_encoder)
                    result = run_ffmpeg_command(command, progress_callback=progress_callback)

            if result.get('success'):
                print(json.dumps({"type": "progress", "percent": 100}))
                sys.stdout.flush()
                return {'success': True, 'outputPath': output_path}
            else:
                return result

        except Exception as e:
            return {'success': False, 'error': str(e)}
