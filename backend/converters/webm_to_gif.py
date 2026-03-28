import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info


class WEBMToGIFConverter(BaseConverter):
    """WEBM to GIF Converter"""

    def __init__(self):
        super().__init__()
        self.supported_formats = ['webm']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert WEBM to GIF
        """
        try:
            self.validate_input(input_path)

            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            fps = int(options.get('fps', 30))
            interval_percent = int(options.get('interval', 100) or 100)
            if interval_percent < 1:
                interval_percent = 1
            if interval_percent > 100:
                interval_percent = 100
            frame_step = max(1, round(100 / interval_percent))
            
            # Trimming options
            start_time = options.get('startTime')
            end_time = options.get('endTime')

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.gif',
                {
                    'fps': fps,
                    'interval': interval_percent,
                    'start': start_time,
                    'end': end_time
                },
            )

            # Define temporary palette path
            palette_path = os.path.join(output_dir, f"{filename}_palette.png")

            # Report output path for possible cleanup
            print(
                json.dumps(
                    {
                        "type": "output",
                        "output": output_path,
                        "targets": [output_path, palette_path],
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
                # Adjust progress based on relative position within the trimmed range
                relative_seconds = max(0, current_seconds - effective_start)
                percent = min(99, round((relative_seconds / convert_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            filters = []
            if frame_step > 1:
                filters.append(f"select='not(mod(n,{frame_step}))'")
            filters.append(f"fps={fps}")
            base_filters = ",".join(filters)
            
            # Pass 1: Generate palette
            # We assign 10% progress to palette generation
            print(json.dumps({"type": "progress", "percent": 5}))
            sys.stdout.flush()
            
            palette_command = ['ffmpeg', '-y']
            if start_time is not None:
                palette_command.extend(['-ss', str(start_time)])
            if end_time is not None:
                palette_command.extend(['-to', str(end_time)])
                
            palette_command.extend(['-i', input_path])
            palette_command.extend(['-vf', f"{base_filters},palettegen"])
            palette_command.extend([palette_path])
            
            # Run palette generation (ignoring progress callback as it doesn't report time)
            palette_result = run_ffmpeg_command(palette_command)
            
            if not palette_result.get('success'):
                return palette_result
                
            # Pass 2: Generate GIF using palette
            def progress_callback(current_seconds):
                # Adjust progress based on relative position within the trimmed range
                relative_seconds = current_seconds
                # Map 0-100% of encoding to 10-100% of total progress
                encode_percent = min(100, (relative_seconds / convert_duration) * 100)
                total_percent = 10 + (encode_percent * 0.9)
                
                print(json.dumps({"type": "progress", "percent": int(min(99, total_percent))}))
                sys.stdout.flush()

            filter_complex = f"[0:v]{base_filters}[x];[x][1:v]paletteuse"
            
            command = ['ffmpeg', '-y', '-progress', 'pipe:1']
            if start_time is not None:
                command.extend(['-ss', str(start_time)])
            if end_time is not None:
                command.extend(['-to', str(end_time)])
                
            command.extend(['-i', input_path])
            command.extend(['-i', palette_path])
            command.extend(['-filter_complex', filter_complex])
            command.extend([output_path])

            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            # Cleanup palette
            if os.path.exists(palette_path):
                try:
                    os.remove(palette_path)
                except:
                    pass
            
            if result.get('success'):
                # Final 100% report
                print(json.dumps({"type": "progress", "percent": 100}))
                sys.stdout.flush()
                return {'success': True, 'output': output_path}
            else:
                return result

        except Exception as e:
            return {'success': False, 'error': str(e)}
