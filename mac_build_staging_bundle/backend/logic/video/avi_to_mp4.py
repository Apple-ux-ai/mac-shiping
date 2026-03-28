import os
import json
import sys
from ..common.ffmpeg_utils import run_ffmpeg_command, get_video_info

def convert_avi_to_mp4(source_path, output_dir, params):
    """
    将 AVI 转换为 MP4
    """
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        filename = os.path.splitext(os.path.basename(source_path))[0]
        output_path = os.path.join(output_dir, f"{filename}.mp4")
        
        # 解析参数
        quality_percent = params.get('quality', 80) # 1-100
        audio_bitrate = params.get('audioBitrate', '128k')
        resolution = params.get('resolution', 'original')
        audio_track = params.get('audioTrack', 0)
        
        # 映射质量到 CRF (18-35)
        # 100% -> CRF 18 (High)
        # 1% -> CRF 35 (Low)
        crf = 35 - int((quality_percent - 1) * (35 - 18) / 99)
        crf = max(18, min(35, crf))

        # 获取视频总时长用于计算进度
        video_info = get_video_info(source_path)
        total_duration = 0
        if video_info and 'format' in video_info:
            total_duration = float(video_info['format'].get('duration', 0))

        start_time = params.get('startTime', 0)
        end_time = params.get('endTime', total_duration)
        
        if end_time <= start_time:
            end_time = total_duration
            
        task_duration = end_time - start_time
        if task_duration <= 0: task_duration = 1

        def progress_callback(current_seconds):
            percent = min(99, round((current_seconds / task_duration) * 100))
            print(json.dumps({"type": "progress", "percent": percent}))
            sys.stdout.flush()

        command = ['ffmpeg', '-y']

        # 输入前的裁剪参数
        if start_time > 0:
            command.extend(['-ss', str(start_time)])
        
        if end_time < total_duration:
            command.extend(['-to', str(end_time)])

        command.extend(['-i', source_path])

        # 视频编码设置
        command.extend(['-c:v', 'libx264'])
        command.extend(['-crf', str(crf)])
        command.extend(['-preset', 'medium'])
        
        # 分辨率设置
        if resolution != 'original':
            # resolution 格式如 "1920x1080"
            command.extend(['-s', resolution])
        
        # 音频编码设置
        command.extend(['-c:a', 'aac'])
        command.extend(['-b:a', audio_bitrate])
        
        # 音轨选择
        # ffmpeg 默认选第一个音轨，如果用户选了特定音轨
        command.extend(['-map', '0:v:0']) # 第一个视频流
        command.extend(['-map', f'0:a:{audio_track}']) # 选择特定音轨

        command.extend(['-pix_fmt', 'yuv420p']) # 确保更好的兼容性
        command.append(output_path)
        
        # 执行转换
        result = run_ffmpeg_command(command, progress_callback=progress_callback)
        if not result.get('success'):
            # 如果音轨映射失败（例如视频没有这么多音轨），尝试回退到默认
            if "Stream map" in result.get('error', '') and audio_track != 0:
                command = [c for c in command if not c.startswith('0:a:')]
                # 重新构建不带特定音轨映射的命令，或者只用第一个可用音轨
                # 简化处理：重新运行，但不带 -map
                # 这里略过复杂的回退逻辑，假设 UI 会根据视频信息提供正确的音轨选项
                pass
            return result
            
        # 100% 进度
        print(json.dumps({"type": "progress", "percent": 100}))
        sys.stdout.flush()

        return {'success': True, 'output': output_path}
            
    except Exception as e:
        return {'success': False, 'error': str(e)}
