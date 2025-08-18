import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { Resend } from "npm:resend@2.0.0";
import { SupabaseAuthManager } from '../_shared/auth-verification.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Helper function to get frontend URL with fallback
const getFrontendUrl = (): string => {
  const envUrl = Deno.env.get('FRONTEND_URL');
  if (envUrl) {
    return envUrl;
  }
  
  // Fallback based on environment
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (supabaseUrl?.includes('localhost') || supabaseUrl?.includes('127.0.0.1')) {
    return 'http://localhost:5173'; // Local development
  }
  
  return 'https://preview--orbit-image-forge.lovable.app'; // Production fallback
};

interface OrderCompletionEmailRequest {
  orderId: string;
  userEmail?: string; // Optional - will fetch from database if not provided
  userName?: string;
  imageCount?: number; // Optional - will fetch from database if not provided
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
    
    const requestBody = await req.json();
    console.log('📧 Raw request body:', JSON.stringify(requestBody, null, 2));
    
    const { orderId, userEmail, userName, imageCount, downloadUrl }: OrderCompletionEmailRequest = requestBody;

    console.log('📧 Parsed parameters:');
    console.log('📧 - Order ID:', orderId);
    console.log('📧 - Email recipient:', userEmail);
    console.log('📧 - User name:', userName);
    console.log('📧 - Image count:', imageCount);
    console.log('📧 - Download URL:', downloadUrl);
    
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

    // Initialize enhanced authentication manager
    const authManager = new SupabaseAuthManager({
      supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
      legacyServiceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      newSecretKey: Deno.env.get('SUPABASE_SECRET_KEY'),
      allowLegacy: true // Enable backward compatibility during migration
    });
    
    // Create Supabase client using enhanced authentication
    const supabase = authManager.getSupabaseClient(true);

    // Get order details from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    // Get user email separately
    const { data: userProfile, error: userError } = await supabase
      .from('orbit_users')
      .select('email')
      .eq('id', order.user_id)
      .single();

    if (userError || !userProfile?.email) {
      throw new Error(`User email not found: ${userError?.message}`);
    }
    
