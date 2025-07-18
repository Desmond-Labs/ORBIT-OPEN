import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Image as ImageIcon, Clock, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProcessedImages } from '@/hooks/useProcessedImages';

interface ProcessedImageGalleryProps {
  orderId: string;
}

interface MetadataDisplayProps {
  analysis: any;
  processingCost: number | null;
  processingDuration: number | null;
  analysisType: string | null;
}

const MetadataDisplay: React.FC<MetadataDisplayProps> = ({ 
  analysis, 
  processingCost, 
  processingDuration, 
  analysisType 
}) => {
  return (
    <div className="space-y-4 p-4 bg-secondary/20 rounded-lg">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-accent" />
          <span className="font-medium">Cost:</span>
          <span>${processingCost?.toFixed(2) || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent" />
          <span className="font-medium">Duration:</span>
          <span>{processingDuration ? `${(processingDuration / 1000).toFixed(1)}s` : 'N/A'}</span>
        </div>
      </div>
      
      {analysisType && (
        <div className="text-sm">
          <span className="font-medium">Analysis Type:</span>
          <span className="ml-2 capitalize">{analysisType}</span>
        </div>
      )}
      
      {analysis && (
        <div className="space-y-3">
          <h4 className="font-medium text-accent">AI Analysis Results:</h4>
          <div className="space-y-2 text-sm">
            {analysis.description && (
              <div>
                <span className="font-medium">Description:</span>
                <p className="mt-1 text-muted-foreground">{analysis.description}</p>
              </div>
            )}
            {analysis.tags && Array.isArray(analysis.tags) && (
              <div>
                <span className="font-medium">Tags:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {analysis.tags.map((tag: string, index: number) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-accent/20 text-accent rounded-md text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {analysis.categories && Array.isArray(analysis.categories) && (
              <div>
                <span className="font-medium">Categories:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {analysis.categories.map((category: string, index: number) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-primary/20 text-primary rounded-md text-xs"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {analysis.confidence && (
              <div>
                <span className="font-medium">Confidence:</span>
                <span className="ml-2">{(analysis.confidence * 100).toFixed(1)}%</span>
              </div>
            )}
            {/* Display any other analysis fields */}
            {Object.entries(analysis).map(([key, value]) => {
              if (['description', 'tags', 'categories', 'confidence'].includes(key)) return null;
              return (
                <div key={key}>
                  <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="ml-2">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const ProcessedImageGallery: React.FC<ProcessedImageGalleryProps> = ({ orderId }) => {
  const { images, loading, error } = useProcessedImages(orderId);
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());

  const toggleImageExpanded = (imageId: string) => {
    setExpandedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold mb-4">Processed Images</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse">Loading images...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold mb-4">Processed Images</h3>
        <div className="text-destructive text-center py-4">
          Error loading images: {error}
        </div>
      </div>
    );
  }

  if (!images.length) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold mb-4">Processed Images</h3>
        <div className="text-muted-foreground text-center py-4">
          No processed images found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Processed Images ({images.length})</h3>
      <div className="space-y-4">
        {images.map((image) => {
          const isExpanded = expandedImages.has(image.id);
          
          return (
            <Card key={image.id} className="p-4 bg-card/30 backdrop-blur-sm border-accent/20">
              <div className="flex items-center gap-4">
                {/* Thumbnail */}
                <div className="w-16 h-16 bg-secondary/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  {image.thumbnail_path ? (
                    <img 
                      src={image.thumbnail_path} 
                      alt={image.original_filename}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        // Fallback to icon if thumbnail fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                        e.currentTarget.parentElement?.appendChild(
                          document.createElement('div')
                        );
                      }}
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                
                {/* File info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{image.original_filename}</h4>
                  <p className="text-sm text-muted-foreground">
                    Processed {image.processed_at ? new Date(image.processed_at).toLocaleDateString() : 'recently'}
                  </p>
                </div>
                
                {/* Expand/Collapse button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleImageExpanded(image.id)}
                  className="flex-shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {/* Expanded metadata */}
              {isExpanded && (
                <div className="mt-4">
                  <MetadataDisplay
                    analysis={image.ai_analysis}
                    processingCost={image.processing_cost}
                    processingDuration={image.processing_duration_ms}
                    analysisType={image.analysis_type}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};