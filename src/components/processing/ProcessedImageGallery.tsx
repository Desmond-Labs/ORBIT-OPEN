import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Image as ImageIcon, Palette, Tag, Target, Sparkles, Eye, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProcessedImages } from '@/hooks/useProcessedImages';
import { supabase } from '@/integrations/supabase/client';

interface ProcessedImageGalleryProps {
  orderId: string;
}

interface GeminiAnalysis {
  product_identification?: {
    type?: string;
    category?: string;
    design_style?: string;
  };
  physical_characteristics?: {
    colors?: string[];
    materials?: string[];
    patterns?: string[];
  };
  commercial_analysis?: {
    market_positioning?: string;
    target_market?: string;
  };
  quality_assessment?: {
    construction?: string;
    materials?: string;
    finish?: string;
  };
  design_attributes?: {
    aesthetic_category?: string;
    visual_weight?: string;
  };
  [key: string]: any;
}

interface MetadataDisplayProps {
  geminiAnalysis: string | null;
  analysisType: string | null;
}

const getThumbnailUrl = (storagePath: string | null): string | null => {
  if (!storagePath) return null;
  
  try {
    const { data } = supabase.storage
      .from('processed_images')
      .getPublicUrl(storagePath, {
        transform: {
          width: 64,
          height: 64,
          quality: 80
        }
      });
    
    return data.publicUrl;
  } catch (error) {
    console.error('Error generating thumbnail URL:', error);
    return null;
  }
};

const MetadataDisplay: React.FC<MetadataDisplayProps> = ({ 
  geminiAnalysis, 
  analysisType 
}) => {
  let parsedAnalysis: GeminiAnalysis = {};
  
  try {
    if (geminiAnalysis) {
      parsedAnalysis = JSON.parse(geminiAnalysis);
    }
  } catch (error) {
    console.error('Error parsing gemini analysis:', error);
  }

  return (
    <div className="space-y-4 p-4 bg-secondary/20 rounded-lg">
      {analysisType && (
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-medium">Analysis Type:</span>
          <Badge variant="secondary" className="capitalize">{analysisType}</Badge>
        </div>
      )}
      
      {parsedAnalysis.product_identification && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-primary">Product Identification</h4>
          </div>
          <div className="pl-6 space-y-1 text-sm">
            {parsedAnalysis.product_identification.type && (
              <div><span className="font-medium">Type:</span> <span className="ml-2">{parsedAnalysis.product_identification.type}</span></div>
            )}
            {parsedAnalysis.product_identification.category && (
              <div><span className="font-medium">Category:</span> <span className="ml-2">{parsedAnalysis.product_identification.category}</span></div>
            )}
            {parsedAnalysis.product_identification.design_style && (
              <div><span className="font-medium">Design Style:</span> <span className="ml-2">{parsedAnalysis.product_identification.design_style}</span></div>
            )}
          </div>
        </div>
      )}

      {parsedAnalysis.physical_characteristics && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent" />
            <h4 className="font-medium text-accent">Physical Characteristics</h4>
          </div>
          <div className="pl-6 space-y-2 text-sm">
            {parsedAnalysis.physical_characteristics.colors && (
              <div>
                <span className="font-medium">Colors:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {parsedAnalysis.physical_characteristics.colors.map((color: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">{color}</Badge>
                  ))}
                </div>
              </div>
            )}
            {parsedAnalysis.physical_characteristics.materials && (
              <div>
                <span className="font-medium">Materials:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {parsedAnalysis.physical_characteristics.materials.map((material: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">{material}</Badge>
                  ))}
                </div>
              </div>
            )}
            {parsedAnalysis.physical_characteristics.patterns && (
              <div>
                <span className="font-medium">Patterns:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {parsedAnalysis.physical_characteristics.patterns.map((pattern: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">{pattern}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {parsedAnalysis.commercial_analysis && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-green-600" />
            <h4 className="font-medium text-green-600">Commercial Analysis</h4>
          </div>
          <div className="pl-6 space-y-1 text-sm">
            {parsedAnalysis.commercial_analysis.market_positioning && (
              <div><span className="font-medium">Market Positioning:</span> <span className="ml-2">{parsedAnalysis.commercial_analysis.market_positioning}</span></div>
            )}
            {parsedAnalysis.commercial_analysis.target_market && (
              <div><span className="font-medium">Target Market:</span> <span className="ml-2">{parsedAnalysis.commercial_analysis.target_market}</span></div>
            )}
          </div>
        </div>
      )}

      {parsedAnalysis.quality_assessment && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h4 className="font-medium text-blue-600">Quality Assessment</h4>
          </div>
          <div className="pl-6 space-y-1 text-sm">
            {parsedAnalysis.quality_assessment.construction && (
              <div><span className="font-medium">Construction:</span> <span className="ml-2">{parsedAnalysis.quality_assessment.construction}</span></div>
            )}
            {parsedAnalysis.quality_assessment.materials && (
              <div><span className="font-medium">Materials Quality:</span> <span className="ml-2">{parsedAnalysis.quality_assessment.materials}</span></div>
            )}
            {parsedAnalysis.quality_assessment.finish && (
              <div><span className="font-medium">Finish:</span> <span className="ml-2">{parsedAnalysis.quality_assessment.finish}</span></div>
            )}
          </div>
        </div>
      )}

      {parsedAnalysis.design_attributes && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-600" />
            <h4 className="font-medium text-purple-600">Design Attributes</h4>
          </div>
          <div className="pl-6 space-y-1 text-sm">
            {parsedAnalysis.design_attributes.aesthetic_category && (
              <div><span className="font-medium">Aesthetic Category:</span> <span className="ml-2">{parsedAnalysis.design_attributes.aesthetic_category}</span></div>
            )}
            {parsedAnalysis.design_attributes.visual_weight && (
              <div><span className="font-medium">Visual Weight:</span> <span className="ml-2">{parsedAnalysis.design_attributes.visual_weight}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Display any other analysis fields not covered above */}
      {Object.entries(parsedAnalysis).map(([key, value]) => {
        if (['product_identification', 'physical_characteristics', 'commercial_analysis', 'quality_assessment', 'design_attributes'].includes(key)) return null;
        if (!value || typeof value !== 'object') return null;
        
        return (
          <div key={key} className="space-y-2">
            <h4 className="font-medium capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</h4>
            <div className="pl-6 space-y-1 text-sm">
              {typeof value === 'object' && Object.entries(value).map(([subKey, subValue]) => (
                <div key={subKey}>
                  <span className="font-medium capitalize">{subKey.replace(/_/g, ' ')}:</span>
                  <span className="ml-2">{Array.isArray(subValue) ? subValue.join(', ') : String(subValue)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
          const thumbnailUrl = getThumbnailUrl(image.storage_path_processed);
          
          return (
            <Card key={image.id} className="p-4 bg-card/30 backdrop-blur-sm border-accent/20">
              <div className="flex items-center gap-4">
                {/* Thumbnail */}
                <div className="w-16 h-16 bg-secondary/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  {thumbnailUrl ? (
                    <img 
                      src={thumbnailUrl} 
                      alt={image.original_filename}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const iconDiv = document.createElement('div');
                        iconDiv.className = 'w-8 h-8 text-muted-foreground';
                        e.currentTarget.parentElement?.appendChild(iconDiv);
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