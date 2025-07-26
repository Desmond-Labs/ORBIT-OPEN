import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Upload, Settings, ArrowLeft, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface PaymentState {
  uploadedFiles: File[];
  totalCost: number;
}

type PaymentPhase = 'preparing' | 'uploading' | 'creating-order' | 'connecting-stripe';

export default function PaymentProcessingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<PaymentPhase>('preparing');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState('');
  const [showFallbackButton, setShowFallbackButton] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string>('');

  // Get payment data from navigation state or localStorage
  const paymentData: PaymentState = location.state?.paymentData || 
    JSON.parse(localStorage.getItem('paymentData') || '{}');

  const { uploadedFiles = [], totalCost = 0 } = paymentData;

  // Redirect if no payment data
  useEffect(() => {
    if (!uploadedFiles.length) {
      navigate('/', { replace: true });
    }
  }, [uploadedFiles.length, navigate]);

  // Show fallback button after 3 seconds for Stripe connection
  useEffect(() => {
    if (phase === 'connecting-stripe' && checkoutUrl) {
      const timer = setTimeout(() => {
        setShowFallbackButton(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, checkoutUrl]);

  // Start payment process on mount
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      handlePaymentProcess();
    }
  }, []);

  const handlePaymentProcess = async () => {
    try {
      // Phase 1: Preparing (Authentication & Pricing)
      setPhase('preparing');
      setOperationStatus('Authenticating user...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      setOperationStatus('Calculating pricing...');
      
      // Phase 2: Uploading Files
      setPhase('uploading');
      setUploadProgress({ current: 0, total: uploadedFiles.length });
      
      const fileData = await Promise.all(
        uploadedFiles.map((file, index) => {
          setUploadProgress({ current: index + 1, total: uploadedFiles.length });
          return new Promise<{ name: string; data: string; type: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              resolve({
                name: file.name,
                data: base64.split(',')[1],
                type: file.type
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );

      // Phase 3: Creating Order
      setPhase('creating-order');
      setOperationStatus('Creating payment intent...');

      const { data: paymentIntent, error: paymentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          imageCount: uploadedFiles.length,
          batchName: `Upload ${new Date().toISOString().split('T')[0]}`
        }
      });

      if (paymentError) throw paymentError;

      setOperationStatus('Uploading images to secure storage...');

      const { data: uploadResult, error: uploadError } = await supabase.functions.invoke('upload-order-images', {
        body: {
          orderId: paymentIntent.orderId,
          files: fileData
        }
      });

      if (uploadError) throw uploadError;

      // Phase 4: Connecting to Stripe
      setPhase('connecting-stripe');
      setCheckoutUrl(paymentIntent.checkout_url);
      
      // Immediate redirect to Stripe
      if (paymentIntent.checkout_url) {
        window.location.href = paymentIntent.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (error: any) {
      console.error('Payment process error:', error);
      setError(error.message || 'Payment processing failed. Please try again.');
    }
  };

  const handleRetry = () => {
    setError(null);
    setPhase('preparing');
    setOperationStatus('');
    setShowFallbackButton(false);
    setCheckoutUrl('');
    handlePaymentProcess();
  };

  const handleCancel = () => {
    localStorage.removeItem('paymentData');
    navigate('/', { replace: true });
  };

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

  if (!uploadedFiles.length) {
    return null; // Will redirect in useEffect
  }

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
          {error ? (
            <>
              {/* Error State */}
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
                <Button onClick={handleRetry} variant="cosmic" size="lg">
                  Try Again
                </Button>
                <Button onClick={handleCancel} variant="outline" size="lg">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Upload
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Loading State */}
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

              {/* Fallback Button for Stripe */}
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
              {phase !== 'connecting-stripe' && (
                <Button 
                  onClick={handleCancel} 
                  variant="ghost" 
                  className="mt-6"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Cancel and Return to Upload
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}