import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info


class GIFToWEBPConverter(BaseConverter):
    def __init__(self):
        super().__init__()
        self.supported_formats = ['gif']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        try:
            self.validate_input(input_path)

            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            quality = int(options.get('quality', 85) or 85)
            if quality < 1:
                quality = 1
            if quality > 100:
                quality = 100

            interval_percent = options.get('interval')
            if interval_percent is None:
                interval_percent = options.get('frame_interval', 100)
            interval_percent = int(interval_percent or 100)
            if interval_percent < 1:
                interval_percent = 1
            if interval_percent > 100:
                interval_percent = 100

            frame_interval = max(1, round(100 / float(interval_percent)))

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.webp',
                {
                    'quality': quality,
                    'interval': interval_percent,
                    'frame_interval': frame_interval,
                },
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

            ffmpeg_command = [
                'ffmpeg',
                '-y',
                '-i',
                input_path,
            ]

            if frame_interval > 1:
                ffmpeg_command.extend(
                    [
                        '-vf',
                        f'select=not(mod(n\\,{frame_interval})),setpts=N/FRAME_RATE/TB',
                    ]
                )

            webp_quality = max(1, min(100, quality))

            ffmpeg_command.extend(
                [
                    '-c:v',
                    'libwebp',
                    '-q:v',
                    str(webp_quality),
                    '-compression_level',
                    '2',
                    '-loop',
                    '0',
                    output_path,
                ]
            )

            result = run_ffmpeg_command(ffmpeg_command, progress_callback=progress_callback)
            if not result.get('success'):
                return result

            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {'success': True, 'output': output_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}
