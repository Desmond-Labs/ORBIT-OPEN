import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export type ProcessingStep = 'auth' | 'upload' | 'payment' | 'processing' | 'complete';

export const useProcessingState = () => {
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('auth');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [connectingToStripe, setConnectingToStripe] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<'product' | 'lifestyle'>('product');
  const [processingResults, setProcessingResults] = useState<any>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [realTimeOrderData, setRealTimeOrderData] = useState<any>(null);
  const [processingStage, setProcessingStage] = useState<string>('pending');
  
  // Progressive payment states
  const [paymentPhase, setPaymentPhase] = useState<'preparing' | 'uploading' | 'creating-order' | 'connecting-stripe' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<string>('');
  
  // State locking for minimum display times
  const [phaseLocked, setPhaseLocked] = useState(false);
  const [lastPaymentAttempt, setLastPaymentAttempt] = useState<number>(0);
  const [redirectAttempted, setRedirectAttempted] = useState(false);

  // Comprehensive state cleanup function - only for explicit user actions
  const resetPaymentState = () => {
    console.log('🧹 Resetting payment state for fresh attempt');
    setPaymentPhase(null);
    setUploadProgress({current: 0, total: 0});
    setPaymentError(null);
    setCheckoutUrl(null);
    setOperationStatus('');
    setPaymentLoading(false);
    setConnectingToStripe(false);
    setUploadingFiles(false);
    setRedirectAttempted(false);
  };

  // Limited reset for redirect preservation
  const resetPaymentStateForRetry = () => {
    console.log('🔄 Resetting payment state while preserving redirect state');
    setPaymentError(null);
    setOperationStatus('');
  };

  // Calculate file size-aware timing
  const calculatePhaseDuration = (files: File[], baseMs: number): number => {
    const totalSizeMB = files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024);
    const multiplier = totalSizeMB < 2 ? 1.5 : totalSizeMB < 10 ? 1.2 : 1.0;
    return Math.max(baseMs * multiplier, 2000); // Minimum 2 seconds
  };

  // Debounced payment handler
  const canInitiatePayment = () => {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastPaymentAttempt;
    return !paymentLoading && !paymentPhase && timeSinceLastAttempt > 500;
  };

  // Check authentication status on component mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const orderIdFromUrl = searchParams.get('order');
      const stepFromUrl = searchParams.get('step');
      
      console.log('🔍 Processing state check:', { 
        hasUser: !!session?.user, 
        orderIdFromUrl, 
        stepFromUrl,
        currentStep 
      });
      
      if (session?.user) {
        setUser(session.user);
        
        // Priority: URL parameters override default flow
        if (orderIdFromUrl && stepFromUrl === 'processing') {
          console.log('📋 Setting processing state with order:', orderIdFromUrl);
          setOrderId(orderIdFromUrl);
          setCurrentStep('processing');
        } else if (orderIdFromUrl) {
          console.log('📋 Setting processing state with order (no step):', orderIdFromUrl);
          setOrderId(orderIdFromUrl);
          setCurrentStep('processing');
        } else {
          setCurrentStep('upload');
        }
      } else {
        setCurrentStep('auth');
      }
      setIsAuthenticating(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const orderIdFromUrl = searchParams.get('order');
        
        if (session?.user) {
          setUser(session.user);
          // Don't override processing step if we have an order ID
          if (currentStep === 'auth' && !orderIdFromUrl) {
            setCurrentStep('upload');
          }
        } else {
          setUser(null);
          setCurrentStep('auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [searchParams]);

  return {
    currentStep,
    setCurrentStep,
    uploadedFiles,
    setUploadedFiles,
    totalCost,
    setTotalCost,
    processingProgress,
    setProcessingProgress,
    user,
    setUser,
    isAuthenticating,
    setIsAuthenticating,
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
    uploadingFiles,
    setUploadingFiles,
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
  };
};
