import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2, Clock, Upload, Zap, Rocket, Satellite } from 'lucide-react';

interface ProcessingStepProps {
  processingStage: string;
  analysisType: 'product' | 'lifestyle';
  realTimeOrderData: any;
  processingProgress: number;
  uploadedFiles: File[];
}

export const ProcessingStep: React.FC<ProcessingStepProps> = ({
  processingStage,
  analysisType,
  realTimeOrderData,
  processingProgress,
  uploadedFiles
}) => {
  const getIcon = () => {
    switch (processingStage) {
      case 'initializing':
        return <Rocket className="w-16 h-16 text-blue-500 animate-pulse" />;
      case 'uploading':
        return <Upload className="w-16 h-16 text-blue-500 animate-bounce" />;
      case 'analyzing':
        return <Satellite className="w-16 h-16 text-purple-500 animate-pulse" />;
      case 'completed':
        return <Satellite className="w-16 h-16 text-green-500" />;
      default:
        return <Rocket className="w-16 h-16 text-blue-500 animate-pulse" />;
    }
  };

  const getDescription = () => {
    switch (processingStage) {
      case 'initializing':
        return 'Getting Ready for Launch - Preparing your images for AI analysis...';
      case 'uploading':
        return 'Uploading images to secure ORBIT storage...';
      case 'analyzing':
        return `In ORBIT - AI systems are performing ${analysisType} analysis and enhancement on your images`;
      case 'completed':
        return 'Mission Complete - Your images have been successfully processed!';
      default:
        return 'Getting Ready for Launch - Preparing to begin your mission...';
    }
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-4">
        {getIcon()}
      </div>
      <h3 className="text-xl font-semibold mb-2">ORBIT Mission Status</h3>
      <p className="text-muted-foreground mb-2">
        {getDescription()}
      </p>
      
      {realTimeOrderData && (
        <div className="bg-secondary/50 rounded-lg p-3 mb-4 text-sm">
          <div className="flex justify-between items-center">
            <span>Mission Stage:</span>
            <span className="font-semibold capitalize">
              {processingStage === 'initializing' ? 'Getting Ready for Launch' :
               processingStage === 'analyzing' ? 'In ORBIT' :
               processingStage === 'completed' ? 'Mission Complete' :
               processingStage}
            </span>
          </div>
          {realTimeOrderData.processing_started_at && (
            <div className="flex justify-between items-center mt-1">
              <span>Started:</span>
              <span className="text-xs">{new Date(realTimeOrderData.processing_started_at).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      )}
      
      <Progress value={processingProgress} className="mb-4" />
      <p className="text-sm text-muted-foreground">
        {Math.round(processingProgress)}% complete • Processing {realTimeOrderData?.image_count || uploadedFiles.length} images
      </p>
    </div>
  );
};