import os
import zipfile
import shutil
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class MOVToJPGConverter(BaseConverter):
    """MOV to JPG Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['mov']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert MOV to JPG sequence and zip it
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            # Parse options
            quality = options.get('quality', 23)  # Quality mapping kept as-is
            fps = float(options.get('fps', 30) or 30)

            # interval 作为“保留帧百分比 1-100”
            interval_percent = options.get('interval', 100)
            try:
                interval_percent = float(interval_percent or 100)
            except (TypeError, ValueError):
                interval_percent = 100.0
            if interval_percent < 1:
                interval_percent = 1.0
            if interval_percent > 100:
                interval_percent = 100.0

            keep_ratio = interval_percent / 100.0
            target_fps = fps * keep_ratio

            filename = os.path.splitext(os.path.basename(input_path))[0]

            # Map quality (1-35) to q:v (1-31, where 1 is best)
            # The user's UI says Quality (1-35). Higher usually means better in user's mind, 
            # but in FFmpeg qscale 1 is best, 31 is worst.
            # Let's map 1 (worst) to 31, and 35 (best) to 1.
            q_scale = 31 - int((max(1, min(35, quality)) - 1) * 30 / 34)
            q_scale = max(1, min(31, q_scale))

            # Get total duration
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            zip_path = self.resolve_output_path(
                output_dir,
                filename,
                '.zip',
                {
                    'quality': quality,
                    'fps': fps,
                    'interval': interval_percent,
                    'startTime': start_time,
                    'endTime': end_time
                }
            )
            zip_basename = os.path.splitext(os.path.basename(zip_path))[0]

            temp_frame_dir = os.path.join(output_dir, zip_basename)

            if not os.path.exists(temp_frame_dir):
                os.makedirs(temp_frame_dir)

            output_pattern = os.path.join(temp_frame_dir, f"{zip_basename}_%05d.jpg")

            # Report output path for cancellation tracking
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
                '-q:v', str(q_scale),
                output_pattern
            ])
            
            # Execute
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            if not result.get('success'):
                # Cleanup if failed
                if os.path.exists(temp_frame_dir):
                    shutil.rmtree(temp_frame_dir, ignore_errors=True)
                return result
                
            # Zip files
            try:
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for root, dirs, files in os.walk(temp_frame_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, output_dir)
                            zipf.write(file_path, arcname)

                if os.path.exists(temp_frame_dir):
                    shutil.rmtree(temp_frame_dir, ignore_errors=True)
                
                # Final 100%
                print(json.dumps({"type": "progress", "percent": 100}))
                sys.stdout.flush()
                
                return {
                    'success': True,
                    'output': zip_path,
                    'outputPath': zip_path,
                    'folderPath': temp_frame_dir,
                }
                
            except Exception as e:
                return {'success': False, 'error': f"Compression failed: {str(e)}"}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}
