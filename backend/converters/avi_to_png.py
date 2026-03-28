import os
import zipfile
import shutil
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class AVIToPNGConverter(BaseConverter):
    """AVI to PNG Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['avi']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert AVI to PNG sequence and zip it
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            # Parse options
            # Quality 1-35 (from image reference)
            # For PNG, FFmpeg -compression_level is 0-9. 
            # We map 1-35 to 0-9. (Higher value = higher compression, lower file size, but slower)
            quality = options.get('quality', 23)
            fps = options.get('fps', 30)
            interval = options.get('interval', 1)
            
            # Compression level mapping (1-35 -> 0-9)
            # Higher quality in UI usually means less compression (lower level)
            # But the image says "Quality (1-35)" with 23 as default.
            # In FFmpeg, -compression_level 10 is default.
            # Let's just use the value directly for compression if it's within 0-9, 
            # or map it. Actually, PNG is lossless, so quality only affects file size and speed.
            comp_level = int((quality / 35.0) * 9)
            comp_level = max(0, min(9, comp_level))
            keep_ratio = max(1.0, min(100.0, float(interval))) / 100.0
            target_fps = max(0.1, float(fps) * keep_ratio)

            # Get total duration
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                total_duration = float(video_info['format'].get('duration', 0))

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            zip_path = self.resolve_output_path(
                output_dir,
                filename,
                '.zip',
                {
                    'quality': quality,
                    'fps': fps,
                    'interval': interval,
                    'startTime': start_time,
                    'endTime': end_time,
                },
            )
            zip_basename = os.path.splitext(os.path.basename(zip_path))[0]

            temp_frame_dir = os.path.join(output_dir, zip_basename)

            if not os.path.exists(temp_frame_dir):
                os.makedirs(temp_frame_dir)

            output_pattern = os.path.join(temp_frame_dir, f"{zip_basename}_%05d.png")

            print(json.dumps({"type": "output", "output": zip_path, "targets": [temp_frame_dir, zip_path]}))
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

            command.extend([
                '-i', input_path,
                '-vf', f'fps={target_fps}',
                '-compression_level', str(comp_level),
                output_pattern
            ])
            
            # Execute
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            if not result.get('success'):
                return result
                
            # 100% progress
            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            try:
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for root, dirs, files in os.walk(temp_frame_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, output_dir)
                            zipf.write(file_path, arcname)

                if os.path.exists(temp_frame_dir):
                    shutil.rmtree(temp_frame_dir, ignore_errors=True)
                
                return {
                    'success': True,
                    'message': f'Successfully converted to {zip_path}',
                    'output': zip_path,
                    'outputPath': zip_path,
                    'folderPath': temp_frame_dir
                }
            except Exception as e:
                return {'success': False, 'message': f'Error zipping files: {str(e)}'}

        except Exception as e:
            return {'success': False, 'message': f'Conversion error: {str(e)}'}
