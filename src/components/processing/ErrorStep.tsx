import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface ErrorStepProps {
  error: string;
  orderId?: string;
  onRetry?: () => void;
  onBack?: () => void;
  retrying?: boolean;
}

export const ErrorStep: React.FC<ErrorStepProps> = ({
  error,
  orderId,
  onRetry,
  onBack,
  retrying = false
}) => {
  const getErrorAdvice = (errorMessage: string) => {
    if (errorMessage.includes('No images found')) {
      return {
        title: 'No Images Found',
        description: 'It looks like no images were uploaded for this order. This can happen if the upload failed after payment.',
        suggestions: [
          'Try refreshing the page and restarting the process',
          'Check your internet connection',
          'Contact support if the issue persists'
        ]
      };
    }
    
    if (errorMessage.includes('Order not found')) {
      return {
        title: 'Order Not Found',
        description: 'The order could not be located in the system.',
        suggestions: [
          'Double-check the order ID in the URL',
          'Make sure you\'re logged in with the correct account',
          'Contact support with your order number'
        ]
      };
    }
    
    if (errorMessage.includes('WebSocket')) {
      return {
        title: 'Connection Issue',
        description: 'Real-time updates are not working, but processing may still continue.',
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Processing will continue in the background'
        ]
      };
    }
    
    return {
      title: 'Processing Error',
      description: 'An unexpected error occurred during processing.',
      suggestions: [
        'Try the operation again',
        'Check your internet connection',
        'Contact support if the error persists'
      ]
    };
  };

  const errorInfo = getErrorAdvice(error);

  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-6">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">{errorInfo.title}</h3>
        <p className="text-muted-foreground mb-4">{errorInfo.description}</p>
      </div>

      <div className="bg-secondary/20 rounded-lg p-4 mb-6 text-left">
        <h4 className="font-semibold mb-2">Error Details:</h4>
        <p className="text-sm text-muted-foreground font-mono bg-background/50 p-2 rounded">
          {error}
        </p>
        {orderId && (
          <p className="text-sm text-muted-foreground mt-2">
            <strong>Order ID:</strong> {orderId}
          </p>
        )}
      </div>

      <div className="bg-secondary/20 rounded-lg p-4 mb-6 text-left">
        <h4 className="font-semibold mb-2">What you can try:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          {errorInfo.suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-accent">•</span>
              {suggestion}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-4 justify-center">
        {onRetry && (
          <Button 
            variant="cosmic" 
            size="lg" 
            onClick={onRetry}
            disabled={retrying}
            className="gap-2"
          >
            {retrying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Try Again
              </>
            )}
          </Button>
        )}
        
        {onBack && (
          <Button 
            variant="outline" 
            size="lg" 
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Start Over
          </Button>
        )}
      </div>
    </div>
  );
};