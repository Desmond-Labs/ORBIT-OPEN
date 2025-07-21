
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mail, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailConfirmationNoticeProps {
  email: string;
  onBackToSignIn: () => void;
}

export const EmailConfirmationNotice: React.FC<EmailConfirmationNoticeProps> = ({
  email,
  onBackToSignIn
}) => {
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();

  const handleResendConfirmation = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Confirmation email resent",
        description: "Please check your email for the confirmation link.",
      });
    } catch (error: any) {
      console.error('Resend confirmation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend confirmation email",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-accent/20 p-8">
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
          <Mail className="w-8 h-8 text-accent" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold gradient-text">
            Check Your Email
          </h2>
          <p className="text-muted-foreground">
            We've sent a confirmation link to
          </p>
          <p className="font-medium text-accent">
            {email}
          </p>
        </div>

        <div className="bg-accent/5 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="w-4 h-4" />
            <span>Click the link in your email to activate your account</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="w-4 h-4" />
            <span>Then return here to sign in</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Didn't receive the email?
          </p>
          <Button
            variant="outline"
            onClick={handleResendConfirmation}
            disabled={isResending}
            className="w-full gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
            {isResending ? 'Resending...' : 'Resend Confirmation Email'}
          </Button>
        </div>

        <div className="pt-4 border-t border-accent/20">
          <Button
            variant="ghost"
            onClick={onBackToSignIn}
            className="text-accent hover:text-accent/80"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    </Card>
  );
};
