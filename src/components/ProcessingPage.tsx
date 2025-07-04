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
  const [analysisType, setAnalysisType] = useState<'product' | 'lifestyle'>('product');
  const [processingResults, setProcessingResults] = useState<any>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  
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
    if (!user || uploadedFiles.length === 0 || paymentLoading) return;

    setPaymentLoading(true);
    try {
      // Create checkout session
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          imageCount: uploadedFiles.length,
          batchName: `Batch ${new Date().toISOString()}`
        }
      });

      if (error) throw error;

      setOrderId(data.order_id);

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }

      // This code won't be reached because we redirect away
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "There was an error processing your payment. Please try again.",
        variant: "destructive"
      });
      setPaymentLoading(false);
    }
  };

  const startRealProcessing = async (orderIdParam: string) => {
    try {
      setUploadingFiles(true);
      
      // 1. Upload files to Supabase Storage
      const uploadedPaths = await uploadFilesToStorage(orderIdParam);
      
      // 2. Create image records in database
      await createImageRecords(orderIdParam, uploadedPaths);
      
      setUploadingFiles(false);
      
      // 3. Start batch processing
      const { data, error } = await supabase.functions.invoke('process-image-batch', {
        body: {
          orderId: orderIdParam,
          analysisType: analysisType
        }
      });

      if (error) {
        throw error;
      }

      setProcessingResults(data);
      setCurrentStep('complete');
      
      toast({
        title: "Processing Complete!",
        description: `Successfully processed ${data.results.success_count} images`,
        variant: "default"
      });

    } catch (error: any) {
      console.error('Processing error:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "There was an error processing your images.",
        variant: "destructive"
      });
    }
  };

  const uploadFilesToStorage = async (orderIdParam: string): Promise<string[]> => {
    const uploadedPaths: string[] = [];
    const batchId = crypto.randomUUID();
    
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${user.id}/${batchId}/${fileName}`;
      
      // Convert file to base64 for upload
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.storage
        .from('orbit-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw new Error(`Failed to upload ${file.name}: ${error.message}`);
      }

      uploadedPaths.push(data.path);
      
      // Update progress
      const progress = ((i + 1) / uploadedFiles.length) * 50; // Upload is 50% of progress
      setProcessingProgress(progress);
    }
    
    return uploadedPaths;
  };

  const createImageRecords = async (orderIdParam: string, uploadedPaths: string[]) => {
    const batchId = crypto.randomUUID();
    
    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert({
        user_id: user.id,
        order_id: orderIdParam,
        name: `Batch ${new Date().toISOString()}`,
        status: 'pending',
        image_count: uploadedFiles.length
      })
      .select()
      .single();

    if (batchError) {
      throw new Error(`Failed to create batch: ${batchError.message}`);
    }

    // Create image records
    const imageRecords = uploadedFiles.map((file, index) => ({
      user_id: user.id,
      batch_id: batch.id,
      order_id: orderIdParam,
      original_filename: file.name,
      storage_path_original: uploadedPaths[index],
      file_size: file.size,
      mime_type: file.type,
      processing_status: 'pending',
      analysis_type: analysisType
    }));

    const { error: imagesError } = await supabase
      .from('images')
      .insert(imageRecords);

    if (imagesError) {
      throw new Error(`Failed to create image records: ${imagesError.message}`);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
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
                {/* Analysis Type Selection */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Choose Analysis Type</h3>
                  <div className="flex gap-4 justify-center">
                    <Button
                      variant={analysisType === 'product' ? 'cosmic' : 'outline'}
                      onClick={() => setAnalysisType('product')}
                    >
                      Product Analysis
                    </Button>
                    <Button
                      variant={analysisType === 'lifestyle' ? 'cosmic' : 'outline'}
                      onClick={() => setAnalysisType('lifestyle')}
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

                <div className="border-2 border-dashed border-accent/50 rounded-xl p-12 mb-6 hover:border-accent transition-colors">
                  <Upload className="w-16 h-16 text-accent mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Upload Your Images</h3>
                  <p className="text-muted-foreground mb-6">
                    Drag and drop your images or click to browse
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
                  {uploadingFiles 
                    ? 'Uploading images to secure storage...'
                    : `ORBIT is performing ${analysisType} analysis on your images`
                  }
                </p>
                <Progress value={processingProgress} className="mb-4" />
                <p className="text-sm text-muted-foreground">
                  {uploadingFiles 
                    ? `Uploading ${uploadedFiles.length} images...`
                    : `${Math.round(processingProgress)}% complete • Processing ${uploadedFiles.length} images`
                  }
                </p>
              </div>
            )}

            {currentStep === 'complete' && (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Processing Complete!</h3>
                <p className="text-muted-foreground mb-6">
                  Your images have been analyzed with AI-powered {analysisType} analysis
                </p>
                
                {/* Results Summary */}
                {processingResults && (
                  <div className="bg-secondary/50 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold">Total Images:</span>
                        <span className="ml-2">{processingResults.results?.total_images || uploadedFiles.length}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Successful:</span>
                        <span className="ml-2 text-success">{processingResults.results?.success_count || 0}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Analysis Type:</span>
                        <span className="ml-2 capitalize">{analysisType}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Errors:</span>
                        <span className="ml-2 text-destructive">{processingResults.results?.error_count || 0}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Button variant="success" size="lg" className="w-full">
                    Download Analysis Results
                  </Button>
                  <Button variant="outline" size="lg" className="w-full" onClick={() => {
                    setCurrentStep('upload');
                    setUploadedFiles([]);
                    setTotalCost(0);
                    setProcessingProgress(0);
                    setProcessingResults(null);
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