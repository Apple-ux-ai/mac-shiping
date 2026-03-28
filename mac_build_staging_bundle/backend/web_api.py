import contextlib
import io
import json
import os
import shutil
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from pathlib import Path
from typing import Any, Dict, List

from fastapi import Body, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse


CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from converters.avi_to_gif import AVIToGIFConverter
from converters.avi_to_h264 import AVIToH264Converter
from converters.avi_to_jpg import AVIToJPGConverter
from converters.avi_to_mkv import AVIToMKVConverter
from converters.avi_to_mov import AVIToMOVConverter
from converters.avi_to_mp3 import AVIToMP3Converter
from converters.avi_to_mp4 import AVIToMP4Converter
from converters.avi_to_mpe import AVIToMPEConverter
from converters.avi_to_mpf import AVIToMPFConverter
from converters.avi_to_png import AVIToPNGConverter
from converters.avi_to_wav import AVIToWAVConverter
from converters.avi_to_webm import AVIToWEBMConverter
from converters.gif_to_avi import GIFToAVIConverter
from converters.gif_to_base64 import GIFToBase64Converter
from converters.gif_to_html import GIFToHTMLConverter
from converters.gif_to_jpg import GIFToJPGConverter
from converters.gif_to_mov import GIFToMOVConverter
from converters.gif_to_mp4 import GIFToMP4Converter
from converters.gif_to_pdf import GIFToPDFConverter
from converters.gif_to_png import GIFToPNGConverter
from converters.gif_to_webm import GIFToWEBMConverter
from converters.gif_to_webp import GIFToWEBPConverter
from converters.mov_to_avi import MOVToAVIConverter
from converters.mov_to_gif import MOVToGIFConverter
from converters.mov_to_jpg import MOVToJPGConverter
from converters.mov_to_mp3 import MOVToMP3Converter
from converters.mov_to_mp4 import MOVToMP4Converter
from converters.mov_to_pdf import MOVToPDFConverter
from converters.mov_to_png import MOVToPNGConverter
from converters.mov_to_wav import MOVToWAVConverter
from converters.mov_to_webm import MOVToWEBMConverter
from converters.mp4_to_avi import MP4ToAVIConverter
from converters.mp4_to_gif import MP4ToGIFConverter
from converters.mp4_to_jpg import MP4ToJPGConverter
from converters.mp4_to_mov import MP4ToMOVConverter
from converters.mp4_to_mp3 import MP4ToMP3Converter
from converters.mp4_to_png import MP4ToPNGConverter
from converters.mp4_to_webm import MP4ToWEBMConverter
from converters.webm_to_avi import WEBMToAVIConverter
from converters.webm_to_gif import WEBMToGIFConverter
from converters.webm_to_jpg import WEBMToJPGConverter
from converters.webm_to_mov import WEBMToMOVConverter
from converters.webm_to_mp3 import WEBMToMP3Converter
from converters.webm_to_mp4 import WEBMToMP4Converter
from converters.webm_to_png import WEBMToPNGConverter
from converters.webm_to_wav import WEBMToWAVConverter
from services.preview_service import PreviewService
from utils.ffmpeg_utils import (
    clear_current_task,
    get_video_info,
    is_ffmpeg_available,
    is_ffprobe_available,
    set_cancel_checker,
    set_current_task,
)


DATA_ROOT = CURRENT_DIR / "web_data"
UPLOAD_ROOT = DATA_ROOT / "uploads"
OUTPUT_ROOT = DATA_ROOT / "outputs"
BATCH_ROOT = DATA_ROOT / "batches"
PREVIEW_ROOT = DATA_ROOT / "previews"
EXTERNAL_API_BASE = "https://api-web.kunqiongai.com"
for directory in (UPLOAD_ROOT, OUTPUT_ROOT, BATCH_ROOT, PREVIEW_ROOT):
    directory.mkdir(parents=True, exist_ok=True)


