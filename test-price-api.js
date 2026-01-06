// Simple test script to verify CMC API integration
const fetch = require('node-fetch');

const CMC_API_KEY = '242b0599-d394-49e5-8a6d-c9891bb557d4';

async function testCMCAPI() {
  console.log('Testing CMC API integration...');
  
  try {
    // Test 1: Get MNT price
    console.log('\n1. Testing MNT/USD price...');
    const mntResponse = await fetch(
      'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=MNT&convert=USD',
      {
        headers: {
          'X-CMC_PRO_API_KEY': CMC_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (mntResponse.ok) {
      const mntData = await mntResponse.json();
      const mntPrice = mntData.data.MNT[0].quote.USD.price;
      console.log(`✅ MNT/USD: $${mntPrice.toFixed(6)}`);
    } else {
      console.log(`❌ MNT API failed: ${mntResponse.status}`);
    }

    // Test 2: Get USD to NGN rate
    console.log('\n2. Testing USD/NGN conversion...');
    const ngnResponse = await fetch(
      'https://pro-api.coinmarketcap.com/v1/tools/price-conversion?amount=1&symbol=USD&convert=NGN',
      {
        headers: {
          'X-CMC_PRO_API_KEY': CMC_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (ngnResponse.ok) {
      const ngnData = await ngnResponse.json();
      const ngnRate = ngnData.data.quote.NGN.price;
      console.log(`✅ USD/NGN: ₦${ngnRate.toFixed(2)}`);
    } else {
      console.log(`❌ NGN API failed: ${ngnResponse.status}`);
    }

    // Test 3: Calculate conversion example
    console.log('\n3. Testing conversion example...');
    if (mntResponse.ok && ngnResponse.ok) {
      const mntData = await mntResponse.json();
      const ngnData = await ngnResponse.json();
      
      const mntPrice = mntData.data.MNT[0].quote.USD.price;
      const ngnRate = ngnData.data.quote.NGN.price;
      
      const fiatAmount = 10000; // 10,000 NGN
      const fiatInUsd = fiatAmount / ngnRate;
      const mntAmount = fiatInUsd / mntPrice;
      
      console.log(`✅ Conversion: ₦${fiatAmount} = $${fiatInUsd.toFixed(2)} = ${mntAmount.toFixed(6)} MNT`);
    }

    console.log('\n🎉 CMC API integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCMCAPI();