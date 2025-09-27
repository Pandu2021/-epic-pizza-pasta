#!/usr/bin/env node
// Simple manual test for keepalive ping.
// Uses a local http server to assert ping() returns 200.
import http from 'http';
import assert from 'assert';
import { ping } from './keepalive.mjs';

async function run(){
  const server = http.createServer((req,res)=>{
    if (req.url === '/health') {
      res.writeHead(200, {'Content-Type':'text/plain'});
      res.end('OK');
    } else if (req.url === '/api/menu') {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end('[{"id":1}]');
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise(r=>server.listen(0,r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/health`;
  const { status, ok } = await ping(url);
  try {
    assert.strictEqual(status, 200, 'Expected 200 status');
    assert.strictEqual(ok, true, 'Expected ok=true');
    const menuUrl = `http://127.0.0.1:${port}/api/menu`;
    const r2 = await ping(menuUrl);
    assert.strictEqual(r2.status, 200, 'Expected 200 status for menu');
    assert.strictEqual(r2.ok, true, 'Expected ok=true for menu');
    console.log('Test passed: keepalive ping received 200 OK for both endpoints');
  } finally {
    server.close();
  }
}

run().catch(e=>{console.error('Test failed', e); process.exit(1);});
