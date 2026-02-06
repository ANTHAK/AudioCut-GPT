import os
import json
from flask import Flask, render_template, request, jsonify, send_file, Response, stream_with_context
from werkzeug.utils import secure_filename
import ffmpeg
import whisper
import tempfile
from datetime import datetime
import subprocess
import threading
import time
from dotenv import load_dotenv
import anthropic
import base64
from openai import OpenAI

# 加载环境变量
load_dotenv()

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB max file size

# 确保必要的文件夹存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

# 进度追踪
progress_data = {}

# 获取转录模式
TRANSCRIPTION_MODE = os.getenv('TRANSCRIPTION_MODE', 'whisper').lower()

# 初始化OpenAI客户端（如果使用OpenAI模式）
if TRANSCRIPTION_MODE == 'openai':
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1')
    OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'whisper-1')
    
    if not OPENAI_API_KEY:
        print("警告: 未设置OPENAI_API_KEY，将回退到Whisper模式")
        TRANSCRIPTION_MODE = 'whisper'
    else:
        openai_client = OpenAI(
            base_url=OPENAI_BASE_URL,
            api_key=OPENAI_API_KEY
        )
        print(f"使用OpenAI兼容API进行语音识别")
        print(f"  - Base URL: {OPENAI_BASE_URL}")
        print(f"  - Model: {OPENAI_MODEL}")

# 初始化Claude客户端（如果使用Claude模式）
elif TRANSCRIPTION_MODE == 'claude':
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
    if not ANTHROPIC_API_KEY:
        print("警告: 未设置ANTHROPIC_API_KEY，将回退到Whisper模式")
        TRANSCRIPTION_MODE = 'whisper'
    else:
        claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        print(f"使用Claude API进行语音识别")

# 加载Whisper模型（如果使用Whisper模式）
if TRANSCRIPTION_MODE == 'whisper':
    print("正在加载Whisper模型...")
    model = whisper.load_model("tiny")
    print("Whisper模型加载完成！")

ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a', 'flac'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def transcribe_with_claude(audio_path):
    """使用Claude API进行音频转文字"""
    # 读取音频文件并转换为base64
    with open(audio_path, 'rb') as f:
        audio_data = base64.standard_b64encode(f.read()).decode('utf-8')
    
    # 获取文件扩展名
    file_ext = audio_path.rsplit('.', 1)[1].lower()
    media_type_map = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'flac': 'audio/flac'
    }
    media_type = media_type_map.get(file_ext, 'audio/mpeg')
    
    # 调用Claude API
    message = claude_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": audio_data
                        }
                    },
                    {
                        "type": "text",
                        "text": "请将这段音频转录为文字。要求：\n1. 准确转录所有内容\n2. 保持原始语序\n3. 使用标准标点符号\n4. 返回JSON格式：{\"text\": \"完整文本\", \"segments\": [{\"start\": 0.0, \"end\": 5.0, \"text\": \"片段文字\"}]}\n注意：segments中的时间戳是估计值，请根据语速合理分段。"
                    }
                ]
            }
        ]
    )
    
    # 解析返回结果
    response_text = message.content[0].text
    
    # 尝试从响应中提取JSON
    try:
        # 如果响应包含代码块，提取其中的JSON
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
        
        result = json.loads(json_str)
        return result
    except json.JSONDecodeError:
        # 如果解析失败，返回基本格式
        return {
            'text': response_text,
            'segments': [{'id': 0, 'start': 0.0, 'end': 10.0, 'text': response_text}]
        }

