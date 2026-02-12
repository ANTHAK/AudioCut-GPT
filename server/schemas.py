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

class ConcatenateRequest(BaseModel):
    filenames: List[str]

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
