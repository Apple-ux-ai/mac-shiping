import os
import zipfile
import shutil
import json
import sys
import hashlib
import time
from ..common.ffmpeg_utils import run_ffmpeg_command, get_video_info

def _build_options_hash(params):
    params = params or {}
    if not params:
        return ""
    serialized = json.dumps(params, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.md5(serialized.encode("utf-8")).hexdigest()[:8]

def convert_avi_to_jpg(source_path, output_dir, params):
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        filename = os.path.splitext(os.path.basename(source_path))[0]
        options_hash = _build_options_hash(params)

        if options_hash:
            zip_basename = f"{filename}_{options_hash}"
        else:
            zip_basename = filename

        temp_frame_dir = os.path.join(output_dir, zip_basename)

        if not os.path.exists(temp_frame_dir):
            os.makedirs(temp_frame_dir)

        output_pattern = os.path.join(temp_frame_dir, f"{zip_basename}_%05d.jpg")

        quality = params.get('quality', 80)
        fps = params.get('fps', 30)
        interval = params.get('interval', 100)
        keep_ratio = max(1.0, min(100.0, float(interval))) / 100.0
        target_fps = max(0.1, float(fps) * keep_ratio)

        q_scale = int((100 - quality) * 30 / 100) + 1
        q_scale = max(1, min(31, q_scale))

        video_info = get_video_info(source_path)
        total_duration = 0
        if video_info and 'format' in video_info:
            total_duration = float(video_info['format'].get('duration', 0))

        start_time = params.get('startTime', 0)
        end_time = params.get('endTime', total_duration)

        if end_time <= start_time:
            end_time = total_duration

        task_duration = end_time - start_time
        if task_duration <= 0:
            task_duration = 1

        zip_path = os.path.join(output_dir, f"{zip_basename}.zip")
        print(json.dumps({"type": "output", "output": zip_path, "targets": [temp_frame_dir, zip_path]}))
        sys.stdout.flush()

        def progress_callback(current_seconds):
            percent = min(99, round((current_seconds / task_duration) * 100))
            print(json.dumps({"type": "progress", "percent": percent}))
            sys.stdout.flush()

        command = [
            'ffmpeg', '-y',
        ]

        if start_time > 0:
            command.extend(['-ss', str(start_time)])

        if end_time < total_duration:
            command.extend(['-to', str(end_time)])

        command.extend([
            '-i', source_path,
            '-vf', f'fps={target_fps}',
            '-q:v', str(q_scale),
            output_pattern
        ])

        result = run_ffmpeg_command(command, progress_callback=progress_callback)
        if not result.get('success'):
            return result

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
                'output': zip_path,
                'outputPath': zip_path,
                'folderPath': temp_frame_dir,
            }

        except Exception as e:
            return {'success': False, 'error': f"Compression failed: {str(e)}"}

    except Exception as e:
        return {'success': False, 'error': str(e)}


def _cleanup_old_previews(output_dir, max_age_sec=24 * 60 * 60):
    try:
        now = time.time()
        for name in os.listdir(output_dir):
            if not name.startswith('preview_') or not name.endswith('.mp4'):
                continue
            path = os.path.join(output_dir, name)
            if not os.path.isfile(path):
                continue
            if now - os.path.getmtime(path) > max_age_sec:
                os.remove(path)
    except Exception:
        pass

def generate_preview_video(source_path, output_dir):
    """
    Generate a preview MP4 for the AVI file to allow playback in browser.
    """
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        _cleanup_old_previews(output_dir)
            
        filename = os.path.splitext(os.path.basename(source_path))[0]
        identity = f"{source_path}:{os.path.getmtime(source_path)}:{os.path.getsize(source_path)}"
        digest = hashlib.md5(identity.encode("utf-8")).hexdigest()[:10]
        output_path = os.path.join(output_dir, f"preview_{filename}_{digest}.mp4")
        
        # If it exists and is recent? No, simple overwrite.
        
        # Transcode to H.264 MP4, scaled to 480p for speed, ultrafast preset
        command = [
            'ffmpeg', '-y',
            '-i', source_path,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '28', # Lower quality for preview
            '-vf', 'scale=-2:480', # Resize height to 480p, width auto
            '-c:a', 'aac',
            '-ac', '2',
            output_path
        ]
        
        result = run_ffmpeg_command(command)
        if result.get('success'):
             return {'success': True, 'previewPath': output_path}
        else:
             return result
             
    except Exception as e:
        return {'success': False, 'error': str(e)}
