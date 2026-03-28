import os
import json
import sys
import subprocess
import tempfile
import shutil
from PIL import Image
from converters.base import BaseConverter

class MOVToPDFConverter(BaseConverter):
    """MOV to PDF Converter - Extracts frames and saves them as PDF pages"""

    def __init__(self):
        super().__init__()
        self.supported_formats = ['mov']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        temp_dir = None
        try:
            self.validate_input(input_path)

            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            orientation = str(options.get('orientation', 'Original') or 'Original').strip()
            orientation_key = orientation.lower()
            
            quality = int(options.get('quality', 80))
            if quality < 1:
                quality = 1
            if quality > 100:
                quality = 100
            frame_rate = options.get('frameRate')
            frame_interval_percent = int(options.get('frameInterval', 100) or 100)
            if frame_interval_percent < 1:
                frame_interval_percent = 1
            if frame_interval_percent > 100:
                frame_interval_percent = 100
            frame_interval = max(1, round(100 / frame_interval_percent))
            start_time = options.get('startTime')
            end_time = options.get('endTime')

            # Map前端质量百分比(1-100)到PIL质量(50-95)
            pil_quality = max(50, min(95, quality))

            output_path = self.resolve_output_path(output_dir, filename, '.pdf', {
                'orientation': orientation,
                'quality': quality,
                'frameRate': frame_rate,
                'frameInterval': frame_interval_percent,
                'startTime': start_time,
                'endTime': end_time
            })

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()

            # Create a temporary directory for frames
            temp_dir = tempfile.mkdtemp()
            
            filter_parts = []
            if frame_rate:
                filter_parts.append(f"fps={frame_rate}")
            
            if frame_interval > 1:
                filter_parts.append(f"select='not(mod(n,{frame_interval}))'")
            
            filter_str = ",".join(filter_parts) if filter_parts else ""

            cmd = ['ffmpeg', '-y']
            
            if start_time:
                cmd.extend(['-ss', str(start_time)])
            
            cmd.extend(['-i', input_path])
            
            if end_time and start_time:
                duration = float(end_time) - float(start_time)
                cmd.extend(['-t', str(duration)])
            elif end_time:
                cmd.extend(['-t', str(end_time)])

            if filter_str:
                cmd.extend(['-vf', filter_str])
            
            cmd.extend(['-vsync', 'vfr', os.path.join(temp_dir, 'frame_%05d.jpg')])

            # Run FFmpeg
            startupinfo = None
            if os.name == 'nt':
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', startupinfo=startupinfo)
            stdout, stderr = process.communicate()
            
            if process.returncode != 0:
                return {'success': False, 'error': f'FFmpeg failed: {stderr}'}

            # Collect all frames
            frame_files = sorted([f for f in os.listdir(temp_dir) if f.startswith('frame_')])
            if not frame_files:
                return {'success': False, 'error': 'No frames extracted from video'}

            # Combine frames into PDF using PIL
            images = []
            total = len(frame_files)
            
            for i, f in enumerate(frame_files):
                img_path = os.path.join(temp_dir, f)
                img = Image.open(img_path).convert('RGB')
                if orientation_key == 'landscape' and img.height > img.width:
                    img = img.rotate(90, expand=True)
                elif orientation_key == 'portrait' and img.width > img.height:
                    img = img.rotate(90, expand=True)
                images.append(img)
                
                # Progress for PDF creation (50% - 100%)
                percent = 50 + min(49, round(((i + 1) / total) * 50))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            if images:
                images[0].save(output_path, save_all=True, append_images=images[1:], quality=int(pil_quality))

            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {'success': True, 'output': output_path}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
        finally:
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
