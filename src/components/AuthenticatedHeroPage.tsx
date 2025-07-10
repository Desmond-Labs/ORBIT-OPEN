import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Upload, BarChart3, LogOut, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserOrder } from '@/hooks/useAllUserOrders';

interface AuthenticatedHeroPageProps {
  userEmail: string;
  hasOrders: boolean;
  recentOrders: UserOrder[];
  onNewUpload: () => void;
  onViewDashboard: () => void;
  onSignOut: () => void;
}

export const AuthenticatedHeroPage: React.FC<AuthenticatedHeroPageProps> = ({
  userEmail,
  hasOrders,
  recentOrders,
  onNewUpload,
  onViewDashboard,
  onSignOut
}) => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Cosmic Background */}
      <div className="star-field absolute inset-0" />
      
      {/* Orbital Rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orbital-ring absolute top-1/2 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2 opacity-20" />
        <div className="orbital-ring absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 opacity-10" style={{ animationDelay: '-10s' }} />
        <div className="orbital-ring absolute top-1/2 left-1/2 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 opacity-5" style={{ animationDelay: '-5s' }} />
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
          
          {/* User Profile */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-card/50 backdrop-blur-sm border border-accent/20 rounded-lg px-3 py-2">
              <User className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">{userEmail}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSignOut}
              className="border-accent/20 hover:border-accent/40"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 pt-12 pb-32">
        <div className="max-w-6xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Welcome back to <span className="gradient-text">ORBIT</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Continue processing your images with AI-powered analysis
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Upload New Images */}
            <Card className="cosmic-border hover:border-accent/40 transition-colors group cursor-pointer" onClick={onNewUpload}>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mr-4">
                    <Upload className="w-6 h-6 text-accent" />
                  </div>
                  Upload New Images
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Start a new batch processing job with AI analysis and metadata extraction.
                </p>
                <Button variant="cosmic" className="w-full group-hover:scale-105 transition-transform">
                  Start New Processing
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {/* View Dashboard */}
            {hasOrders && (
              <Card className="cosmic-border hover:border-accent/40 transition-colors group cursor-pointer" onClick={onViewDashboard}>
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mr-4">
                      <BarChart3 className="w-6 h-6 text-accent" />
                    </div>
                    View Dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Monitor your processing jobs and download completed results.
                  </p>
                  <Button variant="outline" className="w-full group-hover:scale-105 transition-transform">
                    Open Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Orders */}
          {hasOrders && recentOrders.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recentOrders.slice(0, 3).map((order) => (
                  <Card key={order.id} className="cosmic-border hover:border-accent/40 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.orderStatus === 'completed' 
                            ? 'bg-green-100 text-green-600' 
                            : order.orderStatus === 'processing'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-yellow-100 text-yellow-600'
                        }`}>
                          {order.orderStatus}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Images:</span>
                          <span>{order.imageCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-medium">${order.totalCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Progress:</span>
                          <span>{order.processedCount}/{order.imageCount}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {recentOrders.length > 3 && (
                <div className="text-center mt-6">
                  <Button variant="outline" onClick={onViewDashboard}>
                    View All Orders
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Quick Stats */}
          {hasOrders && (
            <div className="text-center">
              <div className="inline-block bg-card/30 backdrop-blur-sm border border-accent/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Your ORBIT Stats</h3>
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent mb-1">
                      {recentOrders.filter(o => o.orderStatus === 'completed').length}
                    </div>
                    <div className="text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent mb-1">
                      {recentOrders.reduce((sum, o) => sum + o.imageCount, 0)}
                    </div>
                    <div className="text-muted-foreground">Images Processed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent mb-1">
                      ${recentOrders.reduce((sum, o) => sum + o.totalCost, 0).toFixed(0)}
                    </div>
                    <div className="text-muted-foreground">Total Spent</div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
};