CONVERTER_REGISTRY = {
    "convert-avi-to-gif": AVIToGIFConverter,
    "convert-avi-to-h264": AVIToH264Converter,
    "convert-avi-to-jpg": AVIToJPGConverter,
    "convert-avi-to-mkv": AVIToMKVConverter,
    "convert-avi-to-mov": AVIToMOVConverter,
    "convert-avi-to-mp3": AVIToMP3Converter,
    "convert-avi-to-mp4": AVIToMP4Converter,
    "convert-avi-to-mpe": AVIToMPEConverter,
    "convert-avi-to-mpf": AVIToMPFConverter,
    "convert-avi-to-png": AVIToPNGConverter,
    "convert-avi-to-wav": AVIToWAVConverter,
    "convert-avi-to-webm": AVIToWEBMConverter,
    "convert-gif-to-avi": GIFToAVIConverter,
    "convert-gif-to-base64": GIFToBase64Converter,
    "convert-gif-to-html": GIFToHTMLConverter,
    "convert-gif-to-jpg": GIFToJPGConverter,
    "convert-gif-to-mov": GIFToMOVConverter,
    "convert-gif-to-mp4": GIFToMP4Converter,
    "convert-gif-to-pdf": GIFToPDFConverter,
    "convert-gif-to-png": GIFToPNGConverter,
    "convert-gif-to-webm": GIFToWEBMConverter,
    "convert-gif-to-webp": GIFToWEBPConverter,
    "convert-mov-to-avi": MOVToAVIConverter,
    "convert-mov-to-gif": MOVToGIFConverter,
    "convert-mov-to-jpg": MOVToJPGConverter,
    "convert-mov-to-mp3": MOVToMP3Converter,
    "convert-mov-to-mp4": MOVToMP4Converter,
    "convert-mov-to-pdf": MOVToPDFConverter,
    "convert-mov-to-png": MOVToPNGConverter,
    "convert-mov-to-wav": MOVToWAVConverter,
    "convert-mov-to-webm": MOVToWEBMConverter,
    "convert-mp4-to-avi": MP4ToAVIConverter,
    "convert-mp4-to-gif": MP4ToGIFConverter,
    "convert-mp4-to-jpg": MP4ToJPGConverter,
    "convert-mp4-to-mov": MP4ToMOVConverter,
    "convert-mp4-to-mp3": MP4ToMP3Converter,
    "convert-mp4-to-png": MP4ToPNGConverter,
    "convert-mp4-to-webm": MP4ToWEBMConverter,
    "convert-webm-to-avi": WEBMToAVIConverter,
    "convert-webm-to-gif": WEBMToGIFConverter,
    "convert-webm-to-jpg": WEBMToJPGConverter,
    "convert-webm-to-mov": WEBMToMOVConverter,
    "convert-webm-to-mp3": WEBMToMP3Converter,
    "convert-webm-to-mp4": WEBMToMP4Converter,
    "convert-webm-to-png": WEBMToPNGConverter,
    "convert-webm-to-wav": WEBMToWAVConverter,
}


def _empty_task(task_id: str) -> Dict[str, Any]:
    return {
        "task_id": task_id,
        "status": "queued",
        "progress": 0,
        "error": None,
        "result": None,
        "cancel_requested": False,
        "output_path": None,
    }


TASKS: Dict[str, Dict[str, Any]] = {}
TASK_LOCK = threading.Lock()


def is_cancel_requested(task_id: str) -> bool:
    with TASK_LOCK:
        task = TASKS.get(task_id)
        return bool(task and task.get("cancel_requested"))


set_cancel_checker(is_cancel_requested)


def update_task(task_id: str, **updates: Any) -> Dict[str, Any]:
    with TASK_LOCK:
        task = TASKS.get(task_id)
        if task is None:
            task = _empty_task(task_id)
            TASKS[task_id] = task
        task.update(updates)
        return dict(task)


def _resolve_task_by_download_path(download_path: str) -> Dict[str, Any]:
    prefix = "/api/downloads/"
    if not isinstance(download_path, str) or not download_path.startswith(prefix):
        raise HTTPException(status_code=400, detail=f"Unsupported download path: {download_path}")

    task_id = download_path[len(prefix):].strip()
    with TASK_LOCK:
        task = TASKS.get(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail=f"Task not found for download path: {download_path}")
        return dict(task)


