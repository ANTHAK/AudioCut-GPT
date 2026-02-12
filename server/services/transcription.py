import os
import json
import base64
import tempfile
import ffmpeg
import whisper
from openai import OpenAI
import anthropic
from ..config import (
    TRANSCRIPTION_MODE, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL,
    WHISPER_LANGUAGE, WHISPER_RESPONSE_FORMAT, WHISPER_TEMPERATURE,
    WHISPER_PROMPT, MAX_FILE_SIZE_MB, COMPRESSION_BITRATE, COMPRESSION_SAMPLE_RATE,
    ANTHROPIC_API_KEY
)

# Initialize clients
openai_client = None
if TRANSCRIPTION_MODE == 'openai' and OPENAI_API_KEY:
    openai_client = OpenAI(base_url=OPENAI_BASE_URL, api_key=OPENAI_API_KEY)

claude_client = None
if TRANSCRIPTION_MODE == 'claude' and ANTHROPIC_API_KEY:
    claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

whisper_model = None
if TRANSCRIPTION_MODE == 'whisper':
    print("Loading Whisper model...")
    whisper_model = whisper.load_model("tiny")
    print("Whisper model loaded!")

def transcribe_with_claude(audio_path):
    with open(audio_path, 'rb') as f:
        audio_data = base64.standard_b64encode(f.read()).decode('utf-8')
    
    file_ext = audio_path.rsplit('.', 1)[1].lower()
    media_type_map = {
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
        'm4a': 'audio/mp4', 'flac': 'audio/flac'
    }
    media_type = media_type_map.get(file_ext, 'audio/mpeg')
    
    message = claude_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "document", "source": {"type": "base64", "media_type": media_type, "data": audio_data}},
                    {"type": "text", "text": "请将这段音频转录为文字。要求：\n1. 准确转录所有内容\n2. 保持原始语序\n3. 使用标准标点符号\n4. 返回JSON格式：{\"text\": \"完整文本\", \"segments\": [{\"start\": 0.0, \"end\": 5.0, \"text\": \"片段文字\"}]}\n注意：segments中的时间戳是估计值，请根据语速合理分段。"}
                ]
            }
        ]
    )
    
    response_text = message.content[0].text
    try:
        if '```json' in response_text:
            json_start = response_text.find('```json') + 7
            json_end = response_text.find('```', json_start)
            json_str = response_text[json_start:json_end].strip()
        elif '```' in response_text:
            json_start = response_text.find('```') + 3
            json_end = response_text.find('```', json_start)
            json_str = response_text[json_start:json_end].strip()
        else:
            json_str = response_text.strip()
        
        return json.loads(json_str)
    except:
        return {'text': response_text, 'segments': [{'id': 0, 'start': 0.0, 'end': 10.0, 'text': response_text}]}

def transcribe_with_openai(audio_path):
    file_size = os.path.getsize(audio_path)
    max_size = MAX_FILE_SIZE_MB * 1024 * 1024
    target_path = audio_path
    temp_compressed = None

    if file_size > max_size:
        temp_compressed = tempfile.mktemp(suffix='.mp3')
        ffmpeg.input(audio_path).output(
            temp_compressed, acodec='libmp3lame', ab=COMPRESSION_BITRATE, 
            ar=COMPRESSION_SAMPLE_RATE, ac=1
        ).overwrite_output().run(quiet=True)
        target_path = temp_compressed

    with open(target_path, 'rb') as audio_file:
        api_params = {
            'model': OPENAI_MODEL, 'file': audio_file, 'response_format': WHISPER_RESPONSE_FORMAT,
        }
        if WHISPER_RESPONSE_FORMAT == 'verbose_json':
            api_params['timestamp_granularities'] = ["word", "segment"]
        if WHISPER_LANGUAGE: api_params['language'] = WHISPER_LANGUAGE
        if WHISPER_TEMPERATURE is not None: api_params['temperature'] = WHISPER_TEMPERATURE
        if WHISPER_PROMPT: api_params['prompt'] = WHISPER_PROMPT

        transcript = openai_client.audio.transcriptions.create(**api_params)
    
    if temp_compressed and os.path.exists(temp_compressed):
        os.remove(temp_compressed)

    full_text = transcript.text if hasattr(transcript, 'text') else str(transcript)
    words = []
    if hasattr(transcript, 'words') and transcript.words:
        char_id = 0
        for word_obj in transcript.words:
            w_text = getattr(word_obj, 'word', '').strip()
            w_start = getattr(word_obj, 'start', 0.0)
            w_end = getattr(word_obj, 'end', 0.0)
            if not w_text: continue
            
            char_count = len(w_text)
            char_duration = (w_end - w_start) / char_count
            for i, char in enumerate(w_text):
                c_start = w_start + (i * char_duration)
                words.append({
                    'id': char_id, 'start': round(c_start, 3), 
                    'end': round(c_start + char_duration, 3), 'word': char
                })
                char_id += 1

    segments = []
    if hasattr(transcript, 'segments') and transcript.segments:
        for i, s in enumerate(transcript.segments):
            segments.append({
                'id': i, 'start': getattr(s, 'start', 0.0), 
                'end': getattr(s, 'end', 10.0), 'text': getattr(s, 'text', '').strip()
            })
    else:
        segments = [{'id': 0, 'start': 0.0, 'end': 10.0, 'text': full_text}]

    return {'text': full_text, 'segments': segments, 'words': words}

def run_transcription(filepath):
    if TRANSCRIPTION_MODE == 'openai':
        return transcribe_with_openai(filepath)
    elif TRANSCRIPTION_MODE == 'claude':
        return transcribe_with_claude(filepath)
    else:
        result = whisper_model.transcribe(filepath, language='zh', word_timestamps=True)
        segments = [{'id': s['id'], 'start': s['start'], 'end': s['end'], 'text': s['text'].strip()} for s in result['segments']]
        return {'text': result['text'], 'segments': segments, 'words': []}