def transcribe_with_openai(audio_path):
    """使用OpenAI兼容API进行音频转文字，支持大文件自动压缩"""
    try:
        # 检查文件大小 (OpenAI API 限制为 25MB)
        file_size = os.path.getsize(audio_path)
        max_size = 25 * 1024 * 1024  # 25MB
        
        target_path = audio_path
        temp_compressed = None
        
        if file_size > max_size:
            print(f"文件大小为 {file_size/1024/1024:.2f}MB，超过 OpenAI 25MB 限制，正在进行压缩...")
            temp_compressed = tempfile.mktemp(suffix='.mp3')
            # 使用 ffmpeg 压缩到更低的比特率和单声道以减小体积
            (
                ffmpeg
                .input(audio_path)
                .output(temp_compressed, acodec='libmp3lame', ab='64k', ac=1)
                .overwrite_output()
                .run(quiet=True)
            )
            target_path = temp_compressed
            print(f"压缩完成，新大小: {os.path.getsize(target_path)/1024/1024:.2f}MB")

        # 打开(压缩后的)音频文件
        with open(target_path, 'rb') as audio_file:
            # 调用OpenAI Whisper API
            transcript = openai_client.audio.transcriptions.create(
                model=OPENAI_MODEL,
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"],
                language="zh"
            )
        
        # 清理临时压缩文件
        if temp_compressed and os.path.exists(temp_compressed):
            os.remove(temp_compressed)
        
        # 解析返回结果
        full_text = transcript.text
        
        # 提取word-level时间戳并拆分为单字
        words = []
        char_id = 0
        
        if hasattr(transcript, 'words') and transcript.words:
            for word_obj in transcript.words:
                word_text = getattr(word_obj, 'word', '').strip()
                word_start = getattr(word_obj, 'start', 0.0)
                word_end = getattr(word_obj, 'end', 0.0)
                
                # 过滤掉空白和标点符号（可选）
                if not word_text:
                    continue
                
                # 计算单个字的时长
                word_duration = word_end - word_start
                char_count = len(word_text)
                
                if char_count == 0:
                    continue
                
                # 为每个字分配时间戳
                char_duration = word_duration / char_count
                
                for i, char in enumerate(word_text):
                    char_start = word_start + (i * char_duration)
                    char_end = char_start + char_duration
                    
                    words.append({
                        'id': char_id,
                        'start': round(char_start, 3),
                        'end': round(char_end, 3),
                        'word': char
                    })
                    char_id += 1
        
        # 提取segments（句子级别）
        segments = []
        if hasattr(transcript, 'segments') and transcript.segments:
            for i, segment in enumerate(transcript.segments):
                # segments是对象，使用属性访问
                segments.append({
                    'id': i,
                    'start': getattr(segment, 'start', 0.0),
                    'end': getattr(segment, 'end', 10.0),
                    'text': getattr(segment, 'text', '').strip()
                })
        else:
            # 如果没有segments，创建一个默认的
            segments = [{
                'id': 0,
                'start': 0.0,
                'end': 10.0,
                'text': full_text
            }]
        
        return {
            'text': full_text,
            'segments': segments,
            'words': words  # 添加字级别时间戳
        }
    
    except Exception as e:
        print(f"OpenAI API错误: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """上传音频文件并进行语音识别"""
    if 'file' not in request.files:
        return jsonify({'error': '没有文件上传'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # 生成任务ID
        task_id = f"task_{timestamp}"
        
        # 初始化进度
        progress_data[task_id] = {
            'status': 'uploading',
            'progress': 0,
            'message': '文件上传完成，准备识别...',
            'filename': filename
        }
        
        # 在后台线程中处理识别
        def process_audio():
            try:
                progress_data[task_id]['status'] = 'processing'
                progress_data[task_id]['progress'] = 10
                progress_data[task_id]['message'] = '正在加载音频文件...'
                
                print(f"开始识别音频: {filename}")
                time.sleep(0.5)
                
                # 更新进度
                progress_data[task_id]['progress'] = 20
                progress_data[task_id]['message'] = '正在进行语音识别...（这可能需要一些时间）'
                
                # 启动一个模拟进度更新线程
                stop_progress_simulation = {'value': False}
                
                def simulate_progress():
                    """模拟进度缓慢增长，让用户知道系统还在工作"""
                    current = 20
                    while not stop_progress_simulation['value'] and current < 75:
                        time.sleep(2)  # 每2秒更新一次
                        if not stop_progress_simulation['value']:
                            current = min(current + 2, 75)  # 缓慢增长到75%
                            progress_data[task_id]['progress'] = current
                
                progress_thread = threading.Thread(target=simulate_progress)
                progress_thread.daemon = True
                progress_thread.start()
                
                # 根据模式选择转录方法
                if TRANSCRIPTION_MODE == 'openai':
                    # 使用OpenAI兼容API进行语音识别（速度快）
                    progress_data[task_id]['message'] = '正在使用OpenAI API识别...（通常很快）'
                    result = transcribe_with_openai(filepath)
                    
                    # 停止模拟进度
                    stop_progress_simulation['value'] = True
                    
                    progress_data[task_id]['progress'] = 80
                    progress_data[task_id]['message'] = '正在整理识别结果...'
                    
                    # 提取文字和时间戳信息
                    segments = []
                    for i, segment in enumerate(result.get('segments', [])):
                        segments.append({
                            'id': i,
                            'start': segment.get('start', 0.0),
                            'end': segment.get('end', 10.0),
                            'text': segment.get('text', '').strip()
                        })
                    
                    full_text = result.get('text', '')
                    words = result.get('words', [])  # 获取字级别时间戳
                
                elif TRANSCRIPTION_MODE == 'claude':
                    # 使用Claude API进行语音识别（速度更快）
                    progress_data[task_id]['message'] = '正在使用Claude API识别...（通常很快）'
                    result = transcribe_with_claude(filepath)
                    
                    # 停止模拟进度
                    stop_progress_simulation['value'] = True
                    
                    progress_data[task_id]['progress'] = 80
                    progress_data[task_id]['message'] = '正在整理识别结果...'
                    
                    # 提取文字和时间戳信息
                    segments = []
                    for i, segment in enumerate(result.get('segments', [])):
                        segments.append({
                            'id': i,
                            'start': segment.get('start', 0.0),
                            'end': segment.get('end', 10.0),
                            'text': segment.get('text', '').strip()
                        })
                    
                    full_text = result.get('text', '')
                    words = []  # Claude暂不支持字级别
                    
                else:
                    # 使用Whisper进行语音识别（这是阻塞调用）
                    result = model.transcribe(filepath, language='zh', word_timestamps=True)
                    
                    # 停止模拟进度
                    stop_progress_simulation['value'] = True
                    
                    progress_data[task_id]['progress'] = 80
                    progress_data[task_id]['message'] = '正在整理识别结果...'
                    
                    # 提取文字和时间戳信息
                    segments = []
                    for segment in result['segments']:
                        segments.append({
                            'id': segment['id'],
                            'start': segment['start'],
                            'end': segment['end'],
                            'text': segment['text'].strip()
                        })
                    
                    full_text = result['text']
                    words = []  # Whisper tiny模型暂不支持字级别
                
                # 完成
                progress_data[task_id]['status'] = 'completed'
                progress_data[task_id]['progress'] = 100
                progress_data[task_id]['message'] = '识别完成！'
                progress_data[task_id]['result'] = {
                    'success': True,
                    'filename': filename,
                    'text': full_text,
                    'segments': segments,
                    'words': words  # 添加字级别时间戳
                }
                
            except Exception as e:
                print(f"识别错误: {str(e)}")
                import traceback
                traceback.print_exc()
                progress_data[task_id]['status'] = 'error'
                progress_data[task_id]['message'] = f'识别失败: {str(e)}'
                progress_data[task_id]['error'] = str(e)
        
        # 启动后台线程
        thread = threading.Thread(target=process_audio)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'task_id': task_id,
            'message': '文件上传成功，开始处理...'
        })
    
    return jsonify({'error': '不支持的文件格式'}), 400

@app.route('/progress/<task_id>')
def get_progress(task_id):
    """获取处理进度"""
    if task_id not in progress_data:
        return jsonify({'error': '任务不存在'}), 404
    
    task = progress_data[task_id]
    response = {
        'status': task['status'],
        'progress': task['progress'],
        'message': task['message']
    }
    
    # 如果已完成，返回结果
    if task['status'] == 'completed' and 'result' in task:
        response['result'] = task['result']
    
    # 如果出错，返回错误信息
    if task['status'] == 'error' and 'error' in task:
        response['error'] = task['error']
    
    return jsonify(response)

def format_to_markers(seconds):
    """将秒数转换为 0:00.000 格式的字符串"""
    minutes = int(seconds // 60)
    remaining_seconds = seconds % 60
    return f"{minutes}:{remaining_seconds:06.3f}"

@app.route('/clip', methods=['POST'])
def clip_audio():
    """根据选择的文字片段剪辑音频，并添加前后留白及特定音频规范"""
    data = request.json
    filename = data.get('filename')
    start_time = float(data.get('start_time'))
    end_time = float(data.get('end_time'))
    selected_words = data.get('selected_words', [])
    
    if not filename or start_time is None or end_time is None:
        return jsonify({'error': '缺少必要参数'}), 400
    
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    if not os.path.exists(input_path):
        return jsonify({'error': '源文件不存在'}), 404
    
    try:
        # 生成时间戳
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # 获取文件夹名称（文字内容）
        folder_name = "clip"
        clip_text = ""
        if selected_words:
            task_id = None
            for tid, task in progress_data.items():
                if task.get('result', {}).get('filename') == filename:
                    task_id = tid
                    break
            
            if task_id and 'result' in progress_data[task_id]:
                words_data = progress_data[task_id]['result'].get('words', [])
                if words_data:
                    clip_text = ''.join([words_data[i]['word'] for i in sorted(selected_words) if i < len(words_data)])
                    folder_name = ''.join(c for c in clip_text if c.isalnum() or c in '，。！？、')
                    if len(folder_name) > 50: folder_name = folder_name[:50]
                    if not folder_name: folder_name = "clip"
        
        folder_name = f"{folder_name}_{timestamp}"
        folder_path = os.path.join(app.config['OUTPUT_FOLDER'], folder_name)
        os.makedirs(folder_path, exist_ok=True)
        
        mp3_filename = "audio.mp3"
        mp3_path = os.path.join(folder_path, mp3_filename)
        
        # 1. 音频处理 (纯净剪辑模式：不做任何修饰，仅剪切)
        orig_duration = end_time - start_time
        final_duration = orig_duration
        
        # 简单剪辑命令
        cmd = [
            'ffmpeg', '-y',
            '-ss', str(start_time),
            '-t', str(orig_duration),
            '-i', input_path,
            # 使用 libmp3lame 编码，保持较高质量，但不做重采样或声道转换
            '-acodec', 'libmp3lame',
            '-q:a', '2',  # VBR 质量设置 (0-9, 2 是高品质，约等于 190kbps)
            mp3_path
        ]
        
        import subprocess
        subprocess.run(cmd, check=True, capture_output=True)
        
        # 2. 生成 JSON（更新格式描述，移除 0.1s 偏移）
        json_filename = None
        if selected_words:
            json_filename = "timestamps.json"
            json_path = os.path.join(folder_path, json_filename)
            
            task_id = None
            for tid, task in progress_data.items():
                if task.get('result', {}).get('filename') == filename:
                    task_id = tid
                    break
            
            if task_id and 'result' in progress_data[task_id]:
                words_data = progress_data[task_id]['result'].get('words', [])
                if words_data:
                    clipped_words_for_json = []  # 用于保存到 JSON 的格式化版本
                    clipped_words_for_response = []  # 用于返回前端的数字版本
                    markers = []
                    
                    for word_index in sorted(selected_words):
                        if word_index < len(words_data):
                            word = words_data[word_index]
                            # 计算相对于新音频的时间（无留白偏移）
                            rel_start = max(0, word['start'] - start_time)
                            rel_end = max(0, word['end'] - start_time)
                            
                            # JSON 格式（字符串时间戳）
                            clipped_words_for_json.append({
                                'word': word['word'],
                                'start': format_to_markers(rel_start),
                                'end': format_to_markers(rel_end)
                            })
                            
                            # 前端编辑格式（数字时间戳）
                            clipped_words_for_response.append({
                                'word': word['word'],
                                'start': round(rel_start, 3),
                                'end': round(rel_end, 3)
                            })
                            
                            markers.append(format_to_markers(rel_start))
                    
                    # 在最后添加一个总结束点的 marker
                    if clipped_words_for_json:
                        markers.append(format_to_markers(rel_end))
                    
                    json_data = {
                        'clip_info': {
                            'original_file': filename,
                            'text': clip_text,
                            'duration': format_to_markers(final_duration),
                            'padding_start': "0:00.000",
                            'padding_end': "0:00.000",
                            'format': 'MP3 VBR Quality 2'
                        },
                        'markers': markers,
                        'words': clipped_words_for_json
                    }
                    
                    with open(json_path, 'w', encoding='utf-8') as f:
                        json.dump(json_data, f, ensure_ascii=False, indent=4)
        
        # 3. 打包 ZIP
        import zipfile
        zip_filename = f"{folder_name}.zip"
        zip_path = os.path.join(app.config['OUTPUT_FOLDER'], zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(mp3_path, os.path.join(folder_name, mp3_filename))
            if json_filename:
                zipf.write(os.path.join(folder_path, json_filename), os.path.join(folder_name, json_filename))
        
        # 构建返回数据（包含可编辑的 words）
        response_data = {
            'success': True,
            'folder_name': folder_name,
            'zip_filename': zip_filename,
            'mp3_filename': mp3_filename,
            'json_filename': json_filename,
            'duration': final_duration,
            'clip_info': {
                'text': clip_text,
                'duration': format_to_markers(final_duration),
                'padding_start': "0:00.000",
                'padding_end': "0:00.000",
                'format': 'MP3 VBR Quality 2'
            },
            'words': clipped_words_for_response if selected_words else []
        }
        
        return jsonify(response_data)
    
    except Exception as e:
        print(f"剪辑错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'音频处理失败: {str(e)}'}), 500

@app.route('/save_clip', methods=['POST'])
def save_clip():
    """保存用户编辑后的时间戳到 JSON 文件"""
    try:
        data = request.json
        folder_name = data.get('folder_name')
        words = data.get('words', [])
        clip_info = data.get('clip_info', {})
        
        if not folder_name:
            return jsonify({'error': '缺少文件夹名称'}), 400
        
        # 构建 JSON 文件路径
        folder_path = os.path.join(app.config['OUTPUT_FOLDER'], folder_name)
        json_path = os.path.join(folder_path, 'timestamps.json')
        
        if not os.path.exists(folder_path):
            return jsonify({'error': '文件夹不存在'}), 404
        
        # 准备 markers 列表（转换为格式化字符串）
        markers = []
        formatted_words = []
        
        for word in words:
            # 格式化 markers
            markers.append(format_to_markers(float(word['start'])))
            
            # 格式化 words 用于 JSON
            formatted_words.append({
                'word': word['word'],
                'start': format_to_markers(float(word['start'])),
                'end': format_to_markers(float(word['end']))
            })
            
        if words:
            # 添加最后的结束时间到 markers
            markers.append(format_to_markers(float(words[-1]['end'])))
        
        # 更新 JSON 数据
        json_data = {
            'clip_info': clip_info,
            'markers': markers,
            'words': formatted_words
        }
        
        # 保存到文件
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=4)
        
        # 重新打包 ZIP
        import zipfile
        zip_filename = f"{folder_name}.zip"
        zip_path = os.path.join(app.config['OUTPUT_FOLDER'], zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 添加 MP3
            mp3_path = os.path.join(folder_path, 'audio.mp3')
            if os.path.exists(mp3_path):
                zipf.write(mp3_path, os.path.join(folder_name, 'audio.mp3'))
            # 添加更新后的 JSON
            zipf.write(json_path, os.path.join(folder_name, 'timestamps.json'))
        
        return jsonify({
            'success': True,
            'message': '时间戳已更新并重新打包'
        })
    
    except Exception as e:
        print(f"保存错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'保存失败: {str(e)}'}), 500

@app.route('/download/<path:filename>')
def download_file(filename):
    """下载剪辑后的音频文件或文件夹内的文件"""
    filepath = os.path.join(app.config['OUTPUT_FOLDER'], filename)
    
    # 安全检查：确保路径在 OUTPUT_FOLDER 内
    real_output_folder = os.path.realpath(app.config['OUTPUT_FOLDER'])
    real_filepath = os.path.realpath(filepath)
    
    if not real_filepath.startswith(real_output_folder):
        return jsonify({'error': '非法路径'}), 403
    
    if os.path.exists(filepath) and os.path.isfile(filepath):
        return send_file(filepath, as_attachment=True)
    
    return jsonify({'error': '文件不存在'}), 404

@app.route('/cleanup', methods=['POST'])
def cleanup():
    """清理临时文件"""
    try:
        # 清理上传文件夹
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.isfile(filepath):
                os.remove(filepath)
        
        # 清理输出文件夹
        for filename in os.listdir(app.config['OUTPUT_FOLDER']):
            filepath = os.path.join(app.config['OUTPUT_FOLDER'], filename)
            if os.path.isfile(filepath):
                os.remove(filepath)
        
        return jsonify({'success': True, 'message': '清理完成'})
    except Exception as e:
        return jsonify({'error': f'清理失败: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
