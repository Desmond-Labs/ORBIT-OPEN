
import React from 'react';
import { Loader2, CreditCard } from 'lucide-react';

export const StripeConnectionOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card/90 backdrop-blur-sm border border-accent/20 rounded-xl p-8 max-w-md mx-4 text-center">
        <div className="mb-6">
          <CreditCard className="w-16 h-16 text-accent mx-auto mb-4" />
          <Loader2 className="w-8 h-8 text-accent mx-auto animate-spin mb-4" />
        </div>
        
        <h3 className="text-xl font-semibold mb-2">Connecting to Stripe</h3>
        <p className="text-muted-foreground mb-4">
          One moment while we connect you to Stripe for secure payment processing...
        </p>
        
        <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  );
};
