import os
import hashlib
from utils.ffmpeg_utils import run_ffmpeg_command

class PreviewService:
    """Service for generating video previews"""
    
    @staticmethod
    def generate_preview(source_path, output_dir):
        """
        Generate a preview MP4 for the file
        """
        try:
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
                
            filename = os.path.splitext(os.path.basename(source_path))[0]
            identity = f"{source_path}:{os.path.getmtime(source_path)}:{os.path.getsize(source_path)}"
            digest = hashlib.md5(identity.encode("utf-8")).hexdigest()[:10]
            output_path = os.path.join(output_dir, f"preview_{filename}_{digest}.mp4")
            
            command = [
                'ffmpeg', '-y',
                '-i', source_path,
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '28', 
                '-vf', 'scale=-2:480', 
                '-c:a', 'aac',
                '-ac', '2',
                output_path
            ]
            
            result = run_ffmpeg_command(command)
            if result.get('success'):
                 return {'success': True, 'previewPath': output_path}
            else:
                 return result
                 
        except Exception as e:
            return {'success': False, 'error': str(e)}
