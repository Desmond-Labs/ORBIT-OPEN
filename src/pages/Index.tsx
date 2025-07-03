import React, { useState } from 'react';
import { HeroPage } from '@/components/HeroPage';
import { ProcessingPage } from '@/components/ProcessingPage';

type AppView = 'hero' | 'processing';

const Index = () => {
  const [currentView, setCurrentView] = useState<AppView>('hero');

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
