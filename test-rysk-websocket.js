import WebSocket from 'ws';

console.log('Testing Rysk WebSocket connection...');

// Create WebSocket connection to Rysk taker endpoint
const ws = new WebSocket('wss://v12.rysk.finance/taker', {
  headers: {
    'Origin': 'https://app.rysk.finance',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
  }
});

ws.on('open', function open() {
  console.log('✅ Connected to Rysk WebSocket!');
  
  // Try sending some common WebSocket messages to see what the API expects
  const testMessages = [
    '{"type":"subscribe","channel":"strikes"}',
    '{"type":"subscribe","channel":"quotes"}',
    '{"type":"subscribe","channel":"markets"}',
    '{"action":"subscribe","data":"all"}',
    '{"method":"getStrikes"}',
    'ping'
  ];
  
  testMessages.forEach((msg, index) => {
    setTimeout(() => {
      console.log(`Sending test message ${index + 1}: ${msg}`);
      ws.send(msg);
    }, index * 1000);
  });
});

ws.on('message', function message(data) {
  console.log('📨 Received message:');
  try {
    const parsed = JSON.parse(data);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('Raw message:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log(`🔌 Connection closed: ${code} - ${reason}`);
});

// Keep the script running for 30 seconds to capture messages
setTimeout(() => {
  console.log('Closing connection...');
  ws.close();
  process.exit(0);
}, 30000);
