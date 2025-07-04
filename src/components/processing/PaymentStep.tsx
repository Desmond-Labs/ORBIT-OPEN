import React from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';

interface PaymentStepProps {
  uploadedFiles: File[];
  totalCost: number;
  paymentLoading: boolean;
  onPayment: () => void;
}

export const PaymentStep: React.FC<PaymentStepProps> = ({
  uploadedFiles,
  totalCost,
  paymentLoading,
  onPayment
}) => {
  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <CreditCard className="w-16 h-16 text-accent mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Complete Payment</h3>
        <div className="bg-secondary/50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span>Images to process:</span>
            <span className="font-semibold">{uploadedFiles.length}</span>
          </div>
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total:</span>
            <span>${totalCost}</span>
          </div>
        </div>
      </div>
      <Button 
        variant="cosmic" 
        size="lg" 
        onClick={onPayment} 
        className="w-full"
        disabled={paymentLoading}
      >
        {paymentLoading ? 'Processing...' : 'Pay with Stripe'}
      </Button>
    </div>
  );
};