    // Generate access token for secure download link
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_order_access_token', {
        order_id_param: orderId,
        expires_in_hours: 168 // 7 days
      });

    if (tokenError) {
      throw new Error(`Failed to generate access token: ${tokenError.message}`);
    }

    const accessToken = tokenData && tokenData[0] ? tokenData[0].token : null;
    if (!accessToken) {
      throw new Error('Failed to extract access token from function result');
    }

    // Use provided userEmail or fetch from database
    const finalUserEmail = userEmail || userProfile.email;
    const finalUserName = userName; // No name field in orbit_users table
    const finalImageCount = imageCount || order.image_count || 0;
    
    // Generate secure download URL with token
    const secureDownloadUrl = downloadUrl || `${getFrontendUrl()}/?token=${accessToken}&order=${orderId}&step=processing`;

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

    // Try to get processed images for analysis reports, but don't fail if this fails
    let analysisReportsHtml = '';
    try {
      console.log('📧 Attempting to fetch processed images for reports...');
      const { data: processedImages, error: imagesError } = await supabase
        .from('images')
        .select('id, original_filename, storage_path_processed, gemini_analysis_raw')
        .eq('order_id', orderId)
        .eq('processing_status', 'complete')
        .limit(3); // Limit to 3 images to avoid email size issues

      if (imagesError) {
        console.warn('📧 Could not fetch processed images:', imagesError);
      } else if (processedImages && processedImages.length > 0) {
        console.log(`📧 Found ${processedImages.length} processed images`);
        
        // Simple report generation - don't fail email if this fails
        try {
          const reportPromises = processedImages.slice(0, 2).map(async (image, index) => {
            // Use gemini_analysis_raw if available, otherwise try to fetch report file
            if (image.gemini_analysis_raw) {
              return {
                filename: image.original_filename,
                content: JSON.stringify(image.gemini_analysis_raw, null, 2).substring(0, 500),
                index: index + 1
              };
            }
            return null;
          });
          
          const reports = await Promise.all(reportPromises);
          const validReports = reports.filter(report => report !== null);
          
          if (validReports.length > 0) {
            analysisReportsHtml = `
              <!-- Analysis Summary Section -->
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="margin-top: 0; color: #475569; font-size: 16px;">📊 Processing Summary</h3>
                <p style="color: #64748b; margin-bottom: 16px;">Your images have been successfully processed with AI analysis.</p>
                <div style="background: #f8fafc; border-radius: 4px; padding: 12px; border: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #475569; font-size: 14px;">
                    ✅ ${finalImageCount} ${finalImageCount === 1 ? 'image' : 'images'} processed<br>
                    🤖 AI analysis completed<br>
                    📁 Files ready for download
                  </p>
                </div>
              </div>
            `;
          }
        } catch (reportError) {
          console.warn('📧 Report generation failed, continuing without reports:', reportError);
        }
      }
    } catch (fetchError) {
      console.warn('📧 Could not fetch image data for reports, continuing without:', fetchError);
    }

    // Validate email parameters before sending
    if (!finalUserEmail || !finalUserEmail.includes('@')) {
      throw new Error(`Invalid email address: ${finalUserEmail}`);
    }
    
    if (!orderNumber) {
      throw new Error('Order number is missing');
    }
    
    console.log('📧 Sending email via Resend...');
    console.log('📧 From: ORBIT <support@update.desmondlabs.com>');
    console.log('📧 To:', finalUserEmail);
    console.log('📧 Subject: 🚀 Your ORBIT order is ready! - ' + orderNumber);
    
    const emailResponse = await resend.emails.send({
      from: "ORBIT <support@update.desmondlabs.com>",
      to: [finalUserEmail],
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
            <h2 style="color: #1e293b; margin-top: 0; font-size: 24px;">🎉 Your order is complete!</h2>
            
            ${finalUserName ? `<p style="font-size: 16px; margin-bottom: 24px;">Hi ${finalUserName},</p>` : ''}
            
            <p style="font-size: 16px; margin-bottom: 24px;">
              Great news! Your ORBIT image processing order has been completed successfully. 
              Your ${finalImageCount} ${finalImageCount === 1 ? 'image has' : 'images have'} been processed and enhanced using our advanced AI technology.
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
                  <td style="padding: 8px 0; font-weight: 600;">${finalImageCount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Total Cost:</td>
                  <td style="padding: 8px 0; font-weight: 600;">$${totalCost}</td>
                </tr>
              </table>
            </div>

            ${analysisReportsHtml}

            <!-- Download Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${secureDownloadUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                📥 Download Your Processed Images
              </a>
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
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
            <p style="margin: 8px 0;">Need help? Contact our support team</p>
            <p style="margin: 8px 0;">
              <a href="${getFrontendUrl()}" 
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

    console.log("📧 Resend API response:", emailResponse);
    
    if (emailResponse.error) {
      console.error("📧 Resend API returned error:", JSON.stringify(emailResponse.error, null, 2));
      console.error("📧 Resend API error type:", typeof emailResponse.error);
      console.error("📧 Resend API error message:", emailResponse.error.message);
      console.error("📧 Resend API error details:", emailResponse.error);
      throw new Error(`Resend API error: ${JSON.stringify(emailResponse.error)}`);
    }
    
    if (!emailResponse.data?.id) {
      console.error("📧 Resend API response missing email ID:", emailResponse);
      throw new Error('Email sent but no ID returned from Resend API');
    }

    console.log("📧 ✅ Order completion email sent successfully! Email ID:", emailResponse.data.id);

    // Update email tracking fields in database
    if (emailResponse.data && emailResponse.data.id) {
      try {
        console.log("📧 Updating email tracking fields for order:", orderId);
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            email_sent_at: new Date().toISOString(),
            email_id: emailResponse.data.id
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('📧 Failed to update email tracking fields:', updateError);
        } else {
          console.log('📧 ✅ Email tracking fields updated successfully');
        }
      } catch (updateError) {
        console.error('📧 Failed to update email tracking fields:', updateError);
        // Don't throw - email was sent successfully
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data.id,
      message: "Order completion email sent successfully",
      orderId: orderId,
      recipient: finalUserEmail
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