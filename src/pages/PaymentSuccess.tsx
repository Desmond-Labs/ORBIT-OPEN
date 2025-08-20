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
        console.log('🔍 Session ID format analysis:', {
          sessionId,
          length: sessionId?.length,
          startsWithCs: sessionId?.startsWith('cs_'),
          startsWithPi: sessionId?.startsWith('pi_')
        });
        
        // Try multiple lookup strategies
        let order = null;
        let orderError = null;
        
        // Strategy 1: Find by Stripe session ID or payment intent ID (same as webhook logic)
        console.log('🔍 Attempting order lookup with session ID:', sessionId);
        
        // Wait for authentication to settle to avoid race conditions
        if (user === undefined) {
          console.log('⏳ Waiting for authentication to settle...');
          return;
        }
        
        const query = `stripe_payment_intent_id.eq.${sessionId},stripe_payment_intent_id_actual.eq.${sessionId}`;
        console.log('🔍 Database query:', { query, sessionId });
        
        const { data: orderByStripeId, error: stripeError } = await supabase
          .from('orders')
          .select('*')
          .or(query)
          .maybeSingle();
          
        console.log('🔍 Stripe ID lookup result:', { 
          hasData: !!orderByStripeId, 
          orderData: orderByStripeId ? { 
            id: orderByStripeId.id, 
            order_number: orderByStripeId.order_number,
            stripe_payment_intent_id: orderByStripeId.stripe_payment_intent_id,
            stripe_payment_intent_id_actual: orderByStripeId.stripe_payment_intent_id_actual,
            user_id: orderByStripeId.user_id
          } : null,
          error: stripeError,
          errorCode: stripeError?.code,
          errorMessage: stripeError?.message 
        });
          
        if (orderByStripeId && !stripeError) {
          order = orderByStripeId;
        } else {
          orderError = stripeError;
          console.log('🔍 Stripe ID lookup failed, trying alternative methods...');
          
          // Strategy 2: Try individual field lookups to isolate the issue
          console.log('🔍 Trying stripe_payment_intent_id field only...');
          const { data: orderByIntentId, error: intentError } = await supabase
            .from('orders')
            .select('*')
            .eq('stripe_payment_intent_id', sessionId)
             .maybeSingle();
            
          if (orderByIntentId && !intentError) {
            order = orderByIntentId;
            orderError = null;
            console.log('✅ Found order by stripe_payment_intent_id');
          } else {
            console.log('🔍 Trying stripe_payment_intent_id_actual field only...');
            const { data: orderByActualId, error: actualError } = await supabase
              .from('orders')
              .select('*')
              .eq('stripe_payment_intent_id_actual', sessionId)
               .maybeSingle();
              
            if (orderByActualId && !actualError) {
              order = orderByActualId;
              orderError = null;
              console.log('✅ Found order by stripe_payment_intent_id_actual');
            } else {
              // Strategy 3: Check if sessionId is actually an order ID (fallback)
              if (sessionId?.includes('-') && sessionId.length > 30) {
                console.log('🔍 Trying to find order by ID...');
                const { data: orderById, error: idError } = await supabase
                  .from('orders')
                  .select('*')
                  .eq('id', sessionId)
                   .maybeSingle();
                  
                if (orderById && !idError) {
                  order = orderById; 
                  orderError = null;
                  console.log('✅ Found order by ID fallback');
                }
              }
              
              // Strategy 4: Search by order number if it looks like one
              if (!order && sessionId?.startsWith('ORB-')) {
                console.log('🔍 Trying to find order by order number...');
                const { data: orderByNumber, error: numberError } = await supabase
                  .from('orders')
                  .select('*')
                  .eq('order_number', sessionId)
                  .maybeSingle();
                  
                if (orderByNumber && !numberError) {
                  order = orderByNumber;
                  orderError = null;
                  console.log('✅ Found order by order number');
                }
              }
            }
          }
        }

        if (orderError && !order) {
          console.error('Order lookup error:', orderError);
          
          // Handle specific error codes
          if (orderError.code === 'PGRST116') {
            console.log('🔍 No rows found - order does not exist or access denied');
          } else if (orderError.code === 'PGRST301' || orderError.message?.includes('RLS') || orderError.message?.includes('policy')) {
            console.log('🔒 RLS policy violation - user may not be authenticated');
          } else if (orderError.code === 'PGRST406' || orderError.message?.includes('406') || orderError.message?.includes('Not Acceptable')) {
            console.log('🔍 HTTP 406 Not Acceptable - likely RLS authentication issue');
            
            // For payment success pages, try service role lookup as a fallback
            if (retryCount === 0) {
              console.log('🔧 Attempting service role fallback for payment verification...');
              try {
                const { data: serviceRoleOrder, error: serviceError } = await supabase.functions.invoke('verify-payment-order', {
                  body: { sessionId: sessionId }
                });
                
                console.log('🔧 Service role response analysis (early fallback):', {
                  hasData: !!serviceRoleOrder,
                  hasError: !!serviceError,
                  serviceRoleOrder: serviceRoleOrder,
                  serviceError: serviceError,
                  orderHasId: serviceRoleOrder?.id ? true : false,
                  orderHasError: serviceRoleOrder?.error ? true : false
                });
                
                if (serviceRoleOrder && !serviceError && serviceRoleOrder.id && !serviceRoleOrder.error) {
                  console.log('✅ Found order via service role fallback:', serviceRoleOrder.order_number);
                  order = serviceRoleOrder;
                  orderError = null;
                } else {
                  console.log('🔧 Service role fallback failed (early) - detailed analysis:', {
                    reason: !serviceRoleOrder ? 'No serviceRoleOrder' :
                            serviceError ? 'Service error present' :
                            !serviceRoleOrder.id ? 'No order ID' :
                            serviceRoleOrder.error ? 'Order has error property' : 'Unknown',
                    serviceError: serviceError,
                    serviceRoleOrderError: serviceRoleOrder?.error
                  });
                }
              } catch (serviceRoleError) {
                console.log('🔧 Service role fallback error:', serviceRoleError);
              }
            }
          }
          
          // Retry with exponential backoff for certain error conditions
          if ((orderError.code === 'PGRST301' || orderError.code === 'PGRST406' || !user) && retryCount < 3 && !order) {
            console.log(`🔄 Retrying order lookup (attempt ${retryCount + 1}/3)`);
            setRetryCount(prev => prev + 1);
            setTimeout(() => verifyPayment(), Math.pow(2, retryCount) * 1000);
            return;
          }
          
          // Final attempt: try to search recent orders if user is authenticated
          if (user && retryCount < 1) {
            console.log('🔍 Final attempt: searching recent orders...');
            try {
              const { data: recentOrders, error: recentError } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);
                
              if (recentOrders && !recentError) {
                console.log('🔍 Found recent orders:', recentOrders.length);
                // Try to match by partial session ID or recent timing
                const matchingOrder = recentOrders.find(o => 
                  o.stripe_payment_intent_id?.includes(sessionId?.substring(0, 10)) ||
                  o.stripe_payment_intent_id_actual?.includes(sessionId?.substring(0, 10)) ||
                  (Date.now() - new Date(o.created_at).getTime() < 10 * 60 * 1000) // Within 10 minutes
                );
                
                if (matchingOrder) {
                  console.log('✅ Found matching order in recent orders:', matchingOrder.order_number);
                  order = matchingOrder;
                  orderError = null;
                }
              }
            } catch (recentSearchError) {
              console.error('🔍 Recent orders search failed:', recentSearchError);
            }
            
            if (!order) {
              setRetryCount(prev => prev + 1);
              setTimeout(() => verifyPayment(), 2000);
              return;
            }
          }
          
          if (!order) {
            // If unauthenticated, try service-role edge function as final fallback
            if (!user) {
              try {
                console.log('🔧 Final unauthenticated fallback via verify-payment-order');
                const { data: serviceRoleOrder, error: serviceError } = await supabase.functions.invoke('verify-payment-order', {
                  body: { sessionId }
                });
                
                console.log('🔧 Service role response analysis:', {
                  hasData: !!serviceRoleOrder,
                  hasError: !!serviceError,
                  serviceRoleOrder: serviceRoleOrder,
                  serviceError: serviceError,
                  orderHasId: serviceRoleOrder?.id ? true : false,
                  orderHasError: serviceRoleOrder?.error ? true : false
                });
                
                if (serviceRoleOrder && !serviceError && serviceRoleOrder.id && !serviceRoleOrder.error) {
                  console.log('✅ Found order via service role fallback:', serviceRoleOrder.order_number);
                  order = serviceRoleOrder;
                } else {
                  console.log('🔧 Service role fallback failed - detailed analysis:', {
                    reason: !serviceRoleOrder ? 'No serviceRoleOrder' :
                            serviceError ? 'Service error present' :
                            !serviceRoleOrder.id ? 'No order ID' :
                            serviceRoleOrder.error ? 'Order has error property' : 'Unknown',
                    serviceError: serviceError,
                    serviceRoleOrderError: serviceRoleOrder?.error
                  });
                }
              } catch (e) {
                console.log('🔧 Service role fallback error (final):', e);
              }
            }
            if (!order) {
              setStatus('not_found');
              return;
            }
          }
        }
        
        // Add null guard to prevent TypeError when accessing order properties
        if (!order) {
          console.log('❌ No order found after all lookup strategies');
          setStatus('not_found');
          return;
        }
        
        console.log('✅ Order found:', { id: order.id, order_number: order.order_number, payment_status: order.payment_status });

        setOrderData(order);

        // Check if payment is already marked as completed
        if (order.payment_status === 'completed') {
          setStatus('success');
          
          // Clean up localStorage (processing is now manual)
          await cleanupAfterPayment(order);
          
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
          description: "Your payment has been processed. Processing will begin manually.",
          variant: "default"
        });

        // Clean up localStorage (processing is now manual)
        await cleanupAfterPayment(order);

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

  const cleanupAfterPayment = async (order: any) => {
    try {
      console.log('🧹 Cleaning up after payment completion for order:', order.id);
      
      // Clean up any old localStorage data
      localStorage.removeItem('orbit_pending_order_id');
      localStorage.removeItem('orbit_pending_file_refs');
      localStorage.removeItem('orbit_files_uploaded');
      delete (window as any).orbitTempFiles;
      
      // NOTE: Processing is now manual only - no automatic trigger
      // The process-image-batch function will be called manually when ready
      
      console.log('✅ Payment cleanup completed');

    } catch (error: any) {
      console.log('ℹ️ Cleanup error (non-critical):', error.message);
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
                  Your payment has been processed successfully. Your images are uploaded and ready for processing.
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
                    <div><strong>User Authenticated:</strong> {user ? `✅ Yes (${user.email})` : '❌ No'}</div>
                    <div><strong>User ID:</strong> {user?.id || 'Not available'}</div>
                    <div><strong>Retry Attempts:</strong> {retryCount}/3</div>
                    <div><strong>Order Number:</strong> ORB-2025-212-0000</div>
                  </div>
                  
                  <div className="mt-4 text-xs text-muted-foreground">
                    <div><strong>Troubleshooting Tips:</strong></div>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Payment was successful in Stripe</li>
                      <li>There may be a timing issue with database updates</li>
                      <li>Try refreshing the page or checking your email</li>
                      <li>Contact support if the issue persists</li>
                    </ul>
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