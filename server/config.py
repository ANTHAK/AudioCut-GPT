import os
from dotenv import load_dotenv

load_dotenv()

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'outputs')

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Transcription Configuration
TRANSCRIPTION_MODE = os.getenv('TRANSCRIPTION_MODE', 'whisper').lower()

# OpenAI Config
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'whisper-1')

# Whisper parameters
WHISPER_LANGUAGE = os.getenv('WHISPER_LANGUAGE', 'zh')
WHISPER_RESPONSE_FORMAT = os.getenv('WHISPER_RESPONSE_FORMAT', 'verbose_json')
WHISPER_TEMPERATURE = float(os.getenv('WHISPER_TEMPERATURE', '0'))
WHISPER_PROMPT = os.getenv('WHISPER_PROMPT', '')
MAX_FILE_SIZE_MB = int(os.getenv('MAX_FILE_SIZE_MB', '10'))
COMPRESSION_BITRATE = os.getenv('COMPRESSION_BITRATE', '32k')
COMPRESSION_SAMPLE_RATE = int(os.getenv('COMPRESSION_SAMPLE_RATE', '16000'))

# Claude Config
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')

# Allowed extensions
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a', 'flac'}

def is_allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
