import React from 'react';
import { useEditorStore } from '../store/editorStore';
import { cn, formatDuration } from '@/shared/utils';
import { Play, CheckCircle2 } from 'lucide-react';

export function SegmentList() {
    const { files, selectedFileId, selectedSegments, toggleSegmentSelection } = useEditorStore();

    const selectedFile = files.find((f) => f.id === selectedFileId);

    if (!selectedFile || !selectedFile.segments) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">文字片段 ({selectedFile.segments.length})</h3>
                <p className="text-sm text-gray-400">点击选择要剪辑的片段</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedFile.segments.map((segment) => {
                    const isSelected = selectedSegments.includes(segment.id);

                    return (
                        <div
                            key={segment.id}
                            onClick={() => toggleSegmentSelection(segment.id)}
                            className={cn(
                                "glass-panel p-4 cursor-pointer transition-all border-2",
                                isSelected
                                    ? "border-blue-500 bg-blue-600/10"
                                    : "border-gray-800 hover:border-gray-600"
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-mono text-gray-400">
                                    {formatDuration(segment.start)} - {formatDuration(segment.end)}
                                </span>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                            </div>
                            <p className={cn(
                                "text-sm leading-relaxed",
                                isSelected ? "text-white" : "text-gray-300"
                            )}>
                                {segment.text}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
