let currentFilename = null;
let segments = [];
let selectedSegments = new Set();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeUpload();
});

// 初始化上传功能
function initializeUpload() {
    const uploadBox = document.getElementById('uploadBox');
    const fileInput = document.getElementById('fileInput');

    // 拖拽上传
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('drag-over');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('drag-over');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    // 文件选择上传
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

// 处理文件上传
async function handleFileUpload(file) {
    // 验证文件类型
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/flac'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
        alert('不支持的文件格式！请上传音频文件。');
        return;
    }

    // 验证文件大小 (100MB)
    if (file.size > 100 * 1024 * 1024) {
        alert('文件太大！请上传小于100MB的文件。');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showLoading(true, '正在上传文件...', 0);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success && data.task_id) {
            // 开始轮询进度
            pollProgress(data.task_id);
        } else {
            alert('上传失败: ' + (data.error || '未知错误'));
            showLoading(false);
        }
    } catch (error) {
        console.error('上传错误:', error);
        alert('上传失败，请检查网络连接或稍后重试。');
        showLoading(false);
    }
}

// 轮询进度
async function pollProgress(taskId) {
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/progress/${taskId}`);
            const data = await response.json();

            if (data.error) {
                clearInterval(pollInterval);
                alert('任务错误: ' + data.error);
                showLoading(false);
                return;
            }

            // 更新进度显示
            showLoading(true, data.message, data.progress);

            if (data.status === 'completed' && data.result) {
                clearInterval(pollInterval);
                showLoading(false);
                currentFilename = data.result.filename;
                segments = data.result.segments;
                
                // 保存words数据（字级别时间戳）
                if (data.result.words && data.result.words.length > 0) {
                    window.wordsData = data.result.words;
                    displayWordsResults(data.result.text, data.result.words);
                } else {
                    window.wordsData = null;
                    displayResults(data.result.text, data.result.segments);
                }
            } else if (data.status === 'error') {
                clearInterval(pollInterval);
                alert('处理失败: ' + data.message);
                showLoading(false);
            }
        } catch (error) {
            console.error('获取进度错误:', error);
            clearInterval(pollInterval);
            alert('获取进度失败，请刷新页面重试。');
            showLoading(false);
        }
    }, 1000); // 每秒轮询一次
}

// 显示识别结果
function displayResults(fullText, segmentsList) {
    document.getElementById('fullText').textContent = fullText;
    
    const segmentsContainer = document.getElementById('segmentsList');
    segmentsContainer.innerHTML = '';

    segmentsList.forEach((segment, index) => {
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'segment-item';
        segmentDiv.dataset.index = index;
        
        const timeSpan = document.createElement('div');
        timeSpan.className = 'segment-time';
        timeSpan.textContent = `${formatTime(segment.start)} - ${formatTime(segment.end)}`;
        
        const textSpan = document.createElement('div');
        textSpan.className = 'segment-text';
        textSpan.textContent = segment.text;
        
        segmentDiv.appendChild(timeSpan);
        segmentDiv.appendChild(textSpan);
        
        segmentDiv.addEventListener('click', () => toggleSegment(index));
        
        segmentsContainer.appendChild(segmentDiv);
    });

    document.getElementById('resultSection').style.display = 'block';
    selectedSegments.clear();
    updateSelectionUI();
}

// 显示字级别识别结果
let selectedWords = new Set();

function displayWordsResults(fullText, wordsList) {
    document.getElementById('fullText').textContent = fullText;
    
    const segmentsContainer = document.getElementById('segmentsList');
    segmentsContainer.innerHTML = '';
    
    // 添加提示
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.style.marginBottom = '1rem';
    hint.textContent = '💡 点击单个文字进行选择，支持连续选择多个字';
    segmentsContainer.appendChild(hint);
    
    // 创建字级别容器
    const wordsContainer = document.createElement('div');
    wordsContainer.style.display = 'flex';
    wordsContainer.style.flexWrap = 'wrap';
    wordsContainer.style.gap = '4px';
    wordsContainer.style.lineHeight = '2.5';
    
    wordsList.forEach((wordData, index) => {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word-item';
        wordSpan.dataset.index = index;
        wordSpan.textContent = wordData.word;
        wordSpan.title = `${formatTime(wordData.start)} - ${formatTime(wordData.end)}`;
        
        wordSpan.style.cssText = `
            padding: 4px 8px;
            border: 2px solid #e2e8f0;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: #f8fafc;
            font-size: 1.1rem;
            display: inline-block;
        `;
        
        wordSpan.addEventListener('click', () => toggleWord(index));
        wordSpan.addEventListener('mouseenter', function() {
            if (!selectedWords.has(index)) {
                this.style.background = '#f1f5f9';
                this.style.borderColor = '#6366f1';
            }
        });
        wordSpan.addEventListener('mouseleave', function() {
            if (!selectedWords.has(index)) {
                this.style.background = '#f8fafc';
                this.style.borderColor = '#e2e8f0';
            }
        });
        
        wordsContainer.appendChild(wordSpan);
    });
    
    segmentsContainer.appendChild(wordsContainer);
    document.getElementById('resultSection').style.display = 'block';
    selectedWords.clear();
    updateWordSelectionUI();
}

// 切换字选择状态
function toggleWord(index) {
    const wordSpan = document.querySelector(`.word-item[data-index=\"${index}\"]`);
    
    if (selectedWords.has(index)) {
        selectedWords.delete(index);
        wordSpan.style.borderColor = '#e2e8f0';
        wordSpan.style.background = '#f8fafc';
        wordSpan.style.boxShadow = 'none';
    } else {
        selectedWords.add(index);
        wordSpan.style.borderColor = '#6366f1';
        wordSpan.style.background = 'linear-gradient(135deg, #e0e7ff 0%, #e9d5ff 100%)';
        wordSpan.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    }
    
    updateWordSelectionUI();
}

// 更新字选择UI
function updateWordSelectionUI() {
    const count = selectedWords.size;
    const countSpan = document.getElementById('selectedCount');
    const clipBtn = document.getElementById('clipBtn');
    
    countSpan.textContent = count;
    clipBtn.disabled = count === 0;
}

// 切换片段选择状态
function toggleSegment(index) {
    const segmentDiv = document.querySelector(`.segment-item[data-index="${index}"]`);
    
    if (selectedSegments.has(index)) {
        selectedSegments.delete(index);
        segmentDiv.classList.remove('selected');
    } else {
        selectedSegments.add(index);
        segmentDiv.classList.add('selected');
    }
    
    updateSelectionUI();
}

// 更新选择UI
function updateSelectionUI() {
    document.getElementById('selectedCount').textContent = selectedSegments.size;
    document.getElementById('clipBtn').disabled = selectedSegments.size === 0;
}

// 剪辑音频
async function clipAudio() {
    // 检查是否使用字级别模式
    if (window.wordsData && selectedWords.size > 0) {
        await clipAudioByWords();
        return;
    }
    
    if (selectedSegments.size === 0) {
        alert('请先选择要剪辑的片段！');
        return;
    }

    // 获取选中片段的时间范围
    const selectedIndices = Array.from(selectedSegments).sort((a, b) => a - b);
    const startTime = segments[selectedIndices[0]].start;
    const endTime = segments[selectedIndices[selectedIndices.length - 1]].end;

    showLoading(true);

    try {
        const response = await fetch('/clip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: currentFilename,
                start_time: startTime,
                end_time: endTime
            })
        });

        const data = await response.json();

        if (data.success) {
            showOutput(data);
            clearSelection(); // ⬅️ 生成后清空选择
        } else {
            alert('剪辑失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('剪辑错误:', error);
        alert('剪辑失败，请重试。');
    } finally {
        showLoading(false);
    }
}

