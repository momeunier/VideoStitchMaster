import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VideoDropZone } from '@/components/VideoDropZone';
import { VideoPreview } from '@/components/VideoPreview';
import { CombinationsList } from '@/components/CombinationsList';
import { Button } from '@/components/ui/button';
import { VideoSegment, VideoType, VideoCombination } from '@/lib/types';
import { generateCombinations, getCombinations } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Wand2 } from 'lucide-react';

export function Home() {
  const [segments, setSegments] = useState<Record<VideoType, VideoSegment[]>>({
    hook: [],
    story: [],
    cta: [],
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const combinationsQuery = useQuery({
    queryKey: ['combinations'],
    queryFn: getCombinations,
    refetchInterval: (query) => {
      const data = query.state.data as VideoCombination[] | undefined;
      return data?.some(c => c.status === 'processing') ? 2000 : false;
    },
  });

  const combinations = combinationsQuery.data || [];

  // Show completion toast when all processing is done
  const prevCombinationsRef = useRef<VideoCombination[]>([]);
  useEffect(() => {
    const wasProcessing = prevCombinationsRef.current.some(c => c.status === 'processing');
    const isComplete = combinations.length > 0 && combinations.every(c => c.status === 'ready' || c.status === 'error');
    
    if (wasProcessing && isComplete) {
      toast({
        title: 'Processing complete',
        description: 'All video combinations have been processed',
      });
    }
    
    prevCombinationsRef.current = combinations;
  }, [combinations, toast]);

  const generateMutation = useMutation({
    mutationFn: generateCombinations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combinations'] });
      toast({
        title: 'Generating combinations',
        description: 'Your videos are being processed',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to generate combinations',
        variant: 'destructive',
      });
    },
  });

  const handleUpload = (segment: VideoSegment) => {
    setSegments((prev) => ({
      ...prev,
      [segment.type]: [...prev[segment.type], segment],
    }));
  };

  const handleRemove = (type: VideoType, id: string) => {
    setSegments((prev) => ({
      ...prev,
      [type]: prev[type].filter(segment => segment.id !== id),
    }));
  };

  const canGenerate = Object.values(segments).every(typeSegments => typeSegments.length > 0);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="grid gap-6 md:grid-cols-3">
        {(['hook', 'story', 'cta'] as const).map((type) => (
          <div key={type}>
            <div className="space-y-4">
              <VideoDropZone type={type} onUpload={handleUpload} />
              {segments[type].map((segment) => (
                <VideoPreview
                  key={segment.id}
                  segment={segment}
                  onRemove={() => handleRemove(type, segment.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          disabled={!canGenerate || generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Generate Combinations
        </Button>
      </div>

      {combinations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Generated Combinations</h2>
          <CombinationsList combinations={combinations} />
        </div>
      )}
    </div>
  );
}
