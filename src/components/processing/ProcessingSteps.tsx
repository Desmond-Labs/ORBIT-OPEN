import React from 'react';
import { Upload, CreditCard, Download, User, Loader2, Clock, Zap } from 'lucide-react';
import type { ProcessingStep } from '@/hooks/useProcessingState';

interface ProcessingStepsProps {
  currentStep: ProcessingStep;
  processingStage: string;
}

const stepConfig = {
  auth: { title: 'Sign In', icon: User },
  upload: { title: 'Upload Images', icon: Upload },
  payment: { title: 'Payment', icon: CreditCard },
  processing: { title: 'AI Processing', icon: Loader2 },
  complete: { title: 'Download Ready', icon: Download },
};

const steps: ProcessingStep[] = ['auth', 'upload', 'payment', 'processing', 'complete'];

export const ProcessingSteps: React.FC<ProcessingStepsProps> = ({ currentStep, processingStage }) => {
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const StepIcon = stepConfig[step].icon;
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          const isProcessing = step === 'processing' && currentStep === 'processing';

          return (
            <div key={step} className="flex items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isActive
                    ? 'bg-primary border-primary shadow-cosmic'
                    : isCompleted
                    ? 'bg-accent border-accent'
                    : 'bg-transparent border-muted-foreground/30'
                }`}
              >
                <StepIcon
                  className={`w-5 h-5 ${
                    isProcessing ? 'animate-spin' : ''
                  } ${
                    isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                />
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-20 h-0.5 transition-colors duration-300 ${
                    isCompleted ? 'bg-accent' : 'bg-muted-foreground/30'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{stepConfig[currentStep].title}</h2>
        <p className="text-muted-foreground">
          {currentStep === 'auth' && 'Sign in to access ORBIT image processing'}
          {currentStep === 'upload' && 'Select your product images to begin analysis'}
          {currentStep === 'payment' && 'Complete payment to start AI analysis'}
          {currentStep === 'processing' && 'ORBIT is analyzing your images...'}
          {currentStep === 'complete' && 'Your enhanced images are ready for download'}
        </p>
      </div>
    </div>
  );
};