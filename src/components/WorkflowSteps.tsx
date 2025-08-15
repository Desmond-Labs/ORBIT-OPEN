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
      <div className="hidden md:flex items-start justify-center max-w-7xl mx-auto px-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="flex items-start flex-1 max-w-xs">
              {/* Step */}
              <div className="relative flex-1">
                <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-3 sm:p-4 md:p-5 lg:p-6 text-center w-full mx-auto min-h-[160px] sm:min-h-[170px] md:min-h-[180px] lg:min-h-[190px] flex flex-col">
                  {/* Icon - top aligned */}
                  <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-gradient-primary rounded-full flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                    <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-background" />
                  </div>
                  {/* Step name */}
                  <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2">{step.title}</h3>
                  {/* Description */}
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed flex-grow">
                    {step.description}
                  </p>
                </div>
              </div>
              
              {/* Connector - aligned with step names */}
              {!isLast && (
                <div className="w-4 sm:w-6 md:w-8 lg:w-12 xl:w-16 mx-1 sm:mx-2 md:mx-3 lg:mx-4 flex items-start pt-12 sm:pt-14 md:pt-16">
                  <div className="h-0.5 bg-gradient-primary opacity-60 w-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden space-y-6 max-w-md mx-auto px-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="relative">
              {/* Step */}
              <div className="relative">
                <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-4 sm:p-6 flex items-center space-x-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-background" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold mb-1">{step.title}</h3>
                    <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
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