import os
import json
import sys
from converters.base import BaseConverter
from utils.ffmpeg_utils import run_ffmpeg_command, get_video_info


class MOVToMP4Converter(BaseConverter):
    """MOV to MP4 Converter"""

    def __init__(self):
        super().__init__()
        self.supported_formats = ['mov']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        try:
            self.validate_input(input_path)

            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]

            quality_percent = options.get('quality', 80)
            audio_bitrate = options.get('audioBitrate', '128k')
            resolution = options.get('resolution', 'original')
            audio_track = options.get('audioTrack', 0)
            start_time = options.get('startTime', 0)
            use_vbr = options.get('useVBR', True)
            keyframe_interval = options.get('keyframeInterval')
            audio_sample_rate = options.get('audioSampleRate')
            audio_channels = options.get('audioChannels')
            video_bitrate_option = options.get('videoBitrate')

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

            output_path = self.resolve_output_path(
                output_dir,
                filename,
                '.mp4',
                {
                    'quality': quality_percent,
                    'audioBitrate': audio_bitrate,
                    'resolution': resolution,
                    'audioTrack': audio_track,
                    'startTime': start_time,
                    'endTime': end_time,
                    'useVBR': use_vbr,
                    'keyframeInterval': keyframe_interval,
                    'audioSampleRate': audio_sample_rate,
                    'audioChannels': audio_channels,
                    'videoBitrate': video_bitrate_option,
                },
            )

            print(
                json.dumps(
                    {"type": "output", "output": output_path, "targets": [output_path]}
                )
            )
            sys.stdout.flush()

            crf = 35 - int((quality_percent - 1) * (35 - 18) / 99)
            crf = max(18, min(35, crf))

            if end_time <= start_time:
                end_time = total_duration

            task_duration = end_time - start_time
            if task_duration <= 0:
                task_duration = 1

            def progress_callback(current_seconds):
                percent = min(99, round((current_seconds / task_duration) * 100))
                print(json.dumps({"type": "progress", "percent": percent}))
                sys.stdout.flush()

            command = ['ffmpeg', '-y']

            if start_time > 0:
                command.extend(['-ss', str(start_time)])

            if end_time < total_duration:
                command.extend(['-to', str(end_time)])

            command.extend(['-i', input_path])

            command.extend(['-c:v', 'libx264'])
            if use_vbr:
                command.extend(['-crf', str(crf)])
            else:
                video_bitrate = options.get('videoBitrate')
                if not video_bitrate:
                    if quality_percent >= 30:
                        video_bitrate = '1500k'
                    elif quality_percent >= 20:
                        video_bitrate = '2500k'
                    else:
                        video_bitrate = '4000k'
                command.extend(['-b:v', video_bitrate])
            command.extend(['-preset', 'medium'])
            command.extend(['-pix_fmt', 'yuv420p'])

            if keyframe_interval:
                command.extend(['-g', str(int(keyframe_interval))])

            if resolution != 'original':
                command.extend(['-s', resolution])

            if has_audio:
                command.extend(['-c:a', 'aac'])
                command.extend(['-b:a', audio_bitrate])
                if audio_sample_rate:
                    command.extend(['-ar', str(audio_sample_rate)])
                if audio_channels:
                    command.extend(['-ac', str(audio_channels)])
    
                command.extend(['-map', '0:v:0'])
                command.extend(['-map', f'0:a:{audio_track}?'])
            else:
                command.extend(['-map', '0:v:0'])


            command.append(output_path)

            result = run_ffmpeg_command(command, progress_callback=progress_callback)

            if not result.get('success'):
                if "Stream map" in result.get('error', '') and audio_track != 0:
                    command = ['ffmpeg', '-y']
                    if start_time > 0:
                        command.extend(['-ss', str(start_time)])
                    if end_time < total_duration:
                        command.extend(['-to', str(end_time)])
                    command.extend(['-i', input_path])
                    command.extend(['-c:v', 'libx264'])
                    if use_vbr:
                        command.extend(['-crf', str(crf)])
                    else:
                        video_bitrate = options.get('videoBitrate')
                        if not video_bitrate:
                            if quality_percent >= 30:
                                video_bitrate = '1500k'
                            elif quality_percent >= 20:
                                video_bitrate = '2500k'
                            else:
                                video_bitrate = '4000k'
                        command.extend(['-b:v', video_bitrate])
                    command.extend(['-preset', 'medium'])
                    command.extend(['-pix_fmt', 'yuv420p'])
                    if keyframe_interval:
                        command.extend(['-g', str(int(keyframe_interval))])
                    if resolution != 'original':
                        command.extend(['-s', resolution])
                    command.extend(['-c:a', 'aac', '-b:a', audio_bitrate])
                    if audio_sample_rate:
                        command.extend(['-ar', str(audio_sample_rate)])
                    if audio_channels:
                        command.extend(['-ac', str(audio_channels)])
                    command.append(output_path)
                    result = run_ffmpeg_command(
                        command, progress_callback=progress_callback
                    )

                if not result.get('success'):
                    return result

            return {'success': True, 'outputPath': output_path}

        except Exception as e:
            return {'success': False, 'error': str(e)}
