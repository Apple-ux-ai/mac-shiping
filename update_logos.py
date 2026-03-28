
import os
from PIL import Image

def process_logo():
    source_path = r"c:\Users\admin\Desktop\demo\logo.png"
    frontend_public_dir = r"c:\Users\admin\Desktop\demo\frontend\public"
    build_dir = r"c:\Users\admin\Desktop\demo\build"

    # Ensure directories exist
    os.makedirs(frontend_public_dir, exist_ok=True)
    os.makedirs(build_dir, exist_ok=True)

    try:
        img = Image.open(source_path)
        
        # 1. Save as logo.png in frontend/public
        frontend_logo_path = os.path.join(frontend_public_dir, "logo.png")
        img.save(frontend_logo_path, "PNG")
        print(f"Saved: {frontend_logo_path}")

        # 2. Save as icon.ico in frontend/public (for favicon/legacy)
        frontend_ico_path = os.path.join(frontend_public_dir, "icon.ico")
        img.save(frontend_ico_path, format='ICO', sizes=[(256, 256)])
        print(f"Saved: {frontend_ico_path}")

        # 3. Save as icon.ico in build/ (for Electron Builder)
        build_ico_path = os.path.join(build_dir, "icon.ico")
        img.save(build_ico_path, format='ICO', sizes=[(256, 256)])
        print(f"Saved: {build_ico_path}")

        # 4. Save as icon.png in build/
        build_png_path = os.path.join(build_dir, "icon.png")
        img.save(build_png_path, "PNG")
        print(f"Saved: {build_png_path}")

    except Exception as e:
        print(f"Error processing logo: {e}")

if __name__ == "__main__":
    process_logo()
