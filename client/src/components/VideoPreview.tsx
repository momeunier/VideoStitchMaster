import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { VideoSegment } from '@/lib/types';

interface VideoPreviewProps {
  segment: VideoSegment;
  onRemove: () => void;
}

export function VideoPreview({ segment, onRemove }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.src = segment.previewUrl;
    }
  }, [segment.previewUrl]);

  return (
    <Card className="relative overflow-hidden">
      <video
        ref={videoRef}
        className="w-full aspect-video object-cover"
        controls
        muted
        playsInline
        src={segment.previewUrl}
      />
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </Card>
  );
}
