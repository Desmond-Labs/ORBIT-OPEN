import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface UploadStepProps {
  analysisType: 'product' | 'lifestyle';
  onAnalysisTypeChange: (type: 'product' | 'lifestyle') => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({
  analysisType,
  onAnalysisTypeChange,
  onFileUpload
}) => {
  return (
    <div className="text-center">
      {/* Analysis Type Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Choose Analysis Type</h3>
        <div className="flex gap-4 justify-center">
          <Button
            variant={analysisType === 'product' ? 'cosmic' : 'outline'}
            onClick={() => onAnalysisTypeChange('product')}
          >
            Product Analysis
          </Button>
          <Button
            variant={analysisType === 'lifestyle' ? 'cosmic' : 'outline'}
            onClick={() => onAnalysisTypeChange('lifestyle')}
          >
            Lifestyle Analysis
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {analysisType === 'product' 
            ? 'Analyze product features, materials, and market positioning'
            : 'Analyze lifestyle context, demographics, and social dynamics'
          }
        </p>
      </div>

      <div className="border-2 border-dashed border-accent/50 rounded-xl p-12 mb-6 hover:border-accent transition-colors">
        <Upload className="w-16 h-16 text-accent mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Upload Your Images</h3>
        <p className="text-muted-foreground mb-6">
          Drag and drop your images or click to browse
        </p>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={onFileUpload}
          className="hidden"
          id="file-upload"
        />
        <Button variant="cosmic" size="lg" className="cursor-pointer" asChild>
          <label htmlFor="file-upload">
            Choose Images
          </label>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Supported formats: JPG, PNG, WebP • Max 50MB per image
      </p>
    </div>
  );
};