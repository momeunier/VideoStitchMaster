import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

interface ProcessVideoOptions {
  inputFiles: string[];
  outputPath: string;
}

export async function processVideoCombination({ inputFiles, outputPath }: ProcessVideoOptions): Promise<string> {
  const filterComplex = inputFiles
    .map((_, i) => `[${i}:v][${i}:a]`)
    .join('');
  
  const concatFilter = `concat=n=${inputFiles.length}:v=1:a=1[outv][outa]`;

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      ...inputFiles.flatMap(file => ['-i', file]),
      '-filter_complex', `${filterComplex}${concatFilter}`,
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      outputPath
    ]);

    ffmpeg.stderr.on('data', (data) => {
      console.log(`[FFmpeg Processing] ${data}`);
    });

    ffmpeg.stdout.on('data', (data) => {
      console.log(`[FFmpeg Output] ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });
  });
}

export async function generateThumbnail(videoPath: string): Promise<string> {
  const thumbnailPath = path.join(
    'public/thumbnails',
    `${randomUUID()}.jpg`
  );

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', '00:00:01',
      '-vframes', '1',
      '-vf', 'scale=320:-1',
      thumbnailPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(thumbnailPath);
      } else {
        reject(new Error(`FFmpeg thumbnail generation failed with code ${code}`));
      }
    });
  });
}
