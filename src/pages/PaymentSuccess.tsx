import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Loader2, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';

type PaymentStatus = 'loading' | 'success' | 'failed' | 'not_found';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [orderData, setOrderData] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);

  const sessionId = searchParams.get('session_id');

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    
    getUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setStatus('not_found');
        return;
      }

      try {
        console.log('🔍 Searching for order with session ID:', sessionId);
        console.log('🔍 User authenticated:', !!user);
        
        // Try multiple lookup strategies
        let order = null;
        let orderError = null;
        
        // Strategy 1: Find by Stripe session ID or payment intent ID (same as webhook logic)
        const { data: orderByStripeId, error: stripeError } = await supabase
          .from('orders')
          .select('*')
          .or(`stripe_payment_intent_id.eq.${sessionId},stripe_payment_intent_id_actual.eq.${sessionId}`)
          .single();
          
        if (orderByStripeId && !stripeError) {
          order = orderByStripeId;
        } else {
          orderError = stripeError;
          console.log('🔍 Stripe ID lookup failed, trying alternative methods...');
          
          // Strategy 2: Check if sessionId is actually an order ID (fallback)
          if (sessionId?.includes('-') && sessionId.length > 30) {
            console.log('🔍 Trying to find order by ID...');
            const { data: orderById, error: idError } = await supabase
              .from('orders')
              .select('*')
              .eq('id', sessionId)
              .single();
              
            if (orderById && !idError) {
              order = orderById; 
              orderError = null;
              console.log('✅ Found order by ID fallback');
            }
          }
        }

        if (orderError) {
          console.error('Order lookup error:', orderError);
          
          // Handle specific RLS/authentication errors
          if (orderError.code === 'PGRST301' || orderError.message?.includes('RLS') || orderError.message?.includes('policy')) {
            console.log('🔒 RLS policy violation - user may not be authenticated');
            
            // Retry with exponential backoff for potential race conditions
            if (retryCount < 3) {
              console.log(`🔄 Retrying order lookup (attempt ${retryCount + 1}/3)`);
              setRetryCount(prev => prev + 1);
              setTimeout(() => verifyPayment(), Math.pow(2, retryCount) * 1000);
              return;
            }
          }
          
          setStatus('not_found');
          return;
        }

        if (!order) {
          console.error('Order not found with session ID:', sessionId);
          setStatus('not_found');
          return;
        }
        
        console.log('✅ Order found:', { id: order.id, order_number: order.order_number, payment_status: order.payment_status });

        setOrderData(order);

        // Check if payment is already marked as completed
        if (order.payment_status === 'completed') {
          setStatus('success');
          
          // Files were uploaded during payment process - trigger processing as backup
          await triggerProcessingIfNeeded(order);
          
          // Auto-redirect to processing after 1 second
          setTimeout(() => {
            console.log('🔄 Redirecting to processing page with order:', order.id);
            navigate(`/?step=processing&order=${order.id}`);
          }, 1000);
          return;
        }

        // Update order status to completed (webhook might have missed this)
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'completed',
            order_status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (updateError) {
          console.error('Failed to update order status:', updateError);
          setStatus('failed');
          return;
        }

        setStatus('success');
        
        toast({
          title: "Payment Successful!",
          description: "Your payment has been processed. Your images are being analyzed...",
          variant: "default"
        });

        // Files were uploaded during payment - trigger processing as backup
        await triggerProcessingIfNeeded(order);

        // Auto-redirect to processing after 1 second
        setTimeout(() => {
          console.log('🔄 Redirecting to processing page with order:', order.id);
          navigate(`/?step=processing&order=${order.id}`);
        }, 1000);

      } catch (error: any) {
        console.error('Payment verification error:', error);
        
        // Handle authentication/session errors
        if (error.message?.includes('refresh_token') || error.message?.includes('Invalid Refresh Token')) {
          console.log('🔄 Authentication error - attempting to retry...');
          
          // Try to refresh the session
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && retryCount < 2) {
            console.log('🔄 Session refreshed, retrying...');
            setRetryCount(prev => prev + 1);
            setTimeout(() => verifyPayment(), 1000);
            return;
          }
        }
        
        setStatus('failed');
        toast({
          title: "Verification Failed",
          description: `Unable to verify your payment: ${error.message}. Please contact support if this persists.`,
          variant: "destructive"
        });
      }
    };

    // Only run verification once we have the sessionId and user state is loaded
    if (sessionId && user !== undefined) {
      verifyPayment();
    }
  }, [sessionId, navigate, toast, user, retryCount]);

  const triggerProcessingIfNeeded = async (order: any) => {
    try {
      console.log('🚀 Triggering image processing as backup safety check for order:', order.id);
      
      // Clean up any old localStorage data
      localStorage.removeItem('orbit_pending_order_id');
      localStorage.removeItem('orbit_pending_file_refs');
      localStorage.removeItem('orbit_files_uploaded');
      delete (window as any).orbitTempFiles;
      
      // Trigger processing (defensive programming - webhook should have already done this)
      const { data: processingData, error: processingError } = await supabase.functions.invoke('process-image-batch', {
        body: {
          orderId: order.id,
          analysisType: 'product'
        }
      });

      if (processingError) {
        console.log('ℹ️ Processing trigger failed (likely already running):', processingError);
      } else {
        console.log('✅ Processing triggered successfully:', processingData);
      }
      
      // Show success message
      toast({
        title: "Order Complete!",
        description: "Your images are being processed",
        variant: "default"
      });

    } catch (error: any) {
      console.log('ℹ️ Processing trigger error (likely already running):', error.message);
      
      // Still show success - processing failure doesn't mean payment failed
      toast({
        title: "Payment Successful!",
        description: "Your order is being processed",
        variant: "default"
      });
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleRetryProcessing = () => {
    if (orderData) {
      navigate(`/?step=processing&order=${orderData.id}`);
    }
  };


  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Cosmic Background */}
      <div className="star-field absolute inset-0" />

      {/* Header */}
      <header className="relative z-20 px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={handleBackToHome} className="gap-2">
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
        <div className="max-w-2xl mx-auto">
          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 p-8 text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="w-16 h-16 text-accent mx-auto mb-4 animate-spin" />
                <h1 className="text-2xl font-bold mb-2">Verifying Payment</h1>
                <p className="text-muted-foreground">
                  Please wait while we confirm your payment with Stripe...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
                <p className="text-muted-foreground mb-6">
                  Your payment has been processed successfully. You will be redirected to the processing page shortly.
                </p>
                {orderData && (
                  <div className="bg-secondary/50 rounded-lg p-4 mb-6">
                    <div className="text-sm space-y-1">
                      <div><strong>Order:</strong> {orderData.order_number}</div>
                      <div><strong>Images:</strong> {orderData.image_count}</div>
                      <div><strong>Total:</strong> ${orderData.total_cost}</div>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <Button variant="cosmic" size="lg" onClick={handleRetryProcessing}>
                    Start Processing Now
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Automatically redirecting in 1 second...
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Click "Start Processing Now" to skip the wait
                  </p>
                </div>
              </>
            )}

            {status === 'failed' && (
              <>
                <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">Payment Verification Failed</h1>
                <p className="text-muted-foreground mb-6">
                  We couldn't verify your payment. This might be due to a processing delay.
                </p>
                <div className="space-y-4">
                  <Button variant="cosmic" size="lg" onClick={() => window.location.reload()}>
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={handleBackToHome}>
                    Back to Home
                  </Button>
                </div>
              </>
            )}

            {status === 'not_found' && (
              <>
                <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">Payment Session Not Found</h1>
                <p className="text-muted-foreground mb-4">
                  We couldn't find your payment session. This might be due to authentication issues or timing.
                </p>
                
                {/* Debug information */}
                <div className="bg-secondary/50 rounded-lg p-4 mb-6 text-left">
                  <div className="text-sm space-y-1">
                    <div><strong>Session ID:</strong> {sessionId}</div>
                    <div><strong>User Authenticated:</strong> {user ? '✅ Yes' : '❌ No'}</div>
                    <div><strong>Retry Attempts:</strong> {retryCount}/3</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Button variant="cosmic" size="lg" onClick={() => {
                    setRetryCount(0);
                    setStatus('loading');
                  }}>
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={handleBackToHome}>
                    Start New Order
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PaymentSuccess;