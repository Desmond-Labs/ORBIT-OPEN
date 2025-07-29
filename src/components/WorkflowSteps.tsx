import React from 'react';
import { User, Upload, CreditCard, Sparkles, Download } from 'lucide-react';

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

export const WorkflowSteps: React.FC = () => {
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
      <div className="hidden md:flex items-center justify-between max-w-5xl mx-auto">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="flex items-center">
              {/* Step */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-6 cosmic-transition hover:border-accent/40 text-center min-w-[200px]">
                  <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mb-4 mx-auto">
                    <Icon className="w-6 h-6 text-background" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
              
              {/* Connector */}
              {!isLast && (
                <div className="flex-1 mx-4">
                  <div className="h-0.5 bg-gradient-primary opacity-30" />
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
    </div>
  );
};