// Test the price API route directly
const fetch = require('node-fetch');

async function testPriceRoute() {
  console.log('Testing price API route...');
  
  try {
    const params = new URLSearchParams({
      token: 'mnt',
      fiat_amount: '10000',
      fiat_currency: 'NGN',
      network: 'sepolia',
      chain: 'mantle'
    });

    const response = await fetch(`http://localhost:3000/api/price?${params}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Price API Response:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.log('❌ API Error:', response.status, error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testPriceRoute();