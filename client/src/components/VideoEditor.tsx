import { useRef, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { VideoSegment } from '@/lib/types';
import { Save, Type, Image, RotateCw, X } from 'lucide-react';

interface EditorElement {
  id: string;
  type: 'text' | 'sticker';
  content: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

interface VideoEditorProps {
  segment: VideoSegment;
  onClose: () => void;
  onSave: (edits: EditorElement[]) => void;
}

export function VideoEditor({ segment, onClose, onSave }: VideoEditorProps) {
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<EditorElement | null>(null);
  const [newText, setNewText] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isDraggingRef = useRef(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrameId: number;

    const handleVideoLoad = () => {
      console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };

    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);

      elements.forEach((element) => {
        context.save();
        context.translate(element.x, element.y);
        context.rotate((element.rotation * Math.PI) / 180);
        context.scale(element.scale, element.scale);

        if (element.type === 'text') {
          context.font = '24px sans-serif';
          context.fillStyle = '#ffffff';
          context.strokeStyle = '#000000';
          context.lineWidth = 2;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.strokeText(element.content, 0, 0);
          context.fillText(element.content, 0, 0);
        }

        context.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    video.addEventListener('loadedmetadata', handleVideoLoad);
    if (video.readyState >= 2) {
      handleVideoLoad();
    }

    render();

    return () => {
      video.removeEventListener('loadedmetadata', handleVideoLoad);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [elements]);

  const addText = () => {
    if (!newText.trim()) return;

    const element: EditorElement = {
      id: Math.random().toString(),
      type: 'text',
      content: newText,
      x: canvasRef.current?.width ? canvasRef.current.width / 2 : 0,
      y: canvasRef.current?.height ? canvasRef.current.height / 2 : 0,
      rotation: 0,
      scale: 1,
    };

    setElements([...elements, element]);
    setNewText('');
    setSelectedElement(element);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find clicked element
    const element = elements.find((el) => {
      const dx = el.x - x;
      const dy = el.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 25 * Math.max(scaleX, scaleY);
    });

    if (element) {
      setSelectedElement(element);
      isDraggingRef.current = true;
      lastPositionRef.current = { x, y };
    } else {
      setSelectedElement(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !selectedElement || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const dx = x - lastPositionRef.current.x;
    const dy = y - lastPositionRef.current.y;

    setElements(elements.map((el) =>
      el.id === selectedElement.id
        ? { ...el, x: el.x + dx, y: el.y + dy }
        : el
    ));

    lastPositionRef.current = { x, y };
  };

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false;
  };

  const updateElementRotation = (rotation: number) => {
    if (!selectedElement) return;
    setElements(elements.map((el) =>
      el.id === selectedElement.id ? { ...el, rotation } : el
    ));
  };

  const updateElementScale = (scale: number) => {
    if (!selectedElement) return;
    setElements(elements.map((el) =>
      el.id === selectedElement.id ? { ...el, scale } : el
    ));
  };

  return (
    <Card className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="relative bg-black min-h-[90vh] flex items-center justify-center p-4">
        <div 
          className="relative"
          style={{ 
            width: '405px', // 9:16 ratio based on 720px height
            height: '720px',
            maxWidth: '100%',
            margin: '0 auto'
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
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full cursor-move"
            style={{ touchAction: 'none' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Enter text..."
          />
          <Button onClick={addText}>
            <Type className="w-4 h-4 mr-2" />
            Add Text
          </Button>
        </div>

        {selectedElement && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4" />
              <Slider
                value={[selectedElement.rotation]}
                min={0}
                max={360}
                step={1}
                onValueChange={([value]) => updateElementRotation(value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              <Slider
                value={[selectedElement.scale]}
                min={0.5}
                max={2}
                step={0.1}
                onValueChange={([value]) => updateElementScale(value)}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={() => onSave(elements)}>
            <Save className="w-4 h-4 mr-2" />
            Save Edits
          </Button>
        </div>
      </div>
    </Card>
  );
}
