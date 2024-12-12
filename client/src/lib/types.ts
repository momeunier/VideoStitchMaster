export interface VideoSegment {
  id: string;
  file: File;
  type: 'hook' | 'story' | 'cta';
  previewUrl: string;
}

export interface VideoCombination {
  id: string;
  hook: string;
  story: string;
  cta: string;
  status: 'processing' | 'ready' | 'error';
  downloadUrl: string;
}

export interface UploadProgressEvent {
  loaded: number;
  total: number;
}
