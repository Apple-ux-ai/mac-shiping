import sys
import json
import os
import subprocess
import io
import tempfile

sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from logic.video.avi_to_jpg import generate_preview_video
from converters.avi_to_jpg import AVIToJPGConverter
from converters.mp4_to_avi import MP4ToAVIConverter
from converters.mp4_to_mp3 import MP4ToMP3Converter
from converters.mp4_to_mov import MP4ToMOVConverter
from converters.mp4_to_gif import MP4ToGIFConverter
from converters.mp4_to_png import MP4ToPNGConverter
from converters.mp4_to_jpg import MP4ToJPGConverter
from converters.mp4_to_webm import MP4ToWEBMConverter
from converters.avi_to_mpe import AVIToMPEConverter
from converters.avi_to_mp4 import AVIToMP4Converter
from converters.avi_to_png import AVIToPNGConverter
from converters.avi_to_webm import AVIToWEBMConverter
from converters.avi_to_gif import AVIToGIFConverter
from converters.avi_to_mp3 import AVIToMP3Converter
from converters.avi_to_h264 import AVIToH264Converter
from converters.avi_to_mpf import AVIToMPFConverter
from converters.avi_to_mkv import AVIToMKVConverter
from converters.avi_to_mov import AVIToMOVConverter
from converters.avi_to_wav import AVIToWAVConverter
from converters.mov_to_mp4 import MOVToMP4Converter
from converters.mov_to_webm import MOVToWEBMConverter
from converters.mov_to_avi import MOVToAVIConverter
from converters.mov_to_gif import MOVToGIFConverter
from converters.mov_to_png import MOVToPNGConverter
from converters.mov_to_jpg import MOVToJPGConverter
from converters.mov_to_wav import MOVToWAVConverter
from converters.mov_to_mp3 import MOVToMP3Converter
from converters.mov_to_pdf import MOVToPDFConverter
from converters.gif_to_png import GIFToPNGConverter
from converters.gif_to_webm import GIFToWEBMConverter
from converters.gif_to_webp import GIFToWEBPConverter
from converters.gif_to_mov import GIFToMOVConverter
from converters.gif_to_mp4 import GIFToMP4Converter
from converters.gif_to_pdf import GIFToPDFConverter
from converters.gif_to_jpg import GIFToJPGConverter
from converters.gif_to_base64 import GIFToBase64Converter
from converters.gif_to_html import GIFToHTMLConverter
from converters.gif_to_avi import GIFToAVIConverter
from converters.webm_to_png import WEBMToPNGConverter
from converters.webm_to_wav import WEBMToWAVConverter
from converters.webm_to_mov import WEBMToMOVConverter
from converters.webm_to_avi import WEBMToAVIConverter
from converters.webm_to_gif import WEBMToGIFConverter
from converters.webm_to_jpg import WEBMToJPGConverter
from converters.webm_to_mp3 import WEBMToMP3Converter
from converters.webm_to_mp4 import WEBMToMP4Converter

def get_video_info(file_path):
    try:
        if not os.path.exists(file_path):
            return {'success': False, 'message': '文件不存在'}

        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Use ffprobe to get video info
        cmd = [
            'ffprobe', 
            '-v', 'error', 
            '-print_format', 'json', 
            '-show_format', 
            '-show_streams', 
            file_path
        ]
        
        # Adding startupinfo to hide console window on Windows
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            
        result = subprocess.run(cmd, capture_output=True, startupinfo=startupinfo)
        
        if result.returncode != 0:
            # If ffprobe fails, return basic info from OS instead of just error
            return {
                'success': True,
                'info': {
                    'size': file_size,
                    'width': 0,
                    'height': 0,
                    'fps': 0,
                    'duration': 0,
                    'codec': 'unknown',
                    'audio_codec': 'none',
                    'audio_tracks_count': 0,
                    'path': file_path,
                    'name': os.path.basename(file_path)
                }
            }
            
        stdout_str = result.stdout.decode('utf-8', errors='replace') if isinstance(result.stdout, bytes) else str(result.stdout)
        try:
            data = json.loads(stdout_str)
        except json.JSONDecodeError:
             return {'success': False, 'message': 'Failed to parse ffprobe output'}

        format_info = data.get('format', {})
        streams = data.get('streams', [])
        
        if not streams:
             return {'success': False, 'message': 'No streams found in file'}

        video_stream = next((s for s in streams if s.get('codec_type') == 'video'), {})
        audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
        audio_stream = audio_streams[0] if audio_streams else {}
        
        duration_str = format_info.get('duration', '0')
        try:
            duration = float(duration_str)
        except ValueError:
            duration = 0

        width = int(video_stream.get('width', 0))
        height = int(video_stream.get('height', 0))
        fps_eval = video_stream.get('avg_frame_rate', '0/0')
        if '/' in fps_eval:
            num, den = map(int, fps_eval.split('/'))
            fps = num / den if den > 0 else 0
        else:
            fps = float(fps_eval)
            
        codec = video_stream.get('codec_name', 'unknown')
        audio_codec = audio_stream.get('codec_name', 'none')
        audio_tracks_count = len(audio_streams)

        return {
            'success': True,
            'info': {
                'size': file_size,
                'width': width,
                'height': height,
                'fps': fps,
                'duration': duration,
                'codec': codec,
                'audio_codec': audio_codec,
                'audio_tracks_count': audio_tracks_count,
                'path': file_path,
                'name': os.path.basename(file_path)
            }
        }
    except Exception as e:
        return {'success': False, 'message': str(e)}

