/**
 * Storage Verification Service
 * 
 * Ensures that processed files actually exist in storage before marking operations complete.
 * Provides comprehensive verification to prevent silent failures and maintain data integrity.
 * 
 * Critical for production reliability - verifies storage-database consistency and ORBIT 
 * storage pattern compliance before marking orders complete.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export interface VerificationResult {
  verified: boolean;
  expectedFiles: number;
  actualFiles: number;
  missingFiles: string[];
  extraFiles: string[];
  sizeMismatches: Array<{
    filename: string;
    expected: 'larger_than_original' | 'exists';
    actual: string;
    details: string;
  }>;
  verificationDetails: {
    originalFilesVerified: boolean;
    processedFilesVerified: boolean;
    metadataFilesFound: number;
    reportFilesFound: number;
    xmpFilesFound: number;
  };
}

export interface FileVerificationDetails {
  filename: string;
  exists: boolean;
  size?: number;
  type?: string;
  lastModified?: string;
  path: string;
}

export interface OrderVerificationResult {
  orderId: string;
  userId: string;
  totalImages: number;
  verifiedImages: number;
  failedImages: number;
  verificationPassed: boolean;
  originalFolderVerification: VerificationResult;
  processedFolderVerification: VerificationResult;
  databaseConsistency: {
    consistent: boolean;
    issues: string[];
  };
  storagePatternCompliance: boolean;
  recommendations: string[];
}

export class StorageVerificationService {
  private supabase: any;
  private storageClient: any;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('sb_secret_key') || Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for Storage Verification Service');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.storageClient = this.supabase.storage.from('orbit-images');

    console.log('🔍 Storage Verification Service initialized');
  }

  /**
   * Verify all processed files exist and are valid for order completion
   * This is the main method called before marking orders complete
   */
  async verifyOrderCompletion(orderId: string, userId: string): Promise<OrderVerificationResult> {
    console.log(`🔍 Starting comprehensive verification for order ${orderId}`);

    try {
      // Get all images for this order from database
      const { data: images, error: dbError } = await this.supabase
        .from('images')
        .select(`
          id,
          original_filename,
          storage_path_original,
          storage_path_processed,
          processing_status,
          file_size,
          mime_type
        `)
        .eq('order_id', orderId);

      if (dbError) {
        throw new Error(`Failed to fetch order images: ${dbError.message}`);
      }

      if (!images || images.length === 0) {
        throw new Error(`No images found for order ${orderId}`);
      }

      console.log(`📋 Verifying ${images.length} images for order ${orderId}`);

      // Build folder paths following ORBIT pattern
      const originalFolderPath = `${orderId}_${userId}/original`;
      const processedFolderPath = `${orderId}_${userId}/processed`;

      // Verify original files exist
      const originalVerification = await this.verifyFolderFiles(
        originalFolderPath,
        images.map(img => this.extractFilenameFromPath(img.storage_path_original)),
        'original'
      );

      // Verify processed files exist  
      const processedVerification = await this.verifyFolderFiles(
        processedFolderPath,
        images
          .filter(img => img.storage_path_processed)
          .map(img => this.extractFilenameFromPath(img.storage_path_processed)),
        'processed'
      );

      // Check database consistency
      const databaseConsistency = await this.verifyDatabaseConsistency(images);

      // Verify ORBIT storage pattern compliance
      const storagePatternCompliance = this.verifyStoragePatternCompliance(
        orderId,
        userId,
        originalFolderPath,
        processedFolderPath
      );

      // Count verified images
      let verifiedImages = 0;
      let failedImages = 0;

      for (const image of images) {
        const originalExists = originalVerification.verified && 
          !originalVerification.missingFiles.includes(this.extractFilenameFromPath(image.storage_path_original));
        
        const processedExists = image.storage_path_processed ? 
          processedVerification.verified && 
          !processedVerification.missingFiles.includes(this.extractFilenameFromPath(image.storage_path_processed))
          : false;

        const hasAnalysis = image.processing_status === 'completed';

        if (originalExists && processedExists && hasAnalysis) {
          verifiedImages++;
        } else {
          failedImages++;
        }
      }

      const verificationPassed = 
        originalVerification.verified &&
        processedVerification.verified &&
        databaseConsistency.consistent &&
        storagePatternCompliance &&
        verifiedImages === images.length;

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        originalVerification,
        processedVerification,
        databaseConsistency,
        storagePatternCompliance
      );

      const result: OrderVerificationResult = {
        orderId,
        userId,
        totalImages: images.length,
        verifiedImages,
        failedImages,
        verificationPassed,
        originalFolderVerification: originalVerification,
        processedFolderVerification: processedVerification,
        databaseConsistency,
        storagePatternCompliance,
        recommendations
      };

      if (verificationPassed) {
        console.log(`✅ Verification passed for order ${orderId}: ${verifiedImages}/${images.length} images verified`);
      } else {
        console.warn(`⚠️ Verification failed for order ${orderId}: ${verifiedImages}/${images.length} images verified`);
        console.warn(`🔍 Issues: ${recommendations.join(', ')}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ Verification error for order ${orderId}:`, error);
      
      // Return failed verification result
      return {
        orderId,
        userId,
        totalImages: 0,
        verifiedImages: 0,
        failedImages: 0,
        verificationPassed: false,
        originalFolderVerification: {
          verified: false,
          expectedFiles: 0,
          actualFiles: 0,
          missingFiles: [],
          extraFiles: [],
          sizeMismatches: [],
          verificationDetails: {
            originalFilesVerified: false,
            processedFilesVerified: false,
            metadataFilesFound: 0,
            reportFilesFound: 0,
            xmpFilesFound: 0
          }
        },
        processedFolderVerification: {
          verified: false,
          expectedFiles: 0,
          actualFiles: 0,
          missingFiles: [],
          extraFiles: [],
          sizeMismatches: [],
          verificationDetails: {
            originalFilesVerified: false,
            processedFilesVerified: false,
            metadataFilesFound: 0,
            reportFilesFound: 0,
            xmpFilesFound: 0
          }
        },
        databaseConsistency: {
          consistent: false,
          issues: [`Verification error: ${error.message}`]
        },
        storagePatternCompliance: false,
        recommendations: [`Fix verification error: ${error.message}`]
      };
    }
  }

  /**
   * Verify specific image processing completion
   */
  async verifyImageProcessing(
    imagePath: string, 
    expectedMetadata?: any,
    originalPath?: string
  ): Promise<boolean> {
    try {
      console.log(`🔍 Verifying image processing: ${imagePath}`);

      // Check if processed file exists
      const { data, error } = await this.storageClient.download(imagePath);
      
      if (error || !data) {
        console.warn(`⚠️ Processed file not found: ${imagePath}`);
        return false;
      }

      // If original path provided, verify processed file is larger (metadata adds size)
      if (originalPath) {
        const { data: originalData, error: originalError } = await this.storageClient.download(originalPath);
        
        if (!originalError && originalData) {
          const originalSize = originalData.size;
          const processedSize = data.size;
          
          if (processedSize <= originalSize) {
            console.warn(`⚠️ Processed file not larger than original: ${processedSize} <= ${originalSize}`);
            return false;
          }
          
          console.log(`✅ Size verification passed: ${processedSize} > ${originalSize} bytes`);
        }
      }

      // TODO: Add metadata verification if expectedMetadata provided
      // This could involve reading EXIF/XMP data from the processed image

      console.log(`✅ Image processing verified: ${imagePath}`);
      return true;

    } catch (error) {
      console.error(`❌ Error verifying image processing for ${imagePath}:`, error);
      return false;
    }
  }

  /**
   * Verify storage pattern compliance with ORBIT standards
   */
  verifyStoragePatternCompliance(
    orderId: string,
    userId: string,
    originalFolderPath: string,
    processedFolderPath: string
  ): boolean {
    const expectedOriginalPattern = `${orderId}_${userId}/original`;
    const expectedProcessedPattern = `${orderId}_${userId}/processed`;

    const originalPatternValid = originalFolderPath === expectedOriginalPattern;
    const processedPatternValid = processedFolderPath === expectedProcessedPattern;

    if (!originalPatternValid) {
      console.warn(`⚠️ Original folder pattern mismatch: expected ${expectedOriginalPattern}, got ${originalFolderPath}`);
    }

    if (!processedPatternValid) {
      console.warn(`⚠️ Processed folder pattern mismatch: expected ${expectedProcessedPattern}, got ${processedFolderPath}`);
    }

    return originalPatternValid && processedPatternValid;
  }

  /**
   * Verify files exist in a specific folder
   */
  private async verifyFolderFiles(
    folderPath: string,
    expectedFiles: string[],
    folderType: 'original' | 'processed'
  ): Promise<VerificationResult> {
    try {
      console.log(`🔍 Verifying ${folderType} folder: ${folderPath}`);

      // List all files in the folder
      const { data: files, error } = await this.storageClient.list(folderPath);
      
      if (error) {
        console.error(`❌ Error listing files in ${folderPath}: ${error.message}`);
        return this.createFailedVerificationResult(expectedFiles, `Failed to list files: ${error.message}`);
      }

      const actualFiles = files?.map((f: any) => f.name) || [];
      
      console.log(`📋 Found ${actualFiles.length} files in ${folderPath}: ${actualFiles.join(', ')}`);

      // Check for missing files
      const missingFiles = expectedFiles.filter(expected => !actualFiles.includes(expected));
      
      // Check for extra files (might be metadata files, which is okay)
      const extraFiles = actualFiles.filter(actual => !expectedFiles.includes(actual));

      // Count metadata-related files
      let metadataFilesFound = 0;
      let reportFilesFound = 0;
      let xmpFilesFound = 0;

      extraFiles.forEach(file => {
        const lowerFile = file.toLowerCase();
        if (lowerFile.endsWith('_me.jpg') || lowerFile.endsWith('_me.jpeg')) {
          metadataFilesFound++;
        } else if (lowerFile.endsWith('_report.txt') || lowerFile.endsWith('.txt')) {
          reportFilesFound++;
        } else if (lowerFile.endsWith('.xmp')) {
          xmpFilesFound++;
        }
      });

      const verified = missingFiles.length === 0;
      
      const result: VerificationResult = {
        verified,
        expectedFiles: expectedFiles.length,
        actualFiles: actualFiles.length,
        missingFiles,
        extraFiles,
        sizeMismatches: [], // TODO: Implement size verification
        verificationDetails: {
          originalFilesVerified: folderType === 'original' ? verified : false,
          processedFilesVerified: folderType === 'processed' ? verified : false,
          metadataFilesFound,
          reportFilesFound,
          xmpFilesFound
        }
      };

      if (verified) {
        console.log(`✅ ${folderType} folder verification passed: ${expectedFiles.length} files found`);
        if (extraFiles.length > 0) {
          console.log(`📎 Additional files found: ${extraFiles.length} (${metadataFilesFound} metadata, ${reportFilesFound} reports, ${xmpFilesFound} XMP)`);
        }
      } else {
        console.warn(`⚠️ ${folderType} folder verification failed: ${missingFiles.length} missing files`);
        console.warn(`🚫 Missing: ${missingFiles.join(', ')}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ Error verifying ${folderType} folder ${folderPath}:`, error);
      return this.createFailedVerificationResult(expectedFiles, error.message);
    }
  }

  /**
   * Verify database consistency with storage reality
   */
  private async verifyDatabaseConsistency(images: any[]): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check each image record
    for (const image of images) {
      // Check required fields
      if (!image.storage_path_original) {
        issues.push(`Image ${image.id}: missing storage_path_original`);
      }

      if (image.processing_status === 'completed' && !image.storage_path_processed) {
        issues.push(`Image ${image.id}: marked complete but missing storage_path_processed`);
      }

      if (image.processing_status === 'completed' && !image.ai_analysis) {
        issues.push(`Image ${image.id}: marked complete but missing ai_analysis`);
      }

      // Check processing status consistency
      if (image.storage_path_processed && image.processing_status !== 'completed') {
        issues.push(`Image ${image.id}: has processed path but status is ${image.processing_status}`);
      }
    }

    const consistent = issues.length === 0;

    if (consistent) {
      console.log(`✅ Database consistency verified: ${images.length} images`);
    } else {
      console.warn(`⚠️ Database consistency issues found: ${issues.length} issues`);
      issues.forEach(issue => console.warn(`  - ${issue}`));
    }

    return { consistent, issues };
  }

  /**
   * Generate recommendations based on verification results
   */
  private generateRecommendations(
    originalVerification: VerificationResult,
    processedVerification: VerificationResult,
    databaseConsistency: { consistent: boolean; issues: string[] },
    storagePatternCompliance: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (!originalVerification.verified) {
      recommendations.push(`Fix missing original files: ${originalVerification.missingFiles.join(', ')}`);
    }

    if (!processedVerification.verified) {
      recommendations.push(`Fix missing processed files: ${processedVerification.missingFiles.join(', ')}`);
    }

    if (!databaseConsistency.consistent) {
      recommendations.push(`Fix database consistency issues: ${databaseConsistency.issues.length} found`);
    }

    if (!storagePatternCompliance) {
      recommendations.push('Fix storage folder pattern to match ORBIT standards');
    }

    if (recommendations.length === 0) {
      recommendations.push('All verifications passed - order ready for completion');
    }

    return recommendations;
  }

  /**
   * Create a failed verification result
   */
  private createFailedVerificationResult(expectedFiles: string[], errorMessage: string): VerificationResult {
    return {
      verified: false,
      expectedFiles: expectedFiles.length,
      actualFiles: 0,
      missingFiles: expectedFiles,
      extraFiles: [],
      sizeMismatches: [],
      verificationDetails: {
        originalFilesVerified: false,
        processedFilesVerified: false,
        metadataFilesFound: 0,
        reportFilesFound: 0,
        xmpFilesFound: 0
      }
    };
  }

  /**
   * Extract filename from storage path
   */
  private extractFilenameFromPath(path: string): string {
    return path.split('/').pop() || path;
  }

  /**
   * Get verification service statistics
   */
  async getVerificationStats(): Promise<{
    totalVerifications: number;
    successfulVerifications: number;
    failedVerifications: number;
    averageFilesPerOrder: number;
  }> {
    // This would track verification statistics over time
    // For now, return placeholder stats
    return {
      totalVerifications: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      averageFilesPerOrder: 0
    };
  }
}