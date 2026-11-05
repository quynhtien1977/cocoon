// Run after a frontend build. All API traffic uses isolated fixtures, never real accounts or products.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:3197';
let authenticated = false, recommendationStatus = 200, empty = false;
const writes = [], runtimeErrors = [];
const names = ['Gel rửa mặt bí đao', 'Nước dưỡng tóc tinh dầu bưởi', 'Thạch hoa hồng dưỡng ẩm', 'Nước sen Hậu Giang', 'Cà phê Đắk Lắk', 'Son dưỡng dầu dừa'];
const photos = ['/images/manager-products/winter-melon.jpg', '/images/landing/product-1.jpg', '/images/manager-products/rose.jpg', '/images/manager-products/lotus.jpg', '/images/manager-products/coffee.jpg', '/images/manager-products/coconut.jpg'];
const items = names.map((name, index) => ({ id: index + 71, score: 90 - index, product: { id: index + 101, name, minPrice: index ? 162000 : 299000, imageUrl: photos[index], avgRating: index ? 4.5 : null }, reasons: [{ code: 'preference', label: 'Phù hợp sở thích của bạn' }, { code: 'popular', label: 'Được yêu thích' }] }));
const api = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  const path = new URL(request.url, origin).pathname;
  if (path === '/api/v1/auth/login') { authenticated = true; return response.writeHead(204).end(); }
  if (!authenticated || !request.headers.cookie?.includes('access_token=recommendations-browser-fixture')) return response.writeHead(401).end('{}');
  if (path === '/api/v1/me') return response.end(JSON.stringify({ id: 41, role: 'Customer' }));
  if (path === '/api/v1/me/notifications') return response.end('[]');
  if (path === '/api/v1/me/recommendations') return response.writeHead(recommendationStatus).end(JSON.stringify(recommendationStatus === 200 ? empty ? [] : items : {}));
  if (/^\/api\/v1\/me\/recommendations\/\d+\/click$/.test(path)) { writes.push(path); return response.writeHead(204).end(); }
  if (path === '/api/v1/products/101') return response.end(JSON.stringify({ id: 101, name: names[0], categoryName: 'Chăm sóc da', description: 'Thông tin sản phẩm từ API kiểm thử.', variants: [{ name: '310ml', price: 299000, imageUrl: photos[0] }] }));
  response.writeHead(404).end('{}');
});
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3197', '--hostname', '127.0.0.1'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, API_URL: `http://127.0.0.1:${api.address().port}` } });
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--no-first-run', '--remote-debugging-port=9297', '--user-data-dir=' + resolve(tmpdir(), 'cocoon-customer-recommendations-browser'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, sequence = 0;
const pending = new Map();
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => reject(Error(method)), 15000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression: typeof expression === 'function' ? `(${expression.toString()})()` : expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
async function until(fn) { for (let i = 0; i < 150; i++) { try { if (await fn()) return; } catch {} await delay(100); } throw Error('Recommendation browser check timed out'); }
async function go(path) { await send('Page.navigate', { url: origin + path }); await until(() => evaluate(() => document.readyState === 'complete' && !!document.querySelector('h1'))); }
async function loaded() { await until(() => evaluate(() => document.querySelectorAll('section[aria-labelledby] article').length === 4)); }
async function shot(name) { await delay(400); const result = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(`.next/recommendation-previews/${name}.png`, Buffer.from(result.data, 'base64')); }
try {
  await until(async () => (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok);
  let target;
  await until(async () => { target = (await (await fetch('http://127.0.0.1:9297/json')).json()).find(item => item.type === 'page'); return !!target; });
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (request) { clearTimeout(request.timer); pending.delete(message.id); if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused') {
      const paused = message.params, url = new URL(paused.request.url);
      void (async () => {
        const response = await fetch(`http://127.0.0.1:${api.address().port}${url.pathname}${url.search}`, { method: paused.request.method, headers: { Cookie: 'access_token=recommendations-browser-fixture', 'Content-Type': 'application/json' }, body: paused.request.postData });
        await send('Fetch.fulfillRequest', { requestId: paused.requestId, responseCode: response.status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(await response.text()).toString('base64') });
      })().catch(error => runtimeErrors.push(String(error)));
    }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Network.setCookie', { name: 'access_token', value: 'recommendations-browser-fixture', url: origin, path: '/' });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  await mkdir('.next/recommendation-previews', { recursive: true });
  await go('/');
  assert.equal(await evaluate(() => document.querySelector('#goi-y-cho-ban')), null, 'Public landing has no customer suggestions');
  await evaluate(() => document.querySelector('#san-pham a[href="/account#goi-y-cho-ban"]').click());
  await until(() => evaluate(() => !!document.querySelector('#login-email')));
  assert.equal(await evaluate(() => new URLSearchParams(location.search).get('next')), '/account#goi-y-cho-ban');
  await evaluate(() => { document.querySelector('#login-email').value = 'customer@fixture.test'; document.querySelector('#login-password').value = 'fixture-password'; document.querySelector('form[aria-label="Đăng nhập Cocoon"]').requestSubmit(); });
  await until(() => evaluate(() => location.pathname === '/account' && location.hash === '#goi-y-cho-ban'));
  await loaded();
  for (const width of [1440, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await go('/account#goi-y-cho-ban'); await loaded();
    await evaluate(() => document.querySelector('#goi-y-cho-ban').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await evaluate(() => document.fonts.ready.then(() => true));
    await until(() => evaluate(() => [...document.querySelectorAll('#goi-y-cho-ban img')].every(img => img.complete && img.naturalWidth > 0)));
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Home fits ${width}px`);
    assert.ok(await evaluate(() => document.querySelector('#goi-y-cho-ban').getBoundingClientRect().top >= document.querySelector('header').getBoundingClientRect().bottom - 1), 'Anchor clears sticky navigation');
    await shot(`home-${width}`);
    await go('/account/products/101'); await loaded();
    assert.equal(await evaluate(() => document.querySelector('section[aria-labelledby] a[href="/account/products/101"]')), null, 'Viewed product is excluded');
    await evaluate(() => document.querySelector('section[aria-labelledby]').scrollIntoView({ block: 'start', behavior: 'instant' }));
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Detail fits ${width}px`);
    await shot(`detail-${width}`);
  }
  await go('/account/products/nuoc-duong-toc-tinh-dau-buoi-140ml-1'); await loaded();
  assert.equal(await evaluate(() => document.querySelector('section[aria-labelledby]').textContent.includes('Nước dưỡng tóc tinh dầu bưởi')), false, 'Reference product is excluded by its actual name');
  await go('/account#goi-y-cho-ban'); await loaded();
  await evaluate(() => document.querySelector('#goi-y-cho-ban a[aria-label^="Xem sản phẩm"]').click());
  await until(() => evaluate(() => location.pathname === '/account/products/101'));
  await until(async () => writes.length === 1);
  assert.equal(writes[0], '/api/v1/me/recommendations/71/click', 'Record recommendation ID, not product ID');
  recommendationStatus = 501;
  await go('/account#goi-y-cho-ban');
  await until(() => evaluate(() => !!document.querySelector('#goi-y-cho-ban [role="alert"]')));
  recommendationStatus = 200; empty = true;
  await evaluate(() => document.querySelector('#goi-y-cho-ban button').click());
  await until(() => evaluate(() => !!document.querySelector('#goi-y-cho-ban a[href="/account/profile"]')));
  empty = false;
  await go('/');
  await evaluate(() => document.querySelector('#san-pham a[href="/account#goi-y-cho-ban"]').click());
  await until(() => evaluate(() => location.pathname === '/account' && location.hash === '#goi-y-cho-ban'));
  assert.equal(runtimeErrors.length, 0, runtimeErrors.join('\n'));
  console.log('PASS recommendations: login return anchor, existing-session shortcut, shared home/detail sections, exclusion, images, desktop/mobile, click tracking, retry and empty state.');
} catch (error) {
  console.error('Recommendation browser diagnostic:', await evaluate(() => ({ path: location.href, text: document.body.innerText.slice(0, 1600) })).catch(() => null), runtimeErrors);
  throw error;
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  ws?.close(); browser.kill(); server.kill(); api.closeAllConnections(); api.close();
}
