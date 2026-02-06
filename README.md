# 🎵 智能音频剪辑工具

基于Python的Web应用，用于音频剪辑。支持自动语音识别，可视化选择文字片段，一键生成剪辑后的MP3文件。

## ✨ 功能特性

- 🎤 **智能语音识别**: 使用OpenAI Whisper模型自动识别音频中的文字
- 📝 **可视化编辑**: 在Web界面上直观地选择需要剪辑的文字片段
- ✂️ **精准剪辑**: 根据选择的文字自动定位时间点，精准剪辑音频
- 💾 **一键导出**: 生成高质量MP3文件，支持直接下载
- 🎨 **现代化UI**: 美观的渐变设计，流畅的动画效果
- 📱 **响应式设计**: 支持桌面和移动设备

## 🚀 快速开始

### 环境要求

- Python 3.8+
- FFmpeg (用于音频处理)

### 安装FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
从 [FFmpeg官网](https://ffmpeg.org/download.html) 下载并添加到系统PATH

### 安装依赖

```bash
# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装Python依赖
pip install -r requirements.txt
```

### 运行应用

```bash
python app.py
```

应用将在 `http://localhost:5000` 启动

## 📖 使用说明

1. **上传音频**: 
   - 点击"选择文件"按钮或直接拖拽音频文件到上传区域
   - 支持格式: MP3, WAV, OGG, M4A, FLAC
   - 最大文件大小: 100MB

2. **查看识别结果**:
   - 系统会自动使用Whisper模型识别音频中的文字
   - 识别完成后会显示完整文本和分段文字

3. **选择剪辑片段**:
   - 点击文字片段进行选择（支持多选）
   - 选中的片段会高亮显示
   - 可以看到每个片段的时间范围

4. **生成剪辑**:
   - 点击"生成剪辑"按钮
   - 系统会自动剪辑选中片段对应的音频
   - 生成192kbps高质量MP3文件

5. **下载文件**:
   - 剪辑完成后点击"下载MP3文件"
   - 或继续编辑选择其他片段

## 🛠️ 技术栈

### 后端
- **Flask**: Web框架
- **Whisper**: OpenAI的语音识别模型
- **pydub**: 音频处理库
- **FFmpeg**: 音频编解码

### 前端
- **HTML5**: 结构
- **CSS3**: 样式（渐变、动画、响应式）
- **JavaScript**: 交互逻辑（原生JS，无框架依赖）

## 📁 项目结构

```
voice_editor/
├── app.py              # Flask后端主程序
├── requirements.txt    # Python依赖
├── README.md          # 项目说明
├── templates/         # HTML模板
│   └── index.html     # 主页面
├── static/            # 静态资源
│   ├── style.css      # 样式文件
│   └── script.js      # 前端脚本
├── uploads/           # 上传文件临时存储
└── outputs/           # 剪辑后的文件输出
```

## ⚙️ 配置说明

### Whisper模型

默认使用 `base` 模型（速度和准确度的平衡）。可在 `app.py` 中修改：

```python
# 可选模型: tiny, base, small, medium, large
model = whisper.load_model("base")
```

模型对比：
- `tiny`: 最快，准确度较低
- `base`: 平衡（推荐）
- `small`: 较准确，速度适中
- `medium`: 很准确，速度较慢
- `large`: 最准确，速度最慢

### 文件大小限制

在 `app.py` 中修改：

```python
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB
```

## 🔧 常见问题

**Q: 识别速度很慢怎么办？**
A: 可以切换到更小的Whisper模型（如`tiny`），或使用GPU加速。

**Q: 支持哪些语言？**
A: 当前配置为中文识别，可在代码中修改 `language='zh'` 参数支持其他语言。

**Q: 如何提高识别准确度？**
A: 使用更大的模型（如`medium`或`large`），确保音频质量清晰。

**Q: 能否同时剪辑多个不连续的片段？**
A: 当前版本支持选择连续片段范围。如需多个不连续片段，可以分多次剪辑。

## 📝 开发计划

- [ ] 支持多个不连续片段的合并剪辑
- [ ] 添加音频预览播放功能
- [ ] 支持手动编辑识别文字
- [ ] 添加音频效果处理（淡入淡出、音量调整等）
- [ ] 支持批量处理多个文件
- [ ] 添加用户账号系统和历史记录

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

**享受智能音频剪辑的乐趣！** 🎉
