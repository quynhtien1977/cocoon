// Browser check with isolated fixtures; run after npm run build.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const origin = 'http://127.0.0.1:3198';
const profile = { role: 'Customer', fullName: 'Nguyễn An', email: 'an@example.com', phone: '', dateOfBirth: '', gender: '', address: '', consentPersonalData: true };
let selected = [42, 50];
let failSave = false, failPreferences = false;
const writes = [];
const api = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/api/v1/me' && request.headers.cookie === 'access_token=profile-smoke') response.end(JSON.stringify(profile));
  else response.writeHead(401).end('{}');
});
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3198', '--hostname', '127.0.0.1'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, API_URL: `http://127.0.0.1:${api.address().port}` } });
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--no-first-run', '--remote-debugging-port=9298', '--user-data-dir=' + resolve('.next/profile-browser'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0;
const pending = new Map(), runtimeErrors = [];
async function until(fn) { for (let n = 0; n < 100; n++) { try { if (await fn()) return; } catch {} await delay(100); } throw Error('Profile browser check timed out'); }
function send(method, params = {}) { return new Promise((resolve, reject) => { const n = ++id; const timer = setTimeout(() => reject(Error(method)), 15000); pending.set(n, { resolve, reject, timer }); ws.send(JSON.stringify({ id: n, method, params })); }); }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression: typeof expression === 'function' ? `(${expression.toString()})()` : expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
async function navigate() { await send('Page.navigate', { url: origin + '/account/profile' }); await until(() => evaluate(() => !!document.querySelector('#profile-fullName'))); }
async function key(key, code, windowsVirtualKeyCode) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode }); }
try {
  await until(async () => (await fetch(origin)).ok);
  let target; await until(async () => { target = (await (await fetch('http://127.0.0.1:9298/json')).json()).find(item => item.type === 'page'); return target; });
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data), call = pending.get(message.id);
    if (call) { clearTimeout(call.timer); pending.delete(message.id); if (message.error) call.reject(Error(JSON.stringify(message.error))); else call.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails);
    if (message.method !== 'Fetch.requestPaused') return;
    const { request, requestId } = message.params;
    const path = new URL(request.url).pathname;
    let status = 200, body = {};
    if (request.method === 'PUT') {
      writes.push({ path, body: JSON.parse(request.postData) });
      if (failSave) status = 501;
      else { status = 204; if (path === '/api/v1/me') Object.assign(profile, JSON.parse(request.postData)); else selected = JSON.parse(request.postData).preferenceIds; }
    } else if (path === '/api/v1/me') body = profile;
    else if (failPreferences) status = 501;
    else if (path === '/api/v1/me/preferences') body = { preferenceIds: selected };
    else body = [{ id: 42, name: 'Dry Skin' }, { id: 43, name: 'Oily & Pores' }, { id: 50, name: 'Facial Care' }, { id: 51, name: 'Hair Care' }, { id: 60, name: 'Eco-friendly / Sustainable' }];
    void send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], ...(status === 204 ? {} : { body: Buffer.from(JSON.stringify(body)).toString('base64') }) });
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCookie', { name: 'access_token', value: 'profile-smoke', url: origin, httpOnly: true, sameSite: 'Lax' });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/me' }, { urlPattern: '*/api/v1/me/preferences' }, { urlPattern: '*/api/v1/preferences' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await mkdir('.next/profile-previews', { recursive: true });
  await navigate();
  await until(() => evaluate(() => !!document.querySelector('[aria-label="Bỏ Da khô / Mất nước"]')));
  assert.equal(await evaluate(() => document.querySelector('#profile-fullName').value), 'Nguyễn An');
  assert.equal(await evaluate(() => document.querySelector('#profile-email').readOnly), true);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile('.next/profile-previews/desktop.png', Buffer.from(shot.data, 'base64'));
  // Keyboard selection, including opening the actual Base UI popup.
  await evaluate(() => document.querySelector('[aria-labelledby="profile-preference-products"]').focus());
  await key('ArrowDown', 'ArrowDown', 40);
  await until(() => evaluate(() => document.activeElement?.getAttribute('role') === 'option'));
  await key('ArrowDown', 'ArrowDown', 40);
  await until(() => evaluate(() => document.activeElement?.textContent === 'Chăm sóc tóc'));
  await key('Enter', 'Enter', 13); await key('Escape', 'Escape', 27);
  await until(() => evaluate(() => !!document.querySelector('[aria-label="Bỏ Chăm sóc tóc"]')));
  await evaluate(() => document.querySelector('[aria-label="Chỉnh sửa sở thích"]').requestSubmit());
  await until(() => evaluate(() => document.body.textContent.includes('Đã lưu sở thích.')));
  assert.deepEqual([...selected].sort(), [42, 50, 51]);
  await evaluate(() => { const input = document.querySelector('#profile-fullName'); input.focus(); input.select(); });
  await send('Input.insertText', { text: 'Nguyễn An mới' });
  failSave = true;
  await evaluate(() => document.querySelector('[aria-label="Chỉnh sửa thông tin cá nhân"]').requestSubmit());
  await until(() => evaluate(() => !!document.querySelector('[role="alert"]')));
  assert.equal(await evaluate(() => document.querySelector('#profile-fullName').value), 'Nguyễn An mới');
  failSave = false;
  await evaluate(() => document.querySelector('[aria-label="Chỉnh sửa thông tin cá nhân"]').requestSubmit());
  await until(() => evaluate(() => document.body.textContent.includes('Đã lưu thông tin cá nhân.')));
  assert.equal(profile.fullName, 'Nguyễn An mới');
  assert.ok(!Object.hasOwn(writes.at(-1).body, 'email'));
  await navigate();
  assert.equal(await evaluate(() => document.querySelector('#profile-fullName').value), 'Nguyễn An mới');
  await until(() => evaluate(() => !!document.querySelector('[aria-label="Bỏ Chăm sóc tóc"]')));
  console.log('PASS registered values, keyboard multi-select, independent saves, failure retention, reload persistence');
  for (const width of [390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(150);
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow at ${width}`);
    await evaluate(() => document.querySelector('[aria-labelledby="profile-preference-criteria"]').click());
    await until(() => evaluate(() => !!document.querySelector('[role="listbox"]')));
    assert.equal(await evaluate(() => { const r = document.querySelector('[role="listbox"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), true);
    await key('Escape', 'Escape', 27);
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(`.next/profile-previews/mobile-${width}.png`, Buffer.from(screenshot.data, 'base64'));
  }
  failPreferences = true;
  await navigate();
  await until(() => evaluate(() => !!document.querySelector('[aria-labelledby="customer-preferences"] [role="alert"]')));
  assert.equal(await evaluate(() => !!document.querySelector('[aria-labelledby="customer-preferences"] form')), false);
  failPreferences = false;
  await evaluate(() => document.querySelector('[aria-labelledby="customer-preferences"] button').click());
  await until(() => evaluate(() => !!document.querySelector('[aria-label="Bỏ Chăm sóc tóc"]')));
  assert.deepEqual(runtimeErrors, []);
  console.log('PASS mobile 390/320px, dropdown bounds, unavailable preferences and retry, no runtime exceptions');
} finally {
  for (const call of pending.values()) clearTimeout(call.timer);
  ws?.close(); browser.kill();
  if (server.exitCode === null) { const stopped = new Promise(resolve => server.once('exit', resolve)); server.kill(); await stopped; }
  api.closeAllConnections(); await new Promise(resolve => api.close(resolve));
}
