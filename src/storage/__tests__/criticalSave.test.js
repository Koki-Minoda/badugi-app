import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveCriticalJson, hasSaveFailure, subscribeSaveFailures, clearSaveFailure } from '../criticalSave.js';
const key = 'mgx.tournament.mtt.active';
afterEach(() => clearSaveFailure(key));
function boundedStorage(entries, limit) {
 const data = new Map(Object.entries(entries));
 return { getItem: key => data.get(key) ?? null, setItem: (key, value) => {
  const next = new Map(data); next.set(key, value);
  if ([...next.values()].reduce((n, v) => n + v.length, 0) > limit) throw new DOMException('Full', 'QuotaExceededError');
  data.set(key, value);
 }};
}
describe('critical tournament saves', () => {
 it('reclaims oldest diagnostic lines while preserving histories, identity and progress', () => {
  const logs = ['oldest'.repeat(10), 'older'.repeat(10), 'recent'.repeat(10), 'newest'.repeat(10)].join('\n');
  const initial = {rl_hand_histories_v1: logs, 'badugi.history.hands': '["replay"]', mgx_auth: 'identity', 'mgx.tournament.v2': 'progress'};
  const storage = boundedStorage(initial, 275), snapshot = {version: 1, payload: 'save'.repeat(25)};
  expect(saveCriticalJson(key, snapshot, {storage})).toBe(true);
  expect(JSON.parse(storage.getItem(key))).toEqual(snapshot);
  expect(storage.getItem('rl_hand_histories_v1')).toBe(logs.split('\n').slice(2).join('\n'));
  for (const name of ['badugi.history.hands', 'mgx_auth', 'mgx.tournament.v2']) expect(storage.getItem(name)).toBe(initial[name]);
  expect(hasSaveFailure()).toBe(false);
 });
 it('preserves the last good save and announces unrecoverable failures, then clears on recovery', () => {
  const storage = boundedStorage({[key]: '{"old":true}'}, 30), listener = vi.fn(), unsubscribe = subscribeSaveFailures(listener);
  expect(saveCriticalJson(key, {large: 'x'.repeat(100)}, {storage})).toBe(false);
  expect(storage.getItem(key)).toBe('{"old":true}'); expect(hasSaveFailure()).toBe(true); expect(listener).toHaveBeenCalledTimes(1);
  expect(saveCriticalJson(key, {ok: true}, {storage})).toBe(true); expect(hasSaveFailure()).toBe(false); expect(listener).toHaveBeenCalledTimes(2); unsubscribe();
 });
 it('does not prune any data when access is denied instead of full', () => {
  const storage = {setItem: () => {throw new DOMException('Denied', 'SecurityError');}, getItem: vi.fn()};
  expect(saveCriticalJson(key, {ok: true}, {storage})).toBe(false); expect(storage.getItem).not.toHaveBeenCalled();
 });
});
