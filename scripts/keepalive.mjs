#!/usr/bin/env node
/**
 * Lightweight keep-alive ping for Render free tier.
 * This is a TEMPORARY workaround to reduce cold starts by hitting a cheap public endpoint
 * (e.g. /health or /) every ~14 minutes. Respect fair-use: do NOT lower the interval further
 * or add heavy traffic. Prefer upgrading the service or using Render's native features
 * when feasible. Remove this once on a paid plan or when not needed.
 */
import https from 'https';
import http from 'http';
import { URL } from 'url';

const DEFAULT_INTERVAL_MINUTES = 14;

/**
 * Perform a single GET request to the supplied url.
 * @param {string} urlStr - Full URL including protocol.
 * @returns {Promise<{status:number, ok:boolean}>}
 */
export function ping(urlStr) {
  return new Promise((resolve, reject) => {
    if (!/^https?:\/\//i.test(urlStr)) {
      return reject(new Error('KEEPALIVE_URL must start with http:// or https://'));
    }
    const urlObj = new URL(urlStr);
    const opts = {
      method: 'GET',
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      protocol: urlObj.protocol,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      timeout: 8000,
      headers: {
        'User-Agent': 'keepalive-script/1.0 (+github-actions)'
      }
    };

  const mod = urlObj.protocol === 'https:' ? https : http;
  const req = mod.request(opts, res => {
      // Drain data to allow socket reuse
      res.on('data', () => {});
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, ok: (res.statusCode || 500) < 500 });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
    req.end();
  });
}

function minutes(n){return n*60*1000;}

async function main(){
  // Collect args excluding node + script
  const rawArgs = process.argv.slice(2);
  const once = rawArgs.includes('--once');
  const cleaned = rawArgs.filter(a=>!a.startsWith('--'));
  const positional = cleaned.filter(a => /^(https?:)/i.test(a));
  const url = process.env.KEEPALIVE_URL || positional[0];
  if (!url) {
    console.error('Usage: KEEPALIVE_URL="https://your-app.onrender.com/health" node scripts/keepalive.mjs [--once] [https://override]');
    process.exit(1);
  }
  const intervalMinutes = Number(process.env.KEEPALIVE_INTERVAL_MINUTES) || DEFAULT_INTERVAL_MINUTES;

  const doPing = async () => {
    const start = Date.now();
    try {
      const { status, ok } = await ping(url);
      console.log(new Date().toISOString(), 'PING', url, status, ok ? 'OK' : 'NOT OK', (Date.now()-start)+'ms');
    } catch (e) {
      console.error(new Date().toISOString(), 'PING_ERROR', e.message);
    }
  };

  await doPing();
  if (once) return;
  setInterval(doPing, minutes(intervalMinutes));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-floating-promises
  main();
}
