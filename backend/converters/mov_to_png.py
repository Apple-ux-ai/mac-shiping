import os
import zipfile
import shutil
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info


class MOVToPNGConverter(BaseConverter):
    """MOV to PNG Converter"""

    def __init__(self):
        super().__init__()
        self.supported_formats = ['mov']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        try:
            self.validate_input(input_path)

            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            quality = int(options.get('quality', 23))
            fps = int(options.get('fps', 30))
            interval_percent = int(options.get('interval', 100) or 100)
            if interval_percent < 1:
                interval_percent = 1
            if interval_percent > 100:
                interval_percent = 100
            frame_step = max(1, round(100 / interval_percent))

            start_time = options.get('startTime')
            end_time = options.get('endTime')

            zip_path = self.resolve_output_path(
                output_dir,
                filename,
                '.zip',
                {
                    'quality': quality,
                    'fps': fps,
                    'interval': interval_percent,
                    'start': start_time,
                    'end': end_time
                },
            )
            zip_basename = os.path.splitext(os.path.basename(zip_path))[0]

            temp_frame_dir = os.path.join(output_dir, zip_basename)

            if not os.path.exists(temp_frame_dir):
                os.makedirs(temp_frame_dir)

            output_pattern = os.path.join(temp_frame_dir, f"{zip_basename}_%05d.png")

            print(
                json.dumps(
                    {
                        "type": "output",
                        "output": zip_path,
                        "targets": [temp_frame_dir, zip_path],
                    }
                )
            )
            sys.stdout.flush()

            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            effective_start = float(start_time) if start_time is not None else 0
            effective_end = float(end_time) if end_time is not None else total_duration
            convert_duration = max(0.1, effective_end - effective_start)

            if total_duration <= 0:
                total_duration = 1

            def progress_callback(current_seconds):
                relative_seconds = max(0, current_seconds - effective_start)
                percent = min(99, round((relative_seconds / convert_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            command = ['ffmpeg', '-y']

            if start_time is not None:
                command.extend(['-ss', str(start_time)])
            if end_time is not None:
                command.extend(['-to', str(end_time)])

            command.extend(['-i', input_path])

            filters = []
            if fps > 0:
                filters.append(f'fps={fps}')
            if frame_step > 1:
                filters.append(f'select=not(mod(n\\,{frame_step})),setpts=N/FRAME_RATE/TB')
            if filters:
                command.extend(['-vf', ','.join(filters)])

            comp_level = min(9, max(0, int((quality / 35) * 9)))
            command.extend(['-compression_level', str(comp_level)])

            command.append(output_pattern)

            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            if not result.get('success'):
                return result

            print(json.dumps({"type": "progress", "percent": 99}))
            sys.stdout.flush()

            try:
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_STORED) as zipf:
                    for root, dirs, files in os.walk(temp_frame_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, output_dir)
                            zipf.write(file_path, arcname)

                if os.path.exists(temp_frame_dir):
                    shutil.rmtree(temp_frame_dir, ignore_errors=True)

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

