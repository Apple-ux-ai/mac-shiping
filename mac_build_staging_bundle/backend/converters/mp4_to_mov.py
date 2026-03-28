import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class MP4ToMOVConverter(BaseConverter):
    """MP4 to MOV Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['mp4']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert MP4 to MOV (Apple QuickTime)
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            quality_percent = int(options.get('quality', 90) or 90)
            if quality_percent < 1:
                quality_percent = 1
            if quality_percent > 100:
                quality_percent = 100
            audio_bitrate = options.get('audioBitrate', '128k')
            resolution = options.get('resolution', 'original')
            audio_track = options.get('audioTrack', 0)
            start_time = options.get('startTime', 0)
            end_time = options.get('endTime', None)

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.mov',
                {
                    'quality': quality_percent,
                    'audioBitrate': audio_bitrate,
                    'resolution': resolution,
                    'audioTrack': audio_track
                }
            )

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()
            
            min_crf = 18
            max_crf = 28
            crf_range = max_crf - min_crf
            crf = max_crf - int((quality_percent / 100.0) * crf_range)
            if crf < min_crf:
                crf = min_crf
            if crf > max_crf:
                crf = max_crf

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

            task_duration = total_duration
            if end_time is not None:
                task_duration = float(end_time) - float(start_time)
            elif start_time > 0:
                task_duration = total_duration - float(start_time)

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / task_duration) * 100)) if task_duration > 0 else 0
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            # MOV with H.264/AAC is standard for Apple QuickTime
            command = ['ffmpeg', '-y']
            
            if start_time > 0:
                command.extend(['-ss', str(start_time)])
            
            if end_time is not None:
                command.extend(['-to', str(end_time)])

            command.extend(['-i', input_path])

            # Video encoding settings for MOV (libx264)
            command.extend(['-c:v', 'libx264'])
            command.extend(['-crf', str(crf)])
            command.extend(['-preset', 'medium'])
            # Ensure pixel format is compatible with QuickTime
            command.extend(['-pix_fmt', 'yuv420p'])
            
            # Resolution settings
            if resolution != 'original':
                command.extend(['-s', resolution])
            
            command.extend(['-map', '0:v:0']) # First video stream

            # Audio encoding settings for MOV (AAC)
            if has_audio:
                command.extend(['-c:a', 'aac'])
                command.extend(['-b:a', audio_bitrate])
                command.extend(['-map', f'0:a:{audio_track}?']) # Specific audio track, ? to ignore if missing
            
            command.append(output_path)
            
            # Execute conversion
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            if result.get('success'):
                print(json.dumps({"type": "progress", "percent": 100}))
                sys.stdout.flush()
                return {'success': True, 'outputPath': output_path}
            else:
                return result

        except Exception as e:
            return {"success": False, "error": str(e)}
