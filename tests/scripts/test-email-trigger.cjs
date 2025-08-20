#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
const loadEnvFile = () => {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  if (fs.existsSync(envPath)) {
    console.log('📁 Loading environment variables from .env file...');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value && !line.startsWith('#')) {
        process.env[key] = value;
      }
    });
  } else if (fs.existsSync(envExamplePath)) {
    console.log('⚠️  .env file not found, but .env.example exists');
    console.log('💡 Copy .env.example to .env and fill in your actual values:');
    console.log('   cp .env.example .env');
    console.log('');
  }
};

// Load environment
loadEnvFile();

// Configuration
const SUPABASE_URL = 'https://ufdcvxmizlzlnyyqpfck.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-order-completion-email`;

// Enhanced authentication configuration - support both new and legacy key formats
const getAuthToken = () => {
  // Prefer new secret key format
  const newSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (newSecretKey && newSecretKey.startsWith('sb_secret_')) {
    console.log('🔐 Using new Supabase secret key format');
    return newSecretKey;
  }
  
  // Fall back to legacy service role key
  const legacyServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (legacyServiceKey && legacyServiceKey !== 'your_service_role_key_here') {
    console.log('🔐 Using legacy Supabase service role key (consider upgrading to new format)');
    return legacyServiceKey;
  }
  
  return null;
};

const SERVICE_ROLE_KEY = getAuthToken();

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: No valid Supabase authentication key found');
  console.error('');
  console.error('📝 Set authentication key using one of these methods:');
  console.error('   NEW FORMAT (preferred):');
  console.error('     1. Add to .env file: SUPABASE_SECRET_KEY=sb_secret_your_key_here');
  console.error('     2. Export directly: export SUPABASE_SECRET_KEY=sb_secret_your_key_here');
  console.error('   LEGACY FORMAT (backward compatibility):');
  console.error('     1. Add to .env file: SUPABASE_SERVICE_ROLE_KEY=your_legacy_key_here');
  console.error('     2. Export directly: export SUPABASE_SERVICE_ROLE_KEY=your_legacy_key_here');
  console.error('');
  process.exit(1);
}

const orderId = process.argv[2] || '620f0e46-d0ed-4eac-a14e-21f09e681f02';

console.log(`🚀 Triggering email for order: ${orderId}`);
console.log(`📍 Function URL: ${FUNCTION_URL}`);

const postData = JSON.stringify({
  orderId: orderId
});

const options = {
  hostname: 'ufdcvxmizlzlnyyqpfck.supabase.co',
  port: 443,
  path: '/functions/v1/send-order-completion-email',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  console.log(`📊 Response Status: ${res.statusCode}`);
  console.log(`📋 Response Headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📧 Email Function Response:');
    console.log('─'.repeat(50));
    try {
      const parsedData = JSON.parse(data);
      console.log(JSON.stringify(parsedData, null, 2));
      
      if (parsedData.success) {
        console.log('✅ Email sent successfully!');
        console.log(`📧 Email ID: ${parsedData.emailId}`);
        console.log(`📬 Recipient: ${parsedData.recipientEmail}`);
        console.log(`🔗 Secure Link: ${parsedData.secureLink}`);
      } else {
        console.log('❌ Email sending failed!');
        console.log(`❌ Error: ${parsedData.error}`);
      }
    } catch (e) {
      console.log('Raw response (not JSON):');
      console.log(data);
    }
    console.log('─'.repeat(50));
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

// Send the request
req.write(postData);
req.end();

console.log('⏳ Request sent, waiting for response...');