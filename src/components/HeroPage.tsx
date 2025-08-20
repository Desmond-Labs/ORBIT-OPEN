import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap, Download, User, Upload, CreditCard } from 'lucide-react';
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
              <div className="relative bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-6 cosmic:border-accent/40">
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

          {/* Cosmic Journey Process */}
          <div className="mb-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Your Cosmic <span className="gradient-text">AI Journey</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Experience the ORBIT transformation – where your images enter our cosmic intelligence 
                and emerge as enriched, metadata-enhanced digital assets.
              </p>
            </div>

            {/* Orbital Layout */}
            <div className="relative max-w-5xl mx-auto h-[600px] hidden md:block">
              {/* Central AI Processing Core */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-accent/20 via-primary/30 to-accent/20 rounded-2xl opacity-50 group-hover:opacity-100 transition-all duration-500 animate-pulse" />
                  <div className="absolute -inset-4 rounded-full border-2 border-accent/30 animate-spin-slow opacity-60" />
                  <div className="relative bg-gradient-to-br from-[#1A233F] to-[#2A3B5F] border-2 border-accent/40 rounded-2xl p-8 w-72 h-72 flex flex-col items-center justify-center text-center cosmic-transition hover:border-accent/80 hover:scale-105">
                    <div className="w-20 h-20 bg-gradient-to-r from-accent to-primary rounded-full flex items-center justify-center mb-6">
                      <Sparkles className="w-10 h-10 text-background" />
                    </div>
                    <h3 className="text-2xl font-bold text-accent mb-3">AI Processing</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Our cosmic intelligence analyzes every pixel, extracting deep insights and embedding rich metadata
                    </p>
                  </div>
                </div>
              </div>

              {/* Sign In - Top Left */}
              <div className="absolute top-16 left-16">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-[#1A233F]/80 to-[#2A3B5F]/80 backdrop-blur-sm border border-accent/20 rounded-xl p-6 w-56 h-40 flex flex-col items-center cosmic-transition hover:border-accent/40">
                    <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center mb-4">
                      <User className="w-6 h-6 text-background" />
                    </div>
                    <h3 className="text-lg font-semibold text-accent mb-2">Sign In</h3>
                    <p className="text-muted-foreground text-sm text-center">Begin your cosmic journey with secure authentication</p>
                  </div>
                </div>
              </div>

              {/* Upload - Top Right */}
              <div className="absolute top-16 right-16">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-[#1A233F]/80 to-[#2A3B5F]/80 backdrop-blur-sm border border-accent/20 rounded-xl p-6 w-56 h-40 flex flex-col items-center cosmic-transition hover:border-accent/40">
                    <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center mb-4">
                      <Upload className="w-6 h-6 text-background" />
                    </div>
                    <h3 className="text-lg font-semibold text-accent mb-2">Upload Images</h3>
                    <p className="text-muted-foreground text-sm text-center">Launch your visual assets into our processing orbit</p>
                  </div>
                </div>
              </div>

              {/* Payment - Bottom Left */}
              <div className="absolute bottom-16 left-16">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-[#1A233F]/80 to-[#2A3B5F]/80 backdrop-blur-sm border border-accent/20 rounded-xl p-6 w-56 h-40 flex flex-col items-center cosmic-transition hover:border-accent/40">
                    <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center mb-4">
                      <CreditCard className="w-6 h-6 text-background" />
                    </div>
                    <h3 className="text-lg font-semibold text-accent mb-2">Payment</h3>
                    <p className="text-muted-foreground text-sm text-center">Transparent pricing for your cosmic transformation</p>
                  </div>
                </div>
              </div>

              {/* Download - Bottom Right */}
              <div className="absolute bottom-16 right-16">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-glow rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-[#1A233F]/80 to-[#2A3B5F]/80 backdrop-blur-sm border border-accent/20 rounded-xl p-6 w-56 h-40 flex flex-col items-center cosmic-transition hover:border-accent/40">
                    <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center mb-4">
                      <Download className="w-6 h-6 text-background" />
                    </div>
                    <h3 className="text-lg font-semibold text-accent mb-2">Download Ready</h3>
                    <p className="text-muted-foreground text-sm text-center">Receive your enhanced assets with embedded intelligence</p>
                  </div>
                </div>
              </div>

              {/* Orbital Connection Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300">
                <path d="M80 60 Q150 120 200 150" stroke="url(#gradient1)" strokeWidth="2" fill="none" opacity="0.6" strokeDasharray="5,5" className="animate-pulse" />
                <path d="M320 60 Q250 120 200 150" stroke="url(#gradient1)" strokeWidth="2" fill="none" opacity="0.6" strokeDasharray="5,5" className="animate-pulse" style={{animationDelay: '0.5s'}} />
                <path d="M200 150 Q150 180 80 240" stroke="url(#gradient2)" strokeWidth="2" fill="none" opacity="0.6" strokeDasharray="5,5" className="animate-pulse" style={{animationDelay: '1s'}} />
                <path d="M200 150 Q250 180 320 240" stroke="url(#gradient2)" strokeWidth="2" fill="none" opacity="0.6" strokeDasharray="5,5" className="animate-pulse" style={{animationDelay: '1.5s'}} />
                <defs>
                  <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4A77C3" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#48C9B0" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#48C9B0" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#4A77C3" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden space-y-4 max-w-sm mx-auto px-4">
              <div className="relative bg-gradient-to-br from-[#1A233F]/80 to-[#2A3B5F]/80 border border-accent/20 rounded-xl p-4 h-24 flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-background" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-accent mb-1">Sign In</h3>
                  <p className="text-muted-foreground text-sm">Begin your cosmic journey</p>
                </div>
              </div>

              <div className="flex justify-center my-3">
                <div className="w-0.5 h-6 bg-gradient-to-b from-primary/80 to-accent/80" />
              </div>

              <div className="relative bg-gradient-to-br from-[#1A233F]/80 to-[#2A3B5F]/80 border border-accent/20 rounded-xl p-4 h-24 flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-background" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-accent mb-1">Upload Images</h3>
                  <p className="text-muted-foreground text-sm">Launch your visual assets</p>
                </div>
              </div>

              <div className="flex justify-center my-3">
                <div className="w-0.5 h-6 bg-gradient-to-b from-primary/80 to-accent/80" />
              </div>

              <div className="relative bg-gradient-to-br from-[#1A233F] to-[#2A3B5F] border-2 border-accent/40 rounded-xl p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-accent to-primary rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Sparkles className="w-8 h-8 text-background" />
                </div>
                <h3 className="text-xl font-bold text-accent mb-2">AI Processing</h3>
                <p className="text-muted-foreground text-sm">Cosmic intelligence transforms your images</p>
              </div>

              <div className="flex justify-center my-3">
                <div className="w-0.5 h-6 bg-gradient-to-b from-accent/80 to-primary/80" />
              </div>

              <div className="relative bg-gradient-to-br from-[#1A233F]/80 to-[#2A3B5F]/80 border border-accent/20 rounded-xl p-4 h-24 flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-background" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-accent mb-1">Payment</h3>
                  <p className="text-muted-foreground text-sm">Transparent cosmic pricing</p>
                </div>
              </div>

              <div className="flex justify-center my-3">
                <div className="w-0.5 h-6 bg-gradient-to-b from-primary/80 to-accent/80" />
              </div>

              <div className="relative bg-gradient-to-br from-[#1A233F]/80 to-[#2A3B5F]/80 border border-accent/20 rounded-xl p-4 h-24 flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center">
                  <Download className="w-6 h-6 text-background" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-accent mb-1">Download Ready</h3>
                  <p className="text-muted-foreground text-sm">Enhanced assets ready</p>
                </div>
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
              <h3 className="text-lg font-semibold mb-4">Per-Image Pricing</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Simple, transparent pricing that scales with your volume. No subscriptions or hidden fees.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-accent font-bold">$3.75</div>
                  <div className="text-muted-foreground">per image</div>
                  <div className="text-xs text-muted-foreground/70">(first 49 images)</div>
                </div>
                <div className="text-center">
                  <div className="text-accent font-bold">$3.25</div>
                  <div className="text-muted-foreground">per image</div>
                  <div className="text-xs text-muted-foreground/70">(50-99 images)</div>
                </div>
                <div className="text-center">
                  <div className="text-accent font-bold">$2.75</div>
                  <div className="text-muted-foreground">per image</div>
                  <div className="text-xs text-muted-foreground/70">(100-249 images)</div>
                </div>
                <div className="text-center">
                  <div className="text-accent font-bold">$2.25</div>
                  <div className="text-muted-foreground">per image</div>
                  <div className="text-xs text-muted-foreground/70">(250+ images)</div>
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
        <div className="max-w-7xl mx-auto text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            © 2025 Desmond Labs. ORBIT is a product of Desmond Labs, architecting knowledge ecosystems through AI.
          </p>
          <div>
            <button onClick={() => window.open('/privacy-policy', '_blank')} className="text-sm text-accent hover:text-accent/80 transition-colors underline">
              Privacy Policy
            </button>
          </div>
        </div>
      </footer>
    </div>;
};