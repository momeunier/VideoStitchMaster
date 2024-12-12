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
          const combination: VideoCombination = {
            id: randomUUID(),
            hook: hook.id,
            story: story.id,
            cta: cta.id,
            status: 'processing',
          };

          combinations.push(combination);
          console.log(`[Combinations] Created combination ${combination.id}`);

          processingQueue.add(async () => {
            const outputPath = path.join('public', 'combinations', `${combination.id}.mp4`);
            try {
              console.log(`[Combinations] Processing combination ${combination.id}`);
              
              const selectedSegments = [
                segments.find(s => s.id === hook.id)!,
                segments.find(s => s.id === story.id)!,
                segments.find(s => s.id === cta.id)!
              ];

              // Verify all input files exist
              for (const segment of selectedSegments) {
                if (!fs.existsSync(segment.file)) {
                  throw new Error(`Input file not found: ${segment.file}`);
                }
              }
              
              // Process the video combination
              await processVideoCombination({
                inputFiles: selectedSegments.map(s => s.file),
                outputPath,
              });

              // Verify the output file was created
              if (!fs.existsSync(outputPath)) {
                throw new Error('Output file was not created');
              }

              combination.status = 'ready';
              combination.downloadUrl = `/combinations/${path.basename(outputPath)}`;
              console.log(`[Combinations] Successfully processed combination ${combination.id}`);
            } catch (error) {
              console.error(`[Combinations] Error processing combination ${combination.id}:`, error);
              combination.status = 'error';
              
              // Cleanup: remove partial output file if it exists
              if (fs.existsSync(outputPath)) {
                try {
                  fs.unlinkSync(outputPath);
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