// 字级别剪辑
// 字级别剪辑
async function clipAudioByWords() {
    if (!selectedWords || selectedWords.size === 0) {
        alert('请先选择要剪辑的文字');
        return;
    }

    const selectedIndices = Array.from(selectedWords).sort((a, b) => a - b);
    const startTime = window.wordsData[selectedIndices[0]].start;
    const endTime = window.wordsData[selectedIndices[selectedIndices.length - 1]].end;
    
    // 使用 window.currentFilename 或者全局 currentFilename
    const filename = currentFilename;

    console.log(`Clipping words: ${selectedIndices}, Time: ${startTime} - ${endTime}`);

    const data = await requestClipRegion(filename, startTime, endTime, selectedIndices);
    
    if (data && data.success) {
        // 保存绝对时间戳和元数据，供微调使用
        data.meta = {
            filename: filename,
            absoluteStartTime: startTime,
            absoluteEndTime: endTime,
            selectedIndices: selectedIndices
        };
        showPreviewEditor(data);
        clearSelection();
    } else if (data) {
        alert('剪辑失败: ' + (data.error || '未知错误'));
    }
}

// 【新增】显示预览编辑界面
function showPreviewEditor(clipData) {
    const modal = document.getElementById('previewModal');
    if (!modal) {
        createPreviewModal();
        return showPreviewEditor(clipData);
    }
    
    // 存储当前剪辑数据
    window.currentClipData = clipData;
    
    // 设置音频播放器 - 修复路径
    const audioPlayer = document.getElementById('previewAudio');
    // 构建正确的音频文件路径
    const audioPath = `/download/${clipData.folder_name}/audio.mp3`;
    audioPlayer.src = audioPath;
    
    console.log('音频路径:', audioPath); // 调试用
    
    // 显示文字内容
    const textElement = document.getElementById('previewText');
    if (textElement) {
        textElement.textContent = clipData.clip_info?.text || '未知内容';
    }
    
    // 更新时间显示
    const timeInfoEl = document.getElementById('clipTimeInfo');
    if (timeInfoEl && clipData.meta) {
        timeInfoEl.textContent = `当前范围: ${clipData.meta.absoluteStartTime.toFixed(3)}s - ${clipData.meta.absoluteEndTime.toFixed(3)}s`;
    }
    
    // 渲染时间戳编辑器
    renderTimestampEditor(clipData.words || []);
    
    // 显示模态框
    modal.style.display = 'flex';
}

// 【新增】创建预览模态框
function createPreviewModal() {
    const modal = document.createElement('div');
    modal.id = 'previewModal';
    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-modal-content">
            <div class="preview-header">
                <h3>🎵 预览与编辑</h3>
                <button class="close-btn" onclick="closePreviewModal()">✕</button>
            </div>
            
            <div class="preview-body">
                <!-- 音频播放器 -->
                <div class="audio-player-section">
                    <h4>试听音频</h4>
                    <audio id="previewAudio" controls style="width: 100%; margin-top: 10px; margin-bottom: 20px;"></audio>
                    
                    <!-- 新增：剪辑范围微调 -->
                    <div class="clip-range-adjust" style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h5 style="margin: 0 0 10px 0; font-size: 0.9em; color: #64748b;">🎯 剪辑范围微调 (调整原音频截取位置)</h5>
                        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                            <div class="adjust-group" style="flex: 1;">
                                <span class="label" style="font-size: 0.85em; display: block; margin-bottom: 5px;">起始点:</span>
                                <div class="btn-group-sm" style="display: flex; gap: 5px;">
                                    <button class="btn-xs" style="padding: 2px 8px;" onclick="adjustClipRange(-0.1, 0)">⏪ -0.1s</button>
                                    <button class="btn-xs" style="padding: 2px 8px;" onclick="adjustClipRange(-0.05, 0)">-0.05</button>
                                    <button class="btn-xs" style="padding: 2px 8px;" onclick="adjustClipRange(0.05, 0)">+0.05</button>
                                    <button class="btn-xs" style="padding: 2px 8px;" onclick="adjustClipRange(0.1, 0)">+0.1s ⏩</button>
                                </div>
                            </div>
                            <div class="adjust-group" style="flex: 1;">
                                <span class="label" style="font-size: 0.85em; display: block; margin-bottom: 5px;">结束点:</span>
                                <div class="btn-group-sm" style="display: flex; gap: 5px;">
                                    <button class="btn-xs" style="padding: 2px 8px;" onclick="adjustClipRange(0, -0.1)">⏪ -0.1s</button>
                                    <button class="btn-xs" style="padding: 2px 8px;" onclick="adjustClipRange(0, -0.05)">-0.05</button>
                                    <button class="btn-xs" style="padding: 2px 8px;" onclick="adjustClipRange(0, 0.05)">+0.05</button>
                                    <button class="btn-xs" style="padding: 2px 8px;" onclick="adjustClipRange(0, 0.1)">+0.1s ⏩</button>
                                </div>
                            </div>
                        </div>
                        <div id="clipTimeInfo" style="margin-top: 8px; font-size: 0.8em; color: #64748b; text-align: right;"></div>
                    </div>
                </div>
                
                <!-- 文字内容 -->
                <div class="text-preview-section">
                    <h4>剪辑内容</h4>
                    <p id="previewText" class="preview-text"></p>
                </div>
                
                <!-- 时间戳编辑器 -->
                <div class="timestamp-editor-section">
                    <h4>时间戳调整 (字级别)</h4>
                    <div id="timestampEditor" class="timestamp-editor"></div>
                </div>
            </div>
            
            <div class="preview-footer">
                <button class="btn btn-secondary" onclick="closePreviewModal()">取消</button>
                <button class="btn btn-success" onclick="confirmAndSave()">✓ 确认保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 【新增】渲染时间戳编辑器
function renderTimestampEditor(words) {
    const editor = document.getElementById('timestampEditor');
    editor.innerHTML = '';
    
    words.forEach((word, index) => {
        const row = document.createElement('div');
        row.className = 'timestamp-row';
        row.innerHTML = `
            <span class="word-char">${word.word}</span>
            <input type="number" step="0.001" value="${word.start}" 
                   class="time-input" data-index="${index}" data-field="start"
                   onchange="updateTimestamp(${index}, 'start', this.value)">
            <span class="time-separator">-</span>
            <input type="number" step="0.001" value="${word.end}" 
                   class="time-input" data-index="${index}" data-field="end"
                   onchange="updateTimestamp(${index}, 'end', this.value)">
            <button class="btn-play-word" onclick="playWordSegment(${word.start}, ${word.end})">▶</button>
        `;
        editor.appendChild(row);
    });
}

// 【新增】更新时间戳
function updateTimestamp(index, field, value) {
    if (!window.currentClipData || !window.currentClipData.words) return;
    window.currentClipData.words[index][field] = parseFloat(value);
}

// 【新增】播放单个字的音频片段
function playWordSegment(start, end) {
    const audio = document.getElementById('previewAudio');
    audio.currentTime = start;
    audio.play();
    
    // 在结束时间停止
    const stopTimer = setInterval(() => {
        if (audio.currentTime >= end) {
            audio.pause();
            clearInterval(stopTimer);
        }
    }, 10);
}

// 【新增】关闭预览模态框
function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    if (modal) {
        modal.style.display = 'none';
        const audio = document.getElementById('previewAudio');
        if (audio) audio.pause();
    }
}

// 【新增】确认并保存
async function confirmAndSave() {
    if (!window.currentClipData) return;
    
    showLoading(true, '正在保存最终文件...');
    
    try {
        // 发送更新后的时间戳到后端
        const response = await fetch('/save_clip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                folder_name: window.currentClipData.folder_name,
                words: window.currentClipData.words,
                clip_info: window.currentClipData.clip_info
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closePreviewModal();
            showOutput(window.currentClipData);
            // alert('保存成功！');
        } else {
            alert('保存失败: ' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('保存错误:', error);
        alert('保存失败，请重试。');
    } finally {
        showLoading(false);
    }
}

// 【新增】清空所有选择状态
function clearSelection() {
    // 1. 清空数据集合
    selectedWords.clear();
    selectedSegments.clear();

    // 2. 恢复“按字”模式的样式
    document.querySelectorAll('.word-item').forEach(el => {
        el.style.borderColor = '#e2e8f0';
        el.style.background = '#f8fafc';
        el.style.boxShadow = 'none';
    });

    // 3. 恢复“按段”模式的样式
    document.querySelectorAll('.segment-item').forEach(el => {
        el.classList.remove('selected');
    });

    // 4. 更新底部的选中数量显示
    updateWordSelectionUI();
    updateSelectionUI();
}

// 显示输出结果（列表模式）
function showOutput(data) {
    const historySection = document.getElementById('clipHistorySection');
    const historyList = document.getElementById('clipHistoryList');
    
    historySection.style.display = 'block';
    
    // 创建一个新的列表项
    const item = document.createElement('div');
    item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center mb-2 border rounded';
    
    const textPreview = data.clip_info ? data.clip_info.text : '未知文字';
    const duration = typeof data === 'object' ? data.duration : (arguments[1] || 0);
    const zipFile = data.zip_filename;
    
    item.innerHTML = `
        <div class="flex-grow-1 mr-3">
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1 text-primary">📝 ${textPreview}</h6>
                <small class="text-muted">⏱️ ${duration.toFixed(2)}s</small>
            </div>
            <p class="mb-1 small text-secondary">文件夹：${data.folder_name || '已生成'}</p>
        </div>
        <div class="btn-group">
            <button class="btn btn-sm btn-success" onclick="window.location.href='/download/${zipFile}'">
                📦 下载 ZIP
            </button>
            ${data.json_filename ? `
                <button class="btn btn-sm btn-outline-primary" onclick="window.location.href='/download/${data.folder_name}/${data.json_filename}'">
                    📄 JSON
                </button>
            ` : ''}
        </div>
    `;
    
    // 插入到列表最前面
    historyList.insertBefore(item, historyList.firstChild);
    
    // 自动滚动到列表区
    historySection.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// 移除不再使用的旧函数
function backToEdit() {
    // 现在的模式不需要返回，编辑区一直可见
}

// 【新增】封装剪辑请求逻辑
async function requestClipRegion(filename, startTime, endTime, selectedIndices) {
    showLoading(true);
    try {
        const response = await fetch('/clip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: filename,
                start_time: startTime,
                end_time: endTime,
                selected_words: selectedIndices
            })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
        alert('剪辑请求失败');
        return null;
    } finally {
        showLoading(false);
    }
}

// 全局变量用于防抖
let adjustTimer = null;

// 【新增】调整剪辑范围（带防抖）
function adjustClipRange(deltaStart, deltaEnd) {
    if (!window.currentClipData || !window.currentClipData.meta) return;
    
    // 1. 立即更新本地元数据 (UI 响应)
    const meta = window.currentClipData.meta;
    meta.absoluteStartTime = Math.max(0, meta.absoluteStartTime + deltaStart);
    // 保持至少 0.1s 的时长，并确保结束时间不小于开始时间
    meta.absoluteEndTime = Math.max(meta.absoluteStartTime + 0.1, meta.absoluteEndTime + deltaEnd);
    
    // 2. 更新 UI 显示
    updateRangeDisplay(window.currentClipData);
    
    // 显示状态
    const timeInfoEl = document.getElementById('clipTimeInfo');
    if (timeInfoEl) {
        timeInfoEl.textContent = `待更新范围: ${meta.absoluteStartTime.toFixed(3)}s - ${meta.absoluteEndTime.toFixed(3)}s (处理中...)`;
        timeInfoEl.style.color = "#d97706"; // 橙色表示等待中
    }
    
    // 3. 防抖逻辑：清除之前的定时器
    if (adjustTimer) {
        clearTimeout(adjustTimer);
    }
    
    // 4. 设置新的定时器 (500ms 后执行请求)
    adjustTimer = setTimeout(async () => {
        if (timeInfoEl) timeInfoEl.textContent = "正在重新剪辑...";
        
        // 发送请求
        const newData = await requestClipRegion(meta.filename, meta.absoluteStartTime, meta.absoluteEndTime, meta.selectedIndices);
        
        if (newData && newData.success) {
            // 更新数据，但保持 meta 信息（因为我们刚刚修改了它）
            // 注意：需要把新的 filename 等可能变化的信息同步过来，保持一致性
            newData.meta = meta; 
            
            // 刷新界面
            showPreviewEditor(newData);
            
            // 成功提示
            if (timeInfoEl) {
                timeInfoEl.textContent = `当前范围: ${meta.absoluteStartTime.toFixed(3)}s - ${meta.absoluteEndTime.toFixed(3)}s`;
                timeInfoEl.style.color = "#64748b";
            }

            // 自动播放
            const audioPlayer = document.getElementById('previewAudio');
            if (audioPlayer) {
                audioPlayer.oncanplay = () => {
                    audioPlayer.play().catch(() => {});
                    audioPlayer.oncanplay = null;
                };
            }
        } else {
            alert("范围调整失败，请重试");
            // 应该回滚吗？暂时不回滚，允许再次尝试
        }
    }, 600); // 延迟 600ms
}

function updateRangeDisplay(clipData) {
    const timeInfoEl = document.getElementById('clipTimeInfo');
    if (timeInfoEl && clipData.meta) {
        timeInfoEl.textContent = `当前范围: ${clipData.meta.absoluteStartTime.toFixed(3)}s - ${clipData.meta.absoluteEndTime.toFixed(3)}s`;
    }
}

function resetApp() {
    if(confirm('确定要清除所有识别结果和列表吗？')) {
        window.location.reload();
    }
}
// 下面的代码已合并或不再需要


// 显示/隐藏加载状态
function showLoading(show, message = '正在处理音频，请稍候...', progress = 0) {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = overlay.querySelector('.loading-text');
    const progressBar = overlay.querySelector('.progress-bar');
    const progressText = overlay.querySelector('.progress-text');
    
    if (show) {
        overlay.classList.add('active');
        if (loadingText) loadingText.textContent = message;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${Math.round(progress)}%`;
    } else {
        overlay.classList.remove('active');
    }
}

// 格式化时间显示
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
