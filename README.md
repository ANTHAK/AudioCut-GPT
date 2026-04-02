# 🎙️ AudioCut GPT

### 智能语音剪辑工作站 (AI-Powered Audio Editing Workstation)

**AudioCut GPT** 是一款利用 GPT 大模型深度解析语音信息的智能剪辑工作站。它通过高精度的声音识别技术，将音频流转化为可搜索、可编辑的文本流，颠覆传统的音频剪辑体验。

---

## 🌟 核心逻辑 (Core Logic)

- **深层解析**: 软件自动识别语音中的语气词、重复句及空白段落，精准捕捉语音情绪与结构。
- **文本驱动剪辑**: 用户无需在波形图中反复查找，只需在文本编辑器中勾选或删除文字，软件即可毫秒级完成对应的音音频片段切分与重组。
- **高精度对齐**: 基于字级别的毫秒级时间戳，确保剪辑点极其流畅自然。

---

## 🎯 适用场景 (Use Cases)

- 🎙️ **采访粗剪**: 快速提取对话精华，自动过滤尴尬的沉默与口头禅。
- 🚮 **录音废话清理**: 一键剔除冗余片段，提升信息密度。
- 📱 **短视频素材生产**: 像编辑文档一样制作视频音频轨道，大幅缩短后期制作周期。

---

## ✨ 功能特性 (Features)

- 🎤 **多模式语音识别**: 支持本地 Whisper 模型、OpenAI Whisper API 以及 Claude 语音转录。
- 📝 **可视化字级别选择**: 在 Web 界面上直观地通过拖拽选择需要剪辑的字词片段。
- ✂️ **精准切片引擎**: 基于 FastAPI 后端的高性能音频处理引擎，支持长音频并发处理。
- 📦 **打包导出**: 剪辑结果自动打包为 ZIP，包含分段 MP3 和对应的时间戳 JSON 文件，方便二次开发。
- 🎨 **现代化 UI**: 采用 Tailwind CSS v4 构建的深色透传 (Glassmorphism) 风格界面，极致的视觉交互体验。

---

## 🚀 快速开始 (Quick Start)

### 1. 环境要求
- **Python 3.10+**
- **Node.js 18+**
- **FFmpeg**: 必须安装并添加到系统路径（用于高性能音频编码）

### 2. 后端配置 (FastAPI)
后端代码位于 `server/` 目录。
```bash
# 安装依赖
pip install -r server/requirements.txt

# 运行后端
python -m server.main
```
*默认接口地址: `http://127.0.0.1:8000`*

### 3. 前端配置 (React)
前端基于 Vite 6 + React 19 构建。
```bash
# 安装依赖
npm install

# 运行开发服务器
npm run dev
```
*默认访问地址: `http://localhost:5173`*

---

## 📁 项目结构 (Project Structure)

```text
voice_editor/
├── src/                # React 前端源代码 (Vite + TS)
│   ├── features/       # 功能模块 (编辑器、状态管理)
│   ├── shared/         # 通用 UI 组件与工具 (Zustand, CVA)
│   └── app/            # 路由与全局配置
├── server/             # FastAPI 后端源代码
│   ├── services/       # 转录(Whisper/GPT)与音频处理逻辑
│   ├── uploads/        # 临时上传区
│   └── outputs/        # 导出结果区
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
