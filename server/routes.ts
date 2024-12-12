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

          processingQueue.add(async () => {
            try {
              const outputPath = path.join('public', 'combinations', `${combination.id}.mp4`);
              await processVideoCombination({
                inputFiles: [hook.file, story.file, cta.file],
                outputPath,
              });

              combination.status = 'ready';
              combination.downloadUrl = `/combinations/${path.basename(outputPath)}`;
            } catch (error) {
              combination.status = 'error';
              console.error('Combination processing error:', error);
            }
          });
        }
      }
    }

    res.json(combinations);
  });

  app.get('/api/combinations', (_req, res) => {
    res.json(combinations);
  });

  return httpServer;
}
