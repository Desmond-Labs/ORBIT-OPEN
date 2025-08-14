import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, CheckCircle, XCircle, ArrowRight, Upload, Rocket, Satellite, AlertCircle, CreditCard } from 'lucide-react';
import { UserOrder } from '@/hooks/useAllUserOrders';
import { OrderStatusLegend } from './OrderStatusLegend';
import { MissionFilterBar, MissionFilter } from './MissionFilterBar';
import { getUnifiedOrderStatus } from '@/utils/orderStatus';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedHeader } from './shared/UnifiedHeader';

interface OrdersDashboardProps {
  orders: UserOrder[];
  loading: boolean;
  onViewOrder: (orderId: string) => void;
  onNewUpload: () => void;
  userEmail?: string;
  onBack?: () => void;
  onSignOut?: () => void;
}

const getStatusIcon = (iconType: string) => {
  switch (iconType) {
    case 'check-circle':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'satellite':
      return <Satellite className="w-4 h-4 text-purple-500 animate-pulse" />;
    case 'rocket':
      return <Rocket className="w-4 h-4 text-blue-500" />;
    case 'alert-circle':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'clock':
    default:
      return <Clock className="w-4 h-4 text-yellow-500" />;
  }
};

const getStatusBadge = (order: UserOrder) => {
  // Get unified status information
  const unifiedStatus = getUnifiedOrderStatus({
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    processingStage: order.processingStage,
    processedCount: order.processedCount,
    imageCount: order.imageCount,
    failedCount: order.failedCount
  });

  return (
    <div className="flex flex-col items-end">
      <Badge variant="outline" className={unifiedStatus.colorClass}>
        {getStatusIcon(unifiedStatus.icon)}
        <span className="ml-2 font-medium">{unifiedStatus.label}</span>
      </Badge>
      {unifiedStatus.subtitle && (
        <span className="text-xs text-muted-foreground italic mt-1">{unifiedStatus.subtitle}</span>
      )}
    </div>
  );
};

