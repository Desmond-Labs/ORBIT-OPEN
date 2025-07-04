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

  const handleImageUpload = async (order: any) => {
    try {
      const pendingUpload = sessionStorage.getItem('pendingUpload');
      if (!pendingUpload) {
        console.log('🔍 No pending upload found in session storage');
        return;
      }

      const uploadData = JSON.parse(pendingUpload);
      console.log('📤 Found pending upload data:', uploadData);

      // Create batch first if it doesn't exist
      let batchId = order.batch_id;
      if (!batchId) {
        const { data: batch, error: batchError } = await supabase
          .from('batches')
          .insert({
            user_id: order.user_id,
            order_id: order.id,
            name: `Batch for Order ${order.order_number}`,
            status: 'uploading',
            image_count: uploadData.files.length,
            quality_level: 'standard'
          })
          .select()
          .single();

        if (batchError) {
          throw new Error(`Failed to create batch: ${batchError.message}`);
        }
        batchId = batch.id;

        // Update order with batch_id
        await supabase
          .from('orders')
          .update({ batch_id: batchId })
          .eq('id', order.id);
      }

      // Upload images using the edge function
      const { data: uploadResult, error: uploadError } = await supabase.functions.invoke('upload-images', {
        body: {
          orderId: order.id,
          batchId: batchId,
          files: uploadData.files
        }
      });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('✅ Images uploaded successfully:', uploadResult);
      
      // Clear session storage
      sessionStorage.removeItem('pendingUpload');
      
      toast({
        title: "Images Uploaded!",
        description: `Successfully uploaded ${uploadResult.count} images`,
        variant: "default"
      });

    } catch (error: any) {
      console.error('❌ Image upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload images. You can retry processing.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const verifyPaymentAndUploadImages = async () => {
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
          console.log('✅ Payment already completed, checking for images');
          
          // Check if images have been uploaded
          const { data: images } = await supabase
            .from('images')
            .select('*')
            .eq('order_id', order.id);

          if (!images || images.length === 0) {
            console.log('📤 No images found, attempting to upload from session storage');
            await handleImageUpload(order);
          } else {
            console.log('✅ Images already uploaded:', images.length);
          }

          setStatus('success');
          // Auto-redirect to processing after 3 seconds
          setTimeout(() => {
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

        // Handle image upload after successful payment
        await handleImageUpload(order);

        setStatus('success');
        
        toast({
          title: "Payment Successful!",
          description: "Your payment has been processed. Redirecting to image processing...",
          variant: "default"
        });

        // Auto-redirect to processing after 3 seconds
        setTimeout(() => {
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

    verifyPaymentAndUploadImages();
  }, [sessionId, navigate, toast]);

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