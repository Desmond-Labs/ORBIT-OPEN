import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AuthPage } from './AuthPage';
import { ProcessingSteps } from './processing/ProcessingSteps';
import { AuthStep } from './processing/AuthStep';
import { UploadStep } from './processing/UploadStep';
import { ProcessingStep } from './processing/ProcessingStep';
import { CompleteStep } from './processing/CompleteStep';
import { ErrorStep } from './processing/ErrorStep';
import { useProcessingState } from '@/hooks/useProcessingState';
import { useRealTimeOrderUpdates } from '@/hooks/useRealTimeOrderUpdates';
import { calculateCost } from '@/utils/processingUtils';

interface ProcessingPageProps {
  onBack: () => void;
}

export const ProcessingPage: React.FC<ProcessingPageProps> = ({ onBack }) => {
  const {
    currentStep,
    setCurrentStep,
    uploadedFiles,
    setUploadedFiles,
    totalCost,
    setTotalCost,
    processingProgress,
    setProcessingProgress,
    user,
    isAuthenticating,
    showAuthPage,
    setShowAuthPage,
    paymentLoading,
    setPaymentLoading,
    orderId,
    setOrderId,
    analysisType,
    setAnalysisType,
    processingResults,
    setProcessingResults,
    realTimeOrderData,
    setRealTimeOrderData,
    processingStage,
    setProcessingStage,
    processingError,
    setProcessingError,
  } = useProcessingState();

  const { setupRealTimeSubscription } = useRealTimeOrderUpdates(
    setRealTimeOrderData,
    setProcessingStage,
    setProcessingProgress,
    setCurrentStep
  );

  const { toast } = useToast();

  // Setup real-time subscription when order ID is available
  useEffect(() => {
    if (orderId && currentStep === 'processing') {
      const cleanup = setupRealTimeSubscription(orderId);
      loadOrderAndStartProcessing(orderId);
      return () => {
        cleanup();
      };
    }
  }, [orderId, currentStep, setupRealTimeSubscription]);

  const loadOrderAndStartProcessing = async (orderIdParam: string) => {
    try {
      // Load order details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderIdParam)
        .single();

      if (orderError || !order) {
        throw new Error('Order not found');
      }

      // Set total cost and image count from order
      setTotalCost(order.total_cost);
      
      // Start processing directly - images are already uploaded during payment
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
        description: `Successfully processed ${data.results?.success_count || order.image_count} images`,
        variant: "default"
      });

    } catch (error: any) {
      console.error('Order processing error:', error);
      setProcessingError(error.message || "There was an error processing your order.");
      setCurrentStep('error');
      
      toast({
        title: "Processing Failed", 
        description: error.message || "There was an error processing your order.",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    console.log('Files uploaded:', files.length, files.map(f => f.name));
    
    // Add new files to existing ones
    const allFiles = [...uploadedFiles, ...files];
    setUploadedFiles(allFiles);
    setTotalCost(calculateCost(allFiles.length));
    console.log('Total files:', allFiles.length, 'Total cost calculated:', calculateCost(allFiles.length));
  };

  const handleAuthSuccess = () => {
    setShowAuthPage(false);
    setCurrentStep('upload');
  };

  const handlePayment = async () => {
    if (!user || uploadedFiles.length === 0 || paymentLoading) return;

    setPaymentLoading(true);
    try {
      console.log('🚀 Starting payment process with', uploadedFiles.length, 'files');

      // Step 1: Create checkout session
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          imageCount: uploadedFiles.length,
          batchName: `Batch ${new Date().toISOString()}`
        }
      });

      if (error) {
        console.error('❌ Payment intent creation failed:', error);
        throw error;
      }

      console.log('✅ Payment intent created:', data.order_id);
      setOrderId(data.order_id);

      // Step 2: Convert files to base64 for upload
      const filesToUpload = await Promise.all(
        uploadedFiles.map(async (file) => {
          return new Promise<{name: string; size: number; type: string; data: string}>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64Data = reader.result as string;
              // Remove data:image/jpeg;base64, prefix
              const cleanBase64 = base64Data.split(',')[1];
              resolve({
                name: file.name,
                size: file.size,
                type: file.type,
                data: cleanBase64
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      console.log('✅ Files converted to base64, uploading...');

      // Step 3: Upload images (this will be done after payment)
      // For now, we'll redirect to payment and handle upload in payment success

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        // Store files in session storage for upload after payment
        sessionStorage.setItem('pendingUpload', JSON.stringify({
          orderId: data.order_id,
          batchId: data.batch_id,
          files: filesToUpload
        }));
        
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }

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

  const handleProcessMore = () => {
    setCurrentStep('upload');
    setUploadedFiles([]);
    setTotalCost(0);
    setProcessingProgress(0);
    setProcessingResults(null);
    setProcessingError(null);
  };

  const handleRetryProcessing = () => {
    if (orderId) {
      setProcessingError(null);
      setCurrentStep('processing');
      loadOrderAndStartProcessing(orderId);
    }
  };

  const handleStartOver = () => {
    setCurrentStep('upload');
    setUploadedFiles([]);
    setTotalCost(0);
    setProcessingProgress(0);
    setProcessingResults(null);
    setProcessingError(null);
    setOrderId(null);
  };

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
          <ProcessingSteps currentStep={currentStep} processingStage={processingStage} />

          {/* Debug info */}
          <div className="mb-4 p-2 bg-secondary/20 rounded text-xs">
            Current step: {currentStep} | Files: {uploadedFiles.length} | Cost: ${totalCost}
          </div>

          {/* Step Content */}
          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 p-8">
            {currentStep === 'auth' && (
              <AuthStep onShowAuth={() => setShowAuthPage(true)} />
            )}

            {currentStep === 'upload' && (
              <UploadStep
                analysisType={analysisType}
                onAnalysisTypeChange={setAnalysisType}
                onFileUpload={handleFileUpload}
                uploadedFiles={uploadedFiles}
                totalCost={totalCost}
                paymentLoading={paymentLoading}
                onPayment={handlePayment}
              />
            )}

            {currentStep === 'processing' && (
              <ProcessingStep
                processingStage={processingStage}
                analysisType={analysisType}
                realTimeOrderData={realTimeOrderData}
                processingProgress={processingProgress}
                uploadedFiles={uploadedFiles}
              />
            )}

            {currentStep === 'error' && (
              <ErrorStep
                error={processingError || 'Unknown error occurred'}
                orderId={orderId || undefined}
                onRetry={handleRetryProcessing}
                onBack={handleStartOver}
              />
            )}

            {currentStep === 'complete' && (
              <CompleteStep
                analysisType={analysisType}
                processingResults={processingResults}
                uploadedFiles={uploadedFiles}
                onProcessMore={handleProcessMore}
              />
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};