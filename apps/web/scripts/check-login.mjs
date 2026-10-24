// Optional browser smoke check: run after npm run build, with Microsoft Edge installed.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3193', '--hostname', '127.0.0.1'], { windowsHide: true, stdio: 'ignore' });
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--no-first-run', '--remote-debugging-port=9293', '--user-data-dir=' + resolve('.next/login-browser'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0;
const pending = new Map();
async function until(fn) { for (let i = 0; i < 100; i++) { try { if (await fn()) return; } catch {} await delay(100); } throw Error('Browser check timed out'); }
function send(method, params = {}) { return new Promise((resolve, reject) => { const n = ++id; const timer = setTimeout(() => reject(Error(method)), 15000); pending.set(n, { resolve, reject, timer }); ws.send(JSON.stringify({ id: n, method, params })); }); }
async function evaluate(expression) {
  if (typeof expression === 'function') expression = `(${expression.toString()})()`;
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function screenshot(name) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(`.next/login-previews/${name}.png`, Buffer.from(shot.data, 'base64')); }
async function key(key, code = key, windowsVirtualKeyCode = 27) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode }); }
async function navigate(path) { await send('Page.navigate', { url: 'http://127.0.0.1:3193' + path }); await until(() => evaluate(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`)); }

try {
  await until(async () => (await fetch('http://127.0.0.1:3193/')).ok);
  let target; await until(async () => { target = (await (await fetch('http://127.0.0.1:9293/json')).json()).find(x => x.type === 'page'); return target; });
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = e => {
    const m = JSON.parse(e.data), p = pending.get(m.id);
    if (p) { clearTimeout(p.timer); pending.delete(m.id); if (m.error) p.reject(Error(JSON.stringify(m.error))); else p.resolve(m.result); }
    if (m.method === 'Fetch.requestPaused') {
      // Simulate the repository's current auth stub; no real credentials or backend writes.
      void send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 501, responseHeaders: [{ name: 'Content-Type', value: 'application/problem+json' }], body: Buffer.from('{"title":"Not implemented"}').toString('base64') });
    }
  };
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/auth/login*' }] });
  await mkdir('.next/login-previews', { recursive: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await navigate('/');
  await until(() => evaluate(() => !!document.querySelector('header a[href="/login"]')));
  await evaluate(() => document.querySelector('#cau-chuyen').scrollIntoView({ behavior: 'instant' }));
  const initialScroll = await evaluate(() => scrollY);
  await evaluate(() => { const link = document.querySelector('header a[href="/login"]'); link.focus({ preventScroll: true }); link.click(); });
  await until(() => evaluate(() => location.pathname === '/login' && !!document.querySelector('[role="dialog"]')));
  await delay(350);
  assert.equal(await evaluate(() => document.querySelectorAll('main').length), 1, 'Popup does not add a second main');
  assert.equal(await evaluate(() => Math.abs(scrollY - document.querySelector('#cau-chuyen').offsetTop) < 200), true, 'Opening preserves background scroll');
  await screenshot('login-desktop');
  assert.equal(await evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d.scrollHeight <= d.clientHeight + 1; }), true, 'Desktop login needs no internal scrolling');
  for (let i = 0; i < 10; i++) { await key('Tab', 'Tab', 9); assert.equal(await evaluate(() => !!document.activeElement.closest('[role="dialog"]')), true, 'Keyboard focus stays in modal'); }
  await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit());
  await until(() => evaluate(() => document.querySelectorAll('[aria-invalid="true"]').length === 2));
  assert.equal(await evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d.scrollHeight <= d.clientHeight + 1; }), true, 'Validation errors fit without scrolling');
  assert.equal(await evaluate(() => document.activeElement.id), 'login-email');
  await send('Input.insertText', { text: 'preview@example.com' });
  await evaluate(() => document.querySelector('#login-password').focus());
  await send('Input.insertText', { text: 'test-password' });
  await evaluate(() => document.querySelector('[aria-label="Hiện mật khẩu"]').click());
  assert.equal(await evaluate(() => document.querySelector('#login-password').type), 'text');
  await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit());
  await until(() => evaluate(() => document.querySelector('[role="alert"]')?.textContent.includes('chưa được kích hoạt')));
  assert.equal(await evaluate(() => location.pathname), '/login');
  assert.equal(await evaluate(() => localStorage.length), 0, 'Failed login stores no credentials');
  await key('Escape');
  await until(() => evaluate(() => location.pathname === '/' && !document.querySelector('[role="dialog"]')));
  assert.ok(Math.abs(await evaluate(() => scrollY) - initialScroll) < 5, 'Closing restores background position');
  await evaluate(() => history.forward());
  await until(() => evaluate(() => location.pathname === '/login' && !!document.querySelector('[role="dialog"]')));
  await evaluate(() => document.querySelector('[role="dialog"] a[href="/admin/login"]').click());
  await until(() => evaluate(() => location.pathname === '/admin/login' && !!document.querySelector('form')));
  assert.equal(await evaluate(() => document.querySelector('[role="dialog"]')), null, 'Admin entry has its own page');
  assert.equal(await evaluate(() => document.querySelector('h1').textContent), 'Đăng nhập quản trị');
  await screenshot('admin-desktop');
  console.log('PASS desktop: modal routing, focus, validation, password visibility, 501, back/forward, admin entry');

  await navigate('/register');
  await until(() => evaluate(() => !!document.querySelector('main')));
  const registerText = await evaluate(() => document.querySelector('main').textContent);
  await evaluate(() => document.querySelector('header a[href="/login"]').click());
  await until(() => evaluate(() => !!document.querySelector('[role="dialog"]')));
  assert.equal(await evaluate(() => document.querySelector('main').textContent), registerText, 'Register retains its shell behind modal');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 20, y: 400, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 20, y: 400, button: 'left', clickCount: 1 });
  await until(() => evaluate(() => location.pathname === '/register' && !document.querySelector('[role="dialog"]')));
  console.log('PASS register background and backdrop dismissal');

  for (const width of [390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width === 320 ? 640 : 780, deviceScaleFactor: 1, mobile: false });
    await navigate('/login');
    await until(() => evaluate(() => !!document.querySelector('[role="dialog"]')));
    await delay(250);
    assert.equal(await evaluate(() => { const r = document.querySelector('[role="dialog"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }), true, 'Modal fits narrow viewport');
    assert.equal(await evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d.scrollWidth <= d.clientWidth; }), true, 'No horizontal overflow inside popup');
    await screenshot(`login-${width}`);
    assert.equal(await evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d.scrollHeight <= d.clientHeight + 1; }), true, 'Mobile login needs no internal scrolling');
    await evaluate(() => document.querySelector('[aria-label="Đóng đăng nhập"]').click());
    await until(() => evaluate(() => location.pathname === '/' && !document.querySelector('[role="dialog"]')));
    await navigate('/admin/login');
    await until(() => evaluate(() => !!document.querySelector('form')));
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Admin page has no horizontal overflow');
    await screenshot(`admin-${width}`);
    console.log(`PASS ${width}px: direct modal, close, admin responsive`);
  }
} finally {
  if (ws?.readyState === 1) { await send('Browser.close').catch(() => {}); ws.close(); }
  browser.kill(); server.kill();
}
