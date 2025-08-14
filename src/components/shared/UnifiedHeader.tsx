import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, Sparkles, User } from 'lucide-react';

interface UnifiedHeaderProps {
  userEmail?: string;
  showBackButton?: boolean;
  showSignOut?: boolean;
  onBack?: () => void;
  onSignOut?: () => void;
  backButtonText?: string;
}

export const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  userEmail,
  showBackButton = true,
  showSignOut = true,
  onBack,
  onSignOut,
  backButtonText = "Back to Home"
}) => {
  return (
    <header className="relative z-20 px-6 py-6">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left side - Back button */}
        <div>
          {showBackButton && onBack && (
            <Button variant="ghost" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {backButtonText}
            </Button>
          )}
        </div>

        {/* Center - ORBIT logo */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-background" />
          </div>
          <span className="text-lg font-bold gradient-text">ORBIT</span>
        </div>

        {/* Right side - User info and sign out */}
        <div className="flex items-center space-x-4">
          {userEmail && (
            <div className="flex items-center space-x-2 bg-card/50 backdrop-blur-sm border border-accent/20 rounded-lg px-3 py-2">
              <User className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">{userEmail}</span>
            </div>
          )}
          {showSignOut && onSignOut && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSignOut}
              className="border-accent/20 hover:border-accent/40"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};