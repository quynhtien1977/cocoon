// Run after npm run build. The local API fixture verifies proxy behavior without
// a real backend, credentials, JWT secrets or a production auth bypass.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const api = createServer((request, response) => {
  if (request.url !== '/api/v1/me') { response.writeHead(404).end(); return; }
  const token = /(?:^|;\s*)access_token=([^;]+)/.exec(request.headers.cookie ?? '')?.[1];
  response.setHeader('Content-Type', 'application/json');
  if (token === 'unavailable') { response.writeHead(501).end('{}'); return; }
  if (!['Customer', 'Staff', 'Manager', 'Admin'].includes(token)) { response.writeHead(401).end('{}'); return; }
  response.end(JSON.stringify({ role: token }));
});
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3197', '--hostname', '127.0.0.1'], {
  windowsHide: true, stdio: 'ignore', env: { ...process.env, API_URL: `http://127.0.0.1:${api.address().port}` },
});
const origin = 'http://127.0.0.1:3197';
async function get(path, token) {
  return fetch(origin + path, { redirect: 'manual', headers: token ? { cookie: `access_token=${token}` } : {}, signal: AbortSignal.timeout(15000) });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await get('/'); await response.text(); if (response.ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(ready, 'Next server starts');
  const portals = [['/account', '/account/orders', 'Customer'], ['/staff', '/staff/feedback', 'Staff'], ['/manager', '/manager/customers', 'Manager'], ['/admin', '/admin/activity', 'Admin']];
  for (const [root, child, allowedRole] of portals) {
    for (const token of [undefined, 'invalid', 'unavailable', 'Customer', 'Staff', 'Manager', 'Admin']) {
      for (const path of [root, child]) {
        const response = await get(path + '?preview=1', token);
        await response.text();
        if (token === allowedRole && path === '/staff') {
          assert.equal(response.status, 307);
          assert.equal(new URL(response.headers.get('location'), origin).pathname, '/staff/feedback', 'Staff home preserves its existing section redirect');
        } else if (token === allowedRole) assert.equal(response.status, 200, `${path} allows ${token}`);
        else {
          assert.equal(response.status, 307, `${path} rejects ${token}`);
          assert.equal(new URL(response.headers.get('location'), origin).pathname, root === '/admin' ? '/admin/login' : '/login');
          assert.equal(new URL(response.headers.get('location'), origin).search, '');
        }
      }
    }
    console.log(`PASS ${root}: missing/invalid/unavailable/wrong role redirect, correct role allowed`);
  }
  for (const path of ['/', '/login', '/register', '/admin/login', '/images/landing/logo.svg']) {
    const response = await get(path); await response.text(); assert.equal(response.status, 200, path);
  }
  console.log('PASS login routes and assets stay public; preview params do not bypass auth');
} finally {
  if (server.exitCode === null) {
    const stopped = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await stopped;
  }
  api.closeAllConnections();
  await new Promise(resolve => api.close(resolve));
}
