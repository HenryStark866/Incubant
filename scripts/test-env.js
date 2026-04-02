console.log("Raw Key:");
console.dir(process.env.GOOGLE_PRIVATE_KEY);

const processed = process.env.GOOGLE_PRIVATE_KEY
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim()
  : undefined;

console.log("Processed:");
console.dir(processed);
