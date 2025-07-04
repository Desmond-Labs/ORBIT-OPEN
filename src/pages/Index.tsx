import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HeroPage } from '@/components/HeroPage';
import { ProcessingPage } from '@/components/ProcessingPage';

type AppView = 'hero' | 'processing';

const Index = () => {
  const [searchParams] = useSearchParams();
  const [currentView, setCurrentView] = useState<AppView>('hero');

  useEffect(() => {
    const step = searchParams.get('step');
    const orderId = searchParams.get('order');
    
    if (step === 'processing' && orderId) {
      setCurrentView('processing');
    }
  }, [searchParams]);

  return (
    <>
      {currentView === 'hero' && (
        <HeroPage onGetStarted={() => setCurrentView('processing')} />
      )}
      {currentView === 'processing' && (
        <ProcessingPage onBack={() => setCurrentView('hero')} />
      )}
    </>
  );
};

export default Index;
