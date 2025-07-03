import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, CreditCard, Download, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';

interface ProcessingPageProps {
  onBack: () => void;
}

type ProcessingStep = 'upload' | 'auth' | 'payment' | 'processing' | 'complete';

export const ProcessingPage: React.FC<ProcessingPageProps> = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);

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
      setCurrentStep('auth');
    }
  };

  const handleAuth = () => {
    // TODO: Implement authentication
    setCurrentStep('payment');
  };

  const handlePayment = () => {
    // TODO: Implement Stripe payment
    setCurrentStep('processing');
    // Simulate processing
    simulateProcessing();
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
    upload: { title: 'Upload Images', icon: Upload },
    auth: { title: 'Sign In', icon: CheckCircle },
    payment: { title: 'Payment', icon: CreditCard },
    processing: { title: 'AI Processing', icon: Loader2 },
    complete: { title: 'Download Ready', icon: Download },
  };

  const steps: ProcessingStep[] = ['upload', 'auth', 'payment', 'processing', 'complete'];
  const currentStepIndex = steps.indexOf(currentStep);

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
                {currentStep === 'upload' && 'Select your product images to begin analysis'}
                {currentStep === 'auth' && 'Sign in to continue with processing'}
                {currentStep === 'payment' && 'Complete payment to start AI analysis'}
                {currentStep === 'processing' && 'ORBIT is analyzing your images...'}
                {currentStep === 'complete' && 'Your enhanced images are ready for download'}
              </p>
            </div>
          </div>

          {/* Step Content */}
          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 p-8">
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
                  <label htmlFor="file-upload">
                    <Button variant="cosmic" size="lg" className="cursor-pointer">
                      Choose Images
                    </Button>
                  </label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Supported formats: JPG, PNG, WebP • Max 50MB per image
                </p>
              </div>
            )}

            {currentStep === 'auth' && (
              <div className="max-w-md mx-auto text-center">
                <CheckCircle className="w-16 h-16 text-accent mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Sign In to Continue</h3>
                <p className="text-muted-foreground mb-6">
                  {uploadedFiles.length} images selected • Total cost: ${totalCost}
                </p>
                <div className="space-y-4">
                  <Button variant="cosmic" size="lg" onClick={handleAuth} className="w-full">
                    Sign In with Email
                  </Button>
                  <Button variant="outline" size="lg" className="w-full">
                    Continue as Guest
                  </Button>
                </div>
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
                <Button variant="cosmic" size="lg" onClick={handlePayment} className="w-full">
                  Pay with Stripe
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