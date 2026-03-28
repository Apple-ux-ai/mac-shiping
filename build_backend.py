import os
import subprocess
import shutil
import sys

def _run_cmd(cmd, use_shell=None):
    if use_shell is None:
        use_shell = sys.platform == 'win32'
    return subprocess.run(cmd, shell=use_shell)

def build_backend():
    print("Building Python backend...")
    
    # Ensure backend directory exists
    backend_dir = os.path.join(os.getcwd(), 'backend')
    if not os.path.exists(backend_dir):
        print("Backend directory not found!")
        sys.exit(1)
        
    # PyInstaller command
    # --onedir: Create a directory with the executable (faster startup than --onefile)
    # --console: Show console (useful for debugging, can be changed to --noconsole later if we want to hide it completely)
    # --name: Name of the executable
    # --clean: Clean cache
    # --distpath: Where to put the output
    # --workpath: Where to put build files
    # --paths: Add backend to python path to find modules
    
    cmd = [
        'pyinstaller',
        '--noconfirm',
        '--onedir',
        '--console',  # Keep console for now to see logs/errors. Electron hides it anyway with child_process
        '--clean',
        '--distpath', os.path.join('backend', 'dist'),
        '--workpath', os.path.join('backend', 'build_temp'),
        '--name', 'api',
        '--paths', 'backend',
        # Add hidden imports if necessary (e.g. if some modules are imported dynamically)
        # '--hidden-import', 'PIL', 
        os.path.join('backend', 'main.py')
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    
    result = _run_cmd(cmd)
    
    if result.returncode != 0:
        print("Backend build failed!")
        sys.exit(1)
        
    print("Backend build successful!")
    api_exe = 'api.exe' if sys.platform == 'win32' else 'api'
    print(f"Executable created at: {os.path.join('backend', 'dist', 'api', api_exe)}")

    if sys.platform != 'win32':
        print("\nSkipping Windows updater build on non-Windows platform.")
        return

    # Build Updater (Windows only)
    print("\nBuilding Updater...")
    updater_spec = os.path.join(os.getcwd(), 'updater.spec')
    if not os.path.exists(updater_spec):
        print("updater.spec not found!")
        sys.exit(1)

    cmd_updater = [
        'pyinstaller',
        '--noconfirm',
        '--clean',
        '--distpath', os.path.join('backend', 'dist'),
        '--workpath', os.path.join('backend', 'build_temp'),
        updater_spec
    ]
    
    print(f"Running command: {' '.join(cmd_updater)}")
    result_updater = _run_cmd(cmd_updater)
    
    if result_updater.returncode != 0:
        print("Updater build failed!")
        sys.exit(1)
        
    print("Updater build successful!")
    built_updater = os.path.join('backend', 'dist', 'updater', 'updater.exe')
    print(f"Updater created at: {built_updater}")
    root_dist = os.path.join(os.getcwd(), 'dist')
    os.makedirs(root_dist, exist_ok=True)
    dest_updater = os.path.join(root_dist, 'updater.exe')
    shutil.copy2(built_updater, dest_updater)
    print(f"Copied updater for electron-builder: {dest_updater}")

if __name__ == '__main__':
    build_backend()
