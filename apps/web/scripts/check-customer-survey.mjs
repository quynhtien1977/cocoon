// Run after a frontend build: node --import tsx scripts/check-customer-survey.mjs
// The API below is an isolated browser-test fixture; no real API or database is used.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { previewCustomerSurvey } from '../features/customer/survey-response.fixture.ts';

const detailStatus = 200;
let submitStatus = 501;
const writes = [], errors = [], apiReads = [];
const survey = { ...previewCustomerSurvey('1'), id: 81 };
const api = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (!request.headers.cookie?.includes('access_token=survey-browser-fixture')) return response.writeHead(401).end('{}');
  const path = new URL(request.url, 'http://localhost').pathname;
  apiReads.push(path);
  if (path === '/api/v1/me') return response.end(JSON.stringify({ id: 41, role: 'Customer' }));
  if (path === '/api/v1/me/notifications') return response.end('[]');
  if (path === '/api/v1/me/surveys') return response.end(JSON.stringify([{ id: 81, title: survey.title, description: survey.description, category: 'Chăm sóc da', completedAt: null, closeAt: null, questionCount: 8, estimatedMinutes: 3, googleFormUrl: null }]));
  if (path === '/api/v1/me/surveys/81') return response.writeHead(detailStatus).end(JSON.stringify(detailStatus === 200 ? survey : {}));
  if (path === '/api/v1/me/surveys/81/responses') {
    let body = ''; for await (const chunk of request) body += chunk;
    writes.push(JSON.parse(body));
    await delay(200);
    return response.writeHead(submitStatus).end(submitStatus === 204 ? '' : '{}');
  }
  response.writeHead(404).end('{}');
});
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3196', '--hostname', '127.0.0.1'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, API_URL: `http://127.0.0.1:${api.address().port}` } });
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--no-first-run', '--remote-debugging-port=9296', '--user-data-dir=' + resolve(tmpdir(), 'cocoon-customer-survey-browser'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, sequence = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => reject(Error(method)), 15000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(fn) {
  const result = await send('Runtime.evaluate', { expression: `(${fn.toString()})()`, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(fn) { for (let i = 0; i < 150; i++) { if (await fn().catch(() => false)) return; await delay(100); } throw Error('Browser check timed out'); }
async function go(path) { await send('Page.navigate', { url: `http://127.0.0.1:3196${path}` }); await until(() => evaluate(() => !!document.querySelector('[role="progressbar"]'))); }
async function next() { await evaluate(() => document.querySelector('form[aria-busy] button[type="submit"]').click()); }
try {
  await until(async () => (await fetch('http://127.0.0.1:3196/', { signal: AbortSignal.timeout(1000) })).ok);
  let target;
  await until(async () => { target = (await (await fetch('http://127.0.0.1:9296/json')).json()).find(item => item.type === 'page'); return !!target; });
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (request) { clearTimeout(request.timer); pending.delete(message.id); if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused') {
      const paused = message.params;
      const url = new URL(paused.request.url);
      void (async () => {
        const response = await fetch(`http://127.0.0.1:${api.address().port}${url.pathname}${url.search}`, { method: paused.request.method, headers: { Cookie: 'access_token=survey-browser-fixture', 'Content-Type': 'application/json' }, body: paused.request.postData });
        await send('Fetch.fulfillRequest', { requestId: paused.requestId, responseCode: response.status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(await response.text()).toString('base64') });
      })().catch(error => errors.push(String(error)));
    }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "if (location.pathname === '/account/surveys/1' && location.search.includes('preview=1')) localStorage.clear();" });
  await send('Network.setCookie', { name: 'access_token', value: 'survey-browser-fixture', url: 'http://127.0.0.1:3196', path: '/' });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  await mkdir('.next/survey-previews', { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
    await go('/account/surveys/1?preview=1');
    await next();
    await until(() => evaluate(() => !!document.querySelector('form [role="alert"]')));
    await evaluate(() => document.querySelector('input[type="radio"]').click()); await next();
    await until(() => evaluate(() => !!document.querySelector('input[type="checkbox"]')));
    await evaluate(() => document.querySelector('input[type="checkbox"]').click()); await next();
    await until(() => evaluate(() => document.querySelector('h2')?.textContent === 'Loại da hiện tại của bạn là gì?'));
    await evaluate(() => document.querySelectorAll('input[type="radio"]')[1].click());
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow at ${width}`);
    assert.equal(await evaluate(() => getComputedStyle(document.querySelector('fieldset > div')).display), 'grid', 'Tailwind lays choices out in separate rows');
    assert.ok(await evaluate(() => parseFloat(getComputedStyle(document.querySelector('h2')).fontSize) >= 26), 'Question heading has the designed typography');
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`.next/survey-previews/customer-survey-${width}.png`, Buffer.from(shot.data, 'base64'));
  }
  assert.equal(writes.length, 0, 'Preview never submits real answers');
  await evaluate(() => localStorage.clear());
  await go('/account/surveys/81');
  await evaluate(() => document.querySelector('input[type="radio"]').click()); await next();
  await until(() => evaluate(() => !!document.querySelector('input[type="checkbox"]')));
  await evaluate(() => document.querySelector('input[type="checkbox"]').click());
  await evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Lưu & thoát')).click());
  await until(() => evaluate(() => location.pathname === '/account/surveys' && !!document.querySelector('a[aria-label^="Làm khảo sát:"]')));
  await evaluate(() => document.querySelector('a[aria-label^="Làm khảo sát:"]').click());
  await until(() => evaluate(() => !!document.querySelector('input[type="checkbox"]:checked')));
  for (let index = 1; index < survey.questions.length; index++) {
    const question = survey.questions[index];
    await until(async () => (await send('Runtime.evaluate', { expression: `document.querySelector('h2')?.textContent === ${JSON.stringify(question.text)}`, returnByValue: true })).result.value);
    await send('Runtime.evaluate', { expression: `(() => { const field = document.querySelector('fieldset'); const input = field?.querySelector('input'); if (input && !input.checked) input.click(); const star = field?.querySelector('[role="radio"]'); if (star) star.click(); })()` });
    await next();
  }
  await until(() => evaluate(() => document.querySelector('h2')?.textContent === 'Xem lại câu trả lời'));
  await next();
  await until(() => evaluate(() => !!document.querySelector('form [role="alert"]')));
  assert.equal(writes.length, 1);
  assert.equal(await evaluate(() => document.body.textContent.includes('Cảm ơn bạn đã chia sẻ!')), false);
  submitStatus = 204;
  await evaluate(() => { const button = document.querySelector('form[aria-busy] button[type="submit"]'); button.click(); button.click(); });
  await until(() => evaluate(() => document.body.textContent.includes('Cảm ơn bạn đã chia sẻ!')));
  assert.equal(writes.length, 2, 'Double click sends one request');
  assert.equal(await evaluate(() => localStorage.getItem('cocoon:survey-draft:v1:41:81')), null);
  assert.deepEqual(writes[1].answers[0], { questionId: 1, optionIds: [11], numericValue: null, textValue: null });
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS customer survey: responsive choices, required validation, sample isolation, save/resume, preview, API failure/retry, duplicate protection and draft cleanup.');
} catch (error) {
  console.error('Survey browser diagnostic:', await evaluate(() => ({ path: location.pathname, body: document.body.innerText.slice(0, 1400) })).catch(() => null), apiReads, errors);
  throw error;
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  ws?.close(); browser.kill(); server.kill(); api.closeAllConnections(); api.close();
}
