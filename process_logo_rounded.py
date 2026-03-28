import os
from PIL import Image, ImageDraw, ImageFilter

def process_logo_rounded():
    source_path = r"c:\Users\admin\Desktop\demo\logo.png"
    frontend_public_dir = r"c:\Users\admin\Desktop\demo\frontend\public"
    build_dir = r"c:\Users\admin\Desktop\demo\build"
    
    if not os.path.exists(source_path):
        print(f"Error: Source file not found at {source_path}")
        return

    # Open image and convert to RGBA
    img = Image.open(source_path).convert("RGBA")
    
    # 1. Remove white borders (assuming white is background)
    # Strategy: Replace white pixels with transparent, or just crop/mask if it's a square logo with white bg
    # Better strategy for "remove white borders" if it means "make background transparent":
    datas = img.getdata()
    newData = []
    for item in datas:
        # Change all white (also shades of whites) to transparent
        # Threshold for "white" - e.g., > 240, 240, 240
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
    img.putdata(newData)
    
    # 2. Round corners
    # Create a mask
    size = img.size
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    
    # Radius for rounded corners (e.g., 20% of width)
    radius = int(min(size) * 0.2)
    draw.rounded_rectangle((0, 0) + size, radius=radius, fill=255)
    
    # Apply mask
    output = Image.new('RGBA', size, (0, 0, 0, 0))
    output.paste(img, (0, 0), mask=mask)
    
    # Save processed images
    print("Saving processed images...")
    
    # Ensure directories exist
    os.makedirs(frontend_public_dir, exist_ok=True)
    os.makedirs(build_dir, exist_ok=True)
    
    # Save to frontend public
    frontend_logo_path = os.path.join(frontend_public_dir, "logo.png")
    output.save(frontend_logo_path, "PNG")
    print(f"Saved: {frontend_logo_path}")
    
    # Save ICO for frontend
    frontend_ico_path = os.path.join(frontend_public_dir, "icon.ico")
    output.save(frontend_ico_path, format='ICO', sizes=[(256, 256)])
    print(f"Saved: {frontend_ico_path}")
    
    # Save ICO for build
    build_ico_path = os.path.join(build_dir, "icon.ico")
    output.save(build_ico_path, format='ICO', sizes=[(256, 256)])
    print(f"Saved: {build_ico_path}")
    
    # Save PNG for build (linux/extra)
    build_png_path = os.path.join(build_dir, "icon.png")
    output.save(build_png_path, "PNG")
    print(f"Saved: {build_png_path}")

if __name__ == "__main__":
    process_logo_rounded()
