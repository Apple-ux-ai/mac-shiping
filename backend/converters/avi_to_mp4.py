import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class AVIToMP4Converter(BaseConverter):
    """AVI to MP4 Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['avi']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert AVI to MP4
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
            
            # Map quality to CRF (18-35)
            # 100% -> CRF 18 (High)
            # 1% -> CRF 35 (Low)
            crf = 35 - int((quality_percent - 1) * (35 - 18) / 99)
            crf = max(18, min(35, crf))

            # Get total duration for progress calculation
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

            if not isinstance(audio_track, int):
                try:
                    audio_track = int(audio_track)
                except (TypeError, ValueError):
                    audio_track = 0

            if audio_track < 0 or audio_track >= audio_tracks_count:
                audio_track = 0

            start_time = options.get('startTime', 0)
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

            # Input seeking
            if start_time > 0:
                command.extend(['-ss', str(start_time)])
            
            if end_time < total_duration:
                command.extend(['-to', str(end_time)])

            command.extend(['-i', input_path])

            # Video encoding settings
            command.extend(['-c:v', 'libx264'])
            command.extend(['-crf', str(crf)])
            command.extend(['-preset', 'medium'])
            
            # Resolution settings
            if resolution != 'original':
                command.extend(['-s', resolution])
            
            command.extend(['-map', '0:v:0']) # First video stream

            # Audio encoding settings
            if has_audio:
                command.extend(['-c:a', 'aac'])
                command.extend(['-b:a', audio_bitrate])
                command.extend(['-map', f'0:a:{audio_track}?']) # Specific audio track
            
            command.extend(['-pix_fmt', 'yuv420p']) # Ensure compatibility
            command.append(output_path)
            
            # Execute conversion
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            if not result.get('success'):
                error_text = result.get('error', '') or ''
                if audio_track != 0 and "Stream map" in error_text:
                    new_command = []
                    i = 0
                    while i < len(command):
                        if command[i] == '-map' and i + 1 < len(command) and command[i + 1].startswith('0:a:'):
                            i += 2
                            continue
                        new_command.append(command[i])
                        i += 1

                    result = run_ffmpeg_command(new_command, progress_callback=progress_callback)
                    if not result.get('success'):
                        return result
                else:
                    return result
                
            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {'success': True, 'output': output_path, 'outputPath': output_path}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}
