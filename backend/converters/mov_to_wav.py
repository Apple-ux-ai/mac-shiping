import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class MOVToWAVConverter(BaseConverter):
    """MOV to WAV Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['mov']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Extract audio from MOV and save as WAV (PCM S16LE)
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            # Parse options
            audio_track = options.get('audioTrack', 0)
            sample_rate = options.get('audioSampleRate')
            channels = options.get('audioChannels')

            # Get total duration and track info for progress calculation and naming
            video_info = get_video_info(input_path)
            total_duration = 0
            track_count = 1
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0
            
            if video_info and 'streams' in video_info:
                track_count = len([s for s in video_info['streams'] if s.get('codec_type') == 'audio'])

            filename = os.path.splitext(os.path.basename(input_path))[0]
            # If multiple tracks exist, append track index to filename for clarity
            if track_count > 1:
                filename = f"{filename}_Track{audio_track + 1}"

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.wav',
                {
                    'audioTrack': audio_track,
                    'startTime': start_time,
                    'endTime': end_time,
                    'audioSampleRate': sample_rate,
                    'audioChannels': channels
                }
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

            # Audio encoding settings
            command.extend(['-vn']) # No video
            command.extend(['-c:a', 'pcm_s16le']) # PCM 16-bit little endian
            
            if sample_rate:
                command.extend(['-ar', str(sample_rate)])
            
            if channels:
                command.extend(['-ac', str(channels)])
            
            # Audio track selection
            command.extend(['-map', f'0:a:{audio_track}'])

            command.append(output_path)
            
            # Execute conversion
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            if not result.get('success'):
                # Fallback if audio track mapping fails
                if "Stream map" in result.get('error', '') and audio_track != 0:
                    command = ['ffmpeg', '-y']
                    if start_time > 0: command.extend(['-ss', str(start_time)])
                    if end_time < total_duration: command.extend(['-to', str(end_time)])
                    command.extend(['-i', input_path, '-vn', '-c:a', 'pcm_s16le'])
                    if sample_rate: command.extend(['-ar', str(sample_rate)])
                    if channels: command.extend(['-ac', str(channels)])
                    command.append(output_path)
                    result = run_ffmpeg_command(command, progress_callback=progress_callback)
                
                if not result.get('success'):
                    return result

            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {
                'success': True,
                'outputPath': output_path
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}
