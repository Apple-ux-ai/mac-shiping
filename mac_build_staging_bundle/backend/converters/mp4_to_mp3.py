import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class MP4ToMP3Converter(BaseConverter):
    """MP4 to MP3 Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['mp4']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Extract audio from MP4 and save as MP3
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            # Parse options
            audio_bitrate = options.get('audioBitrate', '128k')
            audio_track = options.get('audioTrack', 0)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            # Get total duration for progress calculation
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                total_duration = float(video_info['format'].get('duration', 0))

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.mp3',
                {
                    'audioBitrate': audio_bitrate,
                    'audioTrack': audio_track,
                    'startTime': start_time,
                    'endTime': end_time
                }
            )

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()
            
            if end_time <= start_time:
                 # If invalid time range, use full duration logic or error?
                 # Assuming 0 duration means full.
                 pass

            # Build command
            command = ['ffmpeg', '-y']
            
            # Start time
            if start_time > 0:
                command.extend(['-ss', str(start_time)])
                
            command.extend(['-i', input_path])
            
            # Duration/End time
            if end_time > start_time and end_time < total_duration:
                 command.extend(['-t', str(end_time - start_time)])

            # Audio settings
            # Map specific audio track
            command.extend(['-map', f'0:a:{audio_track}?']) # Use ? to ignore if audio track missing, or default to 0:a:0 if not specified
            
            # Since we are converting to MP3, we ignore video
            command.append('-vn')
            
            # Codec and bitrate
            command.extend(['-c:a', 'libmp3lame', '-b:a', audio_bitrate])
            
            command.append(output_path)
            
            def progress_callback(percent):
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            if result.get('success'):
                print(json.dumps({"type": "progress", "percent": 100}))
                sys.stdout.flush()
                return {'success': True, 'outputPath': output_path}
            else:
                return result

        except Exception as e:
            return {'success': False, 'error': str(e)}
