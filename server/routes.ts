import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { processVideoCombination, generateThumbnail } from './videoProcessor.js';
import { processingQueue } from './queue.js';

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Ensure directories exist
import fs from 'node:fs';
['uploads', 'public/thumbnails', 'public/combinations'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

interface VideoSegment {
  id: string;
  file: string;
  type: 'hook' | 'story' | 'cta';
  previewUrl: string;
}

interface VideoCombination {
  id: string;
  hook: string;
  story: string;
  cta: string;
  status: 'processing' | 'ready' | 'error';
  downloadUrl?: string;
}

const segments: VideoSegment[] = [];
const combinations: VideoCombination[] = [];

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  app.post('/api/videos/upload', upload.single('file'), async (req, res) => {
    if (!req.file || !req.body.type) {
      return res.status(400).json({ message: 'Missing file or type' });
    }

    try {
      console.log(`[Upload] Processing video file: ${req.file.path}`);
      const thumbnail = await generateThumbnail(req.file.path);
      console.log(`[Upload] Generated thumbnail: ${thumbnail}`);
      
      const segment: VideoSegment = {
        id: randomUUID(),
        file: req.file.path,
        type: req.body.type,
        previewUrl: `/uploads/${path.basename(req.file.path)}`,
      };

      console.log(`[Upload] Created segment with preview URL: ${segment.previewUrl}`);
      segments.push(segment);
      res.json(segment);
    } catch (error) {
      console.error('[Upload] Error:', error);
      res.status(500).json({ message: 'Failed to process video' });
    }
  });

  app.post('/api/combinations/generate', async (req, res) => {
    const hooks = segments.filter(s => s.type === 'hook');
    const stories = segments.filter(s => s.type === 'story');
    const ctas = segments.filter(s => s.type === 'cta');

    if (!hooks.length || !stories.length || !ctas.length) {
      return res.status(400).json({ message: 'Missing required segments' });
    }

    console.log('[Combinations] Starting generation process');
    
    for (const hook of hooks) {
      for (const story of stories) {
        for (const cta of ctas) {
          const combinationId = randomUUID();
          const combination: VideoCombination = {
            id: combinationId,
            hook: hook.id,
            story: story.id,
            cta: cta.id,
            status: 'processing',
            downloadUrl: `/combinations/${combinationId}.mp4`,
          };

          combinations.push(combination);
          console.log(`[Combinations] Created combination ${combination.id}`);

          processingQueue.add(async () => {
            const outputPath = path.join('public', 'combinations', `${combination.id}.mp4`);
            try {
              console.log(`[Combinations] Starting to process combination ${combination.id}`);
              console.log(`[Combinations] Input segments:`, {
                hook: hook.id,
                story: story.id,
                cta: cta.id
              });
              
              const selectedSegments = [
                segments.find(s => s.id === hook.id)!,
                segments.find(s => s.id === story.id)!,
                segments.find(s => s.id === cta.id)!
              ];

              // Log input files
              console.log(`[Combinations] Input files:`, selectedSegments.map(s => ({
                id: s.id,
                type: s.type,
                file: s.file
              })));

              // Create output directory if it doesn't exist
              const outputDir = path.dirname(outputPath);
              if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
              }
              
              // Process the video combination
              console.log(`[Combinations] Starting FFmpeg processing for ${combination.id}`);
              console.log('[Combinations] FFmpeg process starting with full output below:');
              console.log('----------------------------------------');
              try {
                await processVideoCombination({
                  inputFiles: selectedSegments.map(s => s.file),
                  outputPath,
                });
                console.log('----------------------------------------');

                // Verify output file exists and is not empty
                const stats = fs.statSync(outputPath);
                if (stats.size === 0) {
                  throw new Error('Output file is empty');
                }
                
                console.log(`[Combinations] Output file created: ${outputPath} (${stats.size} bytes)`);
                combination.status = 'ready';
                combination.downloadUrl = `/combinations/${path.basename(outputPath)}`;
                console.log(`[Combinations] Successfully processed combination ${combination.id}`);
              } catch (ffmpegError) {
                console.error(`[Combinations] FFmpeg processing error:`, ffmpegError);
                combination.status = 'error';
                throw ffmpegError; // Re-throw to trigger cleanup
              }
            } catch (error) {
              console.error(`[Combinations] Error processing combination ${combination.id}:`, error);
              combination.status = 'error';
              
              // Cleanup partial output
              if (fs.existsSync(outputPath)) {
                try {
                  fs.unlinkSync(outputPath);
                  console.log(`[Combinations] Cleaned up partial output file: ${outputPath}`);
                } catch (cleanupError) {
                  console.error(`[Combinations] Cleanup error:`, cleanupError);
                }
              }
            }
          });
        }
      }
    }

    console.log('[Combinations] Added all combinations to processing queue');
    res.json(combinations);
  });

  app.get('/api/combinations', (_req, res) => {
    res.json(combinations);
  });

  return httpServer;
}
