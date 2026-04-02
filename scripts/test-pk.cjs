const crypto = require('crypto');
let key = process.env.GOOGLE_PRIVATE_KEY;
if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
key = key.replace(/\r/g, '').replace(/^["']|["']$/g, '').trim();

let contentMatch = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
let content = contentMatch[1].replace(/\s+/g, '');
let finalKey = "-----BEGIN PRIVATE KEY-----\n" + (content.match(/.{1,64}/g) || []).join('\n') + "\n-----END PRIVATE KEY-----\n";

try {
  let pk = crypto.createPrivateKey(finalKey);
  console.log("Success! Key type:", pk.type);
} catch (e) {
  console.log("Reformatted failed:", e.message);
  
  try {
     let pk2 = crypto.createPrivateKey(process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'));
     console.log("Original parsed failed?", e.message);
  } catch (e2) {
     console.log("Original also failed:", e2.message);
  }
}
