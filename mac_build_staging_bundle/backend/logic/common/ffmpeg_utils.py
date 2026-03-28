import subprocess
import os
import json

import re
import sys

def run_ffmpeg_command(command, progress_callback=None):
    """
    执行 FFmpeg 命令并实时报告进度
    """
    try:
        if command[0] != 'ffmpeg':
            command.insert(0, 'ffmpeg')
            
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, # 将 stderr 合并到 stdout
            stdin=subprocess.PIPE,
            startupinfo=startupinfo,
            universal_newlines=True,
            encoding='utf-8',
            errors='replace'
        )
        
        # 正则表达式匹配 FFmpeg 输出中的时间信息: time=00:00:01.23
        time_pattern = re.compile(r"time=(\d{2}:\d{2}:\d{2}\.\d{2})")
        
        full_output = []
        for line in process.stdout:
            full_output.append(line)
            match = time_pattern.search(line)
            if match and progress_callback:
                time_str = match.group(1)
                # 将 00:00:01.23 转换为秒
                h, m, s = time_str.split(':')
                seconds = int(h) * 3600 + int(m) * 60 + float(s)
                progress_callback(seconds)
        
        process.wait()
        
        if process.returncode != 0:
            return {
                'success': False,
                'error': "".join(full_output[-10:]) # 返回最后几行错误信息
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
    获取视频信息 (使用 ffprobe)
    """
    try:
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
            return json.loads(stdout_str)
        return None
    except Exception:
        return None