export const OrdersDashboard: React.FC<OrdersDashboardProps> = ({
  orders,
  loading,
  onViewOrder,
  onNewUpload,
  userEmail,
  onBack,
  onSignOut
}) => {
  const [activeFilter, setActiveFilter] = useState<MissionFilter>('all');
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePayForOrder = async (order: UserOrder) => {
    setPaymentLoading(order.id);
    
    try {
      console.log('🔄 Initiating payment for existing order:', order.id);
      
      // Create Stripe checkout session using Supabase edge function
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          imageCount: order.imageCount,
          batchName: `Order ${order.orderNumber}`,
          // extra fields harmless if function ignores them
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalCost: order.totalCost,
          returnUrl: `${window.location.origin}/?view=dashboard`
        }
      });

      if (paymentError) {
        throw new Error(paymentError.message || 'Failed to create payment session');
      }
      
      if (paymentData?.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = paymentData.checkout_url as string;
      } else {
        throw new Error('No checkout URL received from payment service');
      }
      
    } catch (error: any) {
      console.error('❌ Payment initiation failed:', error);
      toast({
        title: "Payment Error", 
        description: error.message || "Failed to initiate payment. Please try again.",
        variant: "destructive"
      });
      setPaymentLoading(null);
    }
  };

  const filterOrders = (orders: UserOrder[], filter: MissionFilter): UserOrder[] => {
    switch (filter) {
      case 'all':
        return orders;
      case 'pending':
        return orders.filter(order => 
          order.paymentStatus !== 'completed' && order.paymentStatus !== 'succeeded'
        );
      case 'launch':
        return orders.filter(order => 
          (order.paymentStatus === 'completed' || order.paymentStatus === 'succeeded') &&
          (order.orderStatus === 'paid' || order.orderStatus === 'payment_pending')
        );
      case 'orbit':
        return orders.filter(order => order.orderStatus === 'processing');
      case 'complete':
        return orders.filter(order => order.orderStatus === 'completed');
      case 'failed':
        return orders.filter(order => order.orderStatus === 'failed');
      default:
        return orders;
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <span className="text-lg">Loading your orders...</span>
        </div>
      </div>
    );
  }

  // Apply filters to orders
  const filteredOrders = filterOrders(orders, activeFilter);
  
  // Separate orders by payment status
  const paidOrders = filteredOrders.filter(order => 
    order.paymentStatus === 'completed' || order.paymentStatus === 'succeeded'
  );
  const unpaidOrders = filteredOrders.filter(order =>
    order.paymentStatus !== 'completed' && order.paymentStatus !== 'succeeded'
  );
  
  // Categorize paid orders
  const activeOrders = paidOrders.filter(order => 
    order.orderStatus === 'processing' || order.orderStatus === 'payment_pending' || order.orderStatus === 'paid'
  );
  const completedOrders = paidOrders.filter(order => order.orderStatus === 'completed');
  const failedOrders = paidOrders.filter(order => order.orderStatus === 'failed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Unified Header */}
      <UnifiedHeader
        userEmail={userEmail}
        onBack={onBack}
        onSignOut={onSignOut}
        backButtonText="Back to Home"
        showSignOut={!!userEmail}
      />
      
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Your Processing Dashboard</h1>
          <p className="text-muted-foreground">Track and manage all your orders</p>
        </div>

        {/* Status Legend */}
        <div className="mb-8">
          <OrderStatusLegend />
        </div>

        {/* Mission Filter Bar */}
        <MissionFilterBar 
          orders={orders}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {/* Mission Pending Orders (Unpaid) */}
        {unpaidOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Clock className="w-5 h-5 text-yellow-500 mr-2" />
              Mission Pending ({unpaidOrders.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {unpaidOrders.map((order) => (
                <Card key={order.id} className="cosmic-border border-amber-200 hover:border-amber-300 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                      {getStatusBadge(order)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Images:</span>
                        <span>{order.imageCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="font-medium">${order.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Created:</span>
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="pt-2 border-t border-amber-100">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                          <p className="text-xs text-amber-800 mb-2">
                            <strong>Payment Required:</strong> Complete your payment to begin processing
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Button 
                            onClick={() => handlePayForOrder(order)}
                            variant="default"
                            size="sm"
                            className="w-full bg-gradient-primary hover:opacity-90"
                            disabled={paymentLoading === order.id}
                          >
                            {paymentLoading === order.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-4 h-4" />
                                Complete Payment
                              </>
                            )}
                          </Button>
                          
                          <Button 
                            onClick={() => onViewOrder(order.id)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            View Details <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No Orders State */}
        {filteredOrders.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <Upload className="w-12 h-12 text-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-4">No completed orders yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start by uploading your first batch of images to see them processed with AI analysis. 
              Only successfully paid orders will appear here.
            </p>
            <Button 
              onClick={onNewUpload}
              variant="cosmic"
              size="lg"
            >
              <Upload className="w-5 h-5" />
              Get Started
            </Button>
          </div>
        )}

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
              Active Processing ({activeOrders.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeOrders.map((order) => (
                <Card key={order.id} className="cosmic-border hover:border-accent/40 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                      {getStatusBadge(order)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Images:</span>
                        <span>{order.processedCount}/{order.imageCount} processed</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="font-medium">${order.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Started:</span>
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(order.processedCount / order.imageCount) * 100}%` }}
                        />
                      </div>
                      <Button 
                        onClick={() => onViewOrder(order.id)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        View Details <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions - Upload New Images */}
        <div className="mb-8">
          <Button 
            onClick={onNewUpload}
            variant="cosmic"
            size="lg"
            className="font-semibold"
          >
            <Upload className="w-5 h-5" />
            Upload New Images
          </Button>
        </div>

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              Completed Orders ({completedOrders.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedOrders.map((order) => (
                <Card key={order.id} className="cosmic-border hover:border-accent/40 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                      {getStatusBadge(order)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Images:</span>
                        <span>{order.imageCount} processed</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="font-medium">${order.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Completed:</span>
                        <span>{order.completedAt ? new Date(order.completedAt).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <Button 
                        onClick={() => onViewOrder(order.id)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        View & Download <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Failed Orders */}
        {failedOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
              Failed Orders ({failedOrders.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {failedOrders.map((order) => (
                <Card key={order.id} className="cosmic-border border-red-200 hover:border-red-300 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                      {getStatusBadge(order)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Images:</span>
                        <span>{order.failedCount}/{order.imageCount} failed</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="font-medium">${order.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Failed:</span>
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      <Button 
                        onClick={() => onViewOrder(order.id)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        View Details <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};