import WebSocket from 'ws';

console.log('Testing Rysk WebSocket with JSON-RPC 2.0...');

const ws = new WebSocket('wss://v12.rysk.finance/taker', {
  headers: {
    'Origin': 'https://app.rysk.finance',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
  }
});

let messageId = 1;

function sendRPCMessage(method, params = {}) {
  const message = {
    jsonrpc: "2.0",
    id: messageId++,
    method: method,
    params: params
  };
  
  console.log(`Sending: ${JSON.stringify(message)}`);
  ws.send(JSON.stringify(message));
}

ws.on('open', function open() {
  console.log('✅ Connected to Rysk WebSocket!');
  
  // Try common RPC methods that might exist
  const testMethods = [
    'getStrikes',
    'getQuotes', 
    'getMarkets',
    'getAssets',
    'getPrices',
    'getOptions',
    'subscribe',
    'getVaults',
    'getTakerQuotes',
    'getOrderbook',
    'ping',
    'help',
    'methods'
  ];
  
  testMethods.forEach((method, index) => {
    setTimeout(() => {
      sendRPCMessage(method);
    }, index * 1000);
  });
  
  // Also try with some parameters
  setTimeout(() => {
    sendRPCMessage('getStrikes', { asset: 'WHYPE' });
  }, testMethods.length * 1000);
  
  setTimeout(() => {
    sendRPCMessage('getQuotes', { assets: ['WHYPE', 'kHYPE'] });
  }, (testMethods.length + 1) * 1000);
});

ws.on('message', function message(data) {
  console.log('📨 Received:');
  try {
    const parsed = JSON.parse(data);
    console.log(JSON.stringify(parsed, null, 2));
    
    // If we get a successful response, log it specially
    if (!parsed.error) {
      console.log('🎉 SUCCESS! Method worked:', parsed);
    }
  } catch (e) {
    console.log('Raw message:', data.toString());
  }
  console.log('---');
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log(`🔌 Connection closed: ${code} - ${reason}`);
});

// Keep running for 45 seconds
setTimeout(() => {
  console.log('Closing connection...');
  ws.close();
  process.exit(0);
}, 45000);
