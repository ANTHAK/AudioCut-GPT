import { create } from 'zustand';

interface AudioSegment {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface UploadedFile {
  name: string;
  id: string;
  url: string;
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
  segments?: AudioSegment[];
  words?: any[]; // Word level timestamps
  full_text?: string;
  error?: string;
}

export interface HistoryItem {
  id: string;
  folder_name: string;
  zip_filename: string;
  json_filename?: string;
  text: string;
  duration: number;
  timestamp: Date;
}

interface EditorState {
  files: UploadedFile[];
  selectedFileId: string | null;
  selectedSegments: string[]; // Segment IDs
  progress: number;
  isProcessing: boolean;
  history: HistoryItem[];
  
  // Actions
  addFiles: (files: UploadedFile[]) => void;
  updateFile: (id: string, updates: Partial<UploadedFile>) => void;
  setSelectedFile: (id: string | null) => void;
  toggleSegmentSelection: (id: string) => void;
  selectRange: (start: number, end: number) => void;
  clearSelection: () => void;
  setProgress: (progress: number) => void;
  setProcessing: (isProcessing: boolean) => void;
  addToHistory: (item: HistoryItem) => void;
  reset: () => void;
}

const initialState = {
  files: [],
  selectedFileId: null,
  selectedSegments: [],
  progress: 0,
  isProcessing: false,
  history: [],
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,

  addFiles: (newFiles) => set((state) => ({ 
    files: [...state.files, ...newFiles] 
  })),

  updateFile: (id, updates) => set((state) => ({
    files: state.files.map((f) => f.id === id ? { ...f, ...updates } : f)
  })),

  setSelectedFile: (id) => set({ selectedFileId: id }),

  toggleSegmentSelection: (id) => set((state) => ({
    selectedSegments: state.selectedSegments.includes(id)
      ? state.selectedSegments.filter((s) => s !== id)
      : [...state.selectedSegments, id]
  })),

  selectRange: (start, end) => set((state) => {
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    const range = Array.from({ length: max - min + 1 }, (_, i) => (min + i).toString());
    return { selectedSegments: range };
  }),

  clearSelection: () => set({ selectedSegments: [] }),

  setProgress: (progress) => set({ progress }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  addToHistory: (item) => set((state) => ({
    history: [item, ...state.history]
  })),

  reset: () => set(initialState),
}));
