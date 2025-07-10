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
  ArrowLeft
} from 'lucide-react';
import { ProcessingStatus } from '@/hooks/useOrderProcessingStatus';

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
  const getStatusIcon = () => {
    switch (status.orderStatus) {
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-success" />;
      case 'processing':
        return <Loader2 className="w-8 h-8 text-accent animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-8 h-8 text-destructive" />;
      default:
        return <Clock className="w-8 h-8 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (status.orderStatus) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500 text-white">Completed</Badge>;
      case 'processing':
        return <Badge variant="default">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getStatusDescription = () => {
    switch (status.orderStatus) {
      case 'completed':
        return 'All images have been processed successfully';
      case 'processing':
        return 'Your images are currently being processed';
      case 'failed':
        return 'Processing failed. Please contact support.';
      default:
        return 'Processing is queued and will begin shortly';
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
        {status.orderStatus === 'completed' && onDownload && (
          <Button 
            variant="default" 
            size="lg" 
            className="w-full"
            onClick={onDownload}
          >
            <Download className="w-5 h-5" />
            Download Results
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
    </div>
  );
};