def read_input():
    try:
        # Read from stdin
        input_str = sys.stdin.readline()
        if not input_str:
            return None
        return json.loads(input_str)
    except Exception as e:
        return {'action': 'error', 'error': str(e)}

def send_output(data):
    print(json.dumps(data), flush=True)

def main():
    while True:
        data = read_input()
        if data is None:
            break
            
        action = data.get('action')
        payload = data.get('payload', {})
        
        result = {'success': False, 'message': 'Unknown action'}
        
        try:
            if action == "convert-avi-to-jpg":
                source_path = payload.get("sourcePath")
                output_dir = payload.get("outputDir")
                params = payload.get("params", {})

                if not source_path or not output_dir:
                    result = {"success": False, "message": "Missing paths"}
                else:
                    converter = AVIToJPGConverter()
                    result = converter.convert(source_path, output_dir, **params)
            
            elif action == 'convert-mp4-to-avi':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})
                
                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MP4ToAVIConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mp4-to-mp3':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MP4ToMP3Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mp4-to-mov':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MP4ToMOVConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mp4-to-gif':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MP4ToGIFConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mp4-to-png':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MP4ToPNGConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mp4-to-jpg':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MP4ToJPGConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mp4-to-webm':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MP4ToWEBMConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-mpe':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})
                
                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToMPEConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-mp4':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToMP4Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-png':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToPNGConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-webm':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToWEBMConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-gif':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToGIFConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-mp3':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToMP3Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-h264':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToH264Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-mpf':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToMPFConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-mkv':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToMKVConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-mov':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})
                
                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToMOVConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-avi-to-wav':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})
                
                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = AVIToWAVConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mov-to-mp4':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MOVToMP4Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mov-to-webm':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MOVToWEBMConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mov-to-avi':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MOVToAVIConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mov-to-gif':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MOVToGIFConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mov-to-png':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MOVToPNGConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mov-to-jpg':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MOVToJPGConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mov-to-wav':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MOVToWAVConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mov-to-mp3':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MOVToMP3Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-mov-to-pdf':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = MOVToPDFConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-webm-to-png':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = WEBMToPNGConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-webm-to-wav':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = WEBMToWAVConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-webm-to-mov':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = WEBMToMOVConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-webm-to-avi':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = WEBMToAVIConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-webm-to-gif':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = WEBMToGIFConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-webm-to-jpg':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = WEBMToJPGConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-webm-to-mp3':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = WEBMToMP3Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-webm-to-mp4':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = WEBMToMP4Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-mp4':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToMP4Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-webp':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToWEBPConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-base64':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToBase64Converter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-png':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToPNGConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-pdf':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToPDFConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-webm':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToWEBMConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-mov':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToMOVConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-avi':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToAVIConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-html':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToHTMLConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'convert-gif-to-jpg':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                params = payload.get('params', {})

                if not source_path or not output_dir:
                    result = {'success': False, 'message': 'Missing paths'}
                else:
                    converter = GIFToJPGConverter()
                    result = converter.convert(source_path, output_dir, **params)

            elif action == 'get-video-info':
                file_path = payload.get('filePath')
                if not file_path:
                    result = {'success': False, 'message': 'Missing file path'}
                else:
                    result = get_video_info(file_path)

            elif action == 'generate-preview':
                source_path = payload.get('sourcePath')
                output_dir = payload.get('outputDir')
                if not output_dir:
                     output_dir = os.path.join(tempfile.gettempdir(), 'convert-tool-preview')
                
                if not source_path:
                    result = {'success': False, 'message': 'Missing source path'}
                else:
                    result = generate_preview_video(source_path, output_dir)

            elif action == 'ping':
                result = {'success': True, 'message': 'pong'}
                
        except Exception as e:
            result = {'success': False, 'message': str(e)}
            
        # Send response with ID if provided, to match request/response
        response = {
            'id': data.get('id'),
            'result': result
        }
        send_output(response)

if __name__ == '__main__':
    # Ensure backend directory is in python path
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    main()
