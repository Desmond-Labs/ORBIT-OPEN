import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Loader2 } from 'lucide-react';
import { useDownloadProcessedImages } from '@/hooks/useDownloadProcessedImages';
import { ProcessedImageGallery } from './ProcessedImageGallery';

interface CompleteStepProps {
  processingResults: any;
  uploadedFiles: File[];
  onProcessMore: () => void;
  orderId?: string;
}

export const CompleteStep: React.FC<CompleteStepProps> = ({
  processingResults,
  uploadedFiles,
  onProcessMore,
  orderId
}) => {
  const { downloadProcessedImages, downloading } = useDownloadProcessedImages();
  return (
    <div className="text-center">
      <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-2">Processing Complete!</h3>
      <p className="text-muted-foreground mb-6">
        Your images have been analyzed with AI-powered analysis
      </p>
      
      {/* Results Summary */}
      {processingResults && (
        <div className="bg-secondary/50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Total Images:</span>
              <span className="ml-2">{processingResults.results?.total_images || uploadedFiles.length}</span>
            </div>
            <div>
              <span className="font-semibold">Successful:</span>
              <span className="ml-2 text-success">{processingResults.results?.success_count || 0}</span>
            </div>
            <div>
              <span className="font-semibold">Analysis Type:</span>
              <span className="ml-2">AI-Determined</span>
            </div>
            <div>
              <span className="font-semibold">Errors:</span>
              <span className="ml-2 text-destructive">{processingResults.results?.error_count || 0}</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {orderId && (
          <Button 
            variant="default" 
            size="lg" 
            className="w-full"
            onClick={() => downloadProcessedImages(orderId)}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {downloading ? 'Preparing Download...' : 'Download Processed Images'}
          </Button>
        )}
        <Button variant="outline" size="lg" className="w-full" onClick={onProcessMore}>
          Process More Images
        </Button>
      </div>

      {/* Image Gallery */}
      {orderId && (
        <div className="mt-8">
          <ProcessedImageGallery orderId={orderId} />
        </div>
      )}
    </div>
  );
};