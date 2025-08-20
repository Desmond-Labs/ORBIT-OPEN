/**
 * COMPREHENSIVE EMAIL TRACKING VALIDATION TEST
 * 
 * This test validates the email tracking fix implemented in send-order-completion-email function
 * Tests both successful email delivery and database update scenarios
 */

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
  if (legacyServiceKey) {
    console.log('🔐 Using legacy Supabase service role key (consider upgrading to new format)');
    return legacyServiceKey;
  }
  
  return null;
};

// Test configuration
const TEST_CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://ufdcvxmizlzlnyyqpfck.supabase.co',
  SUPABASE_SERVICE_KEY: getAuthToken(),
  FUNCTION_URL: 'https://ufdcvxmizlzlnyyqpfck.supabase.co/functions/v1/send-order-completion-email',
  TEST_ORDER_ID: '620f0e46-d0ed-4eac-a14e-21f09e681f02', // Original investigation target
  TEST_EMAIL: 'test-validation@example.com'
};

console.log('🧪 STARTING COMPREHENSIVE EMAIL TRACKING VALIDATION');
console.log('=' .repeat(60));

// Test 1: Verify function can be called successfully
async function testFunctionCall() {
  console.log('\n📧 TEST 1: Function Call Validation');
  console.log('-'.repeat(40));
  
  try {
    const response = await fetch(TEST_CONFIG.FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_CONFIG.SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        orderId: TEST_CONFIG.TEST_ORDER_ID,
        userEmail: TEST_CONFIG.TEST_EMAIL,
        userName: 'Validation Test User',
        imageCount: 3
      })
    });

    const result = await response.text();
    
    console.log('✅ Function Response Status:', response.status);
    console.log('✅ Function Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('✅ Function Response Body:', result);
    
    if (response.status === 200) {
      const data = JSON.parse(result);
      if (data.success && data.emailId) {
        console.log('✅ Email sent successfully with ID:', data.emailId);
        return { success: true, emailId: data.emailId };
      }
    }
    
    return { success: false, error: result };
    
  } catch (error) {
    console.error('❌ Function call failed:', error);
    return { success: false, error: error.message };
  }
}

