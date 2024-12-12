import { useState } from 'react';
import { VideoCombination } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Package } from 'lucide-react';
import JSZip from 'jszip';
import { useToast } from '@/hooks/use-toast';

interface CombinationsListProps {
  combinations: VideoCombination[];
}

export function CombinationsList({ combinations }: CombinationsListProps) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const { toast } = useToast();

  const downloadAll = async () => {
    const readyVideos = combinations.filter(c => c.status === 'ready');
    if (readyVideos.length === 0) {
      toast({
        title: 'No videos ready',
        description: 'Wait for videos to finish processing',
        variant: 'destructive',
      });
      return;
    }

    setDownloadingAll(true);
    try {
      const zip = new JSZip();
      
      // Download all videos and add to zip
      for (const combination of readyVideos) {
        const response = await fetch(combination.downloadUrl);
        const blob = await response.blob();
        zip.file(`combination-${combination.id}.mp4`, blob);
      }
      
      // Generate and download zip
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'video-combinations.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Download complete',
        description: `Successfully downloaded ${readyVideos.length} videos`,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Failed to download videos',
        variant: 'destructive',
      });
    } finally {
      setDownloadingAll(false);
    }
  };

  const readyCount = combinations.filter(c => c.status === 'ready').length;
  const processingCount = combinations.filter(c => c.status === 'processing').length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Generated Combinations</h2>
        {combinations.length > 0 && (
          <Button 
            onClick={downloadAll}
            disabled={downloadingAll || readyCount === 0}
          >
            <Package className="w-4 h-4 mr-2" />
            Download All ({readyCount}/{combinations.length})
            {downloadingAll && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {combinations.map((combination) => (
          <Card key={combination.id} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Combination #{combination.id}</h3>
              {combination.status === 'processing' && (
                <div className="flex items-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing
                </div>
              )}
            </div>
            
            <div className="space-y-2 mb-4">
              <p className="text-sm text-muted-foreground">
                Hook: {combination.hook}
              </p>
              <p className="text-sm text-muted-foreground">
                Story: {combination.story}
              </p>
              <p className="text-sm text-muted-foreground">
                CTA: {combination.cta}
              </p>
            </div>

            <div className="space-y-2">
              {combination.status === 'ready' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Video URL: <a href={combination.downloadUrl} className="underline hover:text-primary" target="_blank" rel="noopener noreferrer">{combination.downloadUrl}</a>
                  </p>
                  
                  <Button
                    className="w-full"
                    onClick={() => window.open(combination.downloadUrl)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Open Video
                  </Button>
                </>
              )}

              {combination.status === 'processing' && (
                <p className="text-sm text-muted-foreground">
                  Processing... The video will be available soon.
                </p>
              )}

              {combination.status === 'error' && (
                <p className="text-sm text-destructive mt-2">
                  Failed to process combination. You can try refreshing to check the status again.
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
