
import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload, CreditCard, Clock, Gift } from 'lucide-react';
import { useDailyLimit } from '@/hooks/useDailyLimit';

interface UploadStepProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedFiles: File[];
  totalCost: number;
  isProcessing: boolean;
  onPayment: () => void;
  canInitiatePayment?: boolean;
  user?: any;
}

export const UploadStep: React.FC<UploadStepProps> = ({
  onFileUpload,
  uploadedFiles,
  totalCost,
  isProcessing,
  onPayment,
  canInitiatePayment = true,
  user
}) => {
  const { dailyLimitData, loading: dailyLimitLoading, getTimeUntilReset, getPricingMessage, getButtonText } = useDailyLimit(user, uploadedFiles.length);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Upload Section */}
      <div className="lg:col-span-2">

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
            disabled={isProcessing}
          />
          <Button variant="cosmic" size="lg" className="cursor-pointer" asChild disabled={isProcessing}>
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
            {/* Daily Limit Status */}
            {dailyLimitData && (
              <div className="mb-6 p-4 bg-secondary/10 rounded-lg border border-accent/10">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-5 h-5 text-accent" />
                  <h4 className="text-sm font-medium">Daily Free Limit</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used today:</span>
                    <span className="font-medium">{dailyLimitData.daily_used}/{dailyLimitData.daily_limit}</span>
                  </div>
                  <div className="w-full bg-secondary/20 rounded-full h-2">
                    <div 
                      className="bg-accent h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min((dailyLimitData.daily_used / dailyLimitData.daily_limit) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{getTimeUntilReset()}</span>
                  </div>
                </div>
              </div>
            )}

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
                <span className="font-semibold">AI-Determined</span>
              </div>
              
              {/* Smart Pricing Display */}
              {dailyLimitData && (
                <div className="bg-secondary/5 rounded-lg p-3 border border-accent/5">
                  <div className="text-sm text-muted-foreground mb-2">Pricing Breakdown:</div>
                  {dailyLimitData.free_images_used > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-accent">🎉 {dailyLimitData.free_images_used} images FREE</span>
                      <span className="font-medium">$0.00</span>
                    </div>
                  )}
                  {dailyLimitData.paid_images > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span>{dailyLimitData.paid_images} images (paid)</span>
                      <span className="font-medium">${dailyLimitData.total_cost}</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="border-t border-accent/20 pt-3">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total:</span>
                  <span>${dailyLimitData?.total_cost ?? totalCost}</span>
                </div>
              </div>
            </div>
            
            <Button 
              variant="cosmic" 
              size="lg" 
              onClick={onPayment} 
              className="w-full"
              disabled={isProcessing || !canInitiatePayment || dailyLimitLoading}
            >
              {getButtonText(isProcessing)}
            </Button>
            
            <p className="text-xs text-muted-foreground text-center mt-4">
              {dailyLimitData?.is_free_only 
                ? "All images will be processed for free!" 
                : "You can add more images before payment"
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
