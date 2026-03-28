import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class MOVToGIFConverter(BaseConverter):
    """MOV to GIF Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['mov']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert MOV to High Quality GIF
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            fps = options.get('fps', 15)
            interval_percent = int(options.get('interval', 100) or 100)
            if interval_percent < 1:
                interval_percent = 1
            if interval_percent > 100:
                interval_percent = 100
            keep_ratio = interval_percent / 100.0
            target_fps = max(0.1, float(fps) * keep_ratio)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            # Get video info for duration
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)
            
            if end_time <= start_time:
                end_time = total_duration

            output_path = self.resolve_output_path(
                output_dir, 
                filename, 
                '.gif',
                {
                    'fps': fps,
                    'interval': interval_percent,
                    'startTime': start_time,
                    'endTime': end_time
                }
            )

            # Report output path for cancellation tracking
            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()

            task_duration = end_time - start_time
            if task_duration <= 0: task_duration = 1

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / task_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            filter_complex = f"[0:v]fps={target_fps},split[a][b];[a]palettegen[p];[b][p]paletteuse"
            
            command = ['ffmpeg', '-y']
            if start_time > 0:
                command.extend(['-ss', str(start_time)])
            if end_time < total_duration:
                command.extend(['-to', str(end_time)])
                
            command.extend([
                '-i', input_path,
                '-filter_complex', filter_complex,
                output_path
            ])

            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            if result.get('success'):
                print(json.dumps({"type": "progress", "percent": 100}))
                sys.stdout.flush()
                return {'success': True, 'outputPath': output_path}
            else:
                return result

        except Exception as e:
            return {'success': False, 'error': str(e)}
