import sys
import os
import time
import zipfile
import shutil
import subprocess
import argparse
import traceback
import ctypes
import threading
import hashlib
import requests
import tkinter as tk
from tkinter import ttk, messagebox

# --- Logging ---
def log(msg):
    try:
        base_dir = os.path.join(
            os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
            "convert-tool-updater",
        )
        os.makedirs(base_dir, exist_ok=True)
        log_file = os.path.join(base_dir, "updater_log.txt")
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {msg}\n")
    except Exception:
        pass

# --- Utils ---
def is_process_running(pid):
    if pid <= 0:
        return False
    try:
        kernel32 = ctypes.windll.kernel32
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        process = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if process:
            exit_code = ctypes.c_ulong()
            kernel32.GetExitCodeProcess(process, ctypes.byref(exit_code))
            kernel32.CloseHandle(process)
            return exit_code.value == 259  # STILL_ACTIVE
        return False
    except:
        return False

def kill_process(pid):
    log(f"Attempting to kill process {pid}")
    try:
        kernel32 = ctypes.windll.kernel32
        PROCESS_TERMINATE = 0x0001
        handle = kernel32.OpenProcess(PROCESS_TERMINATE, False, pid)
        if handle:
            kernel32.TerminateProcess(handle, 1)
            kernel32.CloseHandle(handle)
            log(f"Process {pid} terminated via ctypes")
            return True
        return False
    except Exception as e:
        log(f"Failed to kill process via ctypes: {e}")
        return False

