import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Pencil } from 'lucide-react';
import { VideoSegment } from '@/lib/types';
import { VideoEditor } from './VideoEditor';

interface VideoPreviewProps {
  segment: VideoSegment;
  onRemove: () => void;
}

export function VideoPreview({ segment, onRemove }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.src = segment.previewUrl;
    }
  }, [segment.previewUrl]);

  const handleSaveEdits = (edits: any) => {
    // TODO: Save edits to the video
    console.log('Saving edits:', edits);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <VideoEditor
        segment={segment}
        onClose={() => setIsEditing(false)}
        onSave={handleSaveEdits}
      />
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <video
        ref={videoRef}
        className="w-auto h-[320px] mx-auto"
        style={{ aspectRatio: '9/16', objectFit: 'contain' }}
        controls
        muted
        playsInline
      />
      <div className="absolute top-2 right-2 flex gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
