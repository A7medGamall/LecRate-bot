import https from 'https';

const data = JSON.stringify({
  update_id: 1234567,
  message: {
    message_id: 1,
    from: { id: 111, is_bot: false, first_name: "Mock" },
    chat: { id: 111, type: "private" },
    date: Math.floor(Date.now() / 1000),
    text: "/start"
  }
});

const options = {
  hostname: 'lecrate-bot.netlify.app',
  port: 443,
  path: '/.netlify/functions/bot',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let responseBody = '';

  res.on('data', d => {
    responseBody += d;
  });

  res.on('end', () => {
    console.log('Response body:', responseBody);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
