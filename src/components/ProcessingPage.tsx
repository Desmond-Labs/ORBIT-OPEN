import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, CreditCard, Download, CheckCircle, Loader2, ArrowLeft, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AuthPage } from './AuthPage';
import { loadStripe } from '@stripe/stripe-js';

interface ProcessingPageProps {
  onBack: () => void;
}

type ProcessingStep = 'auth' | 'upload' | 'payment' | 'processing' | 'complete';

export const ProcessingPage: React.FC<ProcessingPageProps> = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('auth');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Check authentication status on component mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setCurrentStep('upload');
      } else {
        setCurrentStep('auth');
      }
      setIsAuthenticating(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          if (currentStep === 'auth') {
            setCurrentStep('upload');
          }
        } else {
          setUser(null);
          setCurrentStep('auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const calculateCost = (imageCount: number) => {
    let cost = 0;
    let remaining = imageCount;

    // First 49 images: $3.75 each
    if (remaining > 0) {
      const tier1 = Math.min(remaining, 49);
      cost += tier1 * 3.75;
      remaining -= tier1;
    }

    // Next 50 images (50-99): $3.25 each
    if (remaining > 0) {
      const tier2 = Math.min(remaining, 50);
      cost += tier2 * 3.25;
      remaining -= tier2;
    }

    // Next 150 images (100-249): $2.75 each
    if (remaining > 0) {
      const tier3 = Math.min(remaining, 150);
      cost += tier3 * 2.75;
      remaining -= tier3;
    }

    // Remaining images (250+): $2.25 each
    if (remaining > 0) {
      cost += remaining * 2.25;
    }

    return Number(cost.toFixed(2));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(files);
    setTotalCost(calculateCost(files.length));
    if (files.length > 0) {
      setCurrentStep('payment');
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthPage(false);
    setCurrentStep('upload');
  };

  const handlePayment = async () => {
    if (!user || uploadedFiles.length === 0) return;

    setPaymentLoading(true);
    try {
      // Create payment intent
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          imageCount: uploadedFiles.length,
          batchName: `Batch ${new Date().toISOString()}`
        }
      });

      if (error) throw error;

      setOrderId(data.order_id);

      // Initialize Stripe
      const stripe = await loadStripe(process.env.NODE_ENV === 'production' 
        ? 'pk_live_...' // Replace with your live publishable key
        : 'pk_test_...' // Replace with your test publishable key
      );

      if (!stripe) throw new Error('Stripe failed to initialize');

      // Confirm payment
      const { error: stripeError } = await stripe.confirmPayment({
        clientSecret: data.client_secret,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
      });

      if (stripeError) {
        throw stripeError;
      }

      // If we get here, payment was successful
      setCurrentStep('processing');
      simulateProcessing();
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "There was an error processing your payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  const simulateProcessing = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 100) {
        progress = 100;
        setCurrentStep('complete');
        clearInterval(interval);
      }
      setProcessingProgress(progress);
    }, 500);
  };

  const stepConfig = {
    auth: { title: 'Sign In', icon: User },
    upload: { title: 'Upload Images', icon: Upload },
    payment: { title: 'Payment', icon: CreditCard },
    processing: { title: 'AI Processing', icon: Loader2 },
    complete: { title: 'Download Ready', icon: Download },
  };

  const steps: ProcessingStep[] = ['auth', 'upload', 'payment', 'processing', 'complete'];
  const currentStepIndex = steps.indexOf(currentStep);

  if (showAuthPage) {
    return <AuthPage onBack={() => setShowAuthPage(false)} onAuthenticated={handleAuthSuccess} />;
  }

  if (isAuthenticating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="star-field absolute inset-0" />
        <div className="relative z-10">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Cosmic Background */}
      <div className="star-field absolute inset-0" />

      {/* Header */}
      <header className="relative z-20 px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold">O</span>
            </div>
            <span className="text-lg font-bold gradient-text">ORBIT</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 pb-32">
        <div className="max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => {
                const StepIcon = stepConfig[step].icon;
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;
                const isProcessing = step === 'processing' && currentStep === 'processing';

                return (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        isActive
                          ? 'bg-primary border-primary shadow-cosmic'
                          : isCompleted
                          ? 'bg-accent border-accent'
                          : 'bg-transparent border-muted-foreground/30'
                      }`}
                    >
                      <StepIcon
                        className={`w-5 h-5 ${
                          isProcessing ? 'animate-spin' : ''
                        } ${
                          isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      />
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-20 h-0.5 transition-colors duration-300 ${
                          isCompleted ? 'bg-accent' : 'bg-muted-foreground/30'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">{stepConfig[currentStep].title}</h2>
              <p className="text-muted-foreground">
                {currentStep === 'auth' && 'Sign in to access ORBIT image processing'}
                {currentStep === 'upload' && 'Select your product images to begin analysis'}
                {currentStep === 'payment' && 'Complete payment to start AI analysis'}
                {currentStep === 'processing' && 'ORBIT is analyzing your images...'}
                {currentStep === 'complete' && 'Your enhanced images are ready for download'}
              </p>
            </div>
          </div>

          {/* Step Content */}
          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 p-8">
            {currentStep === 'auth' && (
              <div className="max-w-md mx-auto text-center">
                <User className="w-16 h-16 text-accent mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Sign In Required</h3>
                <p className="text-muted-foreground mb-6">
                  You need to sign in before uploading images to ORBIT
                </p>
                <Button 
                  variant="cosmic" 
                  size="lg" 
                  onClick={() => setShowAuthPage(true)} 
                  className="w-full"
                >
                  Sign In / Sign Up
                </Button>
              </div>
            )}

            {currentStep === 'upload' && (
              <div className="text-center">
                <div className="border-2 border-dashed border-accent/50 rounded-xl p-12 mb-6 hover:border-accent transition-colors">
                  <Upload className="w-16 h-16 text-accent mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Upload Your Images</h3>
                  <p className="text-muted-foreground mb-6">
                    Drag and drop your product images or click to browse
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
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
            )}

            {currentStep === 'payment' && (
              <div className="max-w-md mx-auto">
                <div className="text-center mb-6">
                  <CreditCard className="w-16 h-16 text-accent mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Complete Payment</h3>
                  <div className="bg-secondary/50 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span>Images to process:</span>
                      <span className="font-semibold">{uploadedFiles.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>${totalCost}</span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="cosmic" 
                  size="lg" 
                  onClick={handlePayment} 
                  className="w-full"
                  disabled={paymentLoading}
                >
                  {paymentLoading ? 'Processing...' : 'Pay with Stripe'}
                </Button>
              </div>
            )}

            {currentStep === 'processing' && (
              <div className="text-center">
                <Loader2 className="w-16 h-16 text-accent mx-auto mb-4 animate-spin" />
                <h3 className="text-xl font-semibold mb-2">AI Analysis in Progress</h3>
                <p className="text-muted-foreground mb-6">
                  ORBIT is extracting metadata and embedding intelligence into your images
                </p>
                <Progress value={processingProgress} className="mb-4" />
                <p className="text-sm text-muted-foreground">
                  {Math.round(processingProgress)}% complete • Processing {uploadedFiles.length} images
                </p>
              </div>
            )}

            {currentStep === 'complete' && (
              <div className="text-center">
                <Download className="w-16 h-16 text-success mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Processing Complete!</h3>
                <p className="text-muted-foreground mb-6">
                  Your images have been enhanced with AI-extracted metadata
                </p>
                <div className="space-y-4">
                  <Button variant="success" size="lg" className="w-full">
                    Download Enhanced Images
                  </Button>
                  <Button variant="outline" size="lg" className="w-full" onClick={() => {
                    setCurrentStep('upload');
                    setUploadedFiles([]);
                    setTotalCost(0);
                    setProcessingProgress(0);
                  }}>
                    Process More Images
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};