def _unique_archive_name(name: str, seen: Dict[str, int]) -> str:
    safe_name = Path(name or "result").name or "result"
    if safe_name not in seen:
        seen[safe_name] = 1
        return safe_name

    stem = Path(safe_name).stem or "result"
    suffix = Path(safe_name).suffix
    index = seen[safe_name]
    seen[safe_name] += 1
    return f"{stem}-{index}{suffix}"


def _external_post(endpoint: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    encoded = urllib.parse.urlencode(data or {}).encode("utf-8")
    request = urllib.request.Request(
        url=f"{EXTERNAL_API_BASE}{endpoint}",
        data=encoded,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"} if data else {},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = response.read().decode("utf-8", errors="replace")
            return json.loads(payload)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=exc.code, detail=detail or f"External API request failed: {endpoint}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"External API request failed: {exc}")


def build_video_info(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        return {"success": False, "message": "文件不存在"}

    if not is_ffprobe_available():
        return {
            "success": False,
            "message": "ffprobe 未安装或未加入 PATH，无法读取媒体信息",
        }

    file_size = os.path.getsize(file_path)
    data = get_video_info(file_path)
    if data.get("error"):
        return {
            "success": False,
            "message": data.get("error"),
        }
    format_info = data.get("format", {})
    streams = data.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), {})
    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
    audio_stream = audio_streams[0] if audio_streams else {}

    duration_raw = format_info.get("duration", "0")
    try:
        duration = float(duration_raw)
    except (TypeError, ValueError):
        duration = 0.0

    fps_value = video_stream.get("avg_frame_rate", "0/0")
    fps = 0.0
    try:
        if isinstance(fps_value, str) and "/" in fps_value:
            numerator, denominator = fps_value.split("/", 1)
            denominator_value = int(denominator)
            fps = int(numerator) / denominator_value if denominator_value else 0.0
        elif fps_value:
            fps = float(fps_value)
    except (TypeError, ValueError, ZeroDivisionError):
        fps = 0.0

    return {
        "success": True,
        "info": {
            "size": file_size,
            "width": int(video_stream.get("width", 0) or 0),
            "height": int(video_stream.get("height", 0) or 0),
            "fps": fps,
            "duration": duration,
            "codec": video_stream.get("codec_name", "unknown"),
            "audio_codec": audio_stream.get("codec_name", "none"),
            "audio_tracks_count": len(audio_streams),
            "path": file_path,
            "name": os.path.basename(file_path),
        },
    }


class TaskProgressWriter(io.TextIOBase):
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.buffer = ""

    def write(self, text: str) -> int:
        self.buffer += text
        while "\n" in self.buffer:
            line, self.buffer = self.buffer.split("\n", 1)
            self._handle_line(line.strip())
        return len(text)

    def flush(self) -> None:
        if self.buffer.strip():
            self._handle_line(self.buffer.strip())
        self.buffer = ""

    def _handle_line(self, line: str) -> None:
        if not line:
            return
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            return

        payload_type = payload.get("type")
        if payload_type == "progress":
            progress = payload.get("percent")
            if isinstance(progress, (int, float)):
                update_task(self.task_id, progress=max(0, min(100, int(progress))))
        elif payload_type == "output":
            output_path = payload.get("output")
            if output_path:
                update_task(self.task_id, output_path=output_path)


def _save_upload(task_id: str, upload: UploadFile) -> Path:
    task_upload_dir = UPLOAD_ROOT / task_id
    task_upload_dir.mkdir(parents=True, exist_ok=True)

    filename = upload.filename or f"upload-{task_id}"
    safe_name = Path(filename).name
    destination = task_upload_dir / safe_name

    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)

    return destination


