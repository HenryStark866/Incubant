import crypto from 'crypto';

let key = process.env.GOOGLE_PRIVATE_KEY;
if (!key) throw new Error("No GOOGLE_PRIVATE_KEY set");

if (key.includes('\\n')) {
  key = key.replace(/\\n/g, '\n');
}
key = key.replace(/\r/g, ''); 
key = key.replace(/^["']|["']$/g, '').trim();

let header = "-----BEGIN PRIVATE KEY-----";
let footer = "-----END PRIVATE KEY-----";

// Extract interior base64, remove all spaces/newlines
let contentMatch = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
if (!contentMatch) throw new Error("No delimiters found");

let content = contentMatch[1].replace(/\s+/g, '');

let finalKey = header + '\n' + (content.match(/.{1,64}/g) || []).join('\n') + '\n' + footer;

try {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update('hello');
  sign.sign(finalKey);
  console.log("✅ PERFECT: reformatted key signed successfully.");
  console.log(finalKey.substring(0, 50));
} catch (e) {
  console.error("❌ FAILED:", e.message);
}
