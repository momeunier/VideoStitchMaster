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
    console.log(`[FFmpeg] Starting process with ${inputFiles.length} input files`);
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let progressRegex = /time=(\d{2}:\d{2}:\d{2}.\d{2})/;
    let lastProgressUpdate = Date.now();

    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      stdErrOutput += output;
      
      // Extract progress information
      const match = progressRegex.exec(output);
      if (match) {
        const currentTime = Date.now();
        // Only log progress every second to avoid spam
        if (currentTime - lastProgressUpdate > 1000) {
          console.log(`[FFmpeg] Processing progress: ${match[1]}`);
          lastProgressUpdate = currentTime;
        }
      } else {
        // Log non-progress messages for debugging
        console.log(`[FFmpeg Processing] ${output}`);
      }
    });

    ffmpeg.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[FFmpeg Output] ${output}`);
    });

    ffmpeg.on('error', (err) => {
      console.error('[FFmpeg Error]', err);
      ffmpeg.kill('SIGKILL');
      reject(new Error(`FFmpeg process error: ${err.message}`));
    });

    // Set a timeout of 5 minutes
    const timeout = setTimeout(() => {
      console.log('[FFmpeg] Process timed out, killing...');
      ffmpeg.kill('SIGKILL');
      reject(new Error('FFmpeg process timed out after 5 minutes'));
    }, 5 * 60 * 1000);

    ffmpeg.on('close', async (code) => {
      clearTimeout(timeout);
      console.log(`[FFmpeg] Process closed with code: ${code}`);
      
      if (code === 0) {
        try {
          // Verify the output file exists and has content
          const stats = await fs.promises.stat(outputPath);
          if (stats.size === 0) {
            console.error('[FFmpeg] Output file is empty');
            reject(new Error('FFmpeg generated an empty output file'));
          } else {
            console.log(`[FFmpeg] Successfully processed video combination (${stats.size} bytes)`);
            // Add a small delay to ensure file system has completely written the file
            await new Promise(resolve => setTimeout(resolve, 500));
            resolve(outputPath);
          }
        } catch (err) {
          console.error('[FFmpeg] Error checking output file:', err);
          reject(new Error(`Failed to verify output file: ${err.message}`));
        }
      } else {
        console.error('[FFmpeg] Process failed with code:', code);
        console.error('[FFmpeg] Error output:', stdErrOutput);
        reject(new Error(`FFmpeg process failed with code ${code}\n${stdErrOutput}`));
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
