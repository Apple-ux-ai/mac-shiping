import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class MOVToMP3Converter(BaseConverter):
    """MOV to MP3 Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['mov']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Extract audio from MOV and save as MP3
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            # Parse options
            audio_bitrate = options.get('audioBitrate', '128k')
            audio_track = options.get('audioTrack', 0)
            use_vbr = options.get('useVBR', False)
            vbr_quality = options.get('vbrQuality', '4') # 0-9, 4 is default
            sample_rate = options.get('audioSampleRate')
            channels = options.get('audioChannels')

            filename = os.path.splitext(os.path.basename(input_path))[0]

            # Get total duration for progress calculation
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', total_duration)

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.mp3',
                {
                    'audioBitrate': audio_bitrate,
                    'audioTrack': audio_track,
                    'startTime': start_time,
                    'endTime': end_time,
                    'useVBR': use_vbr,
                    'vbrQuality': vbr_quality,
                    'audioSampleRate': sample_rate,
                    'audioChannels': channels
                }
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

            # Audio encoding settings
            command.extend(['-vn']) # No video
            command.extend(['-c:a', 'libmp3lame'])
            
            if use_vbr:
                command.extend(['-q:a', str(vbr_quality)])
            else:
                command.extend(['-b:a', audio_bitrate])
            
            if sample_rate:
                command.extend(['-ar', str(sample_rate)])
            
            if channels:
                command.extend(['-ac', str(channels)])
            
            # Audio track selection
            command.extend(['-map', f'0:a:{audio_track}'])

            command.append(output_path)
            
            # Execute conversion
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            if not result.get('success'):
                # Fallback if audio track mapping fails
                if "Stream map" in result.get('error', '') and audio_track != 0:
                    command = ['ffmpeg', '-y']
                    if start_time > 0: command.extend(['-ss', str(start_time)])
                    if end_time < total_duration: command.extend(['-to', str(end_time)])
                    command.extend(['-i', input_path, '-vn', '-c:a', 'libmp3lame'])
                    if use_vbr:
                        command.extend(['-q:a', str(vbr_quality)])
                    else:
                        command.extend(['-b:a', audio_bitrate])
                    command.append(output_path)
                    result = run_ffmpeg_command(command, progress_callback=progress_callback)
                
                if not result.get('success'):
                    return result

            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {
                'success': True,
                'outputPath': output_path
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}
