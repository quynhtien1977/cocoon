// Optional browser smoke check: run after npm run build, with Microsoft Edge installed.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3193', '--hostname', '127.0.0.1'], { windowsHide: true, stdio: 'ignore' });
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--no-first-run', '--remote-debugging-port=9293', '--user-data-dir=' + resolve('.next/login-browser'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0;
let registrationStatus = 501;
let loginStatus = 501;
let profileStatus = 401;
let profile = { role: 'Customer' };
let ordersStatus = 501;
let ordersResponse = { items: [], totalCount: 0 };
let reviewableStatus = 501;
let reviewableItems = [];
let feedbackStatus = 501;
const feedbackSubmissions = [];
const registrations = [];
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
async function navigate(path) { await send('Page.navigate', { url: 'http://127.0.0.1:3193' + path }); await until(() => evaluate(`document.readyState === 'complete' && location.pathname + location.search === ${JSON.stringify(path)}`)); }

try {
  await until(async () => (await fetch('http://127.0.0.1:3193/')).ok);
  let target; await until(async () => { target = (await (await fetch('http://127.0.0.1:9293/json')).json()).find(x => x.type === 'page'); return target; });
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = e => {
    const m = JSON.parse(e.data), p = pending.get(m.id);
    if (p) { clearTimeout(p.timer); pending.delete(m.id); if (m.error) p.reject(Error(JSON.stringify(m.error))); else p.resolve(m.result); }
    if (m.method === 'Fetch.requestPaused') {
      if (m.params.request.url.endsWith('/api/v1/me/reviewable-items')) {
        void send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: reviewableStatus, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(reviewableItems)).toString('base64') });
        return;
      }
      if (m.params.request.url.endsWith('/api/v1/me/feedback')) {
        feedbackSubmissions.push(JSON.parse(m.params.request.postData));
        void send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: feedbackStatus, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from('{}').toString('base64') });
        return;
      }
      if (m.params.request.url.includes('/api/v1/me/orders')) {
        void send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: ordersStatus, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(ordersResponse)).toString('base64') });
        return;
      }
      if (m.params.request.url.includes('cocoonvietnam.com/san-pham/')) {
        void send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html' }], body: Buffer.from('<h1>Verified product destination</h1>').toString('base64') });
        return;
      }
      if (m.params.request.url.endsWith('/api/v1/me')) {
        void send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: profileStatus, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(profile)).toString('base64') });
        return;
      }
      if (m.params.request.url.endsWith('/auth/login')) {
        void send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: loginStatus, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from('{}').toString('base64') });
        return;
      }
      // Simulate the repository's current auth stub; no real credentials or backend writes.
      const isRegistration = m.params.request.url.endsWith('/auth/register');
      if (isRegistration) registrations.push(JSON.parse(m.params.request.postData));
      void send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: isRegistration ? registrationStatus : 501, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(isRegistration && registrationStatus === 201 ? '{}' : '{"title":"Not implemented"}').toString('base64') });
    }
  };
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/auth/login*' }, { urlPattern: '*/api/v1/auth/register*' }, { urlPattern: '*/api/v1/preferences*' }, { urlPattern: '*/api/v1/me' }, { urlPattern: '*/api/v1/me/orders*' }, { urlPattern: '*/api/v1/me/reviewable-items' }, { urlPattern: '*/api/v1/me/feedback' }, { urlPattern: 'https://cocoonvietnam.com/san-pham/*', resourceType: 'Document' }] });
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
  for (let i = 0; i < 10; i++) { await key('Tab', 'Tab', 9); await until(() => evaluate(() => !!document.activeElement.closest('[role="dialog"]'))); }
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
  await until(() => evaluate(() => !!document.querySelector('[role="dialog"] a[href="/login"]')));
  await evaluate(() => document.querySelector('[role="dialog"] a[href="/login"]').click());
  await until(() => evaluate(() => !!document.querySelector('#login-email')));
  assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"]').length), 1, 'Switching from registration never stacks dialogs');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 20, y: 400, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 20, y: 400, button: 'left', clickCount: 1 });
  await until(() => evaluate(() => location.pathname === '/' && !document.querySelector('[role="dialog"]')));
  console.log('PASS register/login switch and backdrop dismissal');

  for (const [status, selector] of [[401, '#bestseller-track article a'], [501, '#bestseller-track h3 a'], [401, '#cau-chuyen a']]) {
    profileStatus = status;
    await navigate('/');
    await until(() => evaluate(`!!document.querySelector('${selector}')`));
    await evaluate(`document.querySelector('${selector}').scrollIntoView({ behavior: 'instant', block: 'center' })`);
    const before = await evaluate(() => scrollY);
    await evaluate(`document.querySelector('${selector}').click()`);
    await until(() => evaluate(() => location.pathname === '/login' && !!document.querySelector('#login-email')));
    assert.ok(Math.abs(await evaluate(() => scrollY) - before) < 5, 'Product login gate preserves scroll');
    await key('Escape');
    await until(() => evaluate(() => location.pathname === '/' && !document.querySelector('[role="dialog"]')));
  }
  profileStatus = 200;
  profile = {};
  await evaluate(() => document.querySelector('#bestseller-track article a').click());
  await until(() => evaluate(() => !!document.querySelector('#login-email')));
  await key('Escape');
  await until(() => evaluate(() => !document.querySelector('[role="dialog"]')));
  profile = { role: 'Customer' };
  await evaluate(() => document.querySelector('#bestseller-track article a').click());
  await until(() => evaluate(() => document.querySelector('h1')?.textContent === 'Verified product destination'));
  console.log('PASS product gate: 401/501/invalid profile open login; verified session opens product');

  await navigate('/register');
  await until(() => evaluate(() => !!document.querySelector('#register-fullName')));
  await delay(250);
  await screenshot('register-step-1-desktop');
  assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"]').length), 1);
  assert.equal(await evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].some(b => b.textContent === 'ĐĂNG KÝ TÀI KHOẢN')), false, 'No registration submit on step one');
  await evaluate(() => document.querySelector('#register-fullName').focus());
  await key('Enter', 'Enter', 13);
  await until(() => evaluate(() => document.querySelectorAll('[aria-invalid="true"]').length === 4));
  assert.equal(registrations.length, 0, 'Invalid first step makes no registration request');
  const fillRegistration = async (confirmation = 'Password1') => {
    for (const [name, text] of [['fullName', 'Nguyễn An'], ['email', 'preview@example.com'], ['password', 'Password1'], ['confirmation', confirmation]]) {
      await evaluate(`document.getElementById('register-${name}').focus()`);
      await send('Input.insertText', { text });
    }
  };
  await fillRegistration('Wrong1');
  await key('Enter', 'Enter', 13);
  await until(() => evaluate(() => document.querySelector('#register-confirmation')?.getAttribute('aria-invalid') === 'true'));
  await evaluate(() => document.querySelector('#register-confirmation').select());
  await send('Input.insertText', { text: 'Password1' });
  await key('Enter', 'Enter', 13);
  await until(() => evaluate(() => !!document.querySelector('[aria-labelledby="preference-skin"]')));
  assert.equal(registrations.length, 0, 'Enter advances without submitting registration');
  await delay(250);
  assert.equal(await evaluate(() => getComputedStyle(document.querySelector('[role="dialog"] button[type="submit"]')).backgroundColor), 'rgb(33, 30, 24)', 'Registration action has dark brand background');
  await screenshot('register-step-2-desktop');
  for (const [group, count] of [['skin', 6], ['products', 5], ['criteria', 4]]) {
    await evaluate(`document.querySelector('[aria-labelledby="preference-${group}"]').click()`);
    await until(() => evaluate(`[...document.querySelectorAll('[role="option"]')].filter(e => e.getBoundingClientRect().height > 0).length === ${count}`));
    await evaluate(() => { const option = [...document.querySelectorAll('[role="option"]')].find(e => e.getBoundingClientRect().height > 0); option.focus(); option.click(); });
    await delay(150);
    await key('Escape');
    await until(() => evaluate(() => [...document.querySelectorAll('[role="listbox"]')].every(e => e.getBoundingClientRect().height === 0)));
    assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"]').length), 1, 'Escape closes dropdown, not registration');
  }
  await evaluate(() => document.querySelector('[aria-label="Quay lại bước 1: Thông tin tài khoản"]').click());
  await until(() => evaluate(() => !!document.querySelector('#register-password')));
  assert.equal(await evaluate(() => document.querySelector('#register-password').value), 'Password1');
  assert.equal(await evaluate(() => document.querySelector('#register-fullName').value), 'Nguyễn An');
  await evaluate(() => document.querySelector('[aria-label="Sang bước 2: Sở thích"]').click());
  await until(() => evaluate(() => !!document.querySelector('[aria-labelledby="preference-skin"]')));
  assert.equal(await evaluate(() => document.querySelector('[aria-labelledby="preference-skin"]').textContent.includes('1')), true, 'Preferences survive back/next');
  await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit());
  await until(() => evaluate(() => document.querySelector('[role="alert"]')?.textContent.includes('chưa thể lưu')));
  assert.equal(registrations.length, 0, 'Unavailable catalog does not silently omit selected preferences');
  await evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Bỏ tất cả lựa chọn').click());
  await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit());
  await until(() => evaluate(() => document.querySelector('[role="alert"]')?.textContent.includes('chưa được kích hoạt')));
  assert.deepEqual(registrations[0].preferenceIds, []);
  assert.equal('role' in registrations[0], false, 'No client role escalation');
  assert.equal('confirmation' in registrations[0], false);
  registrationStatus = 201;
  await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit());
  await until(() => evaluate(() => document.querySelector('[role="status"]')?.textContent.includes('đã được tạo')));
  await evaluate(() => document.querySelector('[role="dialog"] a[href="/login"]').click());
  await until(() => evaluate(() => !!document.querySelector('#login-email')));
  assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"]').length), 1);
  console.log('PASS registration: required fields, Enter, back/next, 15 options, optional preferences, 501, mocked success');

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
    await navigate('/register');
    await until(() => evaluate(() => !!document.querySelector('#register-fullName')));
    await delay(250);
    await screenshot(`register-step-1-${width}`);
    assert.equal(await evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d.scrollHeight <= d.clientHeight + 1 && d.scrollWidth <= d.clientWidth; }), true, 'Registration fits narrow screen without scrolling');
    await fillRegistration();
    await key('Enter', 'Enter', 13);
    await until(() => evaluate(() => !!document.querySelector('[aria-labelledby="preference-skin"]')));
    await screenshot(`register-step-2-${width}`);
    assert.equal(await evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d.scrollHeight <= d.clientHeight + 1; }), true, 'Step two fits without scrolling');
    console.log(`PASS ${width}px: direct modal, close, admin responsive`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  loginStatus = 200;
  profileStatus = 200;
  profile = { role: 'Customer' };
  await navigate('/register');
  await until(() => evaluate(() => !!document.querySelector('#register-fullName')));
  await fillRegistration();
  await key('Enter', 'Enter', 13);
  await until(() => evaluate(() => !!document.querySelector('[aria-labelledby="preference-skin"]')));
  await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit());
  await until(() => evaluate(() => location.pathname === '/account' && !!document.querySelector('[data-portal="customer"]')));
  assert.equal(await evaluate(() => document.querySelectorAll('main').length), 1, 'Customer has one main');
  assert.equal(await evaluate(() => document.querySelectorAll('header').length), 1, 'Customer has one navbar');
  assert.equal(await evaluate(() => !!document.querySelector('header a[href="/register"], header a[href="/login"]')), false);
  for (const href of ['/account/products', '/account/surveys', '/account/orders']) {
    assert.equal(await evaluate(`!!document.querySelector('header nav[aria-label="Điều hướng chính"] a[href="${href}"]')`), true);
  }
  assert.equal(await evaluate(() => !!document.querySelector('header nav[aria-label="Khám phá"] button[aria-haspopup="dialog"]')), true);
  await screenshot('customer-home-desktop');
  await evaluate(() => document.querySelector('header a[href="/account/products"]').click());
  await until(() => evaluate(() => location.pathname === '/account/products' && document.querySelectorAll('#catalog-grid article').length === 5));
  await screenshot('customer-products-desktop');
  await evaluate(() => document.querySelector('#catalog-search').focus());
  await send('Input.insertText', { text: 'buoi' });
  await until(() => evaluate(() => document.querySelectorAll('#catalog-grid article').length === 1));
  await navigate('/account/products?q=khongtontai');
  await until(() => evaluate(() => !document.querySelector('#catalog-grid') && !!document.querySelector('#catalog-search')));
  await evaluate(() => [...document.querySelectorAll('main button')].find(b => b.textContent === 'Xem tất cả sản phẩm').click());
  await until(() => evaluate(() => document.querySelectorAll('#catalog-grid article').length === 5));
  for (const href of ['/account/profile', '/account/orders', '/account/surveys']) {
    await evaluate(`document.querySelector('header a[href="${href}"]').click()`);
    await until(() => evaluate(`location.pathname === '${href}'`));
    assert.equal(await evaluate(() => document.querySelectorAll('main').length), 1);
  }
  await evaluate(() => document.querySelector('header a[href="/account"]').click());
  await until(() => evaluate(() => location.pathname === '/account' && !!document.querySelector('#bestseller-track')));
  await evaluate(() => document.querySelector('#bestseller-track').scrollIntoView({ behavior: 'instant', block: 'center' }));
  const cartScroll = await evaluate(() => scrollY);
  await evaluate(() => { const b = document.querySelector('header nav[aria-label="Khám phá"] button'); b.focus({ preventScroll: true }); b.click(); });
  await until(() => evaluate(() => !!document.querySelector('[aria-label="Đóng giỏ hàng"]')));
  await delay(350);
  assert.equal(await evaluate(() => location.pathname), '/account', 'Cart opens without route navigation');
  assert.ok(Math.abs(await evaluate(() => scrollY) - cartScroll) < 5);
  await screenshot('cart-desktop');
  await key('Escape');
  await until(() => evaluate(() => !document.querySelector('[role="dialog"]')));
  assert.ok(Math.abs(await evaluate(() => scrollY) - cartScroll) < 5);
  await evaluate(() => document.querySelector('#bestseller-track article a').click());
  await until(() => evaluate(() => location.pathname.includes('/account/products/') && !!document.querySelector('h1')));
  assert.equal(await evaluate(() => location.hostname), '127.0.0.1', 'Customer product stays on own site');
  assert.equal(await evaluate(() => document.querySelector('h1').textContent), 'Sữa chống nắng vô cơ sen Hậu Giang');
  await evaluate(() => document.querySelector('button[aria-label="Xem ảnh sản phẩm 2"]').click());
  assert.equal(await evaluate(() => document.querySelector('button[aria-label="Xem ảnh sản phẩm 2"]').getAttribute('aria-pressed')), 'true');
  await until(() => evaluate(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0)));
  await screenshot('product-detail-desktop');
  await navigate('/account/cart');
  await until(() => evaluate(() => !!document.querySelector('[role="dialog"] a[href="/account/products"]')));
  await evaluate(() => document.querySelector('[role="dialog"] a').click());
  await until(() => evaluate(() => location.pathname === '/account/products' && !document.querySelector('[role="dialog"]')));
  console.log('PASS cart drawer: scroll, Escape, direct route, continue shopping; internal product detail and gallery');
  await navigate('/login');
  await until(() => evaluate(() => !!document.querySelector('#login-email')));
  await evaluate(() => document.querySelector('#login-email').focus());
  await send('Input.insertText', { text: 'preview@example.com' });
  await evaluate(() => document.querySelector('#login-password').focus());
  await send('Input.insertText', { text: 'Password1' });
  await evaluate(() => document.querySelector('form').requestSubmit());
  await until(() => evaluate(() => location.pathname === '/account' && !document.querySelector('[role="dialog"]')));
  console.log('PASS customer desktop: register/login redirect, shared layout, navigation, product search and empty state');
  for (const width of [1024, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 780, deviceScaleFactor: 1, mobile: false });
    await navigate('/account');
    await until(() => evaluate(() => !!document.querySelector('header')));
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Customer home does not overflow');
    await evaluate(() => document.querySelector('header button[aria-label="Mở menu"]').click());
    await until(() => evaluate(() => !!document.querySelector('[role="dialog"] nav a[href="/account/products"]')));
    await screenshot(`customer-menu-${width}`);
    await evaluate(() => document.querySelector('[role="dialog"] nav a[href="/account/products"]').click());
    await until(() => evaluate(() => location.pathname === '/account/products' && !document.querySelector('[role="dialog"]')));
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Catalog does not overflow');
    await screenshot(`customer-products-${width}`);
    await evaluate(() => document.querySelector('header button[aria-label="Mở menu"]').click());
    await until(() => evaluate(() => !!document.querySelector('[role="dialog"] nav button')));
    await evaluate(() => document.querySelector('[role="dialog"] nav button').click());
    await until(() => evaluate(() => !!document.querySelector('[aria-label="Đóng giỏ hàng"]') && document.querySelectorAll('[role="dialog"]').length === 1));
    await delay(350);
    assert.equal(await evaluate(() => { const r = document.querySelector('[role="dialog"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }), true, 'Cart fits viewport');
    await screenshot(`cart-${width}`);
    await evaluate(() => document.querySelector('[aria-label="Đóng giỏ hàng"]').click());
    await until(() => evaluate(() => !document.querySelector('[role="dialog"]')));
  }
  console.log('PASS customer responsive: 1024/390/320px menu and catalog');
  for (const width of [1366, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await navigate('/account/orders');
    await until(() => evaluate(() => !!document.querySelector('main [role="alert"]')));
    assert.equal(await evaluate(() => document.querySelectorAll('main article').length), 0, 'API stub does not invent customer orders');
    await evaluate(() => [...document.querySelectorAll('main button')].find(b => b.textContent === 'Xem giao diện mẫu').click());
    await until(() => evaluate(() => document.querySelectorAll('main article').length === 3));
    assert.equal(await evaluate(() => document.querySelectorAll('[aria-label="Lọc đơn hàng"] button:disabled').length), 2);
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Orders fit mobile');
    await evaluate(() => [...document.querySelectorAll('main img')].forEach(img => img.loading = 'eager'));
    await until(() => evaluate(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0)));
    await screenshot(`orders-${width}`);
    await evaluate(() => [...document.querySelectorAll('[aria-label="Lọc đơn hàng"] button')].find(b => b.textContent === 'Đã đánh giá').click());
    assert.equal(await evaluate(() => document.querySelectorAll('main article').length), 2);
    assert.equal(await evaluate(() => document.querySelectorAll('main article h3').length), 3);
    await evaluate(() => [...document.querySelectorAll('[aria-label="Lọc đơn hàng"] button')].find(b => b.textContent === 'Chờ đánh giá').click());
    assert.equal(await evaluate(() => document.querySelectorAll('main article h3').length), 2);
    await evaluate(() => document.querySelector('main input[type="search"]').focus());
    await send('Input.insertText', { text: 'not-found' });
    await until(() => evaluate(() => document.querySelectorAll('main article').length === 0));
  }
  ordersStatus = 200;
  await navigate('/account/orders');
  await until(() => evaluate(() => document.querySelector('main h2')?.textContent === 'Chưa có đơn hàng phù hợp'));
  ordersResponse = { items: [{ id: 81, code: 'TEST-81', orderedAt: '2026-10-20T00:00:00Z', status: 'Completed', totalAmount: 162000, items: [{ id: 91, name: 'Test product', variant: '140ml', quantity: 1, unitPrice: 162000, imageUrl: null, review: null }] }], totalCount: 1 };
  await navigate('/account/orders');
  await until(() => evaluate(() => !!document.querySelector('main a[href="/account/feedback/new?orderItemId=91"]')));
  console.log('PASS orders: 501, explicit preview, disabled tabs, partial reviews, search, responsive, empty and real item review link');
  await evaluate(() => document.querySelector('main a[href="/account/feedback/new?orderItemId=91"]').click());
  await until(() => evaluate(() => !!document.querySelector('main [role="alert"]')));
  assert.equal(await evaluate(() => document.querySelector('main form')), null, 'Unavailable eligibility never permits submission');
  const attachPhotos = async (kind = 'valid', count = 2) => {
    await evaluate(`(() => {
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII='), c => c.charCodeAt(0));
      const transfer = new DataTransfer();
      for (let i = 0; i < ${count}; i++) transfer.items.add(new File([${JSON.stringify(kind)} === 'large' ? new Uint8Array(5 * 1024 * 1024 + 1) : ${JSON.stringify(kind)} === 'broken' ? 'broken' : bytes], 'photo-' + i + '.png', { type: ${JSON.stringify(kind)} === 'wrong' ? 'text/plain' : 'image/png', lastModified: 1 }));
      const input = document.querySelector('input[type="file"]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  };
  for (const width of [1366, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await navigate('/account/feedback/new?preview=1&item=1');
    await until(() => evaluate(() => !!document.querySelector('#review-content')));
    await until(() => evaluate(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0)));
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Review form fits viewport');
    await screenshot(`product-review-${width}`);
    await evaluate(() => document.querySelector('main form').requestSubmit());
    await until(() => evaluate(() => document.querySelectorAll('main [role="alert"]').length === 2));
    await evaluate(() => document.querySelector('[role="radio"][aria-label="4 sao"]').click());
    await evaluate(() => document.querySelector('#review-content').focus());
    await send('Input.insertText', { text: 'San pham phu hop voi toi.' });
    await attachPhotos();
    await until(() => evaluate(() => document.querySelectorAll('[aria-label="Ảnh đính kèm đánh giá"] img').length === 2));
    await screenshot(`review-photos-${width}`);
    await evaluate(() => document.querySelector('main form').requestSubmit());
    await until(() => evaluate(() => document.querySelector('main h2[tabindex]')?.textContent === 'Bản xem trước đánh giá'));
    assert.equal(feedbackSubmissions.length, 0, 'Preview never submits feedback');
    assert.equal(await evaluate(() => document.querySelectorAll('[aria-label="Ảnh đính kèm đánh giá"] img').length), 2);
    await evaluate(() => [...document.querySelectorAll('main button')].find(b => b.textContent === 'Chỉnh sửa bản xem thử').click());
    await until(() => evaluate(() => document.querySelector('#review-content')?.value === 'San pham phu hop voi toi.'));
    await evaluate(() => document.querySelector('[aria-label="Ảnh đính kèm đánh giá"] button').click());
    assert.equal(await evaluate(() => document.querySelectorAll('[aria-label="Ảnh đính kèm đánh giá"] img').length), 1);
    if (width === 1366) {
      for (const kind of ['wrong', 'large', 'broken']) {
        await attachPhotos(kind, 1);
        await until(() => evaluate(() => !!document.querySelector('[aria-labelledby="review-photos-label"] [role="alert"]')));
        assert.equal(await evaluate(() => document.querySelectorAll('[aria-label="Ảnh đính kèm đánh giá"] img').length), 1);
      }
      await attachPhotos('valid', 6);
      await until(() => evaluate(() => document.querySelectorAll('[aria-label="Ảnh đính kèm đánh giá"] img').length === 5));
    }
  }
  reviewableStatus = 200;
  reviewableItems = [{ orderItemId: 91, name: 'Test product', variant: '140ml', imageUrl: null, orderCode: 'TEST-81' }];
  await navigate('/account/feedback/new?orderItemId=91');
  await until(() => evaluate(() => !!document.querySelector('#review-content')));
  await evaluate(() => document.querySelector('[role="radio"][aria-label="5 sao"]').click());
  await evaluate(() => document.querySelector('#review-content').focus());
  await send('Input.insertText', { text: '  Nhan xet that  ' });
  await attachPhotos('valid', 1);
  await until(() => evaluate(() => document.querySelectorAll('[aria-label="Ảnh đính kèm đánh giá"] img').length === 1));
  await evaluate(() => document.querySelector('main form').requestSubmit());
  await until(() => evaluate(() => document.querySelector('main [role="alert"]')?.textContent.includes('Chưa thể gửi ảnh')));
  assert.equal(feedbackSubmissions.length, 0, 'Unsupported attachments are never silently omitted from a real submission');
  await evaluate(() => document.querySelector('[aria-label="Ảnh đính kèm đánh giá"] button').click());
  await evaluate(() => document.querySelector('main form').requestSubmit());
  await until(() => evaluate(() => document.querySelector('main [role="alert"]')?.textContent.includes('chưa khả dụng')));
  assert.equal(await evaluate(() => document.querySelector('#review-content').value), '  Nhan xet that  ');
  assert.deepEqual(feedbackSubmissions[0], { orderItemId: 91, rating: 5, content: 'Nhan xet that' });
  feedbackStatus = 200;
  await evaluate(() => { document.querySelector('main form').requestSubmit(); document.querySelector('main form').requestSubmit(); });
  await until(() => evaluate(() => document.querySelector('main h2[tabindex]')?.textContent === 'Cảm ơn bạn đã chia sẻ!'));
  assert.equal(feedbackSubmissions.length, 2, 'Double submit sends once');
  reviewableItems = [];
  await navigate('/account/feedback/new?orderItemId=91');
  await until(() => evaluate(() => document.querySelector('main h2')?.textContent === 'Chưa có sản phẩm để đánh giá'));
  assert.equal(await evaluate(() => document.querySelector('main form')), null);
  console.log('PASS product review: order link, eligibility, validation, preview without writes, responsive, preserved draft, API success, duplicate protection');
  console.log('PASS review photos: select, preview, remove, limits, invalid files, responsive and no silent attachment loss');
} catch (error) {
  console.log(await evaluate(() => ({
    path: location.pathname,
    focus: document.activeElement?.outerHTML.slice(0, 400),
    options: [...document.querySelectorAll('[role="option"]')].map(e => ({ text: e.textContent, height: e.getBoundingClientRect().height })),
    lists: [...document.querySelectorAll('[role="listbox"]')].map(e => ({ html: e.outerHTML.slice(0, 450), height: e.getBoundingClientRect().height })),
    triggers: [...document.querySelectorAll('[aria-labelledby^="preference-"]')].map(e => e.outerHTML.slice(0, 450)),
  })));
  await screenshot('debug-registration');
  throw error;
} finally {
  if (ws?.readyState === 1) { await send('Browser.close').catch(() => {}); ws.close(); }
  browser.kill(); server.kill();
}