def _run_conversion(task_id: str, action: str, source_path: Path, params: Dict[str, Any]) -> None:
    output_dir = OUTPUT_ROOT / task_id
    output_dir.mkdir(parents=True, exist_ok=True)

    converter_cls = CONVERTER_REGISTRY[action]
    converter = converter_cls()
    writer = TaskProgressWriter(task_id)

    update_task(task_id, status="running", progress=0)
    set_current_task(task_id)
    try:
        with contextlib.redirect_stdout(writer):
            result = converter.convert(str(source_path), str(output_dir), **params)
        writer.flush()

        if is_cancel_requested(task_id):
            update_task(task_id, status="cancelled", progress=0, error="Cancelled")
            return

        if not result.get("success"):
            update_task(
                task_id,
                status="failed",
                error=result.get("error") or result.get("message") or "Conversion failed",
            )
            return

        output_path = (
            result.get("outputPath")
            or result.get("output")
            or result.get("previewPath")
            or TASKS.get(task_id, {}).get("output_path")
        )
        if not output_path:
            update_task(task_id, status="failed", error="Missing output file")
            return

        if not os.path.exists(output_path):
            update_task(task_id, status="failed", error="Output file was not created")
            return

        download_url = f"/api/downloads/{task_id}"
        update_task(
            task_id,
            status="completed",
            progress=100,
            output_path=output_path,
            result={
                "success": True,
                "output": download_url,
                "outputPath": download_url,
                "outputDir": download_url,
                "downloadUrl": download_url,
                "fileName": os.path.basename(output_path),
            },
        )
    except Exception as exc:
        if is_cancel_requested(task_id):
            update_task(task_id, status="cancelled", progress=0, error="Cancelled")
        else:
            update_task(task_id, status="failed", error=str(exc))
    finally:
        clear_current_task()


app = FastAPI(title="Convert Tool Web API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {
        "success": True,
        "message": "ok",
        "ffmpeg": is_ffmpeg_available(),
        "ffprobe": is_ffprobe_available(),
    }


@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "success": True,
        "message": "Convert Tool Web API is running",
        "health": "/api/health",
    }


@app.post("/api/video-info")
async def video_info(source: UploadFile = File(...)) -> Dict[str, Any]:
    task_id = uuid.uuid4().hex
    source_path = _save_upload(task_id, source)
    return build_video_info(str(source_path))


@app.post("/api/external/get-web-login-url")
def get_web_login_url() -> Dict[str, Any]:
    return _external_post("/soft_desktop/get_web_login_url")


@app.post("/api/external/get-custom-url")
def get_custom_url() -> Dict[str, Any]:
    return _external_post("/soft_desktop/get_custom_url")


@app.post("/api/external/get-feedback-url")
def get_feedback_url() -> Dict[str, Any]:
    return _external_post("/soft_desktop/get_feedback_url")


