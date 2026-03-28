import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class AVIToH264Converter(BaseConverter):
    """AVI to H264 Converter (Optimized for H264/MP4)"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['avi']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert AVI to H264 (Raw Bitstream)
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            # Parse options
            quality = options.get('quality', 23) # Use raw CRF value 1-35
            audio_bitrate = options.get('audioBitrate', '128k')
            resolution = options.get('resolution', '1280x720')
            audio_track = options.get('audioTrack', 0)
            preset_name = options.get('preset', 'medium')
            
            # Map UI preset names to ffmpeg presets
            preset_map = {
                '低质量': 'ultrafast',
                '中等质量': 'medium',
                '高质量': 'slow',
                '社交媒体': 'medium'
            }
            ffmpeg_preset = preset_map.get(preset_name, 'medium')

            # Get total duration
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                total_duration = float(video_info['format'].get('duration', 0))

            audio_tracks_count = 0
            if video_info and isinstance(video_info, dict):
                streams = video_info.get('streams') or []
                audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
                audio_tracks_count = len(audio_streams)
            has_audio = audio_tracks_count > 0

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.h264',
                {
                    'quality': quality,
                    'audioBitrate': audio_bitrate,
                    'resolution': resolution,
                    'audioTrack': audio_track,
                    'preset': preset_name,
                    'startTime': start_time,
                    'endTime': end_time,
                },
            )
            
            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()
            
            if end_time <= start_time:
                end_time = total_duration
                
            task_duration = end_time - start_time
            if task_duration <= 0: task_duration = 1

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / task_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            command = ['ffmpeg', '-y']

            if start_time > 0:
                command.extend(['-ss', str(start_time)])
            
            if end_time < total_duration:
                command.extend(['-to', str(end_time)])

            command.extend(['-i', input_path])

            # Video encoding settings
            command.extend(['-c:v', 'libx264'])
            command.extend(['-crf', str(quality)])
            command.extend(['-preset', ffmpeg_preset])
            
            if resolution != 'original':
                command.extend(['-s', resolution])
            
            # Audio encoding settings - to support the UI options
            if has_audio:
                command.extend(['-c:a', 'aac'])
                command.extend(['-b:a', audio_bitrate])
                command.extend(['-map', f'0:a:{audio_track}?'])
            else:
                command.extend(['-an'])
            
            # Stream mapping
            command.extend(['-map', '0:v:0'])
            
            command.extend(['-pix_fmt', 'yuv420p'])
            # Use mp4 format but with .h264 extension to support audio and satisfy user naming preference
            command.extend(['-f', 'mp4'])
            command.append(output_path)
            
            # Execute conversion
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            # If mapping fails (e.g. no audio), fallback to no audio
            if not result.get('success') and "Stream map" in result.get('error', ''):
                # Rebuild command without audio mapping
                new_command = ['ffmpeg', '-y']
                if start_time > 0: new_command.extend(['-ss', str(start_time)])
                if end_time < total_duration: new_command.extend(['-to', str(end_time)])
                new_command.extend(['-i', input_path])
                new_command.extend(['-c:v', 'libx264', '-crf', str(quality), '-preset', ffmpeg_preset])
                if resolution != 'original': new_command.extend(['-s', resolution])
                new_command.extend(['-an', '-pix_fmt', 'yuv420p', '-f', 'mp4', output_path])
                result = run_ffmpeg_command(new_command, progress_callback=progress_callback)

            return result
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
