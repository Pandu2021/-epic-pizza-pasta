// Robust start script for Render: migrate, seed, ensure build, then start server
// This avoids crashes when dist/main.js is missing due to any build artifact mismatch.

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function findEntry() {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'main.js'),
    path.join(__dirname, '..', 'dist', 'src', 'main.js'),
  ];
  return candidates.find(p => existsSync(p));
}

try {
  // 1) Apply migrations
  run('npm run prisma:deploy');

  // 2) Seed if enabled (default true unless explicitly set to 'false')
  if (process.env.SEED_ON_START !== 'false') {
    run('npm run seed:menu');
  } else {
    console.log('Skipping seed (SEED_ON_START=false)');
  }

  // 3) Ensure we have a compiled build
  let entry = findEntry();
  if (!entry) {
    console.warn('Compiled entry not found. Building project...');
    run('npm run build');
    entry = findEntry();
  }

  if (!entry) {
    throw new Error('Unable to locate compiled entry after build (looked for dist/main.js and dist/src/main.js).');
  }

  // 4) Start the server
  console.log(`Starting server: node ${path.relative(process.cwd(), entry)}`);
  run(`node ${JSON.stringify(entry)}`);
} catch (err) {
  console.error('Start failed:', err && err.stack || err);
  process.exit(1);
}
