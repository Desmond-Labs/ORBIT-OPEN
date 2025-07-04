import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload, CreditCard } from 'lucide-react';

interface UploadStepProps {
  analysisType: 'product' | 'lifestyle';
  onAnalysisTypeChange: (type: 'product' | 'lifestyle') => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedFiles: File[];
  totalCost: number;
  paymentLoading: boolean;
  onPayment: () => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({
  analysisType,
  onAnalysisTypeChange,
  onFileUpload,
  uploadedFiles,
  totalCost,
  paymentLoading,
  onPayment
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Upload Section */}
      <div className="lg:col-span-2">
        {/* Analysis Type Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Choose Analysis Type</h3>
          <div className="flex gap-4">
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

        <div className="border-2 border-dashed border-accent/50 rounded-xl p-8 mb-6 hover:border-accent transition-colors">
          <Upload className="w-12 h-12 text-accent mx-auto mb-4" />
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

        <p className="text-sm text-muted-foreground mt-4">
          Supported formats: JPG, PNG, WebP • Max 50MB per image
        </p>
      </div>

      {/* Payment Section */}
      {uploadedFiles.length > 0 && (
        <div className="lg:col-span-1">
          <div className="bg-card/30 backdrop-blur-sm border border-accent/20 rounded-xl p-6 sticky top-4">
            <div className="text-center mb-6">
              <CreditCard className="w-12 h-12 text-accent mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Order Summary</h3>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm">Images to process:</span>
                <span className="font-semibold">{uploadedFiles.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Analysis type:</span>
                <span className="font-semibold capitalize">{analysisType}</span>
              </div>
              <div className="border-t border-accent/20 pt-3">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total:</span>
                  <span>${totalCost}</span>
                </div>
              </div>
            </div>
            
            <Button 
              variant="cosmic" 
              size="lg" 
              onClick={onPayment} 
              className="w-full"
              disabled={paymentLoading}
            >
              {paymentLoading ? 'Processing...' : 'Pay with Stripe'}
            </Button>
            
            <p className="text-xs text-muted-foreground text-center mt-4">
              You can add more images before checkout
            </p>
          </div>
        </div>
      )}
    </div>
  );
};