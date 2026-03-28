import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class MP4ToGIFConverter(BaseConverter):
    """MP4 to GIF Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['mp4']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert MP4 to GIF
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            # Parse options
            fps = options.get('fps', 15)
            interval = options.get('interval', 100)
            quality = options.get('quality', 80)
            keep_ratio = max(1.0, min(100.0, float(interval))) / 100.0
            target_fps = max(0.1, float(fps) * keep_ratio)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            # Get total duration
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                total_duration = float(video_info['format'].get('duration', 0))

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            resolution = options.get('resolution', 'original')

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.gif',
                {
                    'fps': fps,
                    'interval': interval,
                    'startTime': start_time,
                    'endTime': end_time
                }
            )

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()

            task_duration = end_time - start_time
            if task_duration <= 0:
                task_duration = total_duration

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / task_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            # Filter string
            vf_filters = [f'fps={target_fps}']
            
            if resolution != 'original':
                vf_filters.append(f'scale={resolution.replace("x", ":")}')
            
            # Palette generation for better quality
            filter_complex = f"{','.join(vf_filters)},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"

            command = ['ffmpeg', '-y']
            if start_time > 0:
                command.extend(['-ss', str(start_time)])
            if end_time < total_duration:
                command.extend(['-to', str(end_time)])
                
            command.extend(['-i', input_path])
            command.extend(['-filter_complex', filter_complex])
            command.append(output_path)
            
            # Execute
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            if not result.get('success'):
                return result
                
            # 100% progress
            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {'success': True, 'output': output_path}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}
