import React, { useState } from 'react';
import { UploadBox } from './UploadBox';
import { WordList } from './WordList';
import { SegmentList } from './SegmentList';
import { useEditorStore } from '../store/editorStore';
import { ClipEditor } from './ClipEditor';
import { editorService, ClipResponse } from '../services/editorService';
import { Button } from '@/shared/components/ui/Button';
import { Loader2, Scissors, History, Download, FileAudio, ExternalLink } from 'lucide-react';

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
        setProcessing
    } = useEditorStore();

    const [clipResult, setClipResult] = useState<{ url: string; filename: string } | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [editorData, setEditorData] = useState<(ClipResponse & { meta?: any }) | null>(null);

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
                            updateFile(tempId, { status: 'error' });
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
        setShowEditor(false);
    };

    const selectedFile = files.find(f => f.id === selectedFileId);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {showEditor && editorData && (
                <ClipEditor
                    clipData={editorData}
                    onClose={() => setShowEditor(false)}
                    onSave={handleSaveEditor}
                />
            )}
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

                                <div className="flex gap-4">
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
                </div>
            )}

            <div className="mt-12 opacity-50">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <History className="w-5 h-5" />
                    剪辑历史
                </h3>
                <p className="text-gray-500 italic">历史记录功能将在下一版本上线...</p>
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
