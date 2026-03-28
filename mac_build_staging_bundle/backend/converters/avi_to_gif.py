import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class AVIToGIFConverter(BaseConverter):
    """AVI to GIF Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['avi']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert AVI to GIF
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            fps = options.get('fps', 15)
            interval = options.get('interval', 100)
            quality = options.get('quality', 80)
            keep_ratio = max(1.0, min(100.0, float(interval))) / 100.0
            target_fps = max(0.1, float(fps) * keep_ratio)

            # Get total duration
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                total_duration = float(video_info['format'].get('duration', 0))

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.gif',
                {
                    'fps': fps,
                    'interval': interval,
                    'quality': quality,
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

            # For high quality GIF, we use palettegen and paletteuse
            # command: ffmpeg -i input -vf "fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" output.gif
            
            # Simple version first, then maybe high quality if needed
            # For simplicity and speed, let's start with a decent quality version
            
            # Filter string
            vf_filters = [f'fps={target_fps}']
            
            # Add scaling if resolution is provided (though GIF usually doesn't need huge res)
            resolution = options.get('resolution', 'original')
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
