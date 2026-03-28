import subprocess
import os
import json
import re
import sys
import threading
import shutil


_thread_state = threading.local()
_cancel_checker = None


def set_cancel_checker(callback):
    global _cancel_checker
    _cancel_checker = callback


def set_current_task(task_id):
    _thread_state.task_id = task_id


def clear_current_task():
    if hasattr(_thread_state, 'task_id'):
        delattr(_thread_state, 'task_id')


def _should_cancel():
    task_id = getattr(_thread_state, 'task_id', None)
    if not task_id or not _cancel_checker:
        return False
    try:
        return bool(_cancel_checker(task_id))
    except Exception:
        return False


def is_ffmpeg_available():
    return shutil.which('ffmpeg') is not None


def is_ffprobe_available():
    return shutil.which('ffprobe') is not None

def run_ffmpeg_command(command, progress_callback=None):
    """
    Execute FFmpeg command and report progress in real-time
    """
    try:
        if not is_ffmpeg_available():
            return {
                'success': False,
                'error': 'ffmpeg is not installed or not available in PATH'
            }

        if command[0] != 'ffmpeg':
            command.insert(0, 'ffmpeg')

        if '-progress' not in command:
            command = [command[0], '-progress', 'pipe:1', '-nostats', *command[1:]]
            
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, # Merge stderr into stdout
            stdin=subprocess.PIPE,
            startupinfo=startupinfo,
            universal_newlines=True,
            encoding='utf-8',
            errors='replace'
        )
        
        # Regex patterns for FFmpeg progress output
        time_pattern = re.compile(r"time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)")
        out_time_pattern = re.compile(r"out_time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)")
        out_time_ms_pattern = re.compile(r"out_time_ms=(\d+)")
        
        if process.stdout is None:
            return {
                'success': False,
                'error': 'Unable to read ffmpeg output'
            }

        full_output = []
        for line in process.stdout:
            if _should_cancel():
                try:
                    process.terminate()
                except Exception:
                    pass
                try:
                    process.wait(timeout=5)
                except Exception:
                    try:
                        process.kill()
                    except Exception:
                        pass
                return {
                    'success': False,
                    'error': 'Cancelled'
                }
            full_output.append(line)
            if not progress_callback:
                continue

            match_ms = out_time_ms_pattern.search(line)
            if match_ms:
                try:
                    # out_time_ms uses microseconds
                    seconds = int(match_ms.group(1)) / 1_000_000
                    progress_callback(seconds)
                    continue
                except Exception:
                    pass

            match_time = out_time_pattern.search(line) or time_pattern.search(line)
            if match_time:
                try:
                    time_str = match_time.group(1)
                    h, m, s = time_str.split(':')
                    seconds = int(h) * 3600 + int(m) * 60 + float(s)
                    progress_callback(seconds)
                except Exception:
                    pass
        
        process.wait()
        
        if process.returncode != 0:
            return {
                'success': False,
                'error': "".join(full_output[-10:]) # Return last few lines of error
            }
            
        return {
            'success': True,
            'message': 'Conversion completed successfully'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def get_video_info(file_path):
    """
    Get video info (using ffprobe) with OS-level fallback for file size
    """
    # Get basic file info from OS as fallback
    try:
        file_size = os.path.getsize(file_path)
    except Exception:
        file_size = 0

    try:
        if not is_ffprobe_available():
            return {
                'error': 'ffprobe is not installed or not available in PATH',
                'format': {
                    'filename': file_path,
                    'size': str(file_size),
                    'duration': '0'
                },
                'streams': []
            }

        command = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            file_path
        ]
        
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            
        result = subprocess.run(
            command,
            capture_output=True,
            startupinfo=startupinfo
        )
        
        if result.returncode == 0:
            stdout_str = result.stdout.decode('utf-8', errors='replace')
            info = json.loads(stdout_str)
            
            # Ensure size is populated from OS if ffprobe didn't get it
            if 'format' in info:
                if not info['format'].get('size') or int(info['format'].get('size', 0)) == 0:
                    info['format']['size'] = str(file_size)
            return info
            
        # If ffprobe fails, return basic info from OS
        return {
            'format': {
                'filename': file_path,
                'size': str(file_size),
                'duration': '0'
            },
            'streams': []
        }
    except Exception:
        # Fallback to minimum required structure
        return {
            'format': {
                'filename': file_path,
                'size': str(file_size),
                'duration': '0'
            },
            'streams': []
        }
