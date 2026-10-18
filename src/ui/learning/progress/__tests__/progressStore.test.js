import { afterEach, expect, it, vi } from 'vitest';
import { PROGRESS_STORAGE_KEY, MAX_PROGRESS_RECORDS, readLearningProgress, recordPracticeCompletion, recordQuizAnswer, setReviewCompleted, progressSummary, localDay } from '../progressStore.js';
const hand = { handId: 'practice-1', variantId: 'badugi', mode: 'practice', endedAt: new Date(2026, 8, 13, 12).getTime() };
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
it('counts only completed practice hands once, independently of ordinary history', () => {
  localStorage.setItem('badugi.history.hands', 'sentinel');
  expect(() => recordPracticeCompletion({ ...hand, endedAt: undefined })).toThrow('invalid');
  expect(() => recordPracticeCompletion({ ...hand, mode: 'cash' })).toThrow('invalid');
  recordPracticeCompletion(hand); recordPracticeCompletion(hand);
  recordPracticeCompletion({ ...hand, handId: 'practice-2' });
  expect(progressSummary(readLearningProgress().data).practiceCount).toBe(2);
  expect(localStorage.getItem('badugi.history.hands')).toBe('sentinel');
});
it('counts attempts, rejects duplicate delivery, and removes corrected questions from the missed queue', () => {
  const answer = { attemptId: 'first', questionId: 'badugi-0', correct: false };
  recordQuizAnswer(answer, 100); recordQuizAnswer(answer, 100);
  recordQuizAnswer({ ...answer, attemptId: 'retry', correct: true }, 100);
  recordQuizAnswer({ attemptId: 'third', questionId: 'low8-0', correct: false }, 101);
  const summary = progressSummary(readLearningProgress().data);
  expect(summary).toMatchObject({ answerCount: 3, correct: 1, accuracy: 33, missedIds: ['low8-0'] });
});
it('uses the local calendar day and counts only still-saved reviewed hands', () => {
  const now = new Date(2026, 8, 14, 0, 1).getTime();
  const yesterday = new Date(2026, 8, 13, 23, 59).getTime();
  expect(localDay(now)).not.toBe(localDay(yesterday));
  recordPracticeCompletion({ ...hand, endedAt: yesterday });
  recordPracticeCompletion({ ...hand, handId: 'today', endedAt: now });
  recordQuizAnswer({ attemptId: 'a', questionId: 'q', correct: true }, now);
  setReviewCompleted('kept', true, now); setReviewCompleted('removed', true, now);
  const entries = [{ key: 'kept' }, { key: 'pending' }];
  expect(progressSummary(readLearningProgress().data, entries, now)).toMatchObject({ practiceCount: 2, todayPractices: 1, todayAnswers: 1, todayReviewed: 1, reviewedCount: 1, pendingCount: 1 });
  setReviewCompleted('kept', true, now + 1);
  expect(readLearningProgress().data.reviewed.kept).toBe(now);
  setReviewCompleted('kept', false);
  expect(progressSummary(readLearningProgress().data, entries, now).reviewedCount).toBe(0);
});
it.each(['{broken', JSON.stringify({ version: 2, practices: {}, answers: {}, reviewed: {} }), JSON.stringify({ version: 1, practices: {}, answers: { x: { questionId: 'q', correct: 'yes', at: 1 } }, reviewed: {} })])('does not overwrite unreadable progress %s', raw => {
  localStorage.setItem(PROGRESS_STORAGE_KEY, raw);
  expect(readLearningProgress().error).toBe('unreadable');
  expect(() => recordPracticeCompletion(hand)).toThrow('unreadable');
  expect(() => setReviewCompleted('key', true)).toThrow('unreadable');
  expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(raw);
});
it('handles a write failure and a later retry without double counting', () => {
  recordPracticeCompletion(hand);
  const original = localStorage.getItem(PROGRESS_STORAGE_KEY);
  const mock = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(() => recordQuizAnswer({ attemptId: 'x', questionId: 'q', correct: false })).toThrow('storage');
  expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(original);
  mock.mockRestore();
  recordQuizAnswer({ attemptId: 'x', questionId: 'q', correct: false });
  recordQuizAnswer({ attemptId: 'x', questionId: 'q', correct: false });
  expect(progressSummary(readLearningProgress().data).answerCount).toBe(1);
});
it('preserves records at the storage limit and still permits undoing a reviewed mark', () => {
  const data = { version: 1, practices: {}, answers: {}, reviewed: Object.fromEntries(Array.from({ length: MAX_PROGRESS_RECORDS }, (_, i) => [`r${i}`, 1])) };
  const raw = JSON.stringify(data); localStorage.setItem(PROGRESS_STORAGE_KEY, raw);
  expect(() => recordPracticeCompletion(hand)).toThrow('limit');
  expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(raw);
  setReviewCompleted('r0', false);
  recordPracticeCompletion(hand);
  expect(progressSummary(readLearningProgress().data).practiceCount).toBe(1);
});
