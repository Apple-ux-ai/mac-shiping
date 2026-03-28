import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class AVIToMPEConverter(BaseConverter):
    """AVI to MPE (MPEG program stream) Converter"""
    
    def __init__(self):
        super().__init__()
        self.supported_formats = ['avi']
        
    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        """
        Convert AVI to MPE (MPEG program stream)
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
            
            # Map quality (1-35) to MPEG-1 qscale (1-31)
            # User range 1-35, where 1 is best quality?
            # Actually, standardizing with H264: 35 is low, 1 is high? 
            # Wait, in AVIToMPF it was: qscale = 31 - int((quality_percent - 1) * 30 / 34)
            # This means quality_percent=1 -> qscale=31 (worst), quality_percent=35 -> qscale=1 (best).
            # I will follow this pattern for consistency.
            qscale = 31 - int((quality_percent - 1) * 30 / 34)
            qscale = max(1, min(31, qscale))

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
                '.mpe',
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

            command = ['ffmpeg', '-y', '-i', input_path]

            # Use MPEG-2 video in an MPEG program stream for broader compatibility.
            command.extend(['-map', '0:v:0'])
            command.extend(['-c:v', 'mpeg2video'])
            command.extend(['-q:v', str(qscale)])
            command.extend(['-pix_fmt', 'yuv420p'])
            
            # Resolution settings
            if resolution != 'original':
                command.extend(['-s', resolution])
            
            # Audio encoding settings for MPE
            if has_audio:
                command.extend(['-map', f'0:a:{audio_track}?'])
                command.extend(['-c:a', 'mp2'])
                command.extend(['-b:a', audio_bitrate])

            command.extend(['-f', 'mpeg'])
            command.append(output_path)
            
            # Execute conversion
            result = run_ffmpeg_command(command, progress_callback=progress_callback)
            if not result.get('success'):
                # Fallback if audio track mapping fails
                if "Stream map" in result.get('error', '') and audio_track != 0:
                    # Retry with default audio mapping
                    command = ['ffmpeg', '-y', '-i', input_path]
                    command.extend(['-map', '0:v:0', '-c:v', 'mpeg2video', '-q:v', str(qscale), '-pix_fmt', 'yuv420p'])
                    if resolution != 'original':
                        command.extend(['-s', resolution])
                    if has_audio:
                        command.extend(['-c:a', 'mp2', '-b:a', audio_bitrate])
                    command.extend(['-f', 'mpeg', output_path])
                    result = run_ffmpeg_command(command, progress_callback=progress_callback)

            if result.get('success'):
                print(json.dumps({"type": "progress", "percent": 100}))
                sys.stdout.flush()
                return {'success': True, 'output': output_path, 'outputPath': output_path}

            return result

        except Exception as e:
            return {"success": False, "error": str(e)}
