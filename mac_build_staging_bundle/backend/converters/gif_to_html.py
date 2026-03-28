import os
import base64
import json
import sys
from converters.base import BaseConverter
from typing import Dict, Any

class GIFToHTMLConverter(BaseConverter):
    def __init__(self):
        super().__init__()
        self.supported_formats = ['gif']

    def convert(self, input_path: str, output_dir: str, **options) -> Dict[str, Any]:
        """
        将 GIF 转换为嵌入 Base64 的 HTML 文件
        """
        try:
            self.validate_input(input_path)
            
            filename = os.path.splitext(os.path.basename(input_path))[0]
            output_path = self.resolve_output_path(output_dir, filename, '.html', {})

            print(json.dumps({"type": "output", "output": output_path, "targets": [output_path]}))
            sys.stdout.flush()

            # 读取 GIF 并转换为 Base64
            with open(input_path, "rb") as gif_file:
                gif_data = gif_file.read()
                base64_data = base64.b64encode(gif_data).decode('utf-8')

            # HTML 模板
            html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{filename} - GIF 预览</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #f0f2f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }}
        .container {{
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 90%;
        }}
        img {{
            max-width: 100%;
            height: auto;
            border-radius: 4px;
        }}
        .info {{
            margin-top: 15px;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <img src="data:image/gif;base64,{base64_data}" alt="{filename}">
        <div class="info">文件名: {filename}.gif</div>
    </div>
</body>
</html>"""

            # 写入 HTML 文件
            with open(output_path, "w", encoding="utf-8") as html_file:
                html_file.write(html_content)

            return {'success': True, 'output': output_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}
