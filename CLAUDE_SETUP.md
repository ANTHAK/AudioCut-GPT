# 🔧 Claude API配置指南

## 获取Claude API密钥

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册或登录账号
3. 进入 **API Keys** 页面
4. 点击 **Create Key** 创建新密钥
5. 复制生成的API密钥（格式：`sk-ant-...`）

## 配置步骤

### 1. 编辑 `.env` 文件

打开项目根目录下的 `.env` 文件，填入你的API密钥：

```bash
# Claude API配置
ANTHROPIC_API_KEY=sk-ant-api03-你的实际密钥

# 使用模式
TRANSCRIPTION_MODE=claude
```

### 2. 选择转录模式

在 `.env` 文件中设置 `TRANSCRIPTION_MODE`：

#### 选项 A: Claude模式（推荐）
```bash
TRANSCRIPTION_MODE=claude
```
**优点**：
- ⚡ 速度快（通常几秒内完成）
- 🎯 准确度高
- 📊 支持多种音频格式
- 🌐 无需本地GPU

**缺点**：
- 💰 需要API密钥（按使用量付费）
- 🌍 需要网络连接

#### 选项 B: Whisper模式（免费）
```bash
TRANSCRIPTION_MODE=whisper
```
**优点**：
- 🆓 完全免费
- 🔒 本地处理，隐私性好
- 📡 无需网络连接

**缺点**：
- 🐌 速度较慢（CPU上需要几分钟）
- 💻 占用本地资源

## 使用说明

### 启动应用

```bash
# 确保已安装依赖
pip install -r requirements.txt

# 启动服务器
python app.py
```

### 验证配置

启动时会看到以下提示之一：

**Claude模式**：
```
使用Claude API进行语音识别
```

**Whisper模式**：
```
正在加载Whisper模型...
Whisper模型加载完成！
```

## API费用说明

Claude API按使用量计费：

- **音频处理**: 约 $0.003 - $0.015 per minute
- **文本生成**: 约 $0.003 per 1K tokens

示例：处理10分钟音频约 $0.03 - $0.15

查看最新价格：https://www.anthropic.com/pricing

## 故障排除

### 问题1: "未设置ANTHROPIC_API_KEY"

**解决方案**：
1. 确认 `.env` 文件存在于项目根目录
2. 检查API密钥格式是否正确（以 `sk-ant-` 开头）
3. 重启应用

### 问题2: API调用失败

**可能原因**：
- API密钥无效或过期
- 网络连接问题
- API配额用尽

**解决方案**：
1. 检查API密钥是否有效
2. 查看 [Anthropic Status](https://status.anthropic.com/)
3. 临时切换到Whisper模式：`TRANSCRIPTION_MODE=whisper`

### 问题3: 识别结果不准确

**优化建议**：
- 确保音频清晰，噪音较少
- 使用高质量音频格式（WAV, FLAC）
- 音频时长建议在10分钟以内

## 安全提示

⚠️ **重要**：
- 不要将 `.env` 文件提交到Git
- 不要在代码中硬编码API密钥
- 定期轮换API密钥
- 监控API使用量

## 切换模式

随时可以在 `.env` 文件中切换模式，无需修改代码：

```bash
# 切换到Claude
TRANSCRIPTION_MODE=claude

# 切换到Whisper
TRANSCRIPTION_MODE=whisper
```

修改后重启应用即可生效。
