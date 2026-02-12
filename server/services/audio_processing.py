import os
import json
import subprocess
import zipfile
import tempfile
import ffmpeg
from datetime import datetime
from ..config import UPLOAD_FOLDER, OUTPUT_FOLDER
from ..utils import format_to_markers

def clip_audio_logic(filename, start_time, end_time, selected_words, progress_data):
    input_path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(input_path):
        raise FileNotFoundError("源文件不存在")

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    folder_name = "clip"
    clip_text = ""
    
    words_data = []
    # Find matching task result for word sequence
    for task in progress_data.values():
        if task.get('result', {}).get('filename') == filename:
            words_data = task['result'].get('words', [])
            break

    if selected_words and words_data:
        clip_text = ''.join([words_data[i]['word'] for i in sorted(selected_words) if i < len(words_data)])
        folder_name = ''.join(c for c in clip_text if c.isalnum() or c in '，。！？、')
        if len(folder_name) > 50: folder_name = folder_name[:50]
        if not folder_name: folder_name = "clip"

    folder_name = f"{folder_name}_{timestamp}"
    folder_path = os.path.join(OUTPUT_FOLDER, folder_name)
    os.makedirs(folder_path, exist_ok=True)

    mp3_path = os.path.join(folder_path, "audio.mp3")
    orig_duration = end_time - start_time

    cmd = [
        'ffmpeg', '-y', '-ss', str(start_time), '-t', str(orig_duration),
        '-i', input_path, '-acodec', 'libmp3lame', '-q:a', '2', mp3_path
    ]
    subprocess.run(cmd, check=True, capture_output=True)

    json_filename = None
    clipped_words_for_response = []
    if selected_words and words_data:
        json_filename = "timestamps.json"
        json_path = os.path.join(folder_path, json_filename)
        clipped_words_for_json = []
        markers = []

        for word_index in sorted(selected_words):
            if word_index < len(words_data):
                word = words_data[word_index]
                rel_start = max(0, word['start'] - start_time)
                rel_end = max(0, word['end'] - start_time)
                
                clipped_words_for_json.append({
                    'word': word['word'],
                    'start': format_to_markers(rel_start),
                    'end': format_to_markers(rel_end)
                })
                clipped_words_for_response.append({
                    'word': word['word'], 'start': round(rel_start, 3), 'end': round(rel_end, 3)
                })
                markers.append(format_to_markers(rel_start))
        
        if clipped_words_for_json:
            markers.append(format_to_markers(rel_end))

        json_data = {
            'clip_info': {
                'original_file': filename, 'text': clip_text, 
                'duration': format_to_markers(orig_duration),
                'padding_start': "0:00.000", 'padding_end': "0:00.000",
                'format': 'MP3 VBR Quality 2'
            },
            'markers': markers, 'words': clipped_words_for_json
        }
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=4)

    zip_filename = f"{folder_name}.zip"
    zip_path = os.path.join(OUTPUT_FOLDER, zip_filename)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(mp3_path, os.path.join(folder_name, "audio.mp3"))
        if json_filename:
            zipf.write(os.path.join(folder_path, json_filename), os.path.join(folder_name, json_filename))

    return {
        'success': True, 'folder_name': folder_name, 'zip_filename': zip_filename,
        'mp3_filename': "audio.mp3", 'json_filename': json_filename,
        'duration': orig_duration,
        'clip_info': {
            'text': clip_text, 'duration': format_to_markers(orig_duration),
            'padding_start': "0:00.000", 'padding_end': "0:00.000", 'format': 'MP3 VBR Quality 2'
        },
        'words': clipped_words_for_response
    }

def save_clip_logic(folder_name, words, clip_info):
    folder_path = os.path.join(OUTPUT_FOLDER, folder_name)
    if not os.path.exists(folder_path):
        raise FileNotFoundError("文件夹不存在")

    json_path = os.path.join(folder_path, 'timestamps.json')
    markers = []
    formatted_words = []
    
    for word in words:
        markers.append(format_to_markers(float(word['start'])))
        formatted_words.append({
            'word': word['word'],
            'start': format_to_markers(float(word['start'])),
            'end': format_to_markers(float(word['end']))
        })
            
    if words:
        markers.append(format_to_markers(float(words[-1]['end'])))
    
    json_data = {'clip_info': clip_info, 'markers': markers, 'words': formatted_words}
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=4)
    
    zip_filename = f"{folder_name}.zip"
    zip_path = os.path.join(OUTPUT_FOLDER, zip_filename)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        mp3_path = os.path.join(folder_path, 'audio.mp3')
        if os.path.exists(mp3_path):
            zipf.write(mp3_path, os.path.join(folder_name, 'audio.mp3'))
        zipf.write(json_path, os.path.join(folder_name, 'timestamps.json'))
    
    return True

def concatenate_audio_logic(filenames):
    input_paths = []
    for filename in filenames:
        path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(path):
            raise FileNotFoundError(f"文件不存在: {filename}")
        input_paths.append(path)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_filename = f"concatenated_{timestamp}.mp3"
    output_path = os.path.join(OUTPUT_FOLDER, output_filename)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        for p in input_paths:
            f.write(f"file '{os.path.abspath(p)}'\n")
        concat_list_path = f.name

    try:
        cmd = ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', concat_list_path, '-c', 'copy', output_path]
        subprocess.run(cmd, check=True, capture_output=True)
        probe = ffmpeg.probe(output_path)
        duration = float(probe['format']['duration'])
        return output_filename, duration
    finally:
        if os.path.exists(concat_list_path):
            os.remove(concat_list_path)
