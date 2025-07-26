import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Upload, Settings, ArrowLeft, ExternalLink } from 'lucide-react';

interface PaymentProcessingPageProps {
  uploadedFiles: File[];
  totalCost: number;
  phase: 'preparing' | 'uploading' | 'creating-order' | 'connecting-stripe';
  uploadProgress?: { current: number; total: number };
  error?: string | null;
  checkoutUrl?: string;
  operationStatus?: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

export const PaymentProcessingPage: React.FC<PaymentProcessingPageProps> = ({
  uploadedFiles,
  totalCost,
  phase,
  uploadProgress,
  error,
  checkoutUrl,
  operationStatus,
  onRetry,
  onCancel
}) => {
  const [showFallbackButton, setShowFallbackButton] = useState(false);

  // Show fallback button after 3 seconds for Stripe connection
  useEffect(() => {
    if (phase === 'connecting-stripe' && checkoutUrl) {
      const timer = setTimeout(() => {
        setShowFallbackButton(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, checkoutUrl]);

  const getPhaseConfig = () => {
    switch (phase) {
      case 'preparing':
        return {
          icon: Settings,
          title: 'Preparing Your Order',
          description: operationStatus || 'Authenticating and calculating pricing...',
          showProgress: false
        };
      case 'uploading':
        return {
          icon: Upload,
          title: 'Uploading Images',
          description: `Uploading ${uploadProgress?.current || 0} of ${uploadProgress?.total || 0} images...`,
          showProgress: true
        };
      case 'creating-order':
        return {
          icon: CreditCard,
          title: 'Creating Payment',
          description: operationStatus || 'Setting up your payment with Stripe...',
          showProgress: false
        };
      case 'connecting-stripe':
        return {
          icon: CreditCard,
          title: 'Opening Stripe Checkout',
          description: 'Stripe is loading your secure payment page...',
          showProgress: false
        };
    }
  };

  const config = getPhaseConfig();
  const Icon = config.icon;
  const progressPercentage = uploadProgress ? (uploadProgress.current / uploadProgress.total) * 100 : 0;

  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-red-600 dark:text-red-400">Payment Failed</h2>
          <p className="text-lg text-muted-foreground mb-8">
            {error}
          </p>
        </div>

        <div className="bg-card/30 backdrop-blur-sm border border-accent/20 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
          <div className="flex justify-between items-center mb-2">
            <span>Images to process:</span>
            <span className="font-semibold">{uploadedFiles.length}</span>
          </div>
          <div className="flex justify-between items-center text-xl font-bold border-t border-accent/20 pt-2">
            <span>Total:</span>
            <span>${totalCost}</span>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          {onRetry && (
            <Button onClick={onRetry} variant="cosmic" size="lg">
              Try Again
            </Button>
          )}
          {onCancel && (
            <Button onClick={onCancel} variant="outline" size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Upload
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto text-center">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="relative">
          <Icon className="w-24 h-24 text-accent mx-auto mb-6" />
          {phase !== 'connecting-stripe' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
            </div>
          )}
        </div>
        
        <h2 className="text-3xl font-bold mb-4">{config.title}</h2>
        <p className="text-lg text-muted-foreground mb-6">
          {config.description}
        </p>

        {config.showProgress && uploadProgress && (
          <div className="mb-6">
            <Progress value={progressPercentage} className="mb-3 h-3" />
            <p className="text-sm text-muted-foreground">
              {uploadProgress.current} of {uploadProgress.total} files uploaded ({progressPercentage.toFixed(0)}%)
            </p>
          </div>
        )}
      </div>

      {/* Order Summary */}
      <div className="bg-card/30 backdrop-blur-sm border border-accent/20 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span>Images to process:</span>
            <span className="font-semibold">{uploadedFiles.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Analysis type:</span>
            <span className="font-semibold">AI-Determined</span>
          </div>
          <div className="border-t border-accent/20 pt-2">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total:</span>
              <span>${totalCost}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {phase === 'connecting-stripe' && showFallbackButton && checkoutUrl && (
        <div className="mb-6">
          <Button 
            onClick={() => window.open(checkoutUrl, '_blank')}
            variant="cosmic" 
            size="lg" 
            className="w-full max-w-md"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            If Stripe didn't open, click here
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            This will open Stripe checkout in a new tab
          </p>
        </div>
      )}

      {/* Loading Animation */}
      {!showFallbackButton && (
        <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
          <div className="w-3 h-3 bg-accent rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-3 h-3 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      )}

      {/* Cancel Button */}
      {onCancel && phase !== 'connecting-stripe' && (
        <Button 
          onClick={onCancel} 
          variant="ghost" 
          className="mt-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Cancel and Return to Upload
        </Button>
      )}
    </div>
  );
};