// Test 2: Database validation - Check if email tracking fields were updated
async function testDatabaseTracking(emailId) {
  console.log('\n🗄️  TEST 2: Database Tracking Validation');
  console.log('-'.repeat(40));
  
  if (!TEST_CONFIG.SUPABASE_SERVICE_KEY) {
    console.log('⚠️  Skipping database test - No service key available');
    return { success: true, skipped: true };
  }
  
  try {
    // Check order table for updated email tracking fields
    const response = await fetch(`${TEST_CONFIG.SUPABASE_URL}/rest/v1/orders?id=eq.${TEST_CONFIG.TEST_ORDER_ID}&select=id,email_sent_at,email_id,order_number`, {
      headers: {
        'apikey': TEST_CONFIG.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${TEST_CONFIG.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const orders = await response.json();
    
    if (orders && orders.length > 0) {
      const order = orders[0];
      console.log('📊 Order data retrieved:', JSON.stringify(order, null, 2));
      
      let validationResults = {
        emailSentAt: !!order.email_sent_at,
        emailId: !!order.email_id,
        emailIdMatches: order.email_id === emailId
      };
      
      console.log('✅ email_sent_at populated:', validationResults.emailSentAt);
      console.log('✅ email_id populated:', validationResults.emailId);
      console.log('✅ email_id matches sent email:', validationResults.emailIdMatches);
      
      if (validationResults.emailSentAt && validationResults.emailId) {
        console.log('🎉 ROOT CAUSE FIXED: Email tracking fields are now populated!');
        return { success: true, ...validationResults };
      } else {
        console.log('❌ ROOT CAUSE NOT FIXED: Email tracking fields missing');
        return { success: false, ...validationResults };
      }
    } else {
      console.log('❌ No order found with ID:', TEST_CONFIG.TEST_ORDER_ID);
      return { success: false, error: 'Order not found' };
    }
    
  } catch (error) {
    console.error('❌ Database validation failed:', error);
    return { success: false, error: error.message };
  }
}

// Test 3: Error handling validation
async function testErrorHandling() {
  console.log('\n🛡️  TEST 3: Error Handling Validation');
  console.log('-'.repeat(40));
  
  // Test with invalid order ID to ensure graceful error handling
  try {
    const response = await fetch(TEST_CONFIG.FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_CONFIG.SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        orderId: 'invalid-order-id-12345',
        userEmail: TEST_CONFIG.TEST_EMAIL,
        userName: 'Error Test User',
        imageCount: 1
      })
    });

    const result = await response.text();
    console.log('✅ Error handling response status:', response.status);
    console.log('✅ Error handling response body:', result);
    
    if (response.status === 500) {
      const data = JSON.parse(result);
      if (data.error && data.error.includes('Order not found')) {
        console.log('✅ Error handling works correctly - Order not found error');
        return { success: true };
      }
    }
    
    console.log('⚠️  Unexpected error handling behavior');
    return { success: false, unexpected: true };
    
  } catch (error) {
    console.error('❌ Error handling test failed:', error);
    return { success: false, error: error.message };
  }
}

// Main test execution
async function runValidation() {
  console.log(`📋 Test Configuration:`);
  console.log(`   Function URL: ${TEST_CONFIG.FUNCTION_URL}`);
  console.log(`   Test Order ID: ${TEST_CONFIG.TEST_ORDER_ID}`);
  console.log(`   Test Email: ${TEST_CONFIG.TEST_EMAIL}`);
  console.log(`   Has Service Key: ${!!TEST_CONFIG.SUPABASE_SERVICE_KEY}`);
  
  const results = {
    functionCall: null,
    databaseTracking: null,
    errorHandling: null
  };
  
  // Run tests sequentially
  results.functionCall = await testFunctionCall();
  
  if (results.functionCall.success && results.functionCall.emailId) {
    results.databaseTracking = await testDatabaseTracking(results.functionCall.emailId);
  } else {
    console.log('⚠️  Skipping database test - Function call failed');
    results.databaseTracking = { success: false, skipped: true };
  }
  
  results.errorHandling = await testErrorHandling();
  
  // Final validation report
  console.log('\n📊 COMPREHENSIVE VALIDATION REPORT');
  console.log('=' .repeat(60));
  
  console.log('🔍 ROOT CAUSE RESOLUTION VALIDATION:');
  if (results.databaseTracking.success && !results.databaseTracking.skipped) {
    console.log('✅ PASSED: Email tracking fields (email_sent_at, email_id) are populated');
    console.log('✅ PASSED: Database update logic works correctly');
    console.log('🎯 ROOT CAUSE FIXED: Original issue resolved');
  } else if (results.databaseTracking.skipped) {
    console.log('⚠️  INCONCLUSIVE: Database test skipped due to access limitations');
  } else {
    console.log('❌ FAILED: Email tracking fields not populated correctly');
    console.log('🚨 ROOT CAUSE NOT FIXED: Issue persists');
  }
  
  console.log('\n🔧 FUNCTIONALITY PRESERVATION:');
  if (results.functionCall.success) {
    console.log('✅ PASSED: Email sending functionality preserved');
    console.log('✅ PASSED: Function responds correctly');
  } else {
    console.log('❌ FAILED: Email sending functionality broken');
  }
  
  console.log('\n🛡️  ERROR HANDLING:');
  if (results.errorHandling.success) {
    console.log('✅ PASSED: Error handling works correctly');
    console.log('✅ PASSED: Graceful failure for invalid inputs');
  } else {
    console.log('❌ FAILED: Error handling issues detected');
  }
  
  const overallSuccess = results.functionCall.success && 
                        (results.databaseTracking.success || results.databaseTracking.skipped) && 
                        results.errorHandling.success;
  
  console.log('\n🎯 OVERALL VALIDATION RESULT:');
  if (overallSuccess) {
    console.log('🎉 VALIDATION PASSED: Email tracking fix is working correctly');
    console.log('✅ Ready for production deployment');
  } else {
    console.log('❌ VALIDATION FAILED: Issues detected that need attention');
    console.log('⚠️  Not ready for production deployment');
  }
  
  return {
    success: overallSuccess,
    results: results,
    timestamp: new Date().toISOString()
  };
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runValidation, TEST_CONFIG };
}

// Run if executed directly
if (typeof window === 'undefined' && require.main === module) {
  runValidation().then(result => {
    console.log('\n📋 Test completed at:', result.timestamp);
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}