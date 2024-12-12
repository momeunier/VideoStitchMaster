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

  // Set video source directly in the video element
  // This is more reliable than setting it via useEffect

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
      <div 
        className="relative mx-auto" 
        style={{ 
          width: '180px', // 9:16 ratio based on 320px height
          height: '320px',
          maxWidth: '100%',
          backgroundColor: 'black'
        }}
      >
        <video
          ref={videoRef}
          className="absolute top-0 left-0 w-full h-full object-contain bg-black"
          controls
          muted
          playsInline
          src={segment.previewUrl}
        />
      </div>
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
