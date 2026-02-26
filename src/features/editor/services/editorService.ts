const API_BASE = '/api';

export interface TranscribeResponse {
  task_id: string;
  filename: string;
  result?: {
    text: string;
    segments: Array<{
      id: string | number;
      start: number;
      end: number;
      text: string;
    }>;
    words?: Array<{
      id: number;
      start: number;
      end: number;
      word: string;
    }>;
  };
}

export interface ClipRequest {
  filename: string;
  start_time: number;
  end_time: number;
  selected_words?: number[];
}

export interface ClipResponse {
  success: boolean;
  folder_name: string;
  zip_filename: string;
  mp3_filename: string;
  json_filename: string;
  duration: number;
  clip_info: any;
  words: any[];
}

export const editorService = {
  async uploadAudio(file: File): Promise<TranscribeResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  },

  async getProgress(taskId: string): Promise<{ progress: number; status: string; message: string; result?: any; error?: string }> {
    const response = await fetch(`${API_BASE}/progress/${taskId}`);
    if (!response.ok) {
      throw new Error('Failed to get progress');
    }
    return response.json();
  },

  async clipAudio(data: ClipRequest): Promise<ClipResponse> {
    const response = await fetch(`${API_BASE}/clip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Clipping failed');
    }

    return response.json();
  },

  async listUploads(): Promise<any[]> {
    const response = await fetch(`${API_BASE}/list_uploads`);
    if (!response.ok) {
      throw new Error('Failed to list uploads');
    }
    const data = await response.json();
    return data.files;
  },

  async concatenateAudio(filenames: string[]): Promise<{ success: boolean; filename: string; duration: number }> {
    const response = await fetch(`${API_BASE}/concatenate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filenames }),
    });

    if (!response.ok) {
      throw new Error('Concatenation failed');
    }

    return response.json();
  },

  async saveClip(data: { folder_name: string; words: any[]; clip_info: any }): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/save_clip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Save clip failed');
    }

    return response.json();
  }
};
