import os
import zipfile
import shutil
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class WEBMToJPGConverter(BaseConverter):
    """WEBM to JPG Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['webm']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert WEBM to JPG sequence and zip it
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            # Parse options
            quality = int(options.get('quality', 23)) # 1-35, higher is better
            fps = int(options.get('fps', 30))
            interval = int(options.get('interval', 1)) # 1-100, skip frames

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            # Map quality (1-35) to q:v (1-31), where 1 is best
            # Quality 35 -> q 1
            # Quality 1 -> q 31
            q_scale = max(1, min(31, 36 - quality))

            # Trimming options
            start_time = options.get('startTime')
            end_time = options.get('endTime')

            # Prepare output paths
            # We will create a zip file containing the images
            zip_path = self.resolve_output_path(
                output_dir,
                filename,
                '.zip',
                {
                    'quality': quality,
                    'fps': fps,
                    'interval': interval,
                    'start': start_time,
                    'end': end_time
                }
            )
            zip_basename = os.path.splitext(os.path.basename(zip_path))[0]
            
            # Temporary directory for images
            temp_frame_dir = os.path.join(output_dir, zip_basename)
            if not os.path.exists(temp_frame_dir):
                os.makedirs(temp_frame_dir)

            output_pattern = os.path.join(temp_frame_dir, f"{filename}_%05d.jpg")

            # Report output path immediately
            print(json.dumps({"type": "output", "output": zip_path, "targets": [temp_frame_dir, zip_path]}))
            sys.stdout.flush()
            
            # Get video info for progress calculation
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            # Calculate actual duration to convert for progress reporting
            effective_start = float(start_time) if start_time is not None else 0
            effective_end = float(end_time) if end_time is not None else total_duration
            convert_duration = max(0.1, effective_end - effective_start)

            def progress_callback(current_seconds):
                # Adjust progress based on relative position within the trimmed range
                # current_seconds from ffmpeg includes start_time offset usually
                relative_seconds = current_seconds
                percent = min(99, round((relative_seconds / convert_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            # Build Filters
            filters = []
            if interval > 1:
                filters.append(f"select='not(mod(n,{interval}))'")
            
            filters.append(f"fps={fps}")
            filter_str = ",".join(filters)

            command = ['ffmpeg', '-y', '-progress', 'pipe:1']
            
            if start_time is not None:
                command.extend(['-ss', str(start_time)])
            
            if end_time is not None:
                command.extend(['-to', str(end_time)])
            
            command.extend([
                '-i', input_path,
                '-vf', filter_str,
                '-q:v', str(q_scale),
                output_pattern
            ])
            
            # Execute
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            if not result.get('success'):
                # Cleanup temp dir on failure
                shutil.rmtree(temp_frame_dir, ignore_errors=True)
                return result
                
            # 100% progress
            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

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
