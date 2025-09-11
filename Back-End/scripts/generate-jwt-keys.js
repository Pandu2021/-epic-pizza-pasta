// Generate RSA key pair for JWT (RS256)
// Usage: node scripts/generate-jwt-keys.js
const { generateKeyPairSync } = require('node:crypto');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const esc = (s) => s.replace(/\r?\n/g, '\\n');
const out = {
  JWT_PRIVATE_KEY: esc(privateKey),
  JWT_PUBLIC_KEY: esc(publicKey),
};

console.log(JSON.stringify(out, null, 2));
