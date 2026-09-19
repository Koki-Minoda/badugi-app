// Physical iPhone Safari QA through a single pymobiledevice3 CDP page endpoint.
// Start a production preview on 127.0.0.1:4178 and the USB CDP bridge on :9231.
// Open https://example.com in an explicitly dedicated, foreground Safari tab.
// The local build is supplied as an HTTP fixture on that tab; nothing is published.
// DOM actions test real WebKit app behavior, not physical taps/keyboard or real TLS/network.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { DRAW_RULE_QUESTIONS } from '../../src/ui/learning/drawRuleQuestions.js';
const output = new URL('./simulator-artifacts/', import.meta.url);
await mkdir(output, { recursive: true });
const targets = await (await fetch('http://127.0.0.1:9231/json/list')).json();
const candidates = targets.filter(t => t.url.startsWith('https://example.com/') && (!process.env.MGX_TEST_TAB || t.id === process.env.MGX_TEST_TAB));
assert.equal(candidates.length, 1, 'Open one dedicated Example Domain tab, or set MGX_TEST_TAB to its ID');
const target = candidates[0];
const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map(), errors = [], fixtureErrors = [], passed = [];
let environment;
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
  const r = await fetch('http://127.0.0.1:4178' + url.pathname + url.search);
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
  await until(() => !window.__mgxQaOldDocument && !!document.querySelector('main h1'), undefined, 30000);
  console.log('Loaded', path || '(reload)');
}
const textAt = selector => evaluate(s => document.querySelector(s)?.textContent, selector);
const assertText = (selector, text) => until(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
const pass = name => { passed.push(name); console.log('PASS', name); };
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' }, 10000);
  await writeFile(new URL(`iphone-physical-${name}.png`, output), Buffer.from(r.data, 'base64'));
}
async function finish() {
  for (let i = 0; i < 70; i++) {
    const action = await until(() => {
      if (document.querySelector('[data-testid="practice-result"]')) return 'done';
      return [...document.querySelectorAll('button')].find(b => !b.disabled && /^(チェック|コール \d+|0枚交換する)$/.test(b.textContent.trim()))?.textContent.trim();
    });
    if (action === 'done') return;
    if (action === '0枚交換する') {
      await evaluate(() => document.querySelector('[data-testid="practice-hero-hand"] button').click());
      await click('1枚交換する');
    } else await click(action);
  }
  throw Error('Practice did not finish');
}
try {
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://example.com/*', requestStage: 'Request' }] });
  await navigate('/learn');
  environment = await evaluate(() => ({ userAgent: navigator.userAgent, width: innerWidth, height: innerHeight, scale: visualViewport.scale, pixelRatio: devicePixelRatio, secure: isSecureContext, uuid: typeof crypto.randomUUID }));
  assert.match(environment.userAgent, /iPhone/); assert(environment.secure); assert.equal(environment.uuid, 'function');
  await field('Language', 'ja');
  await assertText('main', '今日やること');
  const normalBefore = await evaluate(() => ({ history: localStorage.getItem('badugi.history.hands'), stats: localStorage.getItem('badugi_player_stats_v1') }));
  await evaluate(() => {
    if (location.origin !== 'https://example.com') throw Error('Unexpected test origin');
    for (const key of ['mgx.learningProgress.v1', 'mgx.practicePresets.v1', 'mgx.handReviews.v1']) localStorage.removeItem(key);
  });
  await navigate('', true);
  await click('種目切り替えのルールを6問');
  const prompt = await textAt('h2');
  const q = DRAW_RULE_QUESTIONS.find(q => q.prompt.ja === prompt);
  assert(q, `Unexpected question: ${prompt}`);
  const correct = q.choices.find(c => c.key === q.answer).ja;
  await click(q.choices.find(c => c.key !== q.answer).ja);
  await until(() => JSON.parse(localStorage.getItem('mgx.learningProgress.v1')).answers && Object.keys(JSON.parse(localStorage.getItem('mgx.learningProgress.v1')).answers).length === 1);
  await click('学習に戻る'); await navigate('', true);
  await click('間違えたクイズを復習（1問）'); await click(correct); await click('結果を見る'); await click('学習に戻る');
  await assertText('[data-testid="learning-totals"]', '50%');
  assert(!await evaluate(() => [...document.querySelectorAll('a')].some(a => a.textContent.includes('間違えたクイズを復習'))));
  pass('quiz wrong answer, reload, retry, 50% and queue removal');
  for (const [index, variant] of ['badugi', 'ace_to_five_triple_draw', 'deuce_to_seven_triple_draw'].entries()) {
    await navigate('/learn/practice'); await field('種目', variant); await sleep(150);
    const selected = await textAt('[aria-label="選んだ手札"]');
    assert((await field('練習条件の名前', `iPhone ${variant}`)).font >= 16);
    await click('現在の条件を保存'); await assertText('[role="status"]', '保存しました'); await navigate('', true);
    await field('保存した練習条件', `iPhone ${variant}`, true); await click('この条件を呼び出す');
    assert.equal((await field('種目')).value, variant); assert.equal(await textAt('[aria-label="選んだ手札"]'), selected);
    await click('この手札で練習する'); await finish(); await shot(`${variant}-finished`); await click('あとで復習に保存');
    const record = await evaluate(() => JSON.parse(localStorage.getItem('mgx.handReviews.v1')).entries[0].hand);
    assert.deepEqual(record.seats.map(s => s.name), ['You', 'CPU 1', 'CPU 2', 'CPU 3', 'CPU 4', 'CPU 5']);
    for (const winner of record.events.find(e => e.type === 'HAND_END').winners) assert.equal(winner.name, record.seats[winner.seat].name);
    await click('同じ開始手札でもう一度'); assert(!await evaluate(() => !!document.querySelector('[data-testid="practice-result"]')));
    await click('条件を変更'); assert.equal(await textAt('[aria-label="選んだ手札"]'), selected); await click('学習に戻る');
    await until(() => scrollY === 0); await assertText('[data-testid="learning-totals"]', `練習完了 ${index + 1}`);
    pass(`${variant}: preset save/reload/load, full hand, save, names, repeat, progress, scroll reset`);
  }
  await navigate('/learn/review');
  const scope = '[data-testid="saved-hand"]';
  await evaluate(() => document.querySelector('[data-testid="saved-hand"] summary').click());
  await click('復習済みにする', scope);
  await field('メモ', 'iPhone physical review', false, scope); await field('タグ（カンマ区切り）', '交換', false, scope); await click('メモとタグを保存', scope);
  await navigate('', true); await evaluate(() => document.querySelector('[data-testid="saved-hand"] summary').click());
  assert.equal((await field('メモ', undefined, false, scope)).value, 'iPhone physical review');
  assert.equal((await field('タグ（カンマ区切り）', undefined, false, scope)).value, '交換');
  await assertText(scope, '復習済み・未復習に戻す'); await click('この開始手札で練習', scope); await until(() => scrollY === 0);
  assert.equal((await field('種目')).value, 'deuce_to_seven_triple_draw');
  pass('review status, notes, tags, reload, transfer starting hand');
  await click('学習に戻る'); await field('Language', 'en'); await assertText('main', 'What to study today');
  const layout = await evaluate(() => ({ width: innerWidth, contentWidth: document.documentElement.scrollWidth, scale: visualViewport.scale }));
  assert(layout.contentWidth <= layout.width + 1); assert.equal(layout.scale, 1);
  assert.deepEqual(await evaluate(() => ({ history: localStorage.getItem('badugi.history.hands'), stats: localStorage.getItem('badugi_player_stats_v1') })), normalBefore);
  assert.deepEqual(errors, []); assert.deepEqual(fixtureErrors, []); await shot('final-progress');
  pass('English dashboard, width, scale, normal stats unchanged, no runtime errors');
  const result = { at: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), method: 'physical iPhone Safari; USB Web Inspector; locally fulfilled HTTP fixture; DOM actions', environment, layout, passed, errors, fixtureErrors };
  await writeFile(new URL('iphone-physical-results.json', output), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('FAIL', String(error));
  await writeFile(new URL('iphone-physical-failure.json', output), JSON.stringify({ environment, passed, errors, fixtureErrors, failure: String(error) }, null, 2));
  try { await shot('failure'); } catch (e) { console.error('Failure screenshot unavailable', String(e)); }
  process.exitCode = 1;
} finally {
  try { await send('Fetch.disable', {}, 3000); } catch { /* device may have disconnected */ }
  socket.close(); for (const p of pending.values()) clearTimeout(p.timer);
}
