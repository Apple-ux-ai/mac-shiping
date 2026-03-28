from typing import Dict, Any
from converters.avi_to_mp4 import AVIToMP4Converter
from converters.avi_to_jpg import AVIToJPGConverter

class ConverterService:
    """Converter Service Orchestration"""
    
    def __init__(self):
        self.converters = {
            'avi-to-mp4': AVIToMP4Converter(),
            'avi-to-jpg': AVIToJPGConverter()
        }
    
    def convert(self, converter_type: str, input_path: str, output_dir: str, **options) -> Dict[str, Any]:
        """
        Execute conversion
        """
        if converter_type not in self.converters:
            raise ValueError(f"Unsupported converter type: {converter_type}")
        
        converter = self.converters[converter_type]
        return converter.convert(input_path, output_dir, **options)
