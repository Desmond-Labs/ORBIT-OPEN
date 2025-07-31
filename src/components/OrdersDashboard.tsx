import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, CheckCircle, XCircle, ArrowRight, Upload, CreditCard } from 'lucide-react';
import { UserOrder } from '@/hooks/useAllUserOrders';

interface OrdersDashboardProps {
  orders: UserOrder[];
  loading: boolean;
  onViewOrder: (orderId: string) => void;
  onNewUpload: () => void;
}

const getStatusIcon = (status: UserOrder['orderStatus']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'processing':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-yellow-500" />;
  }
};

const getStatusBadge = (status: UserOrder['orderStatus'], processingStage?: string) => {
  const variants = {
    pending: 'secondary',
    processing: 'default',
    completed: 'default',
    failed: 'destructive'
  } as const;

  const colors = {
    pending: 'text-yellow-600 bg-yellow-100',
    processing: 'text-blue-600 bg-blue-100',
    completed: 'text-green-600 bg-green-100',
    failed: 'text-red-600 bg-red-100'
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return '🚀 Mission Complete';
      case 'processing':
        return '🛰️ In ORBIT';
      case 'failed':
        return '❌ Mission Failed';
      default:
        // Check if it's "getting ready for launch" phase
        if (processingStage === 'preparing' || processingStage === 'queued') {
          return '🚀 Getting Ready';
        }
        return '⏳ Mission Pending';
    }
  };

  return (
    <Badge variant={variants[status]} className={colors[status]}>
      {getStatusIcon(status)}
      <span className="ml-1">{getStatusText()}</span>
    </Badge>
  );
};

export const OrdersDashboard: React.FC<OrdersDashboardProps> = ({
  orders,
  loading,
  onViewOrder,
  onNewUpload
}) => {
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

  // Filter orders by payment status as well - only show paid orders
  const paidOrders = orders.filter(order => 
    order.paymentStatus === 'completed' || order.paymentStatus === 'succeeded'
  );
  
  const activeOrders = paidOrders.filter(order => 
    order.orderStatus === 'processing' || order.orderStatus === 'pending'
  );
  const completedOrders = paidOrders.filter(order => order.orderStatus === 'completed');
  const failedOrders = paidOrders.filter(order => order.orderStatus === 'failed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Your Processing Dashboard</h1>
          <p className="text-muted-foreground">Manage and track all your image processing orders</p>
        </div>

        {/* Quick Actions */}
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

        {/* No Orders State */}
        {paidOrders.length === 0 && (
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
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-green-600 bg-green-50">
                          <CreditCard className="w-3 h-3 mr-1" />
                          Paid
                        </Badge>
                        {getStatusBadge(order.orderStatus, order.processingStage)}
                      </div>
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
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-green-600 bg-green-50">
                          <CreditCard className="w-3 h-3 mr-1" />
                          Paid
                        </Badge>
                        {getStatusBadge(order.orderStatus, order.processingStage)}
                      </div>
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
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-green-600 bg-green-50">
                          <CreditCard className="w-3 h-3 mr-1" />
                          Paid
                        </Badge>
                        {getStatusBadge(order.orderStatus, order.processingStage)}
                      </div>
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