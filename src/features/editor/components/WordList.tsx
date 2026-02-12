import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { cn } from '@/shared/utils';

interface Word {
    id: number;
    start: number;
    end: number;
    word: string;
}

interface WordListProps {
    words: Word[];
}

export function WordList({ words }: WordListProps) {
    const { selectedSegments, toggleSegmentSelection, clearSelection, selectRange } = useEditorStore();
    const [isSelecting, setIsSelecting] = useState(false);
    const [startIndex, setStartIndex] = useState(-1);

    const handleMouseDown = (index: number, e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsSelecting(true);
        setStartIndex(index);

        if (!e.ctrlKey && !e.metaKey) {
            clearSelection();
        }

        toggleSegmentSelection(index.toString());
    };

    const handleMouseEnter = (index: number) => {
        if (isSelecting && startIndex !== -1) {
            selectRange(startIndex, index);
        }
    };

    const handleMouseUp = useCallback(() => {
        setIsSelecting(false);
        setStartIndex(-1);
    }, []);

    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseUp]);

    // Bulk select action in store would be better. Let's update the store.

    return (
        <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">识别结果</h3>
                <p className="text-sm text-gray-400 font-medium">按住左键拖拽可快速选择连续片段</p>
            </div>

            <div className="flex flex-wrap gap-1 leading-[2.5] select-none">
                {words.map((word, index) => {
                    const isSelected = selectedSegments.includes(index.toString());
                    return (
                        <span
                            key={index}
                            onMouseDown={(e) => handleMouseDown(index, e)}
                            onMouseEnter={() => handleMouseEnter(index)}
                            className={cn(
                                "px-2 py-1 border-2 rounded-md cursor-pointer transition-all text-lg",
                                isSelected
                                    ? "border-blue-500 bg-linear-to-br from-blue-600/20 to-purple-600/20 shadow-lg text-white"
                                    : "border-gray-800 bg-gray-900/50 text-gray-300 hover:border-blue-500/50"
                            )}
                            title={`${word.start.toFixed(3)}s - ${word.end.toFixed(3)}s`}
                        >
                            {word.word}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
