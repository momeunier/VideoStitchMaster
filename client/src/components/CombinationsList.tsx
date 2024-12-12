import { VideoCombination } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

interface CombinationsListProps {
  combinations: VideoCombination[];
}

export function CombinationsList({ combinations }: CombinationsListProps) {
  return (
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

          {combination.status === 'ready' && combination.downloadUrl && (
            <Button
              className="w-full"
              onClick={() => window.open(combination.downloadUrl)}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}

          {combination.status === 'error' && (
            <p className="text-sm text-destructive">
              Failed to process combination
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