def kill_process_by_name(exe_name):
    try:
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        subprocess.run([
            "taskkill", "/f", "/im", exe_name
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, startupinfo=startupinfo)
        log(f"Process with name {exe_name} terminated via taskkill")
    except Exception as e:
        log(f"Failed to kill processes by name {exe_name}: {e}")

# --- GUI ---
class UpdateWindow:
    def __init__(self, root):
        self.root = root
        self.root.title("软件更新")
        self.root.geometry("400x150")
        self.root.resizable(False, False)
        
        # Center window
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        x = (screen_width - 400) // 2
        y = (screen_height - 150) // 2
        self.root.geometry(f"400x150+{x}+{y}")
        
        # Style
        self.root.configure(bg="#ffffff")
        style = ttk.Style()
        style.theme_use('default')
        style.configure("TProgressbar", thickness=10, background='#409eff')
        
        # Main Layout
        self.main_frame = tk.Frame(root, bg="#ffffff", padx=20, pady=20)
        self.main_frame.pack(fill=tk.BOTH, expand=True)
        
        self.title_label = tk.Label(self.main_frame, text="正在升级系统", font=("Microsoft YaHei", 12, "bold"), bg="#ffffff", fg="#333333")
        self.title_label.pack(anchor="w", pady=(0, 10))
        
        self.status_label = tk.Label(self.main_frame, text="准备就绪...", font=("Microsoft YaHei", 9), bg="#ffffff", fg="#666666")
        self.status_label.pack(anchor="w", pady=(0, 5))
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(self.main_frame, variable=self.progress_var, maximum=100, style="TProgressbar")
        self.progress_bar.pack(fill=tk.X, pady=(0, 5))
        
        self.percent_label = tk.Label(self.main_frame, text="0%", font=("Arial", 9), bg="#ffffff", fg="#409eff")
        self.percent_label.pack(anchor="e")

    def update_status(self, text):
        self.status_label.config(text=text)
        
    def update_progress(self, value):
        self.progress_var.set(value)
        self.percent_label.config(text=f"{int(value)}%")

    def show_error(self, msg):
        messagebox.showerror("更新错误", msg)
        self.root.destroy()

# --- Worker ---
def update_worker(args, window):
    try:
        # 1. Wait for main app to exit
        if args.pid:
            window.root.after(0, window.update_status, "正在关闭主程序...")
            window.root.after(0, window.update_progress, 5)
            start_time = time.time()
            timeout = 10
            while is_process_running(args.pid):
                if time.time() - start_time > timeout:
                    log(f"Process {args.pid} did not exit. Killing it.")
                    kill_process(args.pid)
                    time.sleep(1)
                    break
                time.sleep(0.5)
        
        window.root.after(0, window.update_progress, 10)
        
        # 2. Handle download if URL is provided
        zip_path = args.zip
        if args.url:
            window.root.after(0, window.update_status, "正在下载更新包...")
            try:
                temp_dir = os.path.dirname(args.zip) if args.zip else os.environ.get('TEMP', '.')
                if not zip_path:
                    zip_path = os.path.join(temp_dir, "update_package.zip")
                
                response = requests.get(args.url, stream=True, timeout=30)
                response.raise_for_status()
                total_size = int(response.headers.get('content-length', 0))
                
                downloaded = 0
                sha256 = hashlib.sha256()
                with open(zip_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            sha256.update(chunk)
                            downloaded += len(chunk)
                            if total_size > 0:
                                progress = 10 + int(downloaded / total_size * 40) # 10% to 50%
                                window.root.after(0, window.update_progress, progress)
                
                # Verify hash if provided
                if args.hash:
                    actual_hash = sha256.hexdigest()
                    if actual_hash.lower() != args.hash.lower():
                        log(f"Hash mismatch. Expected: {args.hash}, Actual: {actual_hash}")
                        window.root.after(0, window.show_error, "校验失败：下载文件损坏")
                        return
                
                log("Download successful")
            except Exception as e:
                log(f"Download failed: {e}")
                window.root.after(0, window.show_error, f"下载失败: {str(e)}")
                return
        
        kill_process_by_name(args.exe)
        kill_process_by_name("api.exe")

        window.root.after(0, window.update_status, "正在安装更新...")
        window.root.after(0, window.update_progress, 50)
        
        max_retries = 5
        success = False
        for i in range(max_retries):
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    files = zip_ref.namelist()
                    total_files = len(files)
                    for idx, file in enumerate(files):
                        if "updater.exe" in file.lower():
                            continue
                        zip_ref.extract(file, args.dir)
                        progress = 50 + int((idx + 1) / total_files * 40) # 50% to 90%
                        window.root.after(0, window.update_progress, progress)
                
                success = True
                log("Extraction successful")
                break
            except PermissionError as e:
                log(f"Permission error (attempt {i+1}/{max_retries}): {e}")
                window.root.after(0, window.update_status, f"正在重试 ({i+1}/{max_retries})...")
                time.sleep(2)
            except Exception as e:
                log(f"Error during installation (attempt {i+1}/{max_retries}): {e}")
                time.sleep(1)
        
        if not success:
            window.root.after(0, window.show_error, "安装失败：文件被占用，请手动关闭程序后重试")
            return

        window.root.after(0, window.update_progress, 95)
        window.root.after(0, window.update_status, "清理并重启...")
        
        # 4. Cleanup
        try:
            if zip_path and os.path.exists(zip_path):
                os.remove(zip_path)
                log("Cleaned up zip file")
        except Exception as e:
            log(f"Failed to remove zip: {e}")

        # 5. Restart
        exe_path = os.path.join(args.dir, args.exe)
        if os.path.exists(exe_path):
            try:
                subprocess.Popen([exe_path], cwd=args.dir, 
                               creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS)
                log("Application restarted")
                window.root.after(0, window.update_progress, 100)
                window.root.after(1000, window.root.destroy)
            except Exception as e:
                log(f"Failed to restart application: {e}")
                window.root.after(0, window.show_error, "启动失败，请手动打开程序")
        else:
            log(f"Executable not found: {exe_path}")
            window.root.after(0, window.show_error, "未找到主程序")
            
    except Exception as e:
        log(f"Critical error in worker: {traceback.format_exc()}")
        window.root.after(0, window.show_error, f"更新出错: {str(e)}")

def show_error(title, message):
    try:
        ctypes.windll.user32.MessageBoxW(0, message, title, 0x10 | 0x40000)
    except:
        pass

def main():
    try:
        log(f"Updater process started. Raw args: {sys.argv}")
        
        # Arg parsing
        parser = argparse.ArgumentParser(description='Independent Updater')
        parser.add_argument('--zip', help='Path to local update zip file')
        parser.add_argument('--url', help='URL to download update package')
        parser.add_argument('--hash', help='Expected SHA256 hash of the package')
        parser.add_argument('--dir', required=True, help='Installation directory')
        parser.add_argument('--exe', required=True, help='Main executable name to restart')
        parser.add_argument('--pid', type=int, help='PID of the main process to wait for')
        
        try:
            args = parser.parse_args()
        except SystemExit:
            log("Argument parsing failed.")
            show_error("启动错误", f"更新程序参数错误。\n\n原始参数: {sys.argv}")
            return
        
        log(f"Updater started with args: {args}")

        root = tk.Tk()
        window = UpdateWindow(root)
        
        # Bring to front
        root.lift()
        root.attributes('-topmost',True)
        root.after_idle(root.attributes,'-topmost',False)
        root.focus_force()

        worker_thread = threading.Thread(target=update_worker, args=(args, window))
        worker_thread.daemon = True
        worker_thread.start()
        
        root.mainloop()
        
    except Exception as e:
        log(f"Startup error: {traceback.format_exc()}")
        show_error("更新程序启动失败", str(e))

if __name__ == '__main__':
    main()
