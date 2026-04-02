import os
import time
import uuid
import shutil
from datetime import datetime
from urllib.parse import unquote
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import UPLOAD_FOLDER, OUTPUT_FOLDER, is_allowed_file
from .schemas import ClipRequest, SaveClipRequest, ConcatenateRequest, TaskResponse, FileInfo
from .services.transcription import run_transcription
from .services.audio_processing import clip_audio_logic, save_clip_logic, concatenate_audio_logic

app = FastAPI(title="Voice Editor API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Progress tracking
progress_data = {}

def process_audio_task(task_id: str, filepath: str, filename: str):
    try:
        progress_data[task_id]['status'] = 'processing'
        progress_data[task_id]['progress'] = 10
        progress_data[task_id]['message'] = '正在加载音频文件...'
        
        # Start a simple progress simulation in real scenarios we'd use a separate worker
        # But for this simple app, we can just update at stages
        progress_data[task_id]['progress'] = 20
        progress_data[task_id]['message'] = '正在进行语音识别...'
        
        result = run_transcription(filepath)
        
        progress_data[task_id]['status'] = 'completed'
        progress_data[task_id]['progress'] = 100
        progress_data[task_id]['message'] = '识别完成！'
        progress_data[task_id]['result'] = {
            'success': True,
            'filename': filename,
            'text': result['text'],
            'segments': result['segments'],
            'words': result['words']
        }
    except Exception as e:
        progress_data[task_id]['status'] = 'error'
        progress_data[task_id]['message'] = f'识别失败: {str(e)}'
        progress_data[task_id]['error'] = str(e)

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not is_allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{timestamp}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    task_id = f"task_{timestamp}_{uuid.uuid4().hex[:6]}"
    progress_data[task_id] = {
        'status': 'uploading',
        'progress': 0,
        'message': '文件上传完成，准备识别...',
        'filename': filename
    }
    
    background_tasks.add_task(process_audio_task, task_id, filepath, filename)
    
    return {"success": True, "task_id": task_id, "message": "文件上传成功，开始处理..."}

@app.post("/upload_raw")
async def upload_raw(file: UploadFile = File(...)):
    """上传音频文件用于拼接，不触发语音识别，立即返回文件名和时长。"""
    if not is_allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    
    try:
        import ffmpeg as _ffmpeg
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 获取时长
        try:
            probe = _ffmpeg.probe(filepath)
            duration = float(probe['format']['duration'])
        except Exception:
            duration = 0.0
        
        return {
            "success": True,
            "filename": filename,
            "original_name": file.filename,
            "duration": round(duration, 3),
            "message": "上传成功"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@app.get("/progress/{task_id}", response_model=TaskResponse)
async def get_progress(task_id: str):
    if task_id not in progress_data:
        raise HTTPException(status_code=404, detail="任务不存在")
    return progress_data[task_id]

@app.post("/clip")
async def clip_audio(request: ClipRequest):
    try:
        result = clip_audio_logic(
            request.filename, request.start_time, request.end_time, 
            request.selected_words, progress_data
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"音频处理失败: {str(e)}")

@app.post("/save_clip")
async def save_clip(request: SaveClipRequest):
    try:
        save_clip_logic(request.folder_name, request.words, request.clip_info)
        return {"success": True, "message": "时间戳已更新并重新打包"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")

@app.post("/concatenate")
async def concatenate_audio(request: ConcatenateRequest):
    try:
        segments_dicts = None
        if request.segments:
            segments_dicts = [s.model_dump() for s in request.segments]

        result = concatenate_audio_logic(
            filenames=request.filenames,
            segments=segments_dicts,
            output_label=request.output_label
        )
        return {
            "success": True,
            "filename": result['filename'],
            "folder_name": result['folder_name'],
            "zip_filename": result['zip_filename'],
            "duration": result['duration'],
            "segments": result.get('segments', []),
            "message": f"成功拼接 {len(request.segments or request.filenames)} 个音频片段"
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"拼接失败: {str(e)}")

@app.get("/list_uploads")
async def list_uploads():
    try:
        files = []
        for filename in os.listdir(UPLOAD_FOLDER):
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.isfile(filepath) and is_allowed_file(filename):
                stat = os.stat(filepath)
                files.append({
                    'filename': filename,
                    'size': stat.st_size,
                    'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                })
        files.sort(key=lambda x: x['modified'], reverse=True)
        return {"success": True, "files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")

# Static files for downloads
app.mount("/outputs", StaticFiles(directory=OUTPUT_FOLDER), name="outputs")
# Uploads preview (for concat editor segment preview)
app.mount("/uploads", StaticFiles(directory=UPLOAD_FOLDER), name="uploads")

@app.get("/stream_output/{folder}/{filename}")
async def stream_output(folder: str, filename: str):
    """用于流式输出预览音频，比 StaticFiles 更可靠"""
    filepath = os.path.join(OUTPUT_FOLDER, folder, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(filepath)

@app.get("/download/{filename:path}")
async def download_file(filename: str):
    decoded_filename = unquote(filename)
    filepath = os.path.join(OUTPUT_FOLDER, decoded_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"文件不存在: {decoded_filename}")
    return FileResponse(filepath, filename=os.path.basename(decoded_filename))

@app.post("/cleanup")
async def cleanup():
    try:
        for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER]:
            for filename in os.listdir(folder):
                filepath = os.path.join(folder, filename)
                if os.path.isfile(filepath):
                    os.remove(filepath)
                elif os.path.isdir(filepath):
                    shutil.rmtree(filepath)
        return {"success": True, "message": "清理完成"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清理失败: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
