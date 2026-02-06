# 解决 413 Request Entity Too Large 错误

## 问题原因
当上传大于默认限制的文件时，Nginx 会返回 413 错误。这是因为 Nginx 默认的 `client_max_body_size` 通常只有 1-2MB。

## 解决方案

### 方案 1: 修改现有 Nginx 配置（推荐）

1. **找到 Nginx 配置文件**
   ```bash
   # macOS (如果使用 Homebrew 安装)
   /opt/homebrew/etc/nginx/nginx.conf
   # 或
   /usr/local/etc/nginx/nginx.conf
   
   # Linux
   /etc/nginx/nginx.conf
   # 或
   /etc/nginx/sites-available/default
   ```

2. **编辑配置文件**
   在 `http` 块或 `server` 块中添加：
   ```nginx
   client_max_body_size 200M;
   ```

3. **重启 Nginx**
   ```bash
   # macOS
   brew services restart nginx
   
   # Linux
   sudo systemctl restart nginx
   # 或
   sudo nginx -s reload
   ```

### 方案 2: 直接运行 Flask（临时解决）

如果您不需要 Nginx，可以直接访问 Flask 应用：

```bash
# 停止 Nginx
brew services stop nginx  # macOS
# 或
sudo systemctl stop nginx  # Linux

# 直接访问 Flask
# 浏览器打开: http://localhost:5001
```

Flask 应用已经配置为支持 200MB 的文件上传。

### 方案 3: 使用提供的 Nginx 配置

项目中已包含 `nginx.conf.example` 文件，您可以：

```bash
# 复制示例配置
cp nginx.conf.example /opt/homebrew/etc/nginx/servers/voice_editor.conf

# 重启 Nginx
brew services restart nginx
```

## 验证配置

上传文件后，如果仍然遇到问题，检查：

1. **Nginx 错误日志**
   ```bash
   tail -f /opt/homebrew/var/log/nginx/error.log
   ```

2. **Flask 应用日志**
   查看终端中运行 `python app.py` 的输出

## 当前配置

- **Flask 最大上传**: 200MB
- **建议 Nginx 配置**: 200MB
- **OpenAI API 限制**: 25MB（超过会自动压缩）

## 注意事项

- 大文件上传和处理需要时间，请耐心等待
- 超过 25MB 的文件会自动压缩后再发送给识别 API
- 确保服务器有足够的磁盘空间存储临时文件
