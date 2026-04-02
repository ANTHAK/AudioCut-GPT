from pydantic import BaseModel
from typing import List, Optional, Any

class ClipRequest(BaseModel):
    filename: str
    start_time: float
    end_time: float
    selected_words: List[int] = []

class SaveClipRequest(BaseModel):
    folder_name: str
    words: List[dict]
    clip_info: dict

class ConcatenateSegment(BaseModel):
    """单个拼接片段，支持指定起止时间"""
    filename: str          # uploads 目录下的文件名
    start_time: float = 0.0
    end_time: float = -1.0  # -1 表示到文件末尾
    label: Optional[str] = None  # 自定义标签（前端显示用）
    volume: float = 1.0     # 音量倍数，1.0 是原音量

class ConcatenateRequest(BaseModel):
    filenames: List[str]  # 保留旧接口兼容
    segments: Optional[List[ConcatenateSegment]] = None  # 新版带时间范围
    output_label: Optional[str] = None  # 输出文件名前缀

class TaskResponse(BaseModel):
    status: str
    progress: int
    message: str
    result: Optional[dict] = None
    error: Optional[str] = None

class FileInfo(BaseModel):
    filename: str
    size: int
    modified: str
