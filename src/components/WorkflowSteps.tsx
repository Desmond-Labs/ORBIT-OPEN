import React from 'react';
import { User, Upload, CreditCard, Sparkles, Download, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  {
    id: 1,
    title: 'Sign In',
    description: 'Create your account or sign in to get started',
    icon: User,
  },
  {
    id: 2,
    title: 'Upload Images',
    description: 'Select and upload your product images for analysis',
    icon: Upload,
  },
  {
    id: 3,
    title: 'Payment',
    description: 'Pay only for what you process with transparent pricing',
    icon: CreditCard,
  },
  {
    id: 4,
    title: 'AI Processing',
    description: "ORBIT's advanced AI analyzes and enhances your images",
    icon: Sparkles,
  },
  {
    id: 5,
    title: 'Download Ready',
    description: 'Download your enhanced images with embedded metadata',
    icon: Download,
  },
];

interface WorkflowStepsProps {
  onGetStarted?: () => void;
}

export const WorkflowSteps: React.FC<WorkflowStepsProps> = ({ onGetStarted }) => {
  return (
    <div className="mb-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Simple <span className="gradient-text">5-Step</span> Process
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          From upload to enhanced images with embedded intelligence – 
          ORBIT makes complex AI analysis simple and accessible.
        </p>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:grid md:grid-cols-5 md:gap-4 lg:gap-6 xl:gap-8 max-w-6xl mx-auto px-4 items-start">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="relative flex flex-col items-center">
              {/* Step */}
              <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-4 text-center w-48 h-48 flex flex-col">
                {/* Icon - top aligned */}
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mb-4 mx-auto flex-shrink-0">
                  <Icon className="w-6 h-6 text-background" />
                </div>
                {/* Step name */}
                <h3 className="text-lg font-semibold mb-3 flex-shrink-0">{step.title}</h3>
                {/* Description */}
                <p className="text-muted-foreground text-sm leading-relaxed flex-grow flex items-center justify-center text-center px-1">
                  {step.description}
                </p>
              </div>
              
              {/* Connector - positioned absolutely to connect centers */}
              {!isLast && (
                <div className="absolute top-24 -right-2 lg:-right-3 xl:-right-4 w-4 lg:w-6 xl:w-8 z-10">
                  <div className="h-0.5 bg-gradient-primary opacity-60 w-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden space-y-4 max-w-sm mx-auto px-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="relative">
              {/* Step */}
              <div className="relative">
                <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-4 h-24 flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-background" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold mb-1">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Connector */}
              {!isLast && (
                <div className="flex justify-center my-3">
                  <div className="w-0.5 h-6 bg-gradient-primary opacity-30" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Additional CTA for users who don't scroll to bottom */}
      {onGetStarted && (
        <div className="text-center mt-12">
          <Button variant="cosmic" size="lg" onClick={onGetStarted} className="font-semibold">
            Start Your ORBIT Analysis
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
};