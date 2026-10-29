// Run after npm run build. Uses isolated local API fixtures, never real data.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const api = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/api/v1/me' && request.headers.cookie === 'access_token=manager-browser-fixture') response.end(JSON.stringify({ role: 'Manager' }));
  else response.writeHead(401).end('{}');
});
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3195', '--hostname', '127.0.0.1'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, API_URL: `http://127.0.0.1:${api.address().port}` } });
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--no-first-run', '--remote-debugging-port=9295', '--user-data-dir=' + resolve('.next/manager-browser'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, sequence = 0, status = 501, patchStatus = 501;
let detailStatus = 501, preferenceStatus = 501, insightsStatus = 501, detailReads = 0;
const preferenceWrites = [];
const statusWrites = [];
const requests = new Map();
const fixture = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, name: `Sản phẩm thử ${index + 1}`, sku: `TEST-${index + 1}`, categoryId: index % 2 + 1, categoryName: index % 2 ? 'Chăm sóc tóc' : 'Chăm sóc da', status: index % 2 ? 'Inactive' : 'Active', preferences: index % 2 ? [] : ['Da dầu'], averageRating: 4.5, feedbackCount: index, description: 'Thông tin từ API thử nghiệm.' }));
async function until(fn) { for (let i = 0; i < 100; i++) { try { if (await fn()) return; } catch {} await delay(100); } throw Error('Browser check timed out'); }
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => reject(Error(method)), 15000); requests.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(fn) { const r = await send('Runtime.evaluate', { expression: `(${fn.toString()})()`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function shot(name) { const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(`.next/manager-previews/${name}.png`, Buffer.from(r.data, 'base64')); }
async function navigate() { await send('Page.navigate', { url: 'http://127.0.0.1:3195/manager/products' }); await until(() => evaluate(() => document.readyState === 'complete' && location.pathname === '/manager/products')); }
async function choose(selector, label) {
  await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)}).click()` });
  await until(() => evaluate(() => !!document.querySelector('[role="listbox"]')));
  await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('[role="option"]')].find(option => option.textContent === ${JSON.stringify(label)}).click()` });
  await until(async () => {
    const result = await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-expanded') === 'false'`, returnByValue: true });
    return result.result.value;
  });
}
try {
  await until(async () => (await fetch('http://127.0.0.1:3195/', { signal: AbortSignal.timeout(1000) })).ok);
  let target;
  await until(async () => { target = (await (await fetch('http://127.0.0.1:9295/json')).json()).find(t => t.type === 'page'); return target; });
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data), pending = requests.get(message.id);
    if (pending) { clearTimeout(pending.timer); requests.delete(message.id); if (message.error) pending.reject(Error(JSON.stringify(message.error))); else pending.resolve(message.result); }
    if (message.method === 'Fetch.requestPaused') {
      const path = new URL(message.params.request.url).pathname;
      if (path === '/api/v1/preferences') {
        void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify([{ id: 42, name: 'Da dầu' }, { id: 43, name: 'Cấp ẩm' }])).toString('base64') });
        return;
      }
      if (path === '/api/v1/products/1/preferences') {
        preferenceWrites.push(JSON.parse(message.params.request.postData));
        void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: preferenceStatus, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: preferenceStatus === 204 ? '' : Buffer.from('{}').toString('base64') });
        return;
      }
      if (path === '/api/v1/products/1/insights') {
        void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: insightsStatus, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ totalFeedback: 10, averageRating: 4.5, ratingDistribution: [{ rating: 5, count: 5 }, { rating: 4, count: 5 }] })).toString('base64') });
        return;
      }
      if (path === '/api/v1/products/1') {
        detailReads++;
        void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: detailStatus, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ ...fixture[0], imageUrl: '/images/manager-products/winter-melon.jpg', preferenceIds: [42], variants: [{ id: 1, sku: 'BD-310', name: 'Chai 310ml', price: 299000, imageUrl: '/images/manager-products/winter-melon.jpg' }], ingredients: 'Bí đao', benefits: 'Làm sạch', usage: 'Rửa sạch với nước.' })).toString('base64') });
        return;
      }
      if (message.params.request.method === 'PATCH') {
        const next = JSON.parse(message.params.request.postData).status;
        const id = Number(new URL(message.params.request.url).pathname.split('/').at(-2));
        statusWrites.push({ id, status: next });
        if (patchStatus === 204) fixture.find(item => item.id === id).status = next;
        void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: patchStatus, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: patchStatus === 204 ? '' : Buffer.from('{}').toString('base64') });
      } else void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(status === 200 ? fixture : {})).toString('base64') });
    }
  };
  await send('Page.enable');
  await send('Network.setCookie', { name: 'access_token', value: 'manager-browser-fixture', url: 'http://127.0.0.1:3195', path: '/' });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/products*' }, { urlPattern: '*/api/v1/preferences' }] });
  await mkdir('.next/manager-previews', { recursive: true });
  for (const width of [1440, 1024, 900, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate();
    await until(() => evaluate(() => !!document.querySelector('[role="alert"]')));
    await evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Xem giao diện mẫu')).click());
    await until(() => evaluate(() => document.querySelectorAll('tbody tr').length === 7));
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow at ${width}`);
    await shot(`products-${width}`);
    assert.ok(await evaluate(() => document.querySelector('input[type="search"]').getBoundingClientRect().width >= 160), `Search stays usable at ${width}px`);
    assert.equal(await evaluate(() => document.querySelector('button[aria-label^="Xem nhanh"]')), null);
    assert.equal(await evaluate(() => [...document.querySelectorAll('tbody [role="combobox"]')].every(select => select.disabled)), true);
    assert.equal(await evaluate(() => [...document.querySelectorAll('button[role="combobox"]')].every(select => !select.querySelector('svg'))), true, 'Dropdown triggers have no arrows');
    await until(() => evaluate(() => [...document.querySelectorAll('tbody img')].length === 7 && [...document.querySelectorAll('tbody img')].every(img => img.complete && img.naturalWidth > 0)));
    const reads = detailReads;
    await evaluate(() => document.querySelector('a[aria-label="Chi tiết Gel rửa mặt bí đao"]').click());
    await until(() => evaluate(() => location.pathname === '/manager/products/1' && document.body.textContent.includes('Biến thể & giá bán')));
    assert.equal(detailReads, reads, 'Sample detail never requests real product');
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Detail fits viewport');
    await shot(`detail-${width}`);
    if (width === 390) {
      await evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20;
        const bytes = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), char => char.charCodeAt(0));
        const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'product-photo.png', { type: 'image/png' }));
        const input = document.querySelector('input[type="file"]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await until(() => evaluate(() => !!document.querySelector('button[aria-label="Bỏ ảnh product-photo.png"]')));
      assert.ok(await evaluate(() => document.body.textContent.includes('Chưa lưu')));
      await evaluate(() => document.querySelector('button[aria-label="Bỏ ảnh product-photo.png"]').click());
      assert.equal(await evaluate(() => !!document.querySelector('button[aria-label="Bỏ ảnh product-photo.png"]')), false);
    }
  }
  status = 200;
  await navigate();
  await until(() => evaluate(() => document.querySelectorAll('tbody tr').length === 10));
  await evaluate(() => document.querySelector('input[type="search"]').focus());
  for (const character of 'TEST-12') {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: character, text: character });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: character });
  }
  await until(() => evaluate(() => new URLSearchParams(location.search).get('products.q') === 'TEST-12'));
  assert.equal(await evaluate(() => document.querySelector('input[type="search"]').value), 'TEST-12', 'Every key inserts exactly once');
  await evaluate(() => document.querySelector('input[type="search"]').select());
  await send('Input.imeSetComposition', { text: 'dda', selectionStart: 3, selectionEnd: 3 });
  await send('Input.imeSetComposition', { text: 'đặng', selectionStart: 4, selectionEnd: 4 });
  await send('Input.insertText', { text: 'đặng' });
  await until(() => evaluate(() => new URLSearchParams(location.search).get('products.q') === 'đặng'));
  assert.equal(await evaluate(() => document.querySelector('input[type="search"]').value), 'đặng', 'IME commits Vietnamese once');
  await evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Đặt lại bộ lọc').click());
  await until(() => evaluate(() => document.querySelector('input[type="search"]').value === '' && document.querySelectorAll('tbody tr').length === 10));
  await evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Trang sau').click());
  await until(() => evaluate(() => new URLSearchParams(location.search).get('products.page') === '2' && document.querySelectorAll('tbody tr').length === 2));
  await choose('button[id$="-tags"]', 'Chưa gắn sở thích');
  await until(() => evaluate(() => document.querySelectorAll('tbody tr').length === 6));
  assert.equal(await evaluate(() => new URLSearchParams(location.search).get('products.page')), '1');
  await evaluate(() => document.querySelector('th button').click());
  await until(() => evaluate(() => new URLSearchParams(location.search).get('products.sort') === 'name'));
  await evaluate(() => { const input = document.querySelector('input[type="search"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'TEST-12'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await until(() => evaluate(() => document.querySelectorAll('tbody tr').length === 1 && document.querySelector('tbody').textContent.includes('TEST-12')));
  assert.equal(await evaluate(() => new URLSearchParams(location.search).get('products.q')), 'TEST-12');
  await navigate();
  await until(() => evaluate(() => document.querySelectorAll('tbody tr').length === 10));
  await choose('tbody [role="combobox"]', 'Sắp ra mắt');
  await until(() => evaluate(() => !!document.querySelector('tbody [role="alert"]')));
  assert.equal(fixture[0].status, 'Active', 'Failed save preserves status');
  assert.equal(await evaluate(() => document.querySelector('tbody [role="combobox"]').textContent), 'Đang bán');
  patchStatus = 204;
  for (const value of ['Upcoming', 'Inactive', 'Active']) {
    await choose('tbody [role="combobox"]', { Upcoming: 'Sắp ra mắt', Inactive: 'Ngừng bán', Active: 'Đang bán' }[value]);
    await until(() => evaluate(() => !document.querySelector('tbody [role="combobox"]').disabled && !document.querySelector('tbody [role="alert"]')));
    assert.equal(fixture[0].status, value);
  }
  assert.equal(statusWrites.length, 4);
  console.log('PASS status updates: preview disabled, 501 preserves data, PATCH Active/Upcoming/Inactive updates the list');
  console.log('PASS manager products: 501, explicit preview, responsive table/inline status, real API fixture, pagination, tags, sorting and URL search');
  await evaluate(() => document.querySelector('tbody a').click());
  await until(() => evaluate(() => location.pathname === '/manager/products/1' && !!document.querySelector('[role="alert"]')));
  detailStatus = 200;
  await evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Thử lại').click());
  await until(() => evaluate(() => !!document.querySelector('#add-product-preference') && !document.querySelector('#add-product-preference').disabled));
  await evaluate(() => { const select = document.querySelector('#add-product-preference'); select.value = '43'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Thêm').click());
  await evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Lưu sở thích').click());
  await until(() => evaluate(() => !!document.querySelector('[role="alert"]')));
  assert.ok(await evaluate(() => !!document.querySelector('button[aria-label="Bỏ sở thích Cấp ẩm"]')));
  preferenceStatus = 204;
  await evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Lưu sở thích').click());
  await until(() => evaluate(() => document.body.textContent.includes('Đã lưu sở thích sản phẩm.')));
  assert.deepEqual(preferenceWrites.at(-1), { preferenceIds: [42, 43] });
  await evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Phản hồi & đánh giá').click());
  await until(() => evaluate(() => !!document.querySelector('[role="alert"]')));
  insightsStatus = 200;
  await evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Thử lại').click());
  await until(() => evaluate(() => document.querySelectorAll('meter').length === 5));
  console.log('PASS product detail: real images, navigation, responsive, draft photo add/remove, API retry, preference persistence and insights');
} catch (error) {
  if (ws?.readyState === 1) { console.log(await evaluate(() => ({ path: location.href, text: document.body.innerText.slice(-2000) }))); await shot('failure'); }
  throw error;
} finally {
  if (ws?.readyState === 1) { await send('Browser.close').catch(() => {}); ws.close(); }
  browser.kill(); server.kill(); api.closeAllConnections(); await new Promise(resolve => api.close(resolve));
}
