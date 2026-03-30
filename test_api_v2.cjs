const fs = require('fs');
const path = require('path');
const http = require('https');

const loginData = JSON.stringify({
  id: 'admin',
  pin: '4753'
});

const loginOptions = {
  hostname: 'incubant.onrender.com',
  port: 443,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

const loginReq = http.request(loginOptions, (res) => {
  let cookie = res.headers['set-cookie'];
  console.log('Login status:', res.statusCode);
  
  if (res.statusCode !== 200) {
    console.error('Login failed');
    return;
  }

  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Provide image path');
    return;
  }

  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const filename = path.basename(imagePath);
  const fileContent = fs.readFileSync(imagePath);

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="machineId"\r\n\r\n`;
  body += `inc-01\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="evidence"; filename="${filename}"\r\n`;
  body += `Content-Type: image/png\r\n\r\n`;

  const footer = `\r\n--${boundary}--\r\n`;
  const totalLength = Buffer.byteLength(body) + fileContent.length + Buffer.byteLength(footer);

  const uploadOptions = {
    hostname: 'incubant.onrender.com',
    port: 443,
    path: '/api/reports',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': totalLength
    }
  };

  const uploadReq = http.request(uploadOptions, (uploadRes) => {
    let responseData = '';
    uploadRes.on('data', (chunk) => responseData += chunk);
    uploadRes.on('end', () => {
      console.log('Upload Status:', uploadRes.statusCode);
      console.log('Response:', responseData);
    });
  });

  uploadReq.write(body);
  uploadReq.write(fileContent);
  uploadReq.write(footer);
  uploadReq.end();
});

loginReq.write(loginData);
loginReq.end();
