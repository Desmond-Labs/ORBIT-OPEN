import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ProcessingStatusDashboard } from './processing/ProcessingStatusDashboard';
import { useOrderProcessingStatus } from '@/hooks/useOrderProcessingStatus';
import { useProcessingState } from '@/hooks/useProcessingState';
import { useRealTimeOrderUpdates } from '@/hooks/useRealTimeOrderUpdates';
import { calculateCost } from '@/utils/processingUtils';

interface ProcessingPageProps {
  onBack: () => void;
}

export const ProcessingPage: React.FC<ProcessingPageProps> = ({ onBack }) => {
  const navigate = useNavigate();
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
    operationStatus,
    setOperationStatus,
    // New helper functions
    resetPaymentState,
    resetPaymentStateForRetry,
    calculatePhaseDuration,
    canInitiatePayment,
    phaseLocked,
    setPhaseLocked,
    setLastPaymentAttempt,
    redirectAttempted,
    setRedirectAttempted,
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
      console.log('📤 Starting direct file upload to storage for order:', orderId);
      setPaymentPhase('uploading');
      setUploadProgress({ current: 0, total: uploadedFiles.length });
      
      // Create FormData for direct file upload (no base64 conversion!)
      console.log('📋 Preparing direct file upload...');
      const formData = new FormData();
      formData.append('orderId', orderId);
      
      uploadedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
        console.log(`✅ Added file ${index + 1}/${uploadedFiles.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        setUploadProgress(prev => ({ ...prev, current: index + 1 }));
      });

      console.log('📡 Invoking direct upload function with', uploadedFiles.length, 'files');
      
      // Get auth token for the request
      const session = await supabase.auth.getSession();
      const authToken = session.data.session?.access_token;
      
      if (!authToken) {
        throw new Error('No authentication token available');
      }

      // Use direct fetch to upload FormData
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/upload-order-images-direct`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Files uploaded successfully via direct upload:', data);
      return data;
    } catch (error) {
      console.error('❌ Direct file upload failed:', error);
      throw error;
    }
  };

  const handlePayment = async () => {
    // Debouncing check - prevent multiple rapid clicks
    if (!canInitiatePayment() || !user || uploadedFiles.length === 0) {
      console.log('🚫 Payment blocked:', { canInitiate: canInitiatePayment(), user: !!user, files: uploadedFiles.length });
      return;
    }

    // Start payment loading state
    setPaymentLoading(true);
    setLastPaymentAttempt(Date.now());
    
    try {
      console.log('🚀 Starting payment process with', uploadedFiles.length, 'files');
      
      // Create checkout session
      console.log('💳 Creating payment intent');
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          imageCount: uploadedFiles.length,
          batchName: `Batch ${new Date().toISOString()}`
        }
      });

      if (paymentError) {
        console.error('💥 Payment error:', paymentError);
        throw paymentError;
      }

      console.log('✅ Payment intent created successfully:', paymentData);
      setOrderId(paymentData.order_id);
      
      // Upload files immediately (parallel with payment process)
      console.log('📤 Uploading files immediately for parallel processing');
      await uploadFilesToStorage(paymentData.order_id);
      
      console.log('✅ Files uploaded successfully - images ready for processing');

      // Store data for the payment waiting page
      localStorage.setItem('orbit-checkout-url', paymentData.checkout_url);
      localStorage.setItem('orbit-total-cost', totalCost.toString());
      localStorage.setItem('orbit-file-count', uploadedFiles.length.toString());
      localStorage.setItem('orbit-order-id', paymentData.order_id);
      
      // Navigate directly to payment waiting page (single loading experience)
      console.log('🚀 Navigating directly to payment waiting page');
      navigate(`/payment-waiting?checkoutUrl=${encodeURIComponent(paymentData.checkout_url)}&totalCost=${totalCost}&fileCount=${uploadedFiles.length}&orderId=${paymentData.order_id}`);

    } catch (error: any) {
      console.error('❌ Payment error:', error);
      setPaymentError(error.message || "There was an error processing your payment. Please try again.");
      setPaymentLoading(false);
    }
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
                isProcessing={paymentLoading}
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
