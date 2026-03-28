import os
import json
import sys

from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info


class GIFToMP4Converter(BaseConverter):
    """GIF to MP4 Converter"""

    def __init__(self):
        super().__init__()
        self.supported_formats = ['gif']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        try:
            self.validate_input(input_path)

            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            fps = options.get('fps', 30)

            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            if total_duration <= 0:
                total_duration = 1

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.mp4',
                {
                    'fps': fps,
                },
            )

            print(json.dumps({
                "type": "output",
                "output": output_path,
                "targets": [output_path],
            }))
            sys.stdout.flush()

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / total_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            command = ['ffmpeg', '-y', '-i', input_path]
            command.extend(['-vf', f'fps={fps},scale=trunc(iw/2)*2:trunc(ih/2)*2'])
            command.extend(['-c:v', 'libx264'])
            command.extend(['-pix_fmt', 'yuv420p'])
            command.append(output_path)

            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            if not result.get('success'):
                if os.path.exists(output_path):
                    try:
                        os.remove(output_path)
                    except Exception:
                        pass
                return result

            try:
                if (not os.path.exists(output_path)) or os.path.getsize(output_path) <= 0:
                    if os.path.exists(output_path):
                        try:
                            os.remove(output_path)
                        except Exception:
                            pass
                    return {
                        'success': False,
                        'error': 'FFmpeg 转换结果为空文件，请检查源 GIF 是否正常',
                    }
            except Exception:
                pass

            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {'success': True, 'output': output_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}

