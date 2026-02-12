import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils';

interface UploadBoxProps {
    onUpload: (files: File[]) => void;
    className?: string;
}

export function UploadBox({ onUpload, className }: UploadBoxProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onUpload(Array.from(e.target.files));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onUpload(Array.from(e.dataTransfer.files));
        }
    };

    return (
        <div
            className={cn(
                "glass-panel p-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-700 hover:border-blue-500 transition-colors cursor-pointer",
                className
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                multiple
                className="hidden"
            />
            <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">拖拽音频文件到这里</h3>
            <p className="text-gray-400 mb-6">或者点击选择文件</p>
            <Button variant="default">
                选择文件
            </Button>
            <p className="text-xs text-gray-500 mt-4">
                支持格式: MP3, WAV, OGG, M4A, FLAC (最大100MB)
            </p>
        </div>
    );
}
