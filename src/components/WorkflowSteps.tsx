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
      <div className="hidden md:flex items-start justify-center max-w-7xl mx-auto">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="flex items-start flex-1">
              {/* Step */}
              <div className="relative group flex-1">
                <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-4 lg:p-6 cosmic-transition hover:border-accent/40 text-center w-[220px] mx-auto min-h-[180px] flex flex-col">
                  {/* Icon - top aligned */}
                  <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mb-4 mx-auto">
                    <Icon className="w-6 h-6 text-background" />
                  </div>
                  {/* Step name */}
                  <h3 className="text-base lg:text-lg font-semibold mb-2">{step.title}</h3>
                  {/* Description */}
                  <p className="text-muted-foreground text-xs lg:text-sm leading-relaxed flex-grow">
                    {step.description}
                  </p>
                </div>
              </div>
              
              {/* Connector - aligned with step names */}
              {!isLast && (
                <div className="w-8 lg:w-16 mx-2 lg:mx-4 flex items-start pt-16">
                  <div className="h-0.5 bg-gradient-primary opacity-60 w-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden space-y-6 max-w-md mx-auto">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="relative">
              {/* Step */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-6 cosmic-transition hover:border-accent/40 flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-background" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{step.title}</h3>
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