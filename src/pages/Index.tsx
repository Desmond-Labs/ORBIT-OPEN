import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { HeroPage } from '@/components/HeroPage';
import { AuthenticatedHeroPage } from '@/components/AuthenticatedHeroPage';
import { ProcessingPage } from '@/components/ProcessingPage';
import { OrdersDashboard } from '@/components/OrdersDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useAllUserOrders } from '@/hooks/useAllUserOrders';
import { User } from '@supabase/supabase-js';

type AppView = 'hero' | 'processing' | 'dashboard';

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<AppView>('hero');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const { orders, loading: ordersLoading } = useAllUserOrders(user?.id || null);
  
  // Combined loading state - wait for both auth and orders (if user exists)
  const isInitialLoading = loading || (user && ordersLoading);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Initial auth check:', { hasUser: !!session?.user, email: session?.user?.email });
      setUser(session?.user || null);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth state changed:', { event, hasUser: !!session?.user, email: session?.user?.email });
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const step = searchParams.get('step');
    const orderId = searchParams.get('order');
    const view = searchParams.get('view');
    
    if (step === 'processing' && orderId) {
      setCurrentView('processing');
    } else if (view === 'dashboard') {
      setCurrentView('dashboard');
    } else {
      setCurrentView('hero');
    }
  }, [searchParams]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentView('hero');
    setSearchParams({});
  };

  const handleNewUpload = () => {
    setCurrentView('processing');
    setSearchParams({});
  };

  const handleViewDashboard = () => {
    setCurrentView('dashboard');
    setSearchParams({ view: 'dashboard' });
  };

  const handleViewOrder = (orderId: string) => {
    setCurrentView('processing');
    setSearchParams({ step: 'processing', order: orderId });
  };

  const handleBackToHero = () => {
    setCurrentView('hero');
    setSearchParams({});
  };

  // Debug logging for state tracking
  useEffect(() => {
    console.log('📊 State update:', { 
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      ordersCount: orders.length, 
      ordersLoading, 
      isInitialLoading,
      currentView,
      sampleOrders: orders.slice(0, 2).map(o => ({ id: o.id, orderNumber: o.orderNumber }))
    });
  }, [user, orders.length, ordersLoading, isInitialLoading, currentView]);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-primary rounded-full animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">
            {loading ? 'Loading...' : 'Loading your orders...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentView === 'hero' && !user && (
        <HeroPage onGetStarted={() => setCurrentView('processing')} />
      )}
      
      {currentView === 'hero' && user && (
        <AuthenticatedHeroPage
          userEmail={user.email || ''}
          hasOrders={orders.length > 0}
          recentOrders={orders}
          onNewUpload={handleNewUpload}
          onViewDashboard={handleViewDashboard}
          onViewOrder={handleViewOrder}
          onSignOut={handleSignOut}
        />
      )}
      
      {currentView === 'processing' && (
        <ProcessingPage 
          onBack={user ? handleViewDashboard : () => setCurrentView('hero')} 
        />
      )}
      
      {currentView === 'dashboard' && user && (
        <OrdersDashboard
          orders={orders}
          loading={ordersLoading}
          onViewOrder={handleViewOrder}
          onNewUpload={handleNewUpload}
          userEmail={user.email}
          onBack={handleBackToHero}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );
};

export default Index;
