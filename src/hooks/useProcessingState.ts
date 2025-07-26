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
  const [paymentPhase, setPaymentPhase] = useState<'preparing' | 'uploading' | 'creating-order' | 'connecting-stripe' | 'connecting-stripe-fallback' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

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
  };
};
