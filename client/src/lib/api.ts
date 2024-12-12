import { VideoSegment, VideoCombination } from './types';

export async function uploadVideo(file: File, type: VideoSegment['type'], onProgress?: (event: ProgressEvent) => void): Promise<VideoSegment> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const xhr = new XMLHttpRequest();
  
  const promise = new Promise<VideoSegment>((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => onProgress?.(e));
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error('Upload failed'));
      }
    };
    
    xhr.onerror = () => reject(new Error('Upload failed'));
  });

  xhr.open('POST', '/api/videos/upload');
  xhr.send(formData);

  return promise;
}

export async function generateCombinations(): Promise<VideoCombination[]> {
  const response = await fetch('/api/combinations/generate', {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to generate combinations');
  return response.json();
}

export async function getCombinations(): Promise<VideoCombination[]> {
  const response = await fetch('/api/combinations');
  if (!response.ok) throw new Error('Failed to fetch combinations');
  return response.json();
}
