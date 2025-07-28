import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap, Download } from 'lucide-react';
import { OrbitDemo } from './OrbitDemo';
interface HeroPageProps {
  onGetStarted: () => void;
}
export const HeroPage: React.FC<HeroPageProps> = ({
  onGetStarted
}) => {
  return <div className="min-h-screen relative overflow-hidden">
      {/* Cosmic Background */}
      <div className="star-field absolute inset-0" />
      
      {/* Orbital Rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orbital-ring absolute top-1/2 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2 opacity-20" />
        <div className="orbital-ring absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 opacity-10" style={{
        animationDelay: '-10s'
      }} />
        <div className="orbital-ring absolute top-1/2 left-1/2 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 opacity-5" style={{
        animationDelay: '-5s'
      }} />
      </div>

      {/* Header */}
      <header className="relative z-20 px-6 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">ORBIT</h1>
              <p className="text-xs text-muted-foreground">A Desmond Labs Product</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Headline */}
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="gradient-text">Transform</span> Your Images
              <br />
              Into <span className="gradient-text">Intelligent</span> Data
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              ORBIT uses advanced AI to analyze your product images, extracting detailed metadata 
              and embedding structured intelligence that unlocks hidden value in your visual assets.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-6 cosmic-transition hover:border-accent/40">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Sparkles className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">AI-Powered Analysis</h3>
                <p className="text-muted-foreground text-sm">
                  Advanced computer vision extracts detailed product metadata with unprecedented accuracy.
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-6 cosmic-transition hover:border-accent/40">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Zap className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
                <p className="text-muted-foreground text-sm">Process hundreds of images in 24 hours with our optimized AI pipeline.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-6 cosmic-transition hover:border-accent/40">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Download className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Instant Download</h3>
                <p className="text-muted-foreground text-sm">
                  Get your enhanced images with embedded metadata ready for immediate use.
                </p>
              </div>
            </div>
          </div>

          {/* ORBIT Demo Section */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                See How <span className="gradient-text">ORBIT</span> Works
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Watch ORBIT's AI analyze an image in real-time, extracting detailed metadata 
                and embedding intelligent insights directly into your visual assets.
              </p>
            </div>
            <OrbitDemo className="cosmic-transition" />
          </div>

          {/* Pricing Preview */}
          <div className="mb-12">
            <div className="inline-block bg-card/30 backdrop-blur-sm border border-accent/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Volume-Based Pricing</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-accent font-bold">$3.75</div>
                  <div className="text-muted-foreground">First 49 images</div>
                </div>
                <div className="text-center">
                  <div className="text-accent font-bold">$3.25</div>
                  <div className="text-muted-foreground">50-99 images</div>
                </div>
                <div className="text-center">
                  <div className="text-accent font-bold">$2.75</div>
                  <div className="text-muted-foreground">100-249 images</div>
                </div>
                <div className="text-center">
                  <div className="text-accent font-bold">$2.25</div>
                  <div className="text-muted-foreground">250+ images</div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <Button variant="cosmic" size="xl" onClick={onGetStarted} className="font-semibold">
              Start Your ORBIT Analysis
              <ArrowRight className="w-5 h-5" />
            </Button>
            <p className="text-sm text-muted-foreground">
              No subscription required • Pay per batch • Instant processing
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-accent/20">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            © 2024 Desmond Labs. ORBIT is a product of Desmond Labs, architecting knowledge ecosystems through AI.
          </p>
        </div>
      </footer>
    </div>;
};