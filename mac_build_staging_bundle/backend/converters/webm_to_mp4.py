import os
import json
import sys
import re
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class WEBMToMP4Converter(BaseConverter):
    """WEBM to MP4 Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['webm']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert WEBM to MP4
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            # Parse options
            quality_percent = options.get('quality', 80) # 1-100
            audio_bitrate = options.get('audioBitrate', '128k')
            resolution = options.get('resolution', 'original')
            audio_track = options.get('audioTrack', 0)
            try:
                audio_track = int(audio_track)
            except (TypeError, ValueError):
                audio_track = 0
            audio_track = max(0, audio_track)
            start_time = options.get('startTime', 0)
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
                keyframe_interval = int(keyframe_interval) if keyframe_interval is not None else None
            except (TypeError, ValueError):
                keyframe_interval = None
            if keyframe_interval is not None and keyframe_interval <= 0:
                keyframe_interval = None

            audio_sample_rate = options.get('audioSampleRate')
            try:
                audio_sample_rate = int(audio_sample_rate) if audio_sample_rate is not None else None
            except (TypeError, ValueError):
                audio_sample_rate = None
            if audio_sample_rate is not None and audio_sample_rate <= 0:
                audio_sample_rate = None

            audio_channels = options.get('audioChannels')
            try:
                audio_channels = int(audio_channels) if audio_channels is not None else None
            except (TypeError, ValueError):
                audio_channels = None
            if audio_channels is not None and audio_channels <= 0:
                audio_channels = None

            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                total_duration = float(video_info['format'].get('duration', 0))
            audio_tracks_count = 0
            if video_info and isinstance(video_info.get('streams'), list):
                audio_tracks_count = sum(
                    1 for s in video_info['streams'] if (s or {}).get('codec_type') == 'audio'
                )
            has_audio = audio_tracks_count > 0
            if has_audio and audio_track >= audio_tracks_count:
                audio_track = 0

            end_time = options.get('endTime', total_duration)

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.mp4',
                {
                    'quality': quality_percent,
                    'audioBitrate': audio_bitrate,
                    'resolution': resolution,
                    'audioTrack': audio_track,
                    'startTime': start_time,
                    'endTime': end_time
                }
            )

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()
            
            # Map quality to CRF (18-35)
            crf = 35 - int((quality_percent - 1) * (35 - 18) / 99)
            crf = max(18, min(35, crf))

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

            # Video encoding settings
            command.extend(['-c:v', 'libx264'])
            if use_vbr:
                command.extend(['-crf', str(crf)])
            else:
                bufsize = double_bitrate(video_bitrate)
                command.extend(['-b:v', video_bitrate, '-minrate', video_bitrate, '-maxrate', video_bitrate, '-bufsize', bufsize])
            command.extend(['-preset', 'medium'])
            command.extend(['-pix_fmt', 'yuv420p']) # For compatibility

            if keyframe_interval is not None:
                command.extend(['-g', str(keyframe_interval)])
            
            # Resolution settings
            if resolution != 'original':
                command.extend(['-s', resolution])

            command.extend(['-map', '0:v:0'])
            if has_audio:
                command.extend(['-c:a', 'aac'])
                if audio_sample_rate is not None:
                    command.extend(['-ar', str(audio_sample_rate)])
                if audio_channels is not None:
                    command.extend(['-ac', str(audio_channels)])
                command.extend(['-b:a', audio_bitrate])
                command.extend(['-map', f'0:a:{audio_track}?'])

            command.append(output_path)
            
            # Execute conversion
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            if not result.get('success'):
                # Fallback if audio track mapping fails
                if has_audio and "Stream map" in result.get('error', '') and audio_track != 0:
                    command = ['ffmpeg', '-y']
                    if start_time > 0: command.extend(['-ss', str(start_time)])
                    if end_time < total_duration: command.extend(['-to', str(end_time)])
                    command.extend(['-i', input_path, '-c:v', 'libx264'])
                    if use_vbr:
                        command.extend(['-crf', str(crf)])
                    else:
                        bufsize = double_bitrate(video_bitrate)
                        command.extend(['-b:v', video_bitrate, '-minrate', video_bitrate, '-maxrate', video_bitrate, '-bufsize', bufsize])
                    command.extend(['-preset', 'medium', '-pix_fmt', 'yuv420p'])
                    if keyframe_interval is not None:
                        command.extend(['-g', str(keyframe_interval)])
                    if resolution != 'original': command.extend(['-s', resolution])
                    command.extend(['-c:a', 'aac'])
                    if audio_sample_rate is not None:
                        command.extend(['-ar', str(audio_sample_rate)])
                    if audio_channels is not None:
                        command.extend(['-ac', str(audio_channels)])
                    command.extend(['-b:a', audio_bitrate, output_path])
                    result = run_ffmpeg_command(command, progress_callback=progress_callback)
                
                if not result.get('success'):
                    return result

            return {'success': True, 'outputPath': output_path}

        except Exception as e:
            return {'success': False, 'error': str(e)}
