def format_to_markers(seconds: float) -> str:
    """将秒数转换为 0:00.000 格式的字符串"""
    minutes = int(seconds // 60)
    remaining_seconds = seconds % 60
    return f"{minutes}:{remaining_seconds:06.3f}"
