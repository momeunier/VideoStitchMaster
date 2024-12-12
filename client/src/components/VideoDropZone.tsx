import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { VideoSegment } from '@/lib/types';
import { uploadVideo } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Upload, Video } from 'lucide-react';

interface VideoDropZoneProps {
  type: VideoSegment['type'];
  onUpload: (segment: VideoSegment) => void;
}

export function VideoDropZone({ type, onUpload }: VideoDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(file => file.type.startsWith('video/'));

    if (videoFiles.length === 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload video files',
        variant: 'destructive',
      });
      return;
    }

    if (files.length !== videoFiles.length) {
      toast({
        title: 'Some files skipped',
        description: 'Only video files will be processed',
        variant: 'warning',
      });
    }

    try {
      for (const file of videoFiles) {
        const segment = await uploadVideo(file, type, (e) => {
          setProgress((e.loaded / e.total) * 100);
        });
        onUpload(segment);
        setProgress(0);
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  }, [type, onUpload, toast]);

  return (
    <Card
      className={`p-6 border-2 border-dashed ${
        isDragging ? 'border-primary bg-primary/10' : 'border-border'
      } rounded-lg flex flex-col items-center justify-center min-h-[200px] relative`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {progress > 0 ? (
        <div className="w-full space-y-4">
          <Progress value={progress} />
          <p className="text-sm text-center">Uploading... {Math.round(progress)}%</p>
        </div>
      ) : (
        <>
          {isDragging ? (
            <Upload className="w-12 h-12 text-primary mb-4" />
          ) : (
            <Video className="w-12 h-12 text-muted-foreground mb-4" />
          )}
          <p className="text-lg font-medium capitalize mb-2">{type}</p>
          <p className="text-sm text-muted-foreground text-center">
            Drag and drop your video here
          </p>
        </>
      )}
    </Card>
  );
}
