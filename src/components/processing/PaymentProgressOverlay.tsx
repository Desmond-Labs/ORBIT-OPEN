import React from 'react';
import { Loader2, CreditCard, Upload, Settings } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface PaymentProgressOverlayProps {
  phase: 'processing' | 'uploading' | 'payment-ready' | 'redirecting' | 'payment-fallback';
  uploadProgress?: { current: number; total: number };
  operationStatus?: string;
  error?: string | null;
  checkoutUrl?: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

export const PaymentProgressOverlay: React.FC<PaymentProgressOverlayProps> = ({
  phase,
  uploadProgress,
  operationStatus,
  error,
  checkoutUrl,
  onRetry,
  onCancel
}) => {
  const getPhaseConfig = () => {
    switch (phase) {
      case 'processing':
        return {
          icon: Settings,
          title: 'Processing Order',
          description: operationStatus || 'Setting up your payment...',
          showProgress: false
        };
      case 'uploading':
        return {
          icon: Upload,
          title: 'Uploading Images',
          description: `Uploading ${uploadProgress?.current || 0} of ${uploadProgress?.total || 0} images...`,
          showProgress: true
        };
      case 'payment-ready':
        return {
          icon: CreditCard,
          title: 'Payment Ready',
          description: 'Opening secure payment window...',
          showProgress: false
        };
      case 'redirecting':
        return {
          icon: CreditCard,
          title: 'Redirecting to Payment',
          description: 'Taking you to Stripe checkout...',
          showProgress: false
        };
      case 'payment-fallback':
        return {
          icon: CreditCard,
          title: 'Complete Payment',
          description: 'Click below to open the payment window if it didn\'t open automatically.',
          showProgress: false
        };
    }
  };

  const config = getPhaseConfig();
  const Icon = config.icon;
  const progressPercentage = uploadProgress ? (uploadProgress.current / uploadProgress.total) * 100 : 0;

  if (error) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-card/90 backdrop-blur-sm border border-accent/20 rounded-xl p-8 max-w-md mx-4 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          
          <h3 className="text-xl font-semibold mb-2 text-red-600 dark:text-red-400">Payment Failed</h3>
          <p className="text-muted-foreground mb-6">
            {error}
          </p>
          
          <div className="flex gap-3 justify-center">
            {onRetry && (
              <Button onClick={onRetry} variant="cosmic">
                Try Again
              </Button>
            )}
            {onCancel && (
              <Button onClick={onCancel} variant="outline">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card/90 backdrop-blur-sm border border-accent/20 rounded-xl p-8 max-w-md mx-4 text-center">
        <div className="mb-6">
          <Icon className="w-16 h-16 text-accent mx-auto mb-4" />
          {phase !== 'payment-fallback' && (
            <Loader2 className="w-8 h-8 text-accent mx-auto animate-spin mb-4" />
          )}
        </div>
        
        <h3 className="text-xl font-semibold mb-2">{config.title}</h3>
        <p className="text-muted-foreground mb-4">
          {config.description}
        </p>

        {config.showProgress && uploadProgress && (
          <div className="mb-4">
            <Progress value={progressPercentage} className="mb-2" />
            <p className="text-sm text-muted-foreground">
              {uploadProgress.current} of {uploadProgress.total} files uploaded
            </p>
          </div>
        )}

        {phase === 'payment-fallback' && checkoutUrl && (
          <div className="mb-4">
            <Button 
              onClick={() => window.open(checkoutUrl, '_blank')}
              variant="cosmic" 
              size="lg" 
              className="w-full"
            >
              Open Payment Window
            </Button>
          </div>
        )}
        
        {phase !== 'payment-fallback' && phase !== 'redirecting' && (
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        )}

        {onCancel && phase !== 'redirecting' && phase !== 'payment-fallback' && (
          <Button 
            onClick={onCancel} 
            variant="ghost" 
            size="sm" 
            className="mt-4"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};