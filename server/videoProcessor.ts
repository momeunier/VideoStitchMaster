import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

interface ProcessVideoOptions {
  inputFiles: string[];
  outputPath: string;
}

export async function processVideoCombination({ inputFiles, outputPath }: ProcessVideoOptions): Promise<string> {
  // Verify input files exist and are accessible
  for (const file of inputFiles) {
    try {
      await fs.access(file, fs.constants.R_OK);
      const stats = await fs.stat(file);
      console.log(`[FFmpeg] Input file verified: ${file} (${stats.size} bytes)`);
    } catch (error) {
      throw new Error(`Unable to access input file ${file}: ${error.message}`);
    }
  }

  // Create filter complex string with explicit input stream labels
  const inputLabels = inputFiles.map((_, i) => `[${i}:v][${i}:a]`).join('');
  const concatFilter = `${inputLabels}concat=n=${inputFiles.length}:v=1:a=1[outv][outa]`;
  
  console.log(`[FFmpeg] Starting processing with filter: ${concatFilter}`);

  return new Promise((resolve, reject) => {
    let stdErrOutput = '';
    const ffmpegArgs = [
      // Input files with absolute paths
      ...inputFiles.flatMap(file => ['-i', path.resolve(file)]),
      // Filter complex for concatenation
      '-filter_complex', concatFilter,
      // Map output streams
      '-map', '[outv]',
      '-map', '[outa]',
      // Video codec settings
      '-c:v', 'libx264',
      '-preset', 'ultrafast', // Speed up encoding for testing
      '-crf', '23',
      // Audio codec settings
      '-c:a', 'aac',
      '-b:a', '128k',
      // Output file
      '-y',
      path.resolve(outputPath)
    ];

    console.log(`[FFmpeg] Executing command: ffmpeg ${ffmpegArgs.join(' ')}`);
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.stderr.on('data', (data) => {
      stdErrOutput += data.toString();
      console.log(`[FFmpeg Processing] ${data}`);
    });

    ffmpeg.stdout.on('data', (data) => {
      console.log(`[FFmpeg Output] ${data}`);
    });

    ffmpeg.on('error', (err) => {
      console.error('[FFmpeg Error]', err);
      reject(new Error(`FFmpeg process error: ${err.message}`));
    });

    // Set a timeout of 5 minutes
    const timeout = setTimeout(() => {
      ffmpeg.kill();
      reject(new Error('FFmpeg process timed out after 5 minutes'));
    }, 5 * 60 * 1000);

    ffmpeg.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log('[FFmpeg] Successfully processed video combination');
        resolve(outputPath);
      } else {
        console.error('[FFmpeg] Process failed with code:', code);
        console.error('[FFmpeg] Error output:', stdErrOutput);
        reject(new Error(`FFmpeg process failed with code ${code}`));
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
