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

// Ensure directories exist and clean them up
import fs from 'node:fs';

async function setupDirectories() {
  const dirs = ['uploads', 'public/thumbnails', 'public/combinations'];
  
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[Server] Created directory: ${dir}`);
      } else {
        // Clean up existing files
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          fs.unlinkSync(filePath);
        }
        console.log(`[Server] Cleaned up directory: ${dir}`);
      }
    } catch (error) {
      console.error(`[Server] Error setting up directory ${dir}:`, error);
      throw error;
    }
  }
}

// Initialize directories
setupDirectories().catch(error => {
  console.error('[Server] Failed to setup directories:', error);
  process.exit(1);
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
            const combinationIndex = combinations.findIndex(c => c.id === combination.id);
            
            if (combinationIndex === -1) {
              console.error(`[Combinations] Combination ${combination.id} not found in the list`);
              return;
            }

            try {
              console.log(`[Combinations] Starting to process combination ${combination.id} (${combinationIndex + 1}/${combinations.length})`);
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

              if (!selectedSegments.every(Boolean)) {
                throw new Error('One or more required segments not found');
              }

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
              console.log(`[Combinations] Output path: ${outputPath}`);
              
              await processVideoCombination({
                inputFiles: selectedSegments.map(s => s.file),
                outputPath,
              });

              // Verify output file exists and is not empty
              const stats = await fs.promises.stat(outputPath);
              if (stats.size === 0) {
                throw new Error('Output file is empty');
              }
              
              console.log(`[Combinations] Output file created: ${outputPath} (${stats.size} bytes)`);
              combinations[combinationIndex].status = 'ready';
              console.log(`[Combinations] Successfully processed combination ${combination.id}`);
            } catch (error) {
              console.error(`[Combinations] Error processing combination ${combination.id}:`, error);
              combinations[combinationIndex].status = 'error';
              
              // Cleanup partial output
              try {
                await fs.unlink(outputPath).catch(() => {
                  // Ignore error if file doesn't exist
                });
                console.log(`[Combinations] Cleaned up partial output file: ${outputPath}`);
              } catch (cleanupError) {
                console.error(`[Combinations] Cleanup error:`, cleanupError);
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
