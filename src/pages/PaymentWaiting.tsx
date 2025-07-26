import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowLeft, ExternalLink } from 'lucide-react';

export const PaymentWaiting = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showFallbackButton, setShowFallbackButton] = useState(false);
  
  // Get data from URL params or localStorage
  const checkoutUrl = searchParams.get('checkoutUrl') || localStorage.getItem('orbit-checkout-url');
  const totalCost = searchParams.get('totalCost') || localStorage.getItem('orbit-total-cost');
  const fileCount = searchParams.get('fileCount') || localStorage.getItem('orbit-file-count');
  const orderId = searchParams.get('orderId') || localStorage.getItem('orbit-order-id');

  // Auto-redirect to Stripe on page load
  useEffect(() => {
    if (checkoutUrl && !sessionStorage.getItem('stripe-redirect-attempted')) {
      sessionStorage.setItem('stripe-redirect-attempted', 'true');
      window.location.href = checkoutUrl;
    }
  }, [checkoutUrl]);

  // Show fallback button after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFallbackButton(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

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
          {/* Loading State */}
          <div className="mb-8">
            <div className="relative">
              <CreditCard className="w-24 h-24 text-accent mx-auto mb-6" />
            </div>
            
            <h2 className="text-3xl font-bold mb-4">Opening Stripe Checkout</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Stripe is loading your secure payment page...
            </p>
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
          {!showFallbackButton && (
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground mb-6">
              <div className="w-3 h-3 bg-accent rounded-full animate-bounce" />
              <div className="w-3 h-3 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-3 h-3 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          )}

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