@app.post("/api/external/get-ads")
def get_ads(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    soft_number = str(payload.get("soft_number") or "10030")
    adv_position = str(payload.get("adv_position") or "")
    if not adv_position:
        raise HTTPException(status_code=400, detail="adv_position is required")
    return _external_post(
        "/soft_desktop/get_adv",
        {"soft_number": soft_number, "adv_position": adv_position},
    )


@app.post("/api/convert")
async def start_convert(
    action: str = Form(...),
    params: str = Form("{}"),
    source: UploadFile = File(...),
) -> Dict[str, Any]:
    if not is_ffmpeg_available():
        raise HTTPException(status_code=503, detail="ffmpeg is not installed or not available in PATH")

    if action not in CONVERTER_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unsupported action: {action}")

    try:
        parsed_params = json.loads(params) if params else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid params JSON: {exc}") from exc

    task_id = uuid.uuid4().hex
    source_path = _save_upload(task_id, source)
    update_task(task_id)

    worker = threading.Thread(
        target=_run_conversion,
        args=(task_id, action, source_path, parsed_params),
        daemon=True,
    )
    worker.start()

    return {"success": True, "taskId": task_id}


@app.post("/api/preview")
async def create_preview(source: UploadFile = File(...)) -> Dict[str, Any]:
    if not is_ffmpeg_available():
        raise HTTPException(status_code=503, detail="ffmpeg is not installed or not available in PATH")

    task_id = uuid.uuid4().hex
    source_path = _save_upload(task_id, source)
    preview_dir = PREVIEW_ROOT / task_id
    preview_dir.mkdir(parents=True, exist_ok=True)

    result = PreviewService.generate_preview(str(source_path), str(preview_dir))
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error") or "Preview generation failed")

    preview_path = result.get("previewPath")
    if not preview_path or not os.path.exists(preview_path):
        raise HTTPException(status_code=500, detail="Preview file was not created")

    preview_id = uuid.uuid4().hex
    update_task(f"preview:{preview_id}", output_path=preview_path, status="completed")
    return {
        "success": True,
        "previewUrl": f"/api/previews/{preview_id}",
    }


@app.get("/api/tasks/{task_id}")
def get_task(task_id: str) -> Dict[str, Any]:
    with TASK_LOCK:
        task = TASKS.get(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return dict(task)


@app.post("/api/tasks/{task_id}/cancel")
def cancel_task(task_id: str) -> Dict[str, Any]:
    with TASK_LOCK:
        task = TASKS.get(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        task["cancel_requested"] = True
        if task.get("status") == "queued":
            task["status"] = "cancelled"
            task["error"] = "Cancelled"
    return {"success": True}


@app.get("/api/downloads/{task_id}")
def download_output(task_id: str) -> FileResponse:
    with TASK_LOCK:
        task = TASKS.get(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        output_path = task.get("output_path")

    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Output file not found")

    return FileResponse(path=output_path, filename=os.path.basename(output_path))


@app.get("/api/previews/{preview_id}")
def get_preview_file(preview_id: str) -> FileResponse:
    with TASK_LOCK:
        task = TASKS.get(f"preview:{preview_id}")
        if task is None:
            raise HTTPException(status_code=404, detail="Preview not found")
        preview_path = task.get("output_path")

    if not preview_path or not os.path.exists(preview_path):
        raise HTTPException(status_code=404, detail="Preview file not found")

    return FileResponse(path=preview_path, media_type="video/mp4", filename=os.path.basename(preview_path))


def _create_batch_download_response(download_paths: List[str], archive_name: str) -> FileResponse:
    if not isinstance(download_paths, list) or not download_paths:
        raise HTTPException(status_code=400, detail="downloadPaths is required")

    zip_task_id = uuid.uuid4().hex
    zip_path = BATCH_ROOT / f"{zip_task_id}.zip"
    seen_names: Dict[str, int] = {}
    added = 0

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for download_path in download_paths:
            task = _resolve_task_by_download_path(str(download_path))
            output_path = task.get("output_path")
            if not output_path or not os.path.exists(output_path):
                continue

            file_name = task.get("result", {}).get("fileName") or os.path.basename(output_path)
            archive_name_in_zip = _unique_archive_name(file_name, seen_names)
            archive.write(output_path, arcname=archive_name_in_zip)
            added += 1

    if added == 0:
        with contextlib.suppress(FileNotFoundError):
            zip_path.unlink()
        raise HTTPException(status_code=404, detail="No downloadable files found")

    safe_archive_name = Path(str(archive_name)).name or "batch-results.zip"
    if not safe_archive_name.lower().endswith(".zip"):
        safe_archive_name = f"{safe_archive_name}.zip"

    return FileResponse(path=str(zip_path), filename=safe_archive_name)


@app.post("/api/batch-downloads")
def create_batch_download(payload: Dict[str, Any] = Body(...)) -> FileResponse:
    download_paths = payload.get("downloadPaths") or []
    archive_name = payload.get("archiveName") or "batch-results.zip"
    return _create_batch_download_response(download_paths, archive_name)


@app.get("/api/batch-downloads")
def create_batch_download_get(
    downloadPath: List[str] = Query(default=[]),
    archiveName: str = Query(default="batch-results.zip"),
) -> FileResponse:
    return _create_batch_download_response(downloadPath, archiveName)
