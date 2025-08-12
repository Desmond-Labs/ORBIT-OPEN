import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  FileText, 
  DollarSign,
  Calendar,
  Image,
  Download,
  Upload,
  ArrowLeft,
  CreditCard,
  XCircle,
  Rocket,
  Satellite
} from 'lucide-react';
import { ProcessingStatus } from '@/hooks/useOrderProcessingStatus';
import { useDownloadProcessedImages } from '@/hooks/useDownloadProcessedImages';
import { ProcessedImageGallery } from './ProcessedImageGallery';
import { getUnifiedOrderStatus } from '@/utils/orderStatus';

interface ProcessingStatusDashboardProps {
  status: ProcessingStatus | any; // Allow token order status as well
  onDownload?: () => void;
  onProcessMore?: () => void;
  onBackToDashboard?: () => void;
  isTokenUser?: boolean;
  tokenAuth?: any;
}

export const ProcessingStatusDashboard: React.FC<ProcessingStatusDashboardProps> = ({
  status,
  onDownload,
  onProcessMore,
  onBackToDashboard,
  isTokenUser = false,
  tokenAuth
}) => {
  const { downloadProcessedImages, downloading } = useDownloadProcessedImages();
  
  // Check if payment is completed
  const isPaymentCompleted = status.paymentStatus === 'completed' || status.paymentStatus === 'succeeded';
  
  // If payment is not completed, show payment pending message
  if (!isPaymentCompleted) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <CreditCard className="w-12 h-12 text-amber-500" />
          </div>
          <h3 className="text-2xl font-semibold mb-2">Payment Required</h3>
          <p className="text-muted-foreground mb-4">
            This order requires payment confirmation before processing can begin.
          </p>
          <div className="flex justify-center">
            <Badge variant="outline" className="text-amber-600 bg-amber-50">
              Payment {status.paymentStatus || 'pending'}
            </Badge>
          </div>
        </div>
        
        <Card className="bg-secondary/50 p-6">
          <h4 className="text-lg font-semibold mb-4">Order Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Order Number:</span>
              <span className="font-medium">{status.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Cost:</span>
              <span className="font-medium">${status.totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Images:</span>
              <span className="font-medium">{status.imageCount}</span>
            </div>
          </div>
        </Card>
        
        <div className="flex justify-center">
          {onBackToDashboard && (
            <Button 
              variant="outline" 
              size="lg" 
              onClick={onBackToDashboard}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }
  // Get unified status for consistent display
  const unifiedStatus = getUnifiedOrderStatus({
    orderStatus: status.orderStatus,
    paymentStatus: status.paymentStatus,
    processingStage: status.processingStage,
    processedCount: status.processedCount,
    imageCount: status.imageCount,
    failedCount: status.failedCount
  });

  const getStatusIcon = () => {
    switch (unifiedStatus.icon) {
      case 'check-circle':
        return <CheckCircle className="w-8 h-8 text-success" />;
      case 'satellite':
        return <Satellite className="w-8 h-8 text-purple-500 animate-pulse" />;
      case 'rocket':
        return <Rocket className="w-8 h-8 text-blue-500" />;
      case 'alert-circle':
        return <AlertCircle className="w-8 h-8 text-destructive" />;
      case 'clock':
      default:
        return <Clock className="w-8 h-8 text-yellow-500" />;
    }
  };

  const getStatusBadge = () => {
    return (
      <div className="flex flex-col items-center">
        <Badge variant="outline" className={unifiedStatus.colorClass}>
          {getStatusIcon()}
          <span className="ml-2 font-medium">{unifiedStatus.label}</span>
        </Badge>
        {unifiedStatus.subtitle && (
          <span className="text-xs text-muted-foreground italic mt-1">{unifiedStatus.subtitle}</span>
        )}
      </div>
    );
  };

  const getStatusDescription = () => {
    return unifiedStatus.description;
  };

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          {getStatusIcon()}
        </div>
        <h3 className="text-2xl font-semibold mb-2">Processing Status</h3>
        <p className="text-muted-foreground mb-4">{getStatusDescription()}</p>
        <div className="flex justify-center">
          {getStatusBadge()}
        </div>
      </div>

      {/* Order Details */}
      <Card className="bg-secondary/50 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div className="text-sm text-muted-foreground">Order Number</div>
            <div className="font-semibold">{status.orderNumber}</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Image className="w-5 h-5 text-accent" />
            </div>
            <div className="text-sm text-muted-foreground">Total Images</div>
            <div className="font-semibold">{status.imageCount}</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            <div className="text-sm text-muted-foreground">Total Cost</div>
            <div className="font-semibold">${status.totalCost.toFixed(2)}</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="font-semibold">
              {new Date(status.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </Card>

      {/* Processing Progress */}
      <Card className="bg-secondary/50 p-6">
        <h4 className="text-lg font-semibold mb-4">Processing Progress</h4>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span>Images Processed</span>
            <span className="font-semibold">
              {status.processedCount} / {status.imageCount}
            </span>
          </div>
          <Progress value={status.processingProgress} className="mb-2" />
          <div className="text-sm text-muted-foreground">
            {status.processingProgress}% complete
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-success">{status.processedCount}</div>
            <div className="text-muted-foreground">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">
              {status.imageCount - status.processedCount - status.failedCount}
            </div>
            <div className="text-muted-foreground">Processing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{status.failedCount}</div>
            <div className="text-muted-foreground">Failed</div>
          </div>
        </div>
      </Card>

      {/* Current Mission Stage */}
      {(unifiedStatus.status === 'processing' || unifiedStatus.status === 'paid' || unifiedStatus.status === 'images_uploaded') && (
        <Card className="bg-secondary/50 p-6">
          <h4 className="text-lg font-semibold mb-4">Current Mission Stage</h4>
          <div className="flex items-center gap-3">
            {unifiedStatus.icon === 'satellite' ? (
              <Satellite className="w-5 h-5 text-purple-500 animate-pulse" />
            ) : (
              <Rocket className="w-5 h-5 text-blue-500" />
            )}
            <div className="flex flex-col">
              <span className="font-medium">{unifiedStatus.label}</span>
              <span className="text-sm text-muted-foreground">{unifiedStatus.description}</span>
            </div>
          </div>
          {status.processingCompletionPercentage !== undefined && status.processingCompletionPercentage > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progress</span>
                <span>{status.processingCompletionPercentage}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${status.processingCompletionPercentage}%` }}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {status.orderStatus === 'completed' && (
          <Button 
            variant="default" 
            size="lg" 
            className="w-full"
            onClick={async () => {
              if (isTokenUser && tokenAuth) {
                // Increment token usage for token users
                const urlParams = new URLSearchParams(window.location.search);
                const actualToken = urlParams.get('token');
                if (actualToken) {
                  await tokenAuth.incrementTokenUsage(actualToken);
                }
              }
              downloadProcessedImages(status.orderId, isTokenUser ? tokenAuth : undefined);
            }}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {downloading ? 'Preparing Download...' : 'Download Processed Images'}
          </Button>
        )}
        
        <div className="flex gap-3">
          {onProcessMore && (
            <Button 
              variant="outline" 
              size="lg" 
              className="flex-1"
              onClick={onProcessMore}
            >
              <Upload className="w-5 h-5" />
              Process More Images
            </Button>
          )}
          
          {onBackToDashboard && (
            <Button 
              variant="ghost" 
              size="lg" 
              className="flex-1"
              onClick={onBackToDashboard}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Button>
          )}
        </div>
      </div>

      {/* Image Gallery for completed orders */}
      {status.orderStatus === 'completed' && (
        <div className="mt-8">
          <ProcessedImageGallery orderId={status.orderId} />
        </div>
      )}
    </div>
  );
};