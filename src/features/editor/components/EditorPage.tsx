import React, { useState } from 'react';
import { UploadBox } from './UploadBox';
import { WordList } from './WordList';
import { SegmentList } from './SegmentList';
import { useEditorStore } from '../store/editorStore';
import { ClipEditor } from './ClipEditor';
import { AudioConcatEditor } from './AudioConcatEditor';
import { editorService, ClipResponse } from '../services/editorService';
import { Button } from '@/shared/components/ui/Button';
import { Loader2, Scissors, History, Download, FileAudio, ExternalLink, Layers } from 'lucide-react';

export function EditorPage() {
    const {
        files,
        addFiles,
        updateFile,
        selectedFileId,
        setSelectedFile,
        selectedSegments,
        progress,
        setProgress,
        isProcessing,
        setProcessing,
        history,
        addToHistory,
        clearSelection
    } = useEditorStore();

    const [clipResult, setClipResult] = useState<{ url: string; filename: string } | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [editorData, setEditorData] = useState<(ClipResponse & { meta?: any }) | null>(null);
    const [showConcatEditor, setShowConcatEditor] = useState(false);

    const handleUpload = async (uploadedFiles: File[]) => {
        setProcessing(true);
        setProgress(0);

        for (const file of uploadedFiles) {
            try {
                const tempId = Math.random().toString(36).substring(7);
                const initialFile = {
                    id: tempId,
                    name: file.name,
                    url: '',
                    status: 'uploading' as const,
                };
                addFiles([initialFile]);
                setSelectedFile(tempId);

                const response = await editorService.uploadAudio(file);

                const pollProgress = setInterval(async () => {
                    try {
                        const status = await editorService.getProgress(response.task_id);
                        setProgress(status.progress);

                        if (status.status === 'completed' && status.result) {
                            clearInterval(pollProgress);
                            updateFile(tempId, {
                                status: 'done',
                                name: status.result.filename,
                                segments: status.result.segments,
                                words: status.result.words,
                                full_text: status.result.text,
                            });
                            setProcessing(false);
                        } else if (status.status === 'error') {
                            clearInterval(pollProgress);
                            updateFile(tempId, {
                                status: 'error',
                                error: status.message || status.error || 'Unknown error occurred'
                            });
                            setProcessing(false);
                        }
                    } catch (err) {
                        clearInterval(pollProgress);
                        setProcessing(false);
                    }
                }, 1000);

            } catch (error) {
                console.error('Upload failed', error);
                setProcessing(false);
            }
        }
    };

    const handleClip = async () => {
        const selectedFile = files.find(f => f.id === selectedFileId);
        if (!selectedFile || selectedSegments.length === 0) return;

        setProcessing(true);
        try {
            let startTime = 0;
            let endTime = 0;
            let selectedIndices: number[] = [];

            if (selectedFile.words && selectedFile.words.length > 0) {
                selectedIndices = selectedSegments.map(Number).sort((a, b) => a - b);
                startTime = selectedFile.words[selectedIndices[0]].start;
                endTime = selectedFile.words[selectedIndices[selectedIndices.length - 1]].end;
            } else if (selectedFile.segments && selectedFile.segments.length > 0) {
                selectedIndices = selectedSegments.map(Number).sort((a, b) => a - b);
                startTime = selectedFile.segments[selectedIndices[0]].start;
                endTime = selectedFile.segments[selectedIndices[selectedIndices.length - 1]].end;
            }

            const response = await editorService.clipAudio({
                filename: selectedFile.name,
                start_time: startTime,
                end_time: endTime,
                selected_words: selectedIndices
            });

            if (response.success) {
                setEditorData({
                    ...response,
                    meta: {
                        filename: selectedFile.name,
                        absoluteStartTime: startTime,
                        absoluteEndTime: endTime,
                        selectedIndices: selectedIndices
                    }
                });
                setShowEditor(true);

                setClipResult({
                    url: `/download/${response.zip_filename}`,
                    filename: response.zip_filename
                });
            }
        } catch (error) {
            console.error('Clipping failed', error);
        } finally {
            setProcessing(false);
        }
    };

    const handleSaveEditor = (finalData: any) => {
        setClipResult({
            url: `/download/${finalData.zip_filename}`,
            filename: finalData.zip_filename
        });

        // Add to history
        addToHistory({
            id: Math.random().toString(36).substring(7),
            folder_name: finalData.folder_name,
            zip_filename: finalData.zip_filename,
            json_filename: finalData.json_filename,
            text: finalData.clip_info?.text || '未知文字',
            duration: finalData.duration,
            timestamp: new Date()
        });

        setShowEditor(false);
        clearSelection();
    };

    const selectedFile = files.find(f => f.id === selectedFileId);

    // 构建可用文件列表（仅 done 状态），duration 从 segments 最后一个计算
    const availableFilesForConcat = files
        .filter(f => f.status === 'done')
        .map(f => {
            const lastSeg = f.segments?.[f.segments.length - 1];
            const lastWord = f.words?.[f.words.length - 1];
            const duration = lastWord?.end ?? lastSeg?.end ?? 0;
            return { filename: f.name, label: f.name, duration };
        });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {showEditor && editorData && (
                <ClipEditor
                    clipData={editorData}
                    onClose={() => setShowEditor(false)}
                    onSave={handleSaveEditor}
                />
            )}
            {showConcatEditor && (
                <AudioConcatEditor
                    availableFiles={availableFilesForConcat}
                    onClose={() => setShowConcatEditor(false)}
                    onSaved={(result) => {
                        addToHistory({
                            id: Math.random().toString(36).substring(7),
                            folder_name: result.folder_name,
                            zip_filename: result.zip_filename,
                            json_filename: undefined,
                            text: `[拼接] ${result.folder_name}`,
                            duration: result.duration,
                            timestamp: new Date()
                        });
                    }}
                />
            )}

            {/* 音频拼接快捷入口 — 始终可见 */}
            <div
                className="glass-panel p-5 flex items-center justify-between border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer group"
                onClick={() => setShowConcatEditor(true)}
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                        <Layers className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">音频拼接</h3>
                        <p className="text-sm text-gray-400 mt-0.5">上传多段音频，自由排序 · 精确裁剪 · 一键合并导出</p>
                    </div>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 flex-shrink-0"
                    onClick={e => { e.stopPropagation(); setShowConcatEditor(true); }}
                >
                    <Layers className="w-4 h-4" />
                    打开编辑器
                </Button>
            </div>

            {!selectedFile || selectedFile.status === 'idle' ? (
                <UploadBox onUpload={handleUpload} />
            ) : (
                <div className="space-y-8">
                    <div className="glass-panel p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {selectedFile.status === 'processing' || selectedFile.status === 'uploading' ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                ) : (
                                    <AudioIcon className="w-5 h-5 text-blue-500" />
                                )}
                                {selectedFile.name}
                            </h2>
                            <Button variant="outline" size="sm" onClick={() => setSelectedFile(null)}>
                                重新上传
                            </Button>
                        </div>

                        {(isProcessing || selectedFile.status === 'processing' || selectedFile.status === 'uploading') && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-gray-400">
                                    <span>正在处理中...</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-blue-600 h-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedFile.status === 'done' && (
                        <>
                            <div className="glass-panel p-6">
                                <h3 className="text-lg font-semibold mb-3">完整文本</h3>
                                <p className="text-gray-300 leading-relaxed bg-gray-900/50 p-4 rounded-md">
                                    {selectedFile.full_text}
                                </p>
                            </div>

                            {selectedFile.words && selectedFile.words.length > 0 ? (
                                <WordList words={selectedFile.words} />
                            ) : (
                                <SegmentList />
                            )}

                            <div className="sticky bottom-8 glass-panel p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-blue-500/30 shadow-2xl">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-full text-sm font-medium">
                                        已选择 {selectedSegments.length} 个片段
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        className="gap-2 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/10"
                                        onClick={() => setShowConcatEditor(true)}
                                    >
                                        <Layers className="w-5 h-5" />
                                        音频拼接
                                    </Button>

                                    <Button
                                        variant="default"
                                        size="lg"
                                        className="gap-2"
                                        disabled={selectedSegments.length === 0 || isProcessing}
                                        onClick={handleClip}
                                    >
                                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scissors className="w-5 h-5" />}
                                        生成剪辑
                                    </Button>

                                    {clipResult && (
                                        <Button
                                            variant="secondary"
                                            size="lg"
                                            className="gap-2 border border-green-500/50 text-green-400 hover:bg-green-500/10"
                                            onClick={() => window.open(clipResult.url)}
                                        >
                                            <Download className="w-5 h-5" />
                                            下载结果
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                    {selectedFile.status === 'error' && (
                        <div className="glass-panel p-6 border-red-500/50 bg-red-500/10">
                            <h3 className="text-lg font-bold text-red-400 mb-2">处理失败</h3>
                            <p className="text-gray-300">{selectedFile.error || '发生未知错误，请稍后重试。'}</p>
                            <Button
                                variant="outline"
                                className="mt-4 border-red-500/30 hover:bg-red-500/20 text-red-300"
                                onClick={() => setSelectedFile(null)}
                            >
                                重新上传
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-12">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-400" />
                    剪辑历史
                </h3>
                {history.length > 0 ? (
                    <div className="space-y-4">
                        {history.map((item) => (
                            <div key={item.id} className="glass-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-white/5 hover:border-blue-500/30 transition-all group">
                                <div className="flex-grow">
                                    <h4 className="font-medium text-blue-400 mb-1 flex items-center gap-2">
                                        <FileAudio className="w-4 h-4" />
                                        {item.text}
                                    </h4>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span>⏱️ {item.duration.toFixed(2)}s</span>
                                        <span>📅 {item.timestamp.toLocaleString()}</span>
                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">📁 {item.folder_name}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="gap-1 border border-green-500/30 text-green-400 hover:bg-green-500/10"
                                        onClick={() => window.open(`/download/${item.zip_filename}`)}
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        ZIP
                                    </Button>
                                    {item.json_filename && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1 border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
                                            onClick={() => window.open(`/download/${item.folder_name}/${item.json_filename}`)}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            JSON
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass-panel p-12 text-center border-dashed border-white/10">
                        <History className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-20" />
                        <p className="text-gray-500">暂无剪辑处理记录</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function AudioIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            width="24" height="24"
            viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
            <path d="M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M2 19a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0v-4a6 6 0 0 1 12 0v4a2 2 0 1 1-4 0v-1a2 2 0 1 1 4 0" />
        </svg>
    );
}
