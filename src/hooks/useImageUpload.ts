import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UploadedImageData {
  id: string;
  original_filename: string;
  storage_path_original: string;
  file_size: number;
  mime_type: string;
}

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadImages = async (
    files: File[], 
    orderId: string, 
    batchId: string,
    userId: string
  ): Promise<UploadedImageData[]> => {
    setUploading(true);
    setUploadProgress(0);
    
    const uploadedImages: UploadedImageData[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📤 Uploading file ${i + 1}/${files.length}: ${file.name}`);
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2);
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const storageFileName = `${timestamp}_${randomId}.${fileExtension}`;
        const storagePath = `${userId}/raw_images/${storageFileName}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('orbit-uploads')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error(`❌ Upload failed for ${file.name}:`, uploadError);
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        console.log(`✅ File uploaded to storage:`, uploadData.path);

        // Create image record in database
        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .insert({
            user_id: userId,
            order_id: orderId,
            batch_id: batchId,
            original_filename: file.name,
            storage_path_original: uploadData.path,
            file_size: file.size,
            mime_type: file.type,
            processing_status: 'pending'
          })
          .select()
          .single();

        if (imageError) {
          console.error(`❌ Database insert failed for ${file.name}:`, imageError);
          // Try to clean up uploaded file
          await supabase.storage.from('orbit-uploads').remove([uploadData.path]);
          throw new Error(`Failed to save image metadata for ${file.name}: ${imageError.message}`);
        }

        uploadedImages.push({
          id: imageData.id,
          original_filename: imageData.original_filename,
          storage_path_original: imageData.storage_path_original!,
          file_size: imageData.file_size!,
          mime_type: imageData.mime_type!
        });

        console.log(`✅ Image record created:`, imageData.id);
        
        // Update progress
        const progress = ((i + 1) / files.length) * 100;
        setUploadProgress(progress);
      }

      console.log(`🎉 Successfully uploaded ${uploadedImages.length} images`);
      return uploadedImages;

    } catch (error) {
      console.error('❌ Image upload failed:', error);
      
      // Clean up any successfully uploaded images
      if (uploadedImages.length > 0) {
        console.log('🧹 Cleaning up uploaded images...');
        for (const image of uploadedImages) {
          try {
            await supabase.storage.from('orbit-uploads').remove([image.storage_path_original]);
            await supabase.from('images').delete().eq('id', image.id);
          } catch (cleanupError) {
            console.error('⚠️ Cleanup error:', cleanupError);
          }
        }
      }
      
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return {
    uploadImages,
    uploading,
    uploadProgress
  };
};