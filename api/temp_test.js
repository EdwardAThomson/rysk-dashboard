const fetch = require('node-fetch');

const testEndpoints = async () => {
  try {
    // Test /api/quotes
    console.log('Testing /api/quotes...');
    const quotesResponse = await fetch('http://localhost:3001/api/quotes');
    const quotes = await quotesResponse.json();
    console.log('Quotes:', quotes);

    // Test /api/theoretical_apr
    console.log('\nTesting /api/theoretical_apr...');
    const aprResponse = await fetch('http://localhost:3001/api/theoretical_apr?s=3500&k=3600&t=0.079&r=0.04&sigma=0.6');
    const apr = await aprResponse.json();
    console.log('Theoretical APR:', apr);

  } catch (error) {
    console.error('Test failed:', error);
  }
};

testEndpoints();
