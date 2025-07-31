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
  XCircle
} from 'lucide-react';
import { ProcessingStatus } from '@/hooks/useOrderProcessingStatus';
import { useDownloadProcessedImages } from '@/hooks/useDownloadProcessedImages';
import { ProcessedImageGallery } from './ProcessedImageGallery';

interface ProcessingStatusDashboardProps {
  status: ProcessingStatus;
  onDownload?: () => void;
  onProcessMore?: () => void;
  onBackToDashboard?: () => void;
}

export const ProcessingStatusDashboard: React.FC<ProcessingStatusDashboardProps> = ({
  status,
  onDownload,
  onProcessMore,
  onBackToDashboard
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
  const getStatusIcon = () => {
    switch (status.orderStatus) {
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-success" />;
      case 'processing':
        return <Loader2 className="w-8 h-8 text-accent animate-spin" />;
      case 'failed':
        return <XCircle className="w-8 h-8 text-destructive" />;
      default:
        // Check if it's "getting ready for launch" phase
        if (status.processingStage === 'preparing' || status.processingStage === 'queued') {
          return <Upload className="w-8 h-8 text-amber-500" />;
        }
        return <Clock className="w-8 h-8 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (status.orderStatus) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500 text-white">🚀 Mission Complete</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-500 text-white">🛰️ In ORBIT</Badge>;
      case 'failed':
        return <Badge variant="destructive">❌ Mission Failed</Badge>;
      default:
        // Check if it's "getting ready for launch" phase
        if (status.processingStage === 'preparing' || status.processingStage === 'queued') {
          return (
            <div className="text-center">
              <Badge variant="default" className="bg-amber-500 text-white mb-1">🚀 Getting Ready for Launch</Badge>
              <div className="text-xs text-muted-foreground">Please allow 24 hrs for processing</div>
            </div>
          );
        }
        return <Badge variant="secondary">⏳ Mission Pending</Badge>;
    }
  };

  const getStatusDescription = () => {
    switch (status.orderStatus) {
      case 'completed':
        return 'ORBIT analysis complete - your enhanced images are ready for download';
      case 'processing':
        return 'ORBIT is analyzing and enhancing your images in space';
      case 'failed':
        return 'Mission encountered an error. Please contact mission control.';
      default:
        // Check if it's "getting ready for launch" phase
        if (status.processingStage === 'preparing' || status.processingStage === 'queued') {
          return 'Mission is preparing for launch - systems check in progress';
        }
        return 'Mission queued for launch - awaiting clearance';
    }
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

      {/* Processing Stage */}
      {status.orderStatus === 'processing' && (
        <Card className="bg-secondary/50 p-6">
          <h4 className="text-lg font-semibold mb-4">Current Stage</h4>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
            <span className="capitalize">{status.processingStage}</span>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {status.orderStatus === 'completed' && (
          <Button 
            variant="default" 
            size="lg" 
            className="w-full"
            onClick={() => downloadProcessedImages(status.orderId)}
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