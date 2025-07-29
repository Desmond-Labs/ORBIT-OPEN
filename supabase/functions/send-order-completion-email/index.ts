import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OrderCompletionEmailRequest {
  orderId: string;
  userEmail: string;
  userName?: string;
  imageCount: number;
  errorCount?: number;
  status?: string;
  accessToken?: string;
  downloadUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📧 send-order-completion-email function called');
    console.log('📧 Request method:', req.method);
    console.log('📧 Request headers:', Object.fromEntries(req.headers.entries()));
    
    const { orderId, userEmail, userName, imageCount, errorCount = 0, status = 'completed', accessToken, downloadUrl }: OrderCompletionEmailRequest = await req.json();

    console.log('📧 Sending order completion email for order:', orderId);
    console.log('📧 Email recipient:', userEmail);
    console.log('📧 Image count:', imageCount);
    console.log('📧 Error count:', errorCount);
    console.log('📧 Status:', status);
    console.log('📧 Has access token:', !!accessToken);
    
    // Check environment variables
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('📧 Environment check:', {
      hasResendKey: !!resendKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      resendKeyLength: resendKey?.length || 0
    });
    
    if (!resendKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get order details from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    // Get batch info if available
    let batchName = `Order ${order.order_number}`;
    if (order.batch_id) {
      const { data: batch } = await supabase
        .from('batches')
        .select('name')
        .eq('id', order.batch_id)
        .single();
      
      if (batch?.name) {
        batchName = batch.name;
      }
    }
    const orderNumber = order.order_number;
    const totalCost = order.total_cost;
    
    // Generate secure access token for this order
    console.log('📧 Generating access token for order:', orderId);
    const { data: tokenData, error: tokenError } = await supabase.rpc('generate_order_access_token', {
      order_id_param: orderId,
      expires_in_hours: 168 // 7 days
    });
    
    if (tokenError) {
      console.error('❌ Failed to generate access token:', tokenError);
      // Don't fail the email - just use fallback URL
    }
    
    const accessToken = tokenData;
    console.log('✅ Access token generated:', accessToken ? 'SUCCESS' : 'FAILED');

    // Get processed images with analysis reports
    const { data: processedImages, error: imagesError } = await supabase
      .from('images')
      .select('id, original_filename, storage_path_processed, gemini_analysis_raw')
      .eq('order_id', orderId)
      .eq('processing_status', 'complete')
      .limit(5); // Limit to 5 images to avoid email size issues

    // Fetch .txt report files from storage
    let analysisReportsHtml = '';
    if (processedImages && processedImages.length > 0) {
      console.log(`Found ${processedImages.length} processed images for analysis reports`);
      
      const reportPromises = processedImages.map(async (image, index) => {
        try {
          // Construct the expected .txt file path
          // Pattern: {timestamp}_{index}_{filename}_report.txt
          // Storage path format: {order_id}_{user_id}/processed/
          if (!image.storage_path_processed) return null;
          
          const pathParts = image.storage_path_processed.split('/');
          if (pathParts.length < 2) return null;
          
          const folderPath = pathParts[0]; // e.g., "7e661994-ecbf-4d8a-943c-f7511e824798_7e55b358-63be-4d24-9cc7-c90cff52b0c6"
          const filename = pathParts[1];
          const baseFilename = filename.split('.')[0]; // Remove extension
          
          // Try to find the corresponding .txt report file
          // Pattern: {timestamp}_{index}_{baseFilename}_report.txt
          const reportFilePath = `${folderPath}/processed/`;
          
          // List files in the processed folder to find the matching report
          const { data: files, error: listError } = await supabase.storage
            .from('processed_images')
            .list(reportFilePath);
          
          if (listError || !files) {
            console.warn(`Could not list files in ${reportFilePath}:`, listError);
            return null;
          }
          
          // Find the .txt file that contains the base filename
          const reportFile = files.find(file => 
            file.name.endsWith('_report.txt') && 
            file.name.includes(baseFilename)
          );
          
          if (!reportFile) {
            console.warn(`No report file found for ${baseFilename}`);
            return null;
          }
          
          // Download the .txt file content
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('processed_images')
            .download(`${reportFilePath}${reportFile.name}`);
          
          if (downloadError || !fileData) {
            console.warn(`Could not download ${reportFile.name}:`, downloadError);
            return null;
          }
          
          const reportContent = await fileData.text();
          
          return {
            filename: image.original_filename,
            content: reportContent,
            index: index + 1
          };
        } catch (error) {
          console.warn(`Error processing report for ${image.original_filename}:`, error);
          return null;
        }
      });
      
      const reports = await Promise.all(reportPromises);
      const validReports = reports.filter(report => report !== null);
      
      if (validReports.length > 0) {
        analysisReportsHtml = `
          <!-- Analysis Reports Section -->
          <div style="background: white; border-radius: 8px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #475569; font-size: 18px;">📊 AI Analysis Reports</h3>
            <p style="color: #64748b; margin-bottom: 20px;">Detailed analysis for each processed image:</p>
            
            ${validReports.map(report => `
              <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 16px; background: #f8fafc;">
                <h4 style="margin-top: 0; margin-bottom: 12px; color: #334155; font-size: 14px; font-weight: 600;">
                  ${report.index}. ${report.filename}
                </h4>
                <div style="background: white; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 12px; line-height: 1.4; color: #475569; max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0;">
                  ${report.content.replace(/\n/g, '<br>').substring(0, 1000)}${report.content.length > 1000 ? '...<br><em>[Content truncated for email]</em>' : ''}
                </div>
              </div>
            `).join('')}
            
            ${validReports.length < processedImages.length ? `
              <p style="color: #64748b; font-size: 12px; font-style: italic;">
                Note: Showing ${validReports.length} of ${processedImages.length} analysis reports. 
                Download your files to view all reports.
              </p>
            ` : ''}
          </div>
        `;
      }
    }

    const emailResponse = await resend.emails.send({
      from: "ORBIT <noreply@resend.dev>",
      to: [userEmail],
      subject: `🚀 Your ORBIT order is ready! - ${orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your ORBIT Order is Complete</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px; padding: 30px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 12px; margin-bottom: 16px;">
              <span style="font-size: 28px; font-weight: bold;">O</span>
            </div>
            <h1 style="margin: 0; font-size: 32px; font-weight: bold;">ORBIT</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">AI-Powered Image Processing</p>
          </div>

          <!-- Main Content -->
          <div style="background: #f8fafc; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
            <h2 style="color: #1e293b; margin-top: 0; font-size: 24px;">
              ${status === 'completed_with_errors' && errorCount > 0 ? '⚠️ Your order is partially complete!' : '🎉 Your order is complete!'}
            </h2>
            
            ${userName ? `<p style="font-size: 16px; margin-bottom: 24px;">Hi ${userName},</p>` : ''}
            
            <p style="font-size: 16px; margin-bottom: 24px;">
              ${status === 'completed_with_errors' && errorCount > 0 ? 
                `Your ORBIT image processing order has been completed with some issues. 
                ${imageCount} of ${imageCount + errorCount} ${imageCount + errorCount === 1 ? 'image was' : 'images were'} successfully processed, while ${errorCount} ${errorCount === 1 ? 'image' : 'images'} encountered processing errors.` :
                `Great news! Your ORBIT image processing order has been completed successfully. 
                Your ${imageCount} ${imageCount === 1 ? 'image has' : 'images have'} been processed and enhanced using our advanced AI technology.`}
            </p>

            <!-- Order Details -->
            <div style="background: white; border-radius: 8px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
              <h3 style="margin-top: 0; color: #475569; font-size: 18px;">Order Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Order Number:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${orderNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Batch Name:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${batchName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Images Processed:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${imageCount}</td>
                </tr>
                ${errorCount > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #dc2626; font-weight: 500;">Processing Errors:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${errorCount}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Total Cost:</td>
                  <td style="padding: 8px 0; font-weight: 600;">$${totalCost}</td>
                </tr>
              </table>
            </div>

            ${analysisReportsHtml}

            <!-- Secure Token Access -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${downloadUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                🚀 View & Download Results
              </a>
              <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 12px; margin-top: 16px;">
                <p style="color: #0369a1; font-size: 12px; margin: 0; font-weight: 500;">
                  🔐 Secure Access: This link provides direct access to your order results without requiring login. 
                  It expires in 7 days and can be used up to 10 times for downloads.
                </p>
              </div>
            </div>

            <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <h4 style="margin-top: 0; color: #475569; font-size: 16px;">✨ What we've enhanced:</h4>
              <ul style="margin: 12px 0; padding-left: 20px; color: #64748b;">
                <li>Background removal and enhancement</li>
                <li>AI-powered image optimization</li>
                <li>Professional quality improvements</li>
                <li>Consistent formatting and sizing</li>
              </ul>
            </div>
            
            ${accessToken ? `
            <!-- Security Notice -->
            <div style="background: #e0f2fe; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #0ea5e9;">
              <h4 style="margin-top: 0; color: #0c4a6e; font-size: 14px;">🔒 Secure Access</h4>
              <p style="margin: 8px 0 0 0; color: #075985; font-size: 12px;">
                This link provides secure access to your order results for 7 days. 
                You can download your files up to 10 times without creating an account.
              </p>
            </div>
            ` : ''}
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
            <p style="margin: 8px 0;">Need help? Contact our support team</p>
            <p style="margin: 8px 0;">
              <a href="${Deno.env.get('FRONTEND_URL') || 'https://ufdcvxmizlzlnyyqpfck.supabase.co'}" 
                 style="color: #667eea; text-decoration: none;">Visit ORBIT</a>
            </p>
            <p style="margin: 16px 0 0 0; font-size: 12px; color: #94a3b8;">
              This email was sent regarding your ORBIT order ${orderNumber}. 
              If you didn't place this order, please contact support.
            </p>
          </div>

        </body>
        </html>
      `,
    });

    console.log("Order completion email sent successfully:", emailResponse);
    console.log("✅ Email includes secure access token:", !!accessToken);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      accessToken: accessToken,
      hasToken: !!accessToken,
      message: "Order completion email sent successfully with secure access link" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-order-completion-email function:", error);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("RESEND_API_KEY exists:", !!Deno.env.get("RESEND_API_KEY"));
    console.error("SUPABASE_URL exists:", !!Deno.env.get("SUPABASE_URL"));
    console.error("SUPABASE_SERVICE_ROLE_KEY exists:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        errorName: error.name,
        errorStack: error.stack,
        success: false,
        envCheck: {
          hasResendKey: !!Deno.env.get("RESEND_API_KEY"),
          hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
          hasServiceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);