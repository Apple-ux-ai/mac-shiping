import os
import json
import sys
import time
from PIL import Image
from converters.base import BaseConverter

class GIFToPDFConverter(BaseConverter):
    """GIF to PDF Converter"""

    def __init__(self):
        super().__init__()
        self.supported_formats = ['gif']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        try:
            self.validate_input(input_path)

            # Check if file is empty
            if os.path.exists(input_path) and os.path.getsize(input_path) == 0:
                return {'success': False, 'error': '文件内容为空 (0字节)'}

            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            orientation = str(options.get('orientation', 'Original') or 'Original').strip()
            orientation_key = orientation.lower()

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.pdf',
                {
                    'orientation': orientation,
                },
            )

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()

            img = Image.open(input_path)
            frames = []
            
            # Count total frames for progress
            total_frames = getattr(img, "n_frames", 1)
            last_progress_percent = -1
            last_progress_emit_time = 0.0
            
            try:
                for i in range(total_frames):
                    img.seek(i)
                    # Convert to RGB as PDF doesn't support RGBA well in all viewers
                    frame = img.convert('RGB')
                    
                    # Handle orientation if needed
                    if orientation_key == 'landscape' and frame.height > frame.width:
                        frame = frame.rotate(90, expand=True)
                    elif orientation_key == 'portrait' and frame.width > frame.height:
                        frame = frame.rotate(90, expand=True)
                    
                    frames.append(frame)
                    
                    # Report progress
                    if total_frames > 1:
                        percent = min(99, int(((i + 1) * 100) / total_frames))
                        now = time.monotonic()
                        if percent != last_progress_percent and (now - last_progress_emit_time) >= 0.03:
                            last_progress_percent = percent
                            last_progress_emit_time = now
                            print(json.dumps({"type": "progress", "percent": percent}))
                            sys.stdout.flush()
            except EOFError:
                pass

            if not frames:
                return {'success': False, 'error': 'No frames found in GIF'}

            # Save as PDF
            frames[0].save(output_path, save_all=True, append_images=frames[1:])

            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {'success': True, 'output': output_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}
