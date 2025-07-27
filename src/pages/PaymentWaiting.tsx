import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CreditCard, ArrowLeft, ExternalLink, Upload, Settings, CheckCircle } from 'lucide-react';

type PaymentPhase = 'preparing' | 'uploading' | 'creating-order' | 'connecting-stripe' | 'opening-checkout' | 'complete';

export const PaymentWaiting = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentPhase, setCurrentPhase] = useState<PaymentPhase>('preparing');
  const [progress, setProgress] = useState(0);
  const [showFallbackButton, setShowFallbackButton] = useState(false);
  
  // Get data from URL params or localStorage
  const checkoutUrl = searchParams.get('checkoutUrl') || localStorage.getItem('orbit-checkout-url');
  const totalCost = searchParams.get('totalCost') || localStorage.getItem('orbit-total-cost');
  const fileCount = searchParams.get('fileCount') || localStorage.getItem('orbit-file-count');
  const orderId = searchParams.get('orderId') || localStorage.getItem('orbit-order-id');

  // Phase configuration
  const getPhaseConfig = (phase: PaymentPhase) => {
    switch (phase) {
      case 'preparing':
        return {
          icon: Settings,
          title: 'Preparing Your Order',
          description: 'Setting up your payment details...',
          progress: 25
        };
      case 'uploading':
        return {
          icon: Upload,
          title: 'Processing Files',
          description: 'Your images are being uploaded and prepared for analysis...',
          progress: 50
        };
      case 'creating-order':
        return {
          icon: CreditCard,
          title: 'Creating Payment',
          description: 'Setting up secure payment with Stripe...',
          progress: 75
        };
      case 'connecting-stripe':
        return {
          icon: CreditCard,
          title: 'Opening Stripe Checkout',
          description: 'Loading your secure payment page...',
          progress: 90
        };
      case 'opening-checkout':
        return {
          icon: ExternalLink,
          title: 'Redirecting to Payment',
          description: 'Opening Stripe checkout...',
          progress: 100
        };
      case 'complete':
        return {
          icon: CheckCircle,
          title: 'Ready for Payment',
          description: 'Stripe checkout is now ready!',
          progress: 100
        };
    }
  };

  // Simulate payment preparation phases with realistic timing
  useEffect(() => {
    const phases: PaymentPhase[] = ['preparing', 'uploading', 'creating-order', 'connecting-stripe', 'opening-checkout'];
    let currentIndex = 0;

    const progressTimer = setInterval(() => {
      if (currentIndex < phases.length) {
        setCurrentPhase(phases[currentIndex]);
        const config = getPhaseConfig(phases[currentIndex]);
        setProgress(config.progress);
        currentIndex++;
      } else {
        clearInterval(progressTimer);
        // Auto-open Stripe checkout when ready
        if (checkoutUrl && !sessionStorage.getItem('stripe-redirect-attempted')) {
          console.log('🚀 Auto-opening Stripe checkout:', checkoutUrl);
          sessionStorage.setItem('stripe-redirect-attempted', 'true');
          window.location.href = checkoutUrl;
        }
        setCurrentPhase('complete');
      }
    }, 800); // 0.8 seconds per phase for faster experience

    // Show fallback button after 5 seconds if checkout hasn't opened
    const fallbackTimer = setTimeout(() => {
      setShowFallbackButton(true);
    }, 5000);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(fallbackTimer);
    };
  }, [checkoutUrl]);

  const handleFallbackRedirect = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
    }
  };

  const handleCancel = () => {
    // Clear stored data
    localStorage.removeItem('orbit-checkout-url');
    localStorage.removeItem('orbit-total-cost');
    localStorage.removeItem('orbit-file-count');
    localStorage.removeItem('orbit-order-id');
    sessionStorage.removeItem('stripe-redirect-attempted');
    
    // Navigate back to main page
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/5 relative overflow-hidden">
      {/* Cosmic Background */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-accent/20 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-primary/20 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-secondary/20 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="relative mb-6">
              {(() => {
                const config = getPhaseConfig(currentPhase);
                const Icon = config.icon;
                return <Icon className="w-24 h-24 text-accent mx-auto" />;
              })()}
              {currentPhase !== 'complete' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            <h2 className="text-3xl font-bold mb-4">{getPhaseConfig(currentPhase).title}</h2>
            <p className="text-lg text-muted-foreground mb-6">
              {getPhaseConfig(currentPhase).description}
            </p>

            <div className="mb-6">
              <Progress value={progress} className="mb-3 h-3" />
              <p className="text-sm text-muted-foreground">
                {progress}% Complete
              </p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-card/30 backdrop-blur-sm border border-accent/20 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Images to process:</span>
                <span className="font-semibold">{fileCount || '0'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Analysis type:</span>
                <span className="font-semibold">AI-Determined</span>
              </div>
              <div className="border-t border-accent/20 pt-2">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>Total:</span>
                  <span>${totalCost || '0.00'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fallback Button for Stripe */}
          {showFallbackButton && checkoutUrl && (
            <div className="mb-6">
              <Button 
                onClick={handleFallbackRedirect}
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
          {!showFallbackButton && currentPhase !== 'complete' && (
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground mb-6">
              <div className="w-3 h-3 bg-accent rounded-full animate-bounce" />
              <div className="w-3 h-3 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-3 h-3 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          )}

          {/* Information */}
          <div className="mt-8 p-4 bg-blue-50/50 border border-blue-200/50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>What's happening?</strong><br />
              We're preparing your order and setting up secure payment with Stripe. 
              This process usually takes a few seconds and will open automatically.
            </p>
          </div>

          {/* Cancel Button */}
          <Button 
            onClick={handleCancel} 
            variant="ghost" 
            className="mt-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel and Return to Upload
          </Button>
        </div>
      </div>
    </div>
  );
};