import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Plus, Trash2, GripVertical, Play, Pause, Download,
    Layers, ChevronUp, ChevronDown, Loader2, Music,
    X, Check, AlertCircle, Upload, FileAudio
} from 'lucide-react';
import { cn } from '@/shared/utils';
import { Button } from '@/shared/components/ui/Button';
import { editorService, ConcatenateSegment } from '../services/editorService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileOption {
    filename: string;
    label: string;
    duration: number;
}

interface SegmentItem extends ConcatenateSegment {
    id: string;
    displayName: string;
    sourceDuration: number;
    volume: number; // 确保包含 volume
}

interface AudioConcatEditorProps {
    /** 已处理完毕的文件列表（来自主编辑器） */
    availableFiles: FileOption[];
    onClose: () => void;
    onSaved?: (result: { folder_name: string; zip_filename: string; duration: number }) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
    if (!isFinite(sec) || sec < 0) return '0:00.00';
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
}

function uid(): string {
    return Math.random().toString(36).substring(2, 9);
}

// ─── Component ───────────────────────────────────────────────────────────────

export const AudioConcatEditor: React.FC<AudioConcatEditorProps> = ({
    availableFiles,
    onClose,
    onSaved,
}) => {
    // 所有可选文件（已处理 + 直接上传的 raw 文件）
    const [filePool, setFilePool] = useState<FileOption[]>(availableFiles);
    // 拼接片段列表
    const [segments, setSegments] = useState<SegmentItem[]>([]);

    const [outputLabel, setOutputLabel] = useState('concat');
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
    const [result, setResult] = useState<{ folder_name: string; zip_filename: string; duration: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultAudioRef = useRef<HTMLAudioElement>(null);
    const segAudioRefs = useRef<Record<string, HTMLAudioElement>>({});
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    // ── 直接上传 raw 音频 ──────────────────────────────────────────────────────
    const handleRawUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        e.target.value = '';

        for (const file of files) {
            const tempName = file.name;
            setUploadingFiles(prev => [...prev, tempName]);
            try {
                const res = await editorService.uploadRaw(file);
                const newFile: FileOption = {
                    filename: res.filename,
                    label: res.original_name,
                    duration: res.duration,
                };
                setFilePool(prev => [...prev, newFile]);
                // 自动添加到片段列表
                setSegments(prev => [...prev, {
                    id: uid(),
                    filename: res.filename,
                    displayName: res.original_name,
                    start_time: 0,
                    end_time: -1,
                    sourceDuration: res.duration,
                    label: res.original_name,
                    volume: 1.0,
                }]);
                setResult(null);
                setError(null);
            } catch (err: any) {
                setError(`上传失败：${file.name} — ${err.message}`);
            } finally {
                setUploadingFiles(prev => prev.filter(n => n !== tempName));
            }
        }
    };

    // ── 从已有文件池添加片段 ───────────────────────────────────────────────────
    const addSegmentFromPool = (file: FileOption) => {
        setSegments(prev => [...prev, {
            id: uid(),
            filename: file.filename,
            displayName: file.label,
            start_time: 0,
            end_time: -1,
            sourceDuration: file.duration,
            label: file.label,
            volume: 1.0,
        }]);
        setResult(null);
        setError(null);
    };

    // ── 删除片段 ───────────────────────────────────────────────────────────────
    const removeSegment = (id: string) => {
        setSegments(prev => prev.filter(s => s.id !== id));
        setResult(null);
    };

    // ── 调整时间 ───────────────────────────────────────────────────────────────
    const updateTime = (id: string, field: 'start_time' | 'end_time', value: number) => {
        setSegments(prev => prev.map(s => {
            if (s.id !== id) return s;
            const maxEnd = s.sourceDuration > 0 ? s.sourceDuration : 9999;
            let updated = { ...s };
            if (field === 'start_time') {
                updated.start_time = Math.max(0, Math.min(value, maxEnd - 0.05));
                if (updated.end_time >= 0 && updated.end_time <= updated.start_time) {
                    updated.end_time = Math.min(updated.start_time + 0.5, maxEnd);
                }
            } else {
                updated.end_time = Math.min(Math.max(value, updated.start_time + 0.05), maxEnd);
            }
            return updated;
        }));
        setResult(null);
    };

    // ── 调整音量 ───────────────────────────────────────────────────────────────
    const updateVolume = (id: string, value: number) => {
        setSegments(prev => prev.map(s => (s.id === id ? { ...s, volume: Math.max(0, Math.min(value, 3.0)) } : s)));
        setResult(null);
    };

    // ── 拖拽排序 ───────────────────────────────────────────────────────────────
    const onDragStart = (i: number) => { dragItem.current = i; };
    const onDragEnter = (i: number, id: string) => { dragOverItem.current = i; setDragOverId(id); };
    const onDragEnd = () => {
        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
            dragItem.current = null; dragOverItem.current = null; setDragOverId(null); return;
        }
        const arr = [...segments];
        const [moved] = arr.splice(dragItem.current, 1);
        arr.splice(dragOverItem.current, 0, moved);
        setSegments(arr);
        dragItem.current = null; dragOverItem.current = null; setDragOverId(null);
    };

    // ── 上移/下移 ─────────────────────────────────────────────────────────────
    const move = (i: number, dir: -1 | 1) => {
        const arr = [...segments];
        const t = i + dir;
        if (t < 0 || t >= arr.length) return;
        [arr[i], arr[t]] = [arr[t], arr[i]];
        setSegments(arr);
    };

    // ── 试听单段 ──────────────────────────────────────────────────────────────
    const previewSeg = (seg: SegmentItem) => {
        const audio = segAudioRefs.current[seg.id];
        if (!audio) return;
        if (playingId === seg.id) { audio.pause(); setPlayingId(null); return; }
        Object.values(segAudioRefs.current).forEach(a => a?.pause());
        audio.currentTime = seg.start_time;
        audio.play();
        setPlayingId(seg.id);
        const endTime = seg.end_time >= 0 ? seg.end_time : Infinity;
        const checkEnd = () => {
            if (audio.currentTime >= endTime) { audio.pause(); setPlayingId(null); audio.removeEventListener('timeupdate', checkEnd); }
        };
        audio.addEventListener('timeupdate', checkEnd);
        audio.addEventListener('ended', () => setPlayingId(null), { once: true });
    };

    // ── 开始拼接 ──────────────────────────────────────────────────────────────
    const handleConcatenate = async () => {
        if (!segments.length) return;
        setIsProcessing(true); setError(null); setResult(null);
        try {
            const res = await editorService.concatenateSegments({
                segments: segments.map(s => ({
                    filename: s.filename,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    label: s.label,
                    volume: s.volume,
                })),
                output_label: outputLabel || 'concat',
            });
            setResult({ folder_name: res.folder_name, zip_filename: res.zip_filename, duration: res.duration });
        } catch (err: any) {
            setError(err.message || '拼接失败，请重试');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = () => {
        if (!result) return;
        onSaved?.(result);
        onClose();
    };

    const totalDuration = segments.reduce((sum, s) => {
        const d = s.end_time >= 0 ? (s.end_time - s.start_time) : Math.max(0, s.sourceDuration - s.start_time);
        return sum + Math.max(0, d);
    }, 0);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-linear-to-r from-indigo-900/30 to-purple-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/15 rounded-lg">
                            <Layers className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">音频拼接编辑器</h3>
                            <p className="text-xs text-gray-400">上传或选择文件 · 拖拽排序 · 精确时间裁剪 · 一键合并</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto">

                    {/* 输出名称 & 总时长 */}
                    <div className="px-6 pt-5 pb-3 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 flex-1 min-w-40">
                            <span className="text-xs text-gray-400 whitespace-nowrap">输出名称</span>
                            <input
                                type="text"
                                value={outputLabel}
                                onChange={e => setOutputLabel(e.target.value)}
                                placeholder="concat"
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">预估时长:</span>
                            <span className="font-mono text-indigo-300 font-semibold">{fmtTime(totalDuration)}</span>
                            <span className="text-gray-500">共 {segments.length} 段</span>
                        </div>
                    </div>

                    {/* ── 快速上传区域 ── */}
                    <div className="px-6 pb-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".mp3,.wav,.ogg,.m4a,.flac"
                            multiple
                            onChange={handleRawUpload}
                            className="hidden"
                        />

                        {/* Drop zone / upload trigger */}
                        <div
                            className="relative border-2 border-dashed border-indigo-500/40 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-400/70 hover:bg-indigo-500/5 transition-all group"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={e => e.preventDefault()}
                            onDrop={async e => {
                                e.preventDefault();
                                const files = Array.from(e.dataTransfer.files).filter(f =>
                                    /\.(mp3|wav|ogg|m4a|flac)$/i.test(f.name)
                                );
                                if (!files.length) return;
                                // Fake input change
                                const dt = new DataTransfer();
                                files.forEach(f => dt.items.add(f));
                                if (fileInputRef.current) {
                                    Object.defineProperty(fileInputRef.current, 'files', { value: dt.files, configurable: true });
                                    handleRawUpload({ target: fileInputRef.current } as any);
                                }
                            }}
                        >
                            {uploadingFiles.length > 0 ? (
                                <div className="flex items-center justify-center gap-2 text-indigo-400">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="text-sm">正在上传 {uploadingFiles.length} 个文件...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-3 text-gray-400 group-hover:text-indigo-300 transition-colors">
                                    <Upload className="w-5 h-5 flex-shrink-0" />
                                    <div className="text-left">
                                        <p className="text-sm font-medium">拖拽或点击上传音频</p>
                                        <p className="text-xs opacity-60 mt-0.5">MP3、WAV、OGG、M4A、FLAC · 可多选 · 上传后自动加入片段列表</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 已有文件池（来自主编辑器处理完毕的文件） */}
                        {filePool.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-2">或从已有文件中添加：</p>
                                <div className="flex flex-wrap gap-2">
                                    {filePool.map(f => (
                                        <button
                                            key={f.filename}
                                            onClick={() => addSegmentFromPool(f)}
                                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500/50 rounded-full text-gray-300 hover:text-indigo-300 transition-all"
                                        >
                                            <FileAudio className="w-3 h-3" />
                                            <span className="max-w-[160px] truncate">{f.label}</span>
                                            <span className="text-gray-500 font-mono">{fmtTime(f.duration)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── 片段列表 ── */}
                    <div className="px-6 pb-4 space-y-2">
                        {segments.length === 0 ? (
                            <div className="border-2 border-dashed border-gray-800 rounded-xl p-8 text-center">
                                <Music className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                                <p className="text-gray-600 text-sm">上传音频后自动出现在这里</p>
                            </div>
                        ) : (
                            segments.map((seg, idx) => {
                                const maxEnd = seg.sourceDuration > 0 ? seg.sourceDuration : 999;
                                const currentEnd = seg.end_time < 0 ? maxEnd : seg.end_time;
                                const segDur = Math.max(0, currentEnd - seg.start_time);
                                const isOver = dragOverId === seg.id;

                                return (
                                    <div
                                        key={seg.id}
                                        draggable
                                        onDragStart={() => onDragStart(idx)}
                                        onDragEnter={() => onDragEnter(idx, seg.id)}
                                        onDragEnd={onDragEnd}
                                        onDragOver={e => e.preventDefault()}
                                        className={[
                                            'rounded-xl border transition-all duration-150',
                                            isOver
                                                ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                                                : 'border-gray-700/60 bg-gray-800/40 hover:border-gray-600',
                                        ].join(' ')}
                                    >
                                        {/* Hidden audio */}
                                        <audio
                                            ref={el => { if (el) segAudioRefs.current[seg.id] = el; }}
                                            src={`/uploads/${seg.filename}`}
                                            preload="none"
                                            className="hidden"
                                        />

                                        {/* Row: drag | index | name | dur | preview | move | del */}
                                        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                                            <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 px-0.5">
                                                <GripVertical className="w-4 h-4" />
                                            </div>
                                            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{seg.displayName}</p>
                                            </div>
                                            <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                                {fmtTime(segDur)}
                                            </span>
                                            <button onClick={() => previewSeg(seg)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-400/10 transition-colors flex-shrink-0" title="试听">
                                                {playingId === seg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            </button>
                                            <div className="flex flex-col gap-0.5 flex-shrink-0">
                                                <button onClick={() => move(idx, -1)} disabled={idx === 0}
                                                    className="p-0.5 rounded text-gray-500 hover:text-gray-300 disabled:opacity-20 transition-colors">
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => move(idx, 1)} disabled={idx === segments.length - 1}
                                                    className="p-0.5 rounded text-gray-500 hover:text-gray-300 disabled:opacity-20 transition-colors">
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <button onClick={() => removeSegment(seg.id)}
                                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0" title="删除">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Time editors */}
                                        <div className="grid grid-cols-2 gap-4 px-4 pb-4">
                                            {/* Start */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-500">起始</span>
                                                    <span className="text-xs font-mono text-gray-400">{fmtTime(seg.start_time)}</span>
                                                </div>
                                                <input type="range" min={0} max={maxEnd} step={0.05} value={seg.start_time}
                                                    onChange={e => updateTime(seg.id, 'start_time', +e.target.value)}
                                                    className="w-full accent-indigo-500 h-1.5 rounded-full cursor-pointer" />
                                                <div className="flex gap-1">
                                                    {[-0.1, -0.05, +0.05, +0.1].map(d => (
                                                        <button key={d}
                                                            onClick={() => updateTime(seg.id, 'start_time', seg.start_time + d)}
                                                            className="flex-1 text-[11px] py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors">
                                                            {d > 0 ? `+${d}` : d}s
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* End */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-500">结束</span>
                                                    <span className="text-xs font-mono text-gray-400">{seg.end_time < 0 ? '末尾' : fmtTime(seg.end_time)}</span>
                                                </div>
                                                <input type="range" min={seg.start_time} max={maxEnd} step={0.05} value={currentEnd}
                                                    onChange={e => updateTime(seg.id, 'end_time', +e.target.value)}
                                                    className="w-full accent-purple-500 h-1.5 rounded-full cursor-pointer" />
                                                <div className="flex gap-1">
                                                    {[-0.1, -0.05, +0.05, +0.1].map(d => (
                                                        <button key={d}
                                                            onClick={() => updateTime(seg.id, 'end_time', currentEnd + d)}
                                                            className="flex-1 text-[11px] py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors">
                                                            {d > 0 ? `+${d}` : d}s
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Volume Control */}
                                        <div className="px-4 pb-4 border-t border-gray-700/30 pt-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-400">片段音量</span>
                                                    <span className={cn(
                                                        "text-xs font-bold px-1.5 py-0.5 rounded",
                                                        seg.volume > 1 ? "text-orange-400 bg-orange-400/10" : "text-indigo-300 bg-indigo-500/10"
                                                    )}>
                                                        {Math.round(seg.volume * 100)}%
                                                    </span>
                                                </div>
                                                <div className="flex gap-1">
                                                    {[0.5, 1.0, 1.5, 2.0].map(v => (
                                                        <button
                                                            key={v}
                                                            onClick={() => updateVolume(seg.id, v)}
                                                            className={cn(
                                                                "text-[10px] px-2 py-0.5 rounded transition-colors",
                                                                seg.volume === v 
                                                                    ? "bg-indigo-600 text-white" 
                                                                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                                                            )}
                                                        >
                                                            {v}x
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <input 
                                                type="range" 
                                                min={0} 
                                                max={3} 
                                                step={0.1} 
                                                value={seg.volume}
                                                onChange={e => updateVolume(seg.id, +e.target.value)}
                                                className="w-full accent-indigo-500 h-1.5 rounded-full cursor-pointer" 
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mx-6 mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className="mx-6 mb-5 p-4 bg-green-500/10 border border-green-500/30 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 text-green-400">
                                <Check className="w-4 h-4" />
                                <span className="text-sm font-medium">拼接完成！总时长 {fmtTime(result.duration)}</span>
                            </div>
                            <audio
                                key={result.folder_name}
                                ref={resultAudioRef}
                                src={`/api/stream_output/${result.folder_name}/audio.mp3`}
                                controls
                                className="w-full h-10"
                            />
                            <div className="flex gap-2">
                                <Button variant="secondary" size="sm"
                                    className="gap-1.5 border border-green-500/40 text-green-400 hover:bg-green-500/10"
                                    onClick={() => window.open(`/download/${result.zip_filename}`)}>
                                    <Download className="w-3.5 h-3.5" /> 下载 ZIP
                                </Button>
                                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-500" onClick={handleSave}>
                                    <Check className="w-3.5 h-3.5" /> 保存到历史
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between gap-4">
                    <Button variant="secondary" onClick={onClose} disabled={isProcessing}>关闭</Button>
                    <Button
                        onClick={handleConcatenate}
                        disabled={segments.length < 1 || isProcessing}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 disabled:opacity-40"
                    >
                        {isProcessing
                            ? <><Loader2 className="w-4 h-4 animate-spin" />正在拼接...</>
                            : <><Layers className="w-4 h-4" />开始拼接 ({segments.length} 段)</>}
                    </Button>
                </div>
            </div>
        </div>
    );
};
