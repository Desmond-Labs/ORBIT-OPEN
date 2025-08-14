import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { UserOrder } from '@/hooks/useAllUserOrders';

interface PendingPaymentOrderProps {
  order: UserOrder;
  onBackToDashboard: () => void;
}

export const PendingPaymentOrder: React.FC<PendingPaymentOrderProps> = ({
  order,
  onBackToDashboard
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
      <div className="max-w-lg w-full mx-4">
        <Card className="cosmic-border">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-amber-600" />
              </div>
            </div>
            <CardTitle className="text-2xl mb-2">Payment Required</CardTitle>
            <p className="text-muted-foreground">
              This order requires payment confirmation before processing can begin.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Badge variant="outline" className="text-amber-600 bg-amber-50">
                <Clock className="w-4 h-4 mr-2" />
                Payment {order.paymentStatus}
              </Badge>
            </div>
            
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Order Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Number:</span>
                  <span className="font-medium">{order.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cost:</span>
                  <span className="font-medium">${order.totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Images:</span>
                  <span className="font-medium">{order.imageCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">What happens next?</p>
                  <p className="text-blue-700 mt-1">
                    Once your payment is confirmed via Stripe, processing will begin automatically. 
                    You'll receive real-time updates on the progress.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                onClick={onBackToDashboard}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};