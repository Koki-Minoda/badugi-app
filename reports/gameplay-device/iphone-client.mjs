import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
export async function connectDevice() {
const output = new URL('./artifacts/', import.meta.url);
await mkdir(output, { recursive: true });
const targets = await (await fetch('http://127.0.0.1:9231/json/list')).json();
const candidates = targets.filter(t => t.url.startsWith('https://example.com/') && (!process.env.MGX_TEST_TAB || t.id === process.env.MGX_TEST_TAB));
assert.equal(candidates.length, 1, 'Open one dedicated Example Domain tab, or set MGX_TEST_TAB to its ID');
const target = candidates[0];
const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map(), errors = [], fixtureErrors = [], apiResponses = [];

socket.onmessage = ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id);
    if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  } else if (m.method === 'Fetch.requestPaused') {
    void serve(m.params).catch(e => fixtureErrors.push(String(e)));
  } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params);

};
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
function send(method, params = {}, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`${method} timed out`)); }, timeout);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
}
async function serve({ requestId, request }) {
  const url = new URL(request.url);
  if (url.origin !== 'https://example.com') return send('Fetch.continueRequest', { requestId });
  const isApi = url.pathname.startsWith('/api/');
  const headers = {};
  for (const [key, value] of Object.entries(request.headers || {})) if (/^(authorization|content-type|accept)$/i.test(key)) headers[key] = value;
  const r = await fetch((isApi ? 'http://127.0.0.1:8011' : 'http://127.0.0.1:4178') + url.pathname + url.search, { method: request.method, headers, ...(request.postData ? { body: request.postData } : {}) });
  if (isApi) apiResponses.push({ path: url.pathname, method: request.method, status: r.status, hasAuthorization: Object.keys(headers).some(k => k.toLowerCase() === 'authorization') });
  return send('Fetch.fulfillRequest', { requestId, responseCode: r.status, responseHeaders: [{ name: 'Content-Type', value: r.headers.get('content-type') || 'application/octet-stream' }, { name: 'Cache-Control', value: 'no-store' }], body: Buffer.from(await r.arrayBuffer()).toString('base64') });
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(fn, arg) {
  const r = await send('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(arg) ?? ''})`, returnByValue: true, awaitPromise: true });
  if (r.wasThrown || r.exceptionDetails) throw Error(JSON.stringify(r));
  return r.result?.value;
}
async function until(fn, arg, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const result = await evaluate(fn, arg); if (result) return result; await sleep(150); }
  throw Error(`Condition timed out: ${fn} ${JSON.stringify(arg)}`);
}
async function click(name, scope = 'body') {
  await until(({ name, scope }) => {
    const root = document.querySelector(scope);
    const el = [...(root?.querySelectorAll('button,a,summary') || [])].find(e => e.textContent.trim() === name && !e.disabled && e.getClientRects().length);
    if (!el) return false;
    el.scrollIntoView({ block: 'center' }); el.click(); return true;
  }, { name, scope });
  await sleep(120);
}
async function field(label, value, byText = false, scope = 'body') {
  return evaluate(({ label, value, byText, scope }) => {
    const root = document.querySelector(scope);
    const el = [...root.querySelectorAll('input,select,textarea')].find(e => e.getAttribute('aria-label') === label || [...(e.labels || [])].some(l => [...l.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() === label));
    if (!el) throw Error(`Missing field ${label}`);
    if (value === undefined) return { value: el.value, font: parseFloat(getComputedStyle(el).fontSize) };
    const next = byText ? [...el.options].find(o => o.textContent === value)?.value : value;
    if (next === undefined) throw Error(`Missing option ${value}`);
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return { value: el.value, font: parseFloat(getComputedStyle(el).fontSize) };
  }, { label, value, byText, scope });
}
async function navigate(path, reload = false) {
  await evaluate(() => { window.__mgxQaOldDocument = true; });
  await send(reload ? 'Page.reload' : 'Page.navigate', reload ? {} : { url: `https://example.com${path}` });
  await until(() => !window.__mgxQaOldDocument && !!document.querySelector('#root')?.firstElementChild, undefined, 30000);
  console.log('Loaded', path || '(reload)');
}
const textAt = selector => evaluate(s => document.querySelector(s)?.textContent, selector);
const assertText = (selector, text) => until(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' }, 10000);
  await writeFile(new URL(`${name}.png`, output), Buffer.from(r.data, 'base64'));
}

async function start() { await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: 'https://example.com/*', requestStage: 'Request' }] }); }
async function close() { try { await send('Fetch.disable', {}, 3000); } catch {} socket.close(); for (const p of pending.values()) clearTimeout(p.timer); }
return { send, evaluate, until, click, field, navigate, textAt, assertText, shot, start, close, errors, fixtureErrors, apiResponses };

}
