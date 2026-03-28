import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class AVIToMOVConverter(BaseConverter):
    """AVI to MOV Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['avi']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert AVI to MOV (Apple QuickTime)
        """
        try:
            self.validate_input(input_path)
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            
            # Parse options
            quality_percent = options.get('quality', 23) # 1-35 (User UI range)
            audio_bitrate = options.get('audioBitrate', '128k')
            resolution = options.get('resolution', '1280x720')
            audio_track = options.get('audioTrack', 0)
            
            # Map quality (1-35) to CRF (18-28 as per requirement)
            # User range 1-35, where 1 is worst, 35 is best.
            # For CRF: 18 is high quality, 28 is lower quality.
            crf = 28 - int((quality_percent - 1) * 10 / 34)
            crf = max(18, min(28, crf))

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

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.mov',
                {
                    'quality': quality_percent,
                    'audioBitrate': audio_bitrate,
                    'resolution': resolution,
                    'audioTrack': audio_track,
                },
            )

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / total_duration) * 100)) if total_duration > 0 else 0
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            # MOV with H.264/AAC is standard for Apple QuickTime
            command = ['ffmpeg', '-y', '-i', input_path]

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
                command.extend(['-map', f'0:a:{audio_track}?']) # Specific audio track
            
            command.append(output_path)
            
            # Execute conversion
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            if not result.get('success'):
                # Fallback if audio track mapping fails
                if "Stream map" in result.get('error', '') and audio_track != 0:
                    command = ['ffmpeg', '-y', '-i', input_path]
                    command.extend(['-c:v', 'libx264', '-crf', str(crf), '-preset', 'medium', '-pix_fmt', 'yuv420p'])
                    if resolution != 'original': command.extend(['-s', resolution])
                    command.extend(['-c:a', 'aac', '-b:a', audio_bitrate])
                    command.append(output_path)
                    result = run_ffmpeg_command(command, progress_callback=progress_callback)
            
            return result

        except Exception as e:
            return {"success": False, "error": str(e)}
