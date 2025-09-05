// Simple test script to check WhatsApp connection
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testConnection() {
  console.log('Testing WhatsApp Host API Connection...\n');
  
  try {
    // Test health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('Health check:', healthResponse.data);
    
    // Wait a moment for connection to initialize
    console.log('\n2. Waiting 3 seconds for connection to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test QR code endpoint
    console.log('3. Testing QR code endpoint...');
    try {
      const qrResponse = await axios.get(`${BASE_URL}/api/qr-code`, {
        responseType: 'arraybuffer'
      });
      console.log('QR Code available! Status:', qrResponse.status);
      console.log('Content-Type:', qrResponse.headers['content-type']);
    } catch (qrError) {
      if (qrError.response?.status === 404) {
        console.log('QR Code not available yet (404). This is normal if already connected.');
      } else {
        console.error('QR Code endpoint error:', qrError.response?.data || qrError.message);
      }
    }
    
    // Test reset connection endpoint
    console.log('\n4. Testing reset connection endpoint...');
    try {
      const resetResponse = await axios.post(`${BASE_URL}/api/reset-connection`);
      console.log('Reset connection:', resetResponse.data);
      
      // Wait and check for QR again
      console.log('\n5. Waiting 5 seconds after reset...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('6. Testing QR code endpoint after reset...');
      const qrAfterResetResponse = await axios.get(`${BASE_URL}/api/qr-code`, {
        responseType: 'arraybuffer'
      });
      console.log('QR Code available after reset! Status:', qrAfterResetResponse.status);
    } catch (resetError) {
      if (resetError.response?.status === 404) {
        console.log('QR Code still not available after reset. Check server logs.');
      } else {
        console.error('Reset/QR test error:', resetError.response?.data || resetError.message);
      }
    }
    
  } catch (error) {
    console.error('Connection test failed:', error.message);
    console.error('Make sure the server is running on port 3000');
  }
}

// Run the test
testConnection();