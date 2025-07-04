import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface UploadStepProps {
  analysisType: 'product' | 'lifestyle';
  onAnalysisTypeChange: (type: 'product' | 'lifestyle') => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedFiles: File[];
}

export const UploadStep: React.FC<UploadStepProps> = ({
  analysisType,
  onAnalysisTypeChange,
  onFileUpload,
  uploadedFiles
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
      
      {/* Selected Files Preview */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6 p-4 bg-secondary/20 rounded-lg">
          <h4 className="text-sm font-medium mb-3">Selected Images ({uploadedFiles.length})</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex flex-col items-center p-2 bg-background/50 rounded-md">
                <div className="w-16 h-16 bg-accent/20 rounded-md flex items-center justify-center mb-2">
                  <Upload className="w-6 h-6 text-accent" />
                </div>
                <span className="text-xs text-center text-muted-foreground truncate w-full">
                  {file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(1)}MB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Supported formats: JPG, PNG, WebP • Max 50MB per image
      </p>
    </div>
  );
};