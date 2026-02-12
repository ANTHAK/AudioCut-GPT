# 🎵 智能音频剪辑工具 (React + FastAPI 版)

基于 **React 19** 和 **FastAPI** 的现代化音频剪辑应用。支持自动语音识别（Whisper/OpenAI/Claude）、可视化字级别文本选择、一键生成精准剪辑后的 MP3 文件。

## ✨ 功能特性

- 🎤 **多模式语音识别**: 支持本地 Whisper 模型、OpenAI Whisper API 以及 Claude 语音转录。
- 📝 **可视化字级别选择**: 在 Web 界面上直观地通过拖拽选择需要剪辑的字词片段。
- ✂️ **精准剪辑**: 基于毫秒级时间戳自动定位，一键生成剪辑音频。
- � **打包下载**: 剪辑结果自动打包为 ZIP，包含 MP3 音频和对应的 JSON 时间戳文件。
- 🎨 **现代化 UI**: 采用 Tailwind CSS v4 构建的深色透传 (Glassmorphism) 风格界面。
- ⚡ **异步处理**: 后端基于 FastAPI Background Tasks，支持长音频异步转录。

---

## 🚀 快速开始

### 1. 环境要求

- **Python 3.10+**
- **Node.js 18+**
- **FFmpeg**: 用于音频编解码（必须安装并添加到系统路径）

#### 安装 FFmpeg
- **macOS**: `brew install ffmpeg`
- **Windows**: 从 [FFmpeg 官网](https://ffmpeg.org/download.html) 下载并添加到 PATH。

---

### 2. 后端配置 (FastAPI)

后端代码位于 `server/` 目录。

```bash
# 进入虚拟环境 (如果尚未创建)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r server/requirements.txt
```

#### 环境变量设置
在根目录创建 `.env` 文件，配置识别模式及密钥：

```env
# 识别模式: openai, claude, 或 whisper (本地)
TRANSCRIPTION_MODE=openai
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1

# 如果使用 claude 模式
ANTHROPIC_API_KEY=your_key_here
```

#### 运行后端
```bash
python -m server.main
```
后端默认运行在 `http://127.0.0.1:8000`。

---

### 3. 前端配置 (React)

前端基于 Vite 构建。

```bash
# 安装依赖
npm install

# 运行开发服务器
npm run dev
```
前端默认运行在 `http://localhost:5173`。

---

## 📁 项目结构

```text
voice_editor/
├── src/                # React 前端源代码 (Vite + TS)
│   ├── features/       # 功能模块 (编辑器、状态管理)
│   ├── shared/         # 通用 UI 组件与工具
│   └── app/            # 路由与全局 Provider
├── server/             # FastAPI 后端源代码
│   ├── services/       # 转录与音频处理逻辑
│   ├── uploads/        # 上传缓存
│   └── outputs/        # 剪辑结果导出
├── public/             # 静态资源
├── package.json        # 前端依赖与脚本
├── vite.config.ts      # Vite 配置 (包含 API 代理)
└── .env                # 环境配置文件
```

---

## � 使用步骤

1. **上传音频**: 拖拽文件到上传区，支持 MP3, WAV, m4a 等。
2. **等待识别**: 系统自动根据配置的模式进行转录，进度实时显示。
3. **字级别选择**: 在识别出的文本中，按住鼠标左键拖拽选择需要的片段。
4. **生成剪辑**: 点击页面下方的“生成剪辑”按钮。
5. **下载结果**: 点击“下载结果”获取包含音频和时间戳的 ZIP 包。

---

## �️ 技术栈

### 后端 (Python)
- **FastAPI**: 异步 Web 框架
- **FFmpeg**: 音频处理核心
- **OpenAI/Anthropic/Whisper**: 语音识别引擎
- **Pydantic**: 数据校验

### 前端 (React)
- **React 19**: 核心框架
- **Vite 6**: 构建工具
- **Tailwind CSS v4**: 样式布局
- **Zustand**: 状态管理
- **Lucide React**: 图标库

---

## 📝 开发备注
- 原项目文件（Flask 版本）已重命名为 `.bak` 备份在目录中。
- `vite.config.ts` 已配置热更新代理，所有 `/api/*` 请求会自动转发到 FastAPI 端口。

---

## 📄 许可证
MIT License
