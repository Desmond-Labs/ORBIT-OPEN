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
  downloadUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, userEmail, userName, imageCount, downloadUrl }: OrderCompletionEmailRequest = await req.json();

    console.log('Sending order completion email for order:', orderId);

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get order details from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        batches (
          name,
          processing_results
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    const batchName = order.batches?.name || `Order ${order.order_number}`;
    const orderNumber = order.order_number;
    const totalCost = order.total_cost;

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
            <h2 style="color: #1e293b; margin-top: 0; font-size: 24px;">🎉 Your order is complete!</h2>
            
            ${userName ? `<p style="font-size: 16px; margin-bottom: 24px;">Hi ${userName},</p>` : ''}
            
            <p style="font-size: 16px; margin-bottom: 24px;">
              Great news! Your ORBIT image processing order has been completed successfully. 
              Your ${imageCount} ${imageCount === 1 ? 'image has' : 'images have'} been processed and enhanced using our advanced AI technology.
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
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Total Cost:</td>
                  <td style="padding: 8px 0; font-weight: 600;">$${totalCost}</td>
                </tr>
              </table>
            </div>

            ${downloadUrl ? `
            <!-- Download Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${downloadUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                📥 Download Your Processed Images
              </a>
            </div>
            ` : `
            <!-- Login to Download -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${Deno.env.get('FRONTEND_URL') || 'https://ufdcvxmizlzlnyyqpfck.supabase.co'}/processing?order=${orderId}&step=processing" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                🚀 View & Download Results
              </a>
            </div>
            `}

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

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      message: "Order completion email sent successfully" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-order-completion-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);