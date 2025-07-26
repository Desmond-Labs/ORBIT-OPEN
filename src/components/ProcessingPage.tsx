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
    operationStatus,
    setOperationStatus,
    paymentError,
    setPaymentError,
    checkoutUrl,
    setCheckoutUrl,
    // Helper functions
    resetPaymentState,
    updateOperationStatus,
    canInitiatePayment,
    setLastPaymentAttempt,
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
      console.log('📤 Starting file upload for order:', orderId);
      setPaymentPhase('uploading');
      setUploadProgress({ current: 0, total: uploadedFiles.length });
      
      // Convert files to base64 with progress tracking
      const filesData = await Promise.all(
        uploadedFiles.map(async (file, index) => {
          return new Promise<{name: string, data: string, type: string}>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              const data = base64.split(',')[1];
              setUploadProgress(prev => ({ ...prev, current: index + 1 }));
              resolve({ name: file.name, data, type: file.type });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      // Upload to storage
      const { data, error } = await supabase.functions.invoke('upload-order-images', {
        body: { orderId, files: filesData }
      });

      if (error) throw error;
      console.log('✅ Files uploaded successfully');
      return data;
    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw error;
    }
  };

  const handlePayment = async () => {
    // Prevent double-clicks and ensure prerequisites
    if (!canInitiatePayment() || !user || uploadedFiles.length === 0) {
      console.log('🚫 Payment blocked:', { canInitiate: canInitiatePayment(), user: !!user, files: uploadedFiles.length });
      return;
    }

    // Reset state and prevent rapid successive calls
    resetPaymentState();
    setLastPaymentAttempt(Date.now());
    setPaymentLoading(true);
    
    try {
      console.log('🚀 Starting streamlined payment process:', uploadedFiles.length, 'files');
      
      // Step 1: Initialize processing
      setPaymentPhase('processing');
      updateOperationStatus('Creating payment session...');
      
      // Step 2: Create payment intent and upload files in parallel
      const [paymentResult, ] = await Promise.all([
        // Create payment session
        supabase.functions.invoke('create-payment-intent', {
          body: {
            imageCount: uploadedFiles.length,
            batchName: `Batch ${new Date().toISOString()}`
          }
        }),
        // Start file upload process (will be completed after payment session is ready)
        Promise.resolve() // Placeholder for now, will upload after getting order ID
      ]);

      if (paymentResult.error) throw paymentResult.error;

      const { data: paymentData } = paymentResult;
      console.log('💳 Payment session created for order:', paymentData.order_id);
      setOrderId(paymentData.order_id);
      
      // Step 3: Upload files to storage
      updateOperationStatus('Uploading images...');
      await uploadFilesToStorage(paymentData.order_id);
      
      // Store order ID for recovery
      localStorage.setItem('orbit_pending_order_id', paymentData.order_id);

      // Step 4: Prepare for Stripe redirect
      setPaymentPhase('payment-ready');
      setCheckoutUrl(paymentData.checkout_url);
      updateOperationStatus('Payment ready');
      
      // Small delay to show status, then redirect
      setTimeout(() => {
        setPaymentPhase('redirecting');
        window.open(paymentData.checkout_url, '_blank');
        
        // Show fallback after short delay
        setTimeout(() => {
          setPaymentPhase('payment-fallback');
        }, 2000);
      }, 1000);

    } catch (error: any) {
      console.error('❌ Payment error:', error);
      setPaymentError(error.message || "Payment processing failed. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentRetry = () => {
    console.log('🔄 Retrying payment');
    resetPaymentState();
    handlePayment();
  };

  const handlePaymentCancel = () => {
    console.log('❌ Payment cancelled');
    resetPaymentState();
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
          operationStatus={operationStatus}
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
                canInitiatePayment={canInitiatePayment()}
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
