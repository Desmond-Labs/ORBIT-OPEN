/**
 * Unified order status logic for consistent status display across all components
 */

export interface OrderStatusData {
  orderStatus: string | null;
  paymentStatus: string | null;
  processingStage?: string | null;
  processedCount?: number;
  imageCount?: number;
  failedCount?: number;
}

export interface UnifiedStatus {
  status: 'payment_pending' | 'paid' | 'images_uploaded' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'upload_failed';
  stage: string;
  label: string;
  description: string;
  colorClass: string;
  icon: string;
  subtitle?: string;
}

/**
 * Determines the unified order status based on multiple data points
 * Priority: database order_status > processing stage > calculated status from image counts
 */
export const getUnifiedOrderStatus = (data: OrderStatusData): UnifiedStatus => {
  const {
    orderStatus,
    paymentStatus,
    processingStage,
    processedCount = 0,
    imageCount = 0,
    failedCount = 0
  } = data;

  // Check payment status first - if not completed, always show payment pending
  const isPaymentCompleted = paymentStatus === 'completed' || paymentStatus === 'succeeded';
  
  if (!isPaymentCompleted) {
    return {
      status: 'payment_pending',
      stage: 'pending_payment',
      label: 'Mission Pending',
      description: 'Payment confirmation required to begin processing',
      colorClass: 'text-yellow-600 bg-yellow-100',
      icon: 'clock'
    };
  }

  // Use order_status directly if available and valid
  if (orderStatus) {
    switch (orderStatus) {
      case 'completed':
        return {
          status: 'completed',
          stage: 'completed',
          label: 'Mission Complete',
          description: 'All images have been processed successfully',
          colorClass: 'text-green-600 bg-green-100',
          icon: 'check-circle'
        };
      
      case 'completed_with_errors':
        return {
          status: 'completed_with_errors',
          stage: 'completed',
          label: 'Mission Complete',
          description: 'Processing completed with some errors',
          colorClass: 'text-green-600 bg-green-100',
          icon: 'check-circle'
        };
      
      case 'processing':
        // For processing orders, use processing stage for more specific status
        switch (processingStage) {
          case 'analyzing':
            return {
              status: 'processing',
              stage: 'analyzing',
              label: 'In ORBIT',
              description: 'AI systems are analyzing and enhancing your images',
              colorClass: 'text-purple-600 bg-purple-100',
              icon: 'satellite'
            };
          case 'initializing':
            return {
              status: 'processing',
              stage: 'initializing',
              label: 'Getting Ready for Launch',
              description: 'Preparing your images for AI analysis',
              colorClass: 'text-blue-600 bg-blue-100',
              icon: 'rocket',
              subtitle: 'Please allow 24 hrs'
            };
          default:
            return {
              status: 'processing',
              stage: 'analyzing',
              label: 'In ORBIT',
              description: 'Processing your images with advanced AI',
              colorClass: 'text-purple-600 bg-purple-100',
              icon: 'satellite'
            };
        }
      
      case 'failed':
        return {
          status: 'failed',
          stage: 'failed',
          label: 'Mission Failed',
          description: 'Processing failed. Please contact support.',
          colorClass: 'text-red-600 bg-red-100',
          icon: 'alert-circle'
        };
      
      case 'upload_failed':
        return {
          status: 'upload_failed',
          stage: 'failed',
          label: 'Mission Failed',
          description: 'Image upload failed. Please try again.',
          colorClass: 'text-red-600 bg-red-100',
          icon: 'alert-circle'
        };
      
      case 'paid':
      case 'images_uploaded':
        return {
          status: orderStatus as 'paid' | 'images_uploaded',
          stage: 'initializing',
          label: 'Getting Ready for Launch',
          description: 'Your order is queued and will begin processing shortly',
          colorClass: 'text-blue-600 bg-blue-100',
          icon: 'rocket',
          subtitle: 'Please allow 24 hrs'
        };
    }
  }

  // Fallback: Calculate status based on image processing counts
  if (imageCount > 0) {
    if (processedCount === imageCount) {
      return {
        status: 'completed',
        stage: 'completed',
        label: 'Mission Complete',
        description: 'All images have been processed successfully',
        colorClass: 'text-green-600 bg-green-100',
        icon: 'check-circle'
      };
    } else if (processedCount > 0) {
      return {
        status: 'processing',
        stage: 'analyzing',
        label: 'In ORBIT',
        description: 'Processing your images with advanced AI',
        colorClass: 'text-purple-600 bg-purple-100',
        icon: 'satellite'
      };
    } else if (failedCount === imageCount) {
      return {
        status: 'failed',
        stage: 'failed',
        label: 'Mission Failed',
        description: 'All images failed to process',
        colorClass: 'text-red-600 bg-red-100',
        icon: 'alert-circle'
      };
    }
  }

  // Final fallback: Default status based on payment
  if (isPaymentCompleted) {
    return {
      status: 'paid',
      stage: 'initializing',
      label: 'Getting Ready for Launch',
      description: 'Your order is queued and will begin processing shortly',
      colorClass: 'text-blue-600 bg-blue-100',
      icon: 'rocket',
      subtitle: 'Please allow 24 hrs'
    };
  }

  // Ultimate fallback
  return {
    status: 'payment_pending',
    stage: 'pending_payment',
    label: 'Mission Pending',
    description: 'Preparing to begin your mission',
    colorClass: 'text-yellow-600 bg-yellow-100',
    icon: 'clock'
  };
};