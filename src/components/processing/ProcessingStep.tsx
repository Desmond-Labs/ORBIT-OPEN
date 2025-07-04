import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2, Clock, Upload, Zap } from 'lucide-react';

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
        return <Clock className="w-16 h-16 text-accent animate-pulse" />;
      case 'uploading':
        return <Upload className="w-16 h-16 text-accent animate-bounce" />;
      case 'analyzing':
        return <Zap className="w-16 h-16 text-accent animate-spin" />;
      default:
        return <Loader2 className="w-16 h-16 text-accent animate-spin" />;
    }
  };

  const getDescription = () => {
    switch (processingStage) {
      case 'initializing':
        return 'Preparing your images for analysis...';
      case 'uploading':
        return 'Uploading images to secure storage...';
      case 'analyzing':
        return `ORBIT is performing ${analysisType} analysis on your images`;
      default:
        return 'Getting ready to process your images...';
    }
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-4">
        {getIcon()}
      </div>
      <h3 className="text-xl font-semibold mb-2">AI Analysis in Progress</h3>
      <p className="text-muted-foreground mb-2">
        {getDescription()}
      </p>
      
      {realTimeOrderData && (
        <div className="bg-secondary/50 rounded-lg p-3 mb-4 text-sm">
          <div className="flex justify-between items-center">
            <span>Processing Stage:</span>
            <span className="font-semibold capitalize">{processingStage}</span>
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