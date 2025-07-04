import React from 'react';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';

interface AuthStepProps {
  onShowAuth: () => void;
}

export const AuthStep: React.FC<AuthStepProps> = ({ onShowAuth }) => {
  return (
    <div className="max-w-md mx-auto text-center">
      <User className="w-16 h-16 text-accent mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-2">Sign In Required</h3>
      <p className="text-muted-foreground mb-6">
        You need to sign in before uploading images to ORBIT
      </p>
      <Button 
        variant="cosmic" 
        size="lg" 
        onClick={onShowAuth} 
        className="w-full"
      >
        Sign In / Sign Up
      </Button>
    </div>
  );
};