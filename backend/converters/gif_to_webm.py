import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info


class GIFToWEBMConverter(BaseConverter):
    """GIF to WEBM Converter"""

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
            try:
                fps = int(fps)
            except (TypeError, ValueError):
                fps = 30
            fps = max(1, min(120, fps))

            quality_percent = options.get('quality', 90)
            try:
                quality_percent = float(quality_percent)
            except (TypeError, ValueError):
                quality_percent = 90.0
            quality_percent = max(1.0, min(100.0, quality_percent))

            resolution = options.get('resolution', 'original')
            if not isinstance(resolution, str) or not resolution:
                resolution = 'original'

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.webm',
                {'fps': fps, 'quality': quality_percent, 'resolution': resolution},
            )

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()

            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            if total_duration <= 0:
                total_duration = 1

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / total_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            crf_min, crf_max = 18, 35
            crf = crf_max - (quality_percent - 1) * (crf_max - crf_min) / 99.0
            crf = int(round(crf))
            crf = max(0, min(63, crf))

            if quality_percent >= 85:
                cpu_used = 3
            elif quality_percent >= 60:
                cpu_used = 4
            else:
                cpu_used = 6

            command = ['ffmpeg', '-y', '-i', input_path]

            if resolution == 'original':
                command.extend(['-vf', f'fps={fps},scale=trunc(iw/2)*2:trunc(ih/2)*2'])
            else:
                command.extend(['-vf', f'fps={fps}'])
                command.extend(['-s', resolution])

            command.extend(['-c:v', 'libvpx-vp9'])
            command.extend(['-crf', str(crf), '-b:v', '0'])
            command.extend(['-deadline', 'good', '-cpu-used', str(cpu_used), '-row-mt', '1'])
            command.extend(['-pix_fmt', 'yuva420p'])
            command.extend(['-an'])
            command.append(output_path)

            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            if not result.get('success'):
                return result

            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {'success': True, 'output': output_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}
