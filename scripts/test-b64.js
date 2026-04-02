let key = process.env.GOOGLE_PRIVATE_KEY;
let contentMatch = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
let content = contentMatch[1].replace(/\s+/g, '');
console.log("Base64 string length:", content.length);
try {
  let buf = Buffer.from(content, 'base64');
  console.log("Decoded size:", buf.length);
  // ASN.1 PKCS#8 check
  console.log("Hex start:", buf.toString('hex', 0, 16));
} catch(e) {
  console.error("Decode fail", e);
}
