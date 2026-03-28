import os
import json
import sys
import re
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class MOVToWEBMConverter(BaseConverter):
    """MOV to WEBM Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['mov']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert MOV to WEBM
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            # Parse options
            # UI 中传入的是 1-100 的“质量百分比”，数值越大质量越高
            quality_percent = options.get('quality', 70)
            try:
                quality_percent = float(quality_percent)
            except (TypeError, ValueError):
                quality_percent = 70.0
            quality_percent = max(1.0, min(100.0, quality_percent))

            # 将 1-100 的质量百分比映射到 VP9 合理的 CRF 区间 [18, 35]
            # 百分比越大 -> CRF 越小(画质越好)
            crf_min, crf_max = 18, 35
            crf = crf_max - (quality_percent - 1.0) * (crf_max - crf_min) / 99.0
            crf = int(round(crf))
            crf = max(0, min(63, crf))  # VP9 合法区间 [-1, 63]，这里限制在 [0, 63]

            audio_bitrate = options.get('audioBitrate', '128k')
            resolution = options.get('resolution', 'original')
            audio_track = options.get('audioTrack', 0)

            use_vbr = options.get('useVBR', True)
            if isinstance(use_vbr, str):
                use_vbr = use_vbr.strip().lower() in ('1', 'true', 'yes', 'on')
            use_vbr = bool(use_vbr)

            video_bitrate = options.get('videoBitrate') or '2000k'
            if isinstance(video_bitrate, str):
                video_bitrate = video_bitrate.strip()
            else:
                video_bitrate = str(video_bitrate)

            keyframe_interval = options.get('keyframeInterval')
            try:
                keyframe_interval = (
                    int(keyframe_interval) if keyframe_interval is not None else None
                )
            except (TypeError, ValueError):
                keyframe_interval = None
            if keyframe_interval is not None and keyframe_interval <= 0:
                keyframe_interval = None

            audio_sample_rate = options.get('audioSampleRate')
            try:
                audio_sample_rate = (
                    int(audio_sample_rate) if audio_sample_rate is not None else None
                )
            except (TypeError, ValueError):
                audio_sample_rate = None
            if audio_sample_rate is not None and audio_sample_rate <= 0:
                audio_sample_rate = None
            if audio_sample_rate is not None:
                supported = (8000, 12000, 16000, 24000, 48000)
                audio_sample_rate = min(
                    supported, key=lambda v: (abs(v - audio_sample_rate), -v)
                )

            audio_channels = options.get('audioChannels')
            try:
                audio_channels = (
                    int(audio_channels) if audio_channels is not None else None
                )
            except (TypeError, ValueError):
                audio_channels = None
            if audio_channels is not None and audio_channels <= 0:
                audio_channels = None
            
            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            audio_tracks_count = 0
            if video_info and isinstance(video_info, dict):
                streams = video_info.get('streams') or []
                audio_streams = [s for s in streams if (s or {}).get('codec_type') == 'audio']
                audio_tracks_count = len(audio_streams)

            has_audio = audio_tracks_count > 0

            try:
                audio_track = int(audio_track)
            except (TypeError, ValueError):
                audio_track = 0
            if audio_track < 0:
                audio_track = 0
            if audio_tracks_count and audio_track >= audio_tracks_count:
                audio_track = 0

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.webm',
                {
                    'quality': quality_percent,
                    'audioBitrate': audio_bitrate,
                    'resolution': resolution,
                    'startTime': start_time,
                    'endTime': end_time,
                    'useVBR': use_vbr,
                    'videoBitrate': None if use_vbr else video_bitrate,
                    'keyframeInterval': keyframe_interval,
                    'audioSampleRate': audio_sample_rate,
                    'audioChannels': audio_channels,
                    'audioTrack': audio_track,
                }
            )

            base_output, output_ext = os.path.splitext(output_path)
            temp_output_path = f"{base_output}.part{output_ext}"

            print(
                json.dumps(
                    {
                        "type": "output",
                        "output": output_path,
                        "targets": [temp_output_path, output_path],
                    }
                )
            )
            sys.stdout.flush()

            if end_time <= start_time:
                end_time = total_duration
                
            task_duration = end_time - start_time
            if task_duration <= 0: task_duration = 1

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / task_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            def double_bitrate(value: str) -> str:
                m = re.match(r'^\s*(\d+(?:\.\d+)?)\s*([kKmMgG])?\s*$', value or '')
                if not m:
                    return '4000k'
                num = float(m.group(1)) * 2
                suffix = (m.group(2) or 'k').lower()
                if abs(num - round(num)) < 1e-9:
                    num = int(round(num))
                    return f'{num}{suffix}'
                return f'{num:g}{suffix}'

            command = ['ffmpeg', '-y']
            
            # Input seeking
            if start_time > 0:
                command.extend(['-ss', str(start_time)])
            
            if end_time < total_duration:
                command.extend(['-to', str(end_time)])

            command.extend(['-i', input_path])
            
            # Video encoding settings (VP9)
            command.extend(['-c:v', 'libvpx-vp9'])
            if use_vbr:
                command.extend(['-crf', str(crf)])
                command.extend(['-b:v', '0'])
            else:
                bufsize = double_bitrate(video_bitrate)
                command.extend(
                    [
                        '-b:v',
                        video_bitrate,
                        '-minrate',
                        video_bitrate,
                        '-maxrate',
                        video_bitrate,
                        '-bufsize',
                        bufsize,
                    ]
                )
            # 速度/质量折中，并开启 row-mt 以更好利用多线程
            command.extend(['-deadline', 'good', '-cpu-used', '2', '-row-mt', '1'])

            # Resolution
            if resolution and resolution not in ('source', 'original'):
                command.extend(['-vf', f'scale={resolution}'])

            # Keyframe interval
            if keyframe_interval is not None:
                command.extend(['-g', str(keyframe_interval)])

            # Audio settings (Opus)
            if str(audio_bitrate).lower() == 'none' or not has_audio:
                command.extend(['-an'])
            else:
                command.extend(['-c:a', 'libopus'])
                command.extend(['-b:a', audio_bitrate])
                if audio_sample_rate is not None:
                    command.extend(['-ar', str(audio_sample_rate)])
                if audio_channels is not None:
                    command.extend(['-ac', str(audio_channels)])
    
                # Stream mapping：确保选择首个视频流和指定音轨（如果存在）
                # 只有在有音频时才映射音频流
                command.extend(['-map', f'0:a:{audio_track}?'])

            command.extend(['-map', '0:v:0'])

            command.append(temp_output_path)
            
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            if not result.get('success'):
                try:
                    if os.path.exists(temp_output_path):
                        os.remove(temp_output_path)
                except Exception:
                    pass
                try:
                    if os.path.exists(output_path) and os.path.getsize(output_path) <= 0:
                        os.remove(output_path)
                except Exception:
                    pass
                return result

            try:
                if (not os.path.exists(temp_output_path)) or os.path.getsize(temp_output_path) <= 0:
                    try:
                        if os.path.exists(temp_output_path):
                            os.remove(temp_output_path)
                    except Exception:
                        pass
                    return {'success': False, 'error': 'ffmpeg 已完成但输出文件为空'}

                if os.path.exists(output_path):
                    os.remove(output_path)
                os.replace(temp_output_path, output_path)
            except Exception as e:
                try:
                    if os.path.exists(temp_output_path):
                        os.remove(temp_output_path)
                except Exception:
                    pass
                return {'success': False, 'error': f'输出文件落盘失败: {e}'}

            try:
                if (not os.path.exists(output_path)) or os.path.getsize(output_path) <= 0:
                    try:
                        if os.path.exists(output_path):
                            os.remove(output_path)
                    except Exception:
                        pass
                    return {'success': False, 'error': '输出文件为空'}
            except Exception:
                return {'success': False, 'error': '无法验证输出文件大小'}

            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {
                'success': True,
                'outputPath': output_path
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}
