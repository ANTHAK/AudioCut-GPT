import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Save, RotateCcw, ChevronLeft, ChevronRight, FastForward, Rewind } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { editorService, ClipResponse } from '../services/editorService';

interface Word {
    word: string;
    start: number;
    end: number;
}

interface ClipEditorProps {
    clipData: ClipResponse & { meta?: any };
    onClose: () => void;
    onSave: (data: any) => void;
}

export const ClipEditor: React.FC<ClipEditorProps> = ({ clipData, onClose, onSave }) => {
    const [currentData, setCurrentData] = useState(clipData);
    const [words, setWords] = useState<Word[]>(clipData.words || []);
    const [isProcessing, setIsProcessing] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [timeInfo, setTimeInfo] = useState('');

    useEffect(() => {
        if (currentData.meta) {
            setTimeInfo(`当前范围: ${currentData.meta.absoluteStartTime.toFixed(3)}s - ${currentData.meta.absoluteEndTime.toFixed(3)}s`);
        }
    }, [currentData]);

    const handleAdjustRange = async (deltaStart: number, deltaEnd: number) => {
        if (!currentData.meta || isProcessing) return;

        const newStart = Math.max(0, currentData.meta.absoluteStartTime + deltaStart);
        const newEnd = Math.max(newStart + 0.1, currentData.meta.absoluteEndTime + deltaEnd);

        setIsProcessing(true);
        try {
            const response = await editorService.clipAudio({
                filename: currentData.meta.filename,
                start_time: newStart,
                end_time: newEnd,
                selected_words: currentData.meta.selectedIndices
            });

            if (response.success) {
                const updatedData = {
                    ...response,
                    meta: {
                        ...currentData.meta,
                        absoluteStartTime: newStart,
                        absoluteEndTime: newEnd
                    }
                };
                setCurrentData(updatedData);
                setWords(response.words);
                if (audioRef.current) {
                    audioRef.current.src = `/download/${response.folder_name}/audio.mp3`;
                    audioRef.current.load();
                }
            }
        } catch (error) {
            console.error('Adjust range failed', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateWord = (index: number, field: 'start' | 'end', value: string) => {
        const newWords = [...words];
        newWords[index] = { ...newWords[index], [field]: parseFloat(value) || 0 };
        setWords(newWords);
    };

    const playWord = (start: number, end: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = start;
            audioRef.current.play();

            const checkEnd = () => {
                if (audioRef.current && audioRef.current.currentTime >= end) {
                    audioRef.current.pause();
                    audioRef.current.removeEventListener('timeupdate', checkEnd);
                }
            };

            audioRef.current.addEventListener('timeupdate', checkEnd);
        }
    };

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            const response = await editorService.saveClip({
                folder_name: currentData.folder_name,
                words: words,
                clip_info: currentData.clip_info
            });

            if (response.success) {
                onSave({
                    ...currentData,
                    words: words,
                    zip_filename: `${currentData.folder_name}.zip`
                });
            }
        } catch (error) {
            console.error('Save failed', error);
            alert('保存失败，请重试');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Play className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white">预览与编辑</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Audio Player and Range Adjustment */}
                    <div className="space-y-4">
                        <div className="bg-black/40 p-6 rounded-xl border border-gray-800 shadow-inner">
                            <h4 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">试听与剪辑范围</h4>
                            <audio
                                ref={audioRef}
                                src={`/download/${currentData.folder_name}/audio.mp3`}
                                controls
                                className="w-full h-12 mb-6"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                                {/* Start Adjustment */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-500 uppercase">起始点微调</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => handleAdjustRange(-0.1, 0)} className="flex-1 bg-gray-800 hover:bg-gray-700">
                                            <Rewind className="w-3 h-3 mr-1" /> -0.1s
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleAdjustRange(-0.05, 0)} className="flex-1 bg-gray-800 hover:bg-gray-700">
                                            -0.05
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleAdjustRange(0.05, 0)} className="flex-1 bg-gray-800 hover:bg-gray-700">
                                            +0.05
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleAdjustRange(0.1, 0)} className="flex-1 bg-gray-800 hover:bg-gray-700">
                                            +0.1s <FastForward className="w-3 h-3 ml-1" />
                                        </Button>
                                    </div>
                                </div>

                                {/* End Adjustment */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-500 uppercase">结束点微调</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => handleAdjustRange(0, -0.1)} className="flex-1 bg-gray-800 hover:bg-gray-700">
                                            <Rewind className="w-3 h-3 mr-1" /> -0.1s
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleAdjustRange(0, -0.05)} className="flex-1 bg-gray-800 hover:bg-gray-700">
                                            -0.05
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleAdjustRange(0, 0.05)} className="flex-1 bg-gray-800 hover:bg-gray-700">
                                            +0.05
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleAdjustRange(0, 0.1)} className="flex-1 bg-gray-800 hover:bg-gray-700">
                                            +0.1s <FastForward className="w-3 h-3 ml-1" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="md:col-span-2 text-right">
                                    <span className="text-xs font-mono text-gray-400 bg-black/20 px-2 py-1 rounded">
                                        {timeInfo}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Word Timestamps */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">字级别时间戳调整</h4>
                            <div className="text-xs text-blue-400 flex items-center gap-1">
                                <RotateCcw className="w-3 h-3" />
                                自动同步
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {words.map((word, index) => (
                                <div key={index} className="flex items-center gap-2 p-3 bg-gray-800/40 rounded-xl border border-gray-700/50 hover:bg-gray-800/60 transition-colors group">
                                    <div className="w-8 h-8 flex items-center justify-center bg-blue-500/10 rounded-lg text-blue-400 font-bold">
                                        {word.word}
                                    </div>
                                    <div className="flex-1 flex items-center gap-1 min-w-0">
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={word.start}
                                            onChange={(e) => handleUpdateWord(index, 'start', e.target.value)}
                                            className="w-full bg-black/30 border-none rounded p-1 text-xs text-center text-gray-300 focus:ring-1 focus:ring-blue-500 tabular-nums"
                                        />
                                        <span className="text-gray-600">-</span>
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={word.end}
                                            onChange={(e) => handleUpdateWord(index, 'end', e.target.value)}
                                            className="w-full bg-black/30 border-none rounded p-1 text-xs text-center text-gray-300 focus:ring-1 focus:ring-blue-500 tabular-nums"
                                        />
                                    </div>
                                    <button
                                        onClick={() => playWord(word.start, word.end)}
                                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex items-center justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
                        取消
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                    >
                        {isProcessing ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                正在保存...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Save className="w-4 h-4" />
                                确认并保存
                            </div>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
