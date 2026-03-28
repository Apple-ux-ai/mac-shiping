import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info

class MP4ToAVIConverter(BaseConverter):
    """MP4 to AVI Converter"""

    def __init__(self):
        super().__init__()
        self.supported_formats = ['mp4']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
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
            use_vbr = options.get('useVBR', True)
            keyframe_interval = options.get('keyframeInterval')
            audio_sample_rate = options.get('audioSampleRate')
            audio_channels = options.get('audioChannels')
            video_bitrate_option = options.get('videoBitrate')

            # Get video info for duration
            video_info = get_video_info(input_path)
            total_duration = 0
            if video_info and 'format' in video_info:
                try:
                    total_duration = float(video_info['format'].get('duration', 0))
                except (TypeError, ValueError):
                    total_duration = 0

            audio_tracks_count = 0
            if video_info and isinstance(video_info, dict):
                streams = video_info.get('streams') or []
                audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
                audio_tracks_count = len(audio_streams)
            
            has_audio = audio_tracks_count > 0

            end_time = options.get('endTime', total_duration)
            if end_time is None or end_time <= start_time:
                end_time = total_duration

            # Resolve output path
            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.avi',
                {
                    'quality': quality_percent,
                    'audioBitrate': audio_bitrate,
                    'resolution': resolution,
                    'startTime': start_time,
                    'endTime': end_time,
                    'useVBR': use_vbr,
                    'keyframeInterval': keyframe_interval,
                    'audioSampleRate': audio_sample_rate,
                    'audioChannels': audio_channels,
                },
            )

            # Progress callback
            task_duration = end_time - start_time
            if task_duration <= 0:
                task_duration = 1

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / task_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            min_crf = 18
            max_crf = 28
            crf_range = max_crf - min_crf
            crf = max_crf - int((quality_percent / 100.0) * crf_range)
            if crf < min_crf:
                crf = min_crf
            if crf > max_crf:
                crf = max_crf

            command = ['ffmpeg', '-y']

            # Time trimming
            if start_time > 0:
                command.extend(['-ss', str(start_time)])
            if end_time < total_duration:
                command.extend(['-to', str(end_time)])

            command.extend(['-i', input_path])

            # Video encoding (libx264)
            command.extend(['-c:v', 'libx264'])
            
            if use_vbr:
                command.extend(['-crf', str(crf)])
            else:
                video_bitrate = video_bitrate_option
                if not video_bitrate:
                    # Fallback based on CRF/Quality approximation
                    if crf <= 18:
                        video_bitrate = '5000k'
                    elif crf <= 23:
                        video_bitrate = '2500k'
                    else:
                        video_bitrate = '1000k'
                command.extend(['-b:v', video_bitrate])
            
            command.extend(['-preset', 'medium'])
            command.extend(['-pix_fmt', 'yuv420p'])
            
            # Resolution
            if resolution and resolution != 'original':
                command.extend(['-s', resolution])
            
            # Keyframe interval
            if keyframe_interval:
                command.extend(['-g', str(int(keyframe_interval))])

            command.extend(['-map', '0:v:0'])

            # Audio encoding (libmp3lame)
            if has_audio:
                command.extend(['-c:a', 'libmp3lame'])
                command.extend(['-b:a', audio_bitrate])

                # Audio sample rate
                if audio_sample_rate:
                    command.extend(['-ar', str(audio_sample_rate)])

                # Audio channels
                if audio_channels:
                    command.extend(['-ac', str(audio_channels)])

                # Audio track mapping
                command.extend(['-map', f'0:a:{audio_track}?'])

            command.append(output_path)
            
            # Send output info first (convention in this codebase seems to be mostly just progress, but let's stick to progress)
            # Actually mov_to_avi.py prints the output target first.
            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()

            return run_ffmpeg_command(command, progress_callback=progress_callback)

        except Exception as e:
            return {'success': False, 'error': str(e)}
