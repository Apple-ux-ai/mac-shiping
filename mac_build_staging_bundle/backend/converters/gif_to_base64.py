import os
import base64
import json
import sys
from converters.base import BaseConverter

class GIFToBase64Converter(BaseConverter):
    """GIF to BASE64 Converter"""

    def __init__(self):
        super().__init__()
        self.supported_formats = ['gif']

    def convert(self, input_path: str, output_dir: str, **options) -> dict:
        try:
            self.validate_input(input_path)

            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            filename = os.path.splitext(os.path.basename(input_path))[0]
            # Use .base64 extension to store the base64 string
            output_path = self.resolve_output_path(output_dir, filename, '.base64', {})

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()

            with open(input_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                data_url = f"data:image/gif;base64,{encoded_string}"

            with open(output_path, "w", encoding='utf-8') as text_file:
                text_file.write(data_url)

            print(json.dumps({"type": "progress", "percent": 100}))
            sys.stdout.flush()

            return {'success': True, 'output': output_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}
