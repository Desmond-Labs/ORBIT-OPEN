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
          
          // Upload files if they haven't been uploaded yet
          await handleFileUploadAfterPayment(order);
          
          // Auto-redirect to processing after 5 seconds
          setTimeout(() => {
            navigate(`/?step=processing&order=${order.id}`);
          }, 5000);
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
          description: "Your payment has been processed. Uploading your images...",
          variant: "default"
        });

        // Upload files after successful payment
        await handleFileUploadAfterPayment(order);

        // Auto-redirect to processing after 5 seconds
        setTimeout(() => {
          navigate(`/?step=processing&order=${order.id}`);
        }, 5000);

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

  const handleFileUploadAfterPayment = async (order: any) => {
    try {
      // Get files from localStorage
      const storedFiles = localStorage.getItem('orbit_pending_files');
      if (!storedFiles) {
        console.log('No files found in localStorage');
        return;
      }

      const filesData = JSON.parse(storedFiles);
      console.log('📁 Found', filesData.length, 'files in localStorage');

      // Convert back to File objects for upload
      const files = filesData.map((fileData: any) => ({
        name: fileData.name,
        type: fileData.type,
        data: fileData.data.split(',')[1] // Remove data URL prefix
      }));

      toast({
        title: "Uploading Images",
        description: `Uploading ${files.length} images to your order...`,
        variant: "default"
      });

      const uploadResult = await uploadFiles(files);
      
      if (uploadResult.successCount > 0) {
        toast({
          title: "Upload Complete!",
          description: `Successfully uploaded ${uploadResult.successCount} images`,
          variant: "default"
        });
      }

      // Clean up localStorage
      localStorage.removeItem('orbit_pending_files');
      localStorage.removeItem('orbit_pending_order_id');

    } catch (error: any) {
      console.error('File upload error:', error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your images. Please contact support.",
        variant: "destructive"
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

  const uploadFiles = async (files: File[]) => {
    if (!orderData || !files.length) return;

    try {
      // Convert files to base64 for upload
      const filePromises = files.map(async (file) => {
        return new Promise<{name: string, data: string, type: string}>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            const data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
            resolve({
              name: file.name,
              data,
              type: file.type
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const processedFiles = await Promise.all(filePromises);

      const { data, error } = await supabase.functions.invoke('upload-order-images', {
        body: {
          orderId: orderData.id,
          files: processedFiles
        }
      });

      if (error) throw error;

      console.log('Upload successful:', data);
      return data;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
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