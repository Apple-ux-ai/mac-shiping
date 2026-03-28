import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class AVIToWEBMConverter(BaseConverter):
    """AVI to WEBM Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['avi']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert AVI to WEBM (VP9/Opus)
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            # Parse options
            # UI 中传入的是 1-100 的“质量百分比”，数值越大质量越高
            quality_percent = options.get('quality', 70)
            try:
                quality_percent = float(quality_percent)
            except (TypeError, ValueError):
                quality_percent = 70.0
            quality_percent = max(1.0, min(100.0, quality_percent))

            # 将 1-100 的质量百分比映射到 VP9 合理的 CRF 区间 [18, 35]
            # 百分比越大 -> CRF 越小(画质越好)
            crf_min, crf_max = 18, 35
            crf = crf_max - (quality_percent - 1) * (crf_max - crf_min) / 99.0
            crf = int(round(crf))
            crf = max(0, min(63, crf))  # VP9 合法区间 [-1, 63]，这里限制在 [0, 63]
            audio_bitrate = options.get('audioBitrate', '128k')
            resolution = options.get('resolution', 'original')
            audio_track = options.get('audioTrack', 0)
            
            # Get total duration for progress calculation
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                total_duration = float(video_info['format'].get('duration', 0))

            audio_tracks_count = 0
            if video_info and isinstance(video_info, dict):
                streams = video_info.get('streams') or []
                audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
                audio_tracks_count = len(audio_streams)
            
            has_audio = audio_tracks_count > 0

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.webm',
                {
                    'quality': quality_percent,
                    'audioBitrate': audio_bitrate,
                    'resolution': resolution,
                    'audioTrack': audio_track,
                    'startTime': start_time,
                    'endTime': end_time,
                },
            )
            
            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()
            
            if end_time <= start_time:
                end_time = total_duration
                
            task_duration = end_time - start_time
            if task_duration <= 0: task_duration = 1

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / task_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            command = ['ffmpeg', '-y']

            # Input seeking
            if start_time > 0:
                command.extend(['-ss', str(start_time)])
            
            if end_time < total_duration:
                command.extend(['-to', str(end_time)])

            command.extend(['-i', input_path])

            # Video encoding settings (VP9)
            command.extend(['-c:v', 'libvpx-vp9'])
            command.extend(['-crf', str(crf)])
            # For VP9, bitrate should be 0 when using CRF
            command.extend(['-b:v', '0'])
            # Speed/quality trade-off (row-mt is good for multi-threading)
            command.extend(['-deadline', 'good', '-cpu-used', '2', '-row-mt', '1'])
            
            # Resolution settings
            if resolution != 'original':
                command.extend(['-s', resolution])
            
            command.extend(['-map', '0:v:0']) # First video stream

            # Audio encoding settings for WEBM (Opus)
            if has_audio:
                command.extend(['-c:a', 'libopus'])
                command.extend(['-b:a', audio_bitrate])
                command.extend(['-map', f'0:a:{audio_track}?']) # Specific audio track
            
            command.append(output_path)
            
            result = run_ffmpeg_command(command, progress_callback=progress_callback)

            if not result.get('success'):
                error_text = result.get('error', '') or ''
                if audio_track != 0 and (
                    "Stream map" in error_text
                    or "Nothing was written into output file" in error_text
                    or "Error sending frames to consumers" in error_text
                    or "Could not open encoder" in error_text
                ):
                    new_command = []
                    i = 0
                    while i < len(command):
                        if command[i] == '-map' and command[i + 1].startswith('0:a:'):
                            i += 2
                            continue
                        new_command.append(command[i])
                        i += 1

                    result = run_ffmpeg_command(new_command, progress_callback=progress_callback)
                    if not result.get('success'):
                        return result
                else:
                    return result

            return {
                'success': True,
                'message': f'Successfully converted to {output_path}',
                'outputPath': output_path
            }

        except Exception as e:
            return {
                'success': False,
                'message': f'Conversion error: {str(e)}'
            }
