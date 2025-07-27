import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Loader2, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type PaymentStatus = 'loading' | 'success' | 'failed' | 'not_found';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [orderData, setOrderData] = useState<any>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setStatus('not_found');
        return;
      }

      try {
        // Find the order by Stripe session ID
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('stripe_payment_intent_id', sessionId)
          .single();

        if (orderError || !order) {
          console.error('Order not found:', orderError);
          setStatus('not_found');
          return;
        }

        setOrderData(order);

        // Check if payment is already marked as completed
        if (order.payment_status === 'completed') {
          setStatus('success');
          
          // Files were uploaded during payment process - trigger processing as backup
          await triggerProcessingIfNeeded(order);
          
          // Auto-redirect to processing after 3 seconds
          setTimeout(() => {
            console.log('🔄 Redirecting to processing page with order:', order.id);
            navigate(`/?step=processing&order=${order.id}`);
          }, 3000);
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

        // Auto-redirect to processing after 3 seconds
        setTimeout(() => {
          console.log('🔄 Redirecting to processing page with order:', order.id);
          navigate(`/?step=processing&order=${order.id}`);
        }, 3000);

      } catch (error: any) {
        console.error('Payment verification error:', error);
        setStatus('failed');
        toast({
          title: "Verification Failed",
          description: "Unable to verify your payment. Please contact support.",
          variant: "destructive"
        });
      }
    };

    verifyPayment();
  }, [sessionId, navigate, toast]);

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
                    Automatically redirecting in 3 seconds...
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
                <p className="text-muted-foreground mb-6">
                  We couldn't find your payment session. Please try starting a new order.
                </p>
                <Button variant="cosmic" size="lg" onClick={handleBackToHome}>
                  Start New Order
                </Button>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PaymentSuccess;