import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProcessedImages } from '@/hooks/useProcessedImages';
import { useThumbnails } from '@/hooks/useThumbnails';

interface ProcessedImageGalleryProps {
  orderId: string;
}

interface MetadataDisplayProps {
  geminiAnalysis: string | null;
  analysisType: string | null;
}

const MetadataDisplay: React.FC<MetadataDisplayProps> = ({ 
  geminiAnalysis, 
  analysisType 
}) => {
  let analysisData: any = {};
  
  try {
    if (geminiAnalysis) {
      analysisData = JSON.parse(geminiAnalysis);
    }
  } catch (error) {
    console.error('Error parsing gemini analysis:', error);
    return (
      <div className="space-y-4 p-4 bg-secondary/20 rounded-lg">
        <div className="text-destructive">Failed to parse analysis data</div>
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
          {geminiAnalysis || 'No data available'}
        </pre>
      </div>
    );
  }

  const renderSection = (title: string, data: any, color: string = 'text-primary', useBadges: boolean = true) => {
    if (!data || typeof data !== 'object') return null;

    return (
      <div className="space-y-2">
        <h4 className={`font-medium ${color} flex items-center gap-2`}>
          <span className="text-sm">{title}</span>
        </h4>
        <div className="pl-4 space-y-2 text-sm">
          {Object.entries(data).map(([key, value]) => {
            if (!value) return null;
            
            const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            if (Array.isArray(value)) {
              return (
                <div key={key}>
                  <span className="font-medium">{displayKey}:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {value.map((item: any, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            } else if (typeof value === 'object' && value !== null) {
              return (
                <div key={key}>
                  <span className="font-medium">{displayKey}:</span>
                  <div className="ml-4 mt-1 space-y-1">
                    {Object.entries(value).map(([subKey, subValue]) => (
                      <div key={subKey}>
                        <span className="text-xs text-muted-foreground">
                          {subKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                        </span>{' '}
                        {Array.isArray(subValue) ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {subValue.map((item: any, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {String(item)}
                              </Badge>
                            ))}
                          </div>
                        ) : useBadges ? (
                          <Badge variant="outline" className="text-xs ml-1">
                            {String(subValue)}
                          </Badge>
                        ) : (
                          <span className="text-sm">{String(subValue)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            } else {
              return (
                <div key={key}>
                  <span className="font-medium">{displayKey}:</span>
                  {useBadges ? (
                    <Badge variant="outline" className="text-xs ml-2">
                      {String(value)}
                    </Badge>
                  ) : (
                    <span className="ml-2">{String(value)}</span>
                  )}
                </div>
              );
            }
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4 bg-secondary/20 rounded-lg">
      {analysisType && (
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-medium">Analysis Type:</span>
          <Badge variant="secondary" className="capitalize">{analysisType}</Badge>
        </div>
      )}
      
      {/* Main Analysis Metadata - USE BADGES */}
      {analysisData.metadata && renderSection('Product Analysis', analysisData.metadata, 'text-primary', true)}
      
      {/* Security Scan Results - NO BADGES */}
      {analysisData.security_scan && renderSection('Security Scan', analysisData.security_scan, 'text-green-600', false)}
      
      {/* Integrity Information - NO BADGES */}
      {analysisData.integrity_info && renderSection('Integrity Information', analysisData.integrity_info, 'text-blue-600', false)}
      
      {/* Structural Elements - USE BADGES */}
      {analysisData.structural_elements && renderSection('Structural Elements', analysisData.structural_elements, 'text-purple-600', true)}
      
      {/* Handle flat structure (backward compatibility) - USE BADGES */}
      {!analysisData.metadata && !analysisData.security_scan && !analysisData.integrity_info && Object.keys(analysisData).length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-muted-foreground">Analysis Data</h4>
          {renderSection('Details', analysisData, 'text-primary', true)}
        </div>
      )}
      
      {Object.keys(analysisData).length === 0 && (
        <div className="text-muted-foreground text-center py-4">
          No analysis data available
        </div>
      )}
    </div>
  );
};

export const ProcessedImageGallery: React.FC<ProcessedImageGalleryProps> = ({ orderId }) => {
  const { images, loading, error } = useProcessedImages(orderId);
  const { thumbnails, loading: thumbnailsLoading } = useThumbnails(images);
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
          const thumbnailUrl = thumbnails[image.id];
          
          return (
            <Card key={image.id} className="p-4 bg-card/30 backdrop-blur-sm border-accent/20">
              <div className="flex items-center gap-4">
                {/* Thumbnail */}
                <div className="w-16 h-16 bg-secondary/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  {thumbnailsLoading ? (
                    <div className="animate-pulse w-8 h-8 bg-muted rounded"></div>
                  ) : thumbnailUrl ? (
                    <img 
                      src={thumbnailUrl} 
                      alt={image.original_filename}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        console.error('Failed to load thumbnail:', thumbnailUrl);
                        (e.target as HTMLImageElement).style.display = 'none';
                        const iconDiv = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                        if (iconDiv) {
                          iconDiv.classList.remove('hidden');
                        }
                      }}
                    />
                  ) : null}
                  <ImageIcon className={`w-8 h-8 text-muted-foreground fallback-icon ${thumbnailUrl ? 'hidden' : ''}`} />
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
                    geminiAnalysis={image.gemini_analysis_raw}
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
