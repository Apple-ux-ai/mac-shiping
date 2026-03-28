import os
import zipfile
import shutil
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class GIFToPNGConverter(BaseConverter):
    """GIF to PNG Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['gif']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert GIF to PNG sequence and zip it
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            # Parse options
            quality = options.get('quality', 85)
            interval_percent = int(options.get('interval', 100) or 100)
            if interval_percent < 1:
                interval_percent = 1
            if interval_percent > 100:
                interval_percent = 100

            # Compression level mapping (1-100 -> 9-0)
            # Higher quality in UI (100) means less compression (0)
            # Lower quality in UI (1) means more compression (9)
            comp_level = 9 - int((float(quality) / 100.0) * 9)
            comp_level = max(0, min(9, comp_level))

            # Interval percent 1-100 转为实际帧步长:
            # 100 -> 每帧都导出 (step=1)
            # 50  -> 每 2 帧导出一帧
            # 10  -> 每 10 帧导出一帧
            frame_step = max(1, round(100 / float(interval_percent)))

            # Get total duration/info
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            zip_path = self.resolve_output_path(
                output_dir,
                filename,
                '.zip',
                {
                    'quality': quality,
                    'interval': interval_percent,
                },
            )
            zip_basename = os.path.splitext(os.path.basename(zip_path))[0]

            temp_frame_dir = os.path.join(output_dir, zip_basename)

            if not os.path.exists(temp_frame_dir):
                os.makedirs(temp_frame_dir)

            output_pattern = os.path.join(temp_frame_dir, f"{zip_basename}_%05d.png")

            print(json.dumps({"type": "output", "output": zip_path, "targets": [temp_frame_dir, zip_path]}))
            sys.stdout.flush()

            if total_duration <= 0:
                total_duration = 1

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / total_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            command = ['ffmpeg', '-y', '-i', input_path]
            
            if frame_step > 1:
                command.extend(['-vf', f'select=not(mod(n\\,{frame_step})),setpts=N/FRAME_RATE/TB'])
            
            command.extend([
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
