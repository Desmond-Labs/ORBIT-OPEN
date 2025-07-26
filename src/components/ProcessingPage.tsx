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
import { PaymentProgressOverlay } from './processing/PaymentProgressOverlay';

import { ProcessingStep } from './processing/ProcessingStep';
import { CompleteStep } from './processing/CompleteStep';
import { ProcessingStatusDashboard } from './processing/ProcessingStatusDashboard';
import { useOrderProcessingStatus } from '@/hooks/useOrderProcessingStatus';
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
    connectingToStripe,
    setConnectingToStripe,
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
    paymentPhase,
    setPaymentPhase,
    uploadProgress,
    setUploadProgress,
    paymentError,
    setPaymentError,
    checkoutUrl,
    setCheckoutUrl,
  } = useProcessingState();

  const { setupRealTimeSubscription } = useRealTimeOrderUpdates(
    setRealTimeOrderData,
    setProcessingStage,
    setProcessingProgress,
    setCurrentStep
  );

  const { status: orderStatus, loading: statusLoading } = useOrderProcessingStatus(orderId);

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
      
      // Don't auto-complete - let real-time updates handle status changes
      console.log('Order loaded, monitoring for processing updates...');
      
    } catch (error: any) {
      console.error('Order processing error:', error);
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
    
    // Check if user was in the middle of an upload workflow
    const orderIdFromUrl = new URLSearchParams(window.location.search).get('order');
    const stepFromUrl = new URLSearchParams(window.location.search).get('step');
    const hasUploadedFiles = uploadedFiles.length > 0;
    
    // Only proceed to upload if user was already in an upload workflow
    if (orderIdFromUrl || stepFromUrl || hasUploadedFiles) {
      console.log('🔄 Continuing upload workflow after auth');
      setCurrentStep('upload');
    } else {
      console.log('🏠 Returning to main page after auth');
      // User just wanted to authenticate, return them to main page
      onBack();
    }
  };

  const uploadFilesToStorage = async (orderId: string) => {
    try {
      console.log('📤 Uploading files to storage for order:', orderId);
      setPaymentPhase('uploading');
      setUploadProgress({ current: 0, total: uploadedFiles.length });
      
      // Convert files to the format expected by upload-order-images
      const filesData = await Promise.all(
        uploadedFiles.map(async (file, index) => {
          return new Promise<{name: string, data: string, type: string}>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              const data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
              setUploadProgress(prev => ({ ...prev, current: index + 1 }));
              resolve({
                name: file.name,
                data,
                type: file.type
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      const { data, error } = await supabase.functions.invoke('upload-order-images', {
        body: {
          orderId: orderId,
          files: filesData
        }
      });

      if (error) throw error;
      
      console.log('✅ Files uploaded successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw error;
    }
  };

  const handlePayment = async () => {
    if (!user || uploadedFiles.length === 0 || paymentPhase) return;

    // Clear any previous errors
    setPaymentError(null);
    
    try {
      console.log('🚀 Starting payment process with', uploadedFiles.length, 'files');
      
      // Phase 1: Preparing order
      setPaymentPhase('preparing');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Minimum display time
      
      // Phase 2: Create checkout session
      setPaymentPhase('creating-order');
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          imageCount: uploadedFiles.length,
          batchName: `Batch ${new Date().toISOString()}`
        }
      });

      if (paymentError) throw paymentError;

      console.log('💳 Order created:', paymentData.order_id);
      setOrderId(paymentData.order_id);
      
      // Phase 3: Upload files to storage
      await uploadFilesToStorage(paymentData.order_id);
      
      // Store only the order ID (not file data) in localStorage
      localStorage.setItem('orbit_pending_order_id', paymentData.order_id);

      // Phase 4: Connecting to Stripe
      setPaymentPhase('connecting-stripe');
      setCheckoutUrl(paymentData.checkout_url);
      
      // Extended display time for stripe connection
      setTimeout(() => {
        setPaymentPhase('connecting-stripe-fallback');
      }, 8000);

      // Attempt automatic redirect
      setTimeout(() => {
        if (paymentData.checkout_url) {
          window.location.href = paymentData.checkout_url;
        }
      }, 2000);

    } catch (error: any) {
      console.error('❌ Payment error:', error);
      setPaymentError(error.message || "There was an error processing your payment. Please try again.");
    }
  };

  const handlePaymentRetry = () => {
    setPaymentError(null);
    setPaymentPhase(null);
    handlePayment();
  };

  const handlePaymentCancel = () => {
    setPaymentError(null);
    setPaymentPhase(null);
    setUploadProgress({ current: 0, total: 0 });
  };

  const handleProcessMore = () => {
    setCurrentStep('upload');
    setUploadedFiles([]);
    setTotalCost(0);
    setProcessingProgress(0);
    setProcessingResults(null);
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

      {/* Payment Progress Overlay */}
      {paymentPhase && (
        <PaymentProgressOverlay 
          phase={paymentPhase}
          uploadProgress={uploadProgress}
          error={paymentError}
          checkoutUrl={checkoutUrl}
          onRetry={handlePaymentRetry}
          onCancel={handlePaymentCancel}
        />
      )}

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
            Current step: {currentStep} | Files: {uploadedFiles.length} | Cost: ${totalCost} | OrderID: {orderId} | Status Loading: {statusLoading}
          </div>

          {/* Step Content */}
          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 p-8">
            {currentStep === 'auth' && (
              <AuthStep onShowAuth={() => setShowAuthPage(true)} />
            )}

            {currentStep === 'upload' && (
              <UploadStep
                onFileUpload={handleFileUpload}
                uploadedFiles={uploadedFiles}
                totalCost={totalCost}
                isProcessing={!!paymentPhase}
                onPayment={handlePayment}
              />
            )}

            {currentStep === 'processing' && (
              <>
                {statusLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                    <span className="ml-2">Loading order status...</span>
                  </div>
                ) : orderId && orderStatus ? (
                  <ProcessingStatusDashboard
                    status={orderStatus}
                    onProcessMore={handleProcessMore}
                    onBackToDashboard={user ? () => onBack() : undefined}
                  />
                ) : (
                  <ProcessingStep
                    processingStage={processingStage}
                    analysisType={analysisType}
                    realTimeOrderData={realTimeOrderData}
                    processingProgress={processingProgress}
                    uploadedFiles={uploadedFiles}
                  />
                )}
              </>
            )}

            {currentStep === 'complete' && (
              <>
                {orderStatus ? (
                  <ProcessingStatusDashboard
                    status={orderStatus}
                    onProcessMore={handleProcessMore}
                    onBackToDashboard={user ? () => onBack() : undefined}
                  />
                ) : (
                  <CompleteStep
                    processingResults={processingResults}
                    uploadedFiles={uploadedFiles}
                    onProcessMore={handleProcessMore}
                    orderId={orderId}
                  />
                )}
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};
