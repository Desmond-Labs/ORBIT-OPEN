import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Turnstile } from '@marsidev/react-turnstile';

interface AuthPageProps {
  onBack: () => void;
  onAuthenticated: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onBack, onAuthenticated }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const { toast } = useToast();
  const captchaRef = useRef<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!captchaToken) {
        toast({
          title: "Error",
          description: "Please complete the CAPTCHA verification",
          variant: "destructive"
        });
        return;
      }

      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          toast({
            title: "Error",
            description: "Passwords do not match",
            variant: "destructive"
          });
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            captchaToken,
            data: {
              email: formData.email
            }
          }
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: "Account exists",
              description: "An account with this email already exists. Please sign in instead.",
              variant: "destructive"
            });
            setIsSignUp(false);
          } else {
            throw error;
          }
        } else {
          // Create user profile in orbit_users table
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error: profileError } = await supabase
              .from('orbit_users')
              .insert({
                id: user.id,
                email: formData.email
              });

            if (profileError && !profileError.message.includes('duplicate key')) {
              console.error('Error creating user profile:', profileError);
            }
          }

          toast({
            title: "Account created successfully!",
            description: "Please sign in with your new account credentials.",
          });
          setIsSignUp(false); // Switch to sign-in mode
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
          options: {
            captchaToken
          }
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: "Invalid credentials",
              description: "Please check your email and password and try again.",
              variant: "destructive"
            });
          } else {
            throw error;
          }
        } else {
          toast({
            title: "Welcome back!",
            description: "You have been signed in successfully.",
          });
          onAuthenticated();
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
      // Reset CAPTCHA on error
      if (captchaRef.current) {
        captchaRef.current.reset();
        setCaptchaToken('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptchaSuccess = (token: string) => {
    setCaptchaToken(token);
  };

  const handleCaptchaError = () => {
    setCaptchaToken('');
    toast({
      title: "CAPTCHA Error",
      description: "Please try again",
      variant: "destructive"
    });
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Cosmic Background */}
      <div className="star-field absolute inset-0" />

      {/* Header */}
      <header className="relative z-20 px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
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
        <div className="max-w-md mx-auto">
          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold gradient-text mb-2">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h1>
              <p className="text-muted-foreground">
                {isSignUp 
                  ? 'Join ORBIT to start enhancing your product images'
                  : 'Welcome back! Sign in to continue'
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Security Verification</Label>
                <div className="flex justify-center">
                  <Turnstile
                    ref={captchaRef}
                    siteKey="0x4AAAAAABlD3dqUVjIBd-7w"
                    onSuccess={handleCaptchaSuccess}
                    onError={handleCaptchaError}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                variant="cosmic" 
                size="lg" 
                className="w-full"
                disabled={isLoading || !captchaToken}
              >
                {isLoading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  // Reset CAPTCHA when switching modes
                  if (captchaRef.current) {
                    captchaRef.current.reset();
                    setCaptchaToken('');
                  }
                }}
                className="text-accent hover:text-accent/80 transition-colors"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in' 
                  : "Don't have an account? Sign up"
                }
              </button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};