export const PROGRESS_STORAGE_KEY = 'mgx.learningProgress.v1';
export const PROGRESS_CHANGE_EVENT = 'mgx-learning-progress-changed';
export const MAX_PROGRESS_RECORDS = 5000;
const empty = () => ({ version: 1, practices: {}, answers: {}, reviewed: {} });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const time = value => Number.isFinite(value) && value > 0;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 2000;
const count = data => Object.keys(data.practices).length + Object.keys(data.answers).length + Object.keys(data.reviewed).length;
export function readLearningProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return { data: empty(), error: null };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !['practices', 'answers', 'reviewed'].every(key => object(data[key])) || count(data) > MAX_PROGRESS_RECORDS ||
      Object.entries(data.practices).some(([id, entry]) => !text(id) || !object(entry) || !text(entry.variant) || !time(entry.at)) ||
      Object.entries(data.answers).some(([id, entry]) => !text(id) || !object(entry) || !text(entry.questionId) || typeof entry.correct !== 'boolean' || !time(entry.at)) ||
      Object.entries(data.reviewed).some(([id, at]) => !text(id) || !time(at))) throw new Error('unreadable');
    return { data, error: null };
  } catch { return { data: empty(), error: 'unreadable' }; }
}
function update(change) {
  const state = readLearningProgress();
  if (state.error) throw new Error(state.error);
  const next = change(state.data);
  if (next === state.data) return;
  if (count(next) > MAX_PROGRESS_RECORDS) throw new Error('limit');
  try { localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next)); }
  catch { throw new Error('storage'); }
  window.dispatchEvent(new Event(PROGRESS_CHANGE_EVENT));
}
export function recordPracticeCompletion(hand) {
  if (!text(hand?.handId) || hand.mode !== 'practice' || !text(hand.variantId) || !time(hand.endedAt)) throw new Error('invalid');
  update(data => Object.hasOwn(data.practices, hand.handId) ? data : { ...data, practices: { ...data.practices, [hand.handId]: { variant: hand.variantId, at: hand.endedAt } } });
}
export function recordQuizAnswer({ attemptId, questionId, correct }, at = Date.now()) {
  if (!text(attemptId) || !text(questionId) || typeof correct !== 'boolean' || !time(at)) throw new Error('invalid');
  update(data => Object.hasOwn(data.answers, attemptId) ? data : { ...data, answers: { ...data.answers, [attemptId]: { questionId, correct, at } } });
}
export function setReviewCompleted(key, completed, at = Date.now()) {
  if (!text(key) || typeof completed !== 'boolean' || !time(at)) throw new Error('invalid');
  update(data => {
    if (completed === Object.hasOwn(data.reviewed, key)) return data;
    const reviewed = { ...data.reviewed };
    if (completed) reviewed[key] = at; else delete reviewed[key];
    return { ...data, reviewed };
  });
}
export function localDay(at) {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function progressSummary(data, reviewEntries = [], now = Date.now()) {
  const practices = Object.values(data.practices);
  const answers = Object.values(data.answers);
  const reviewed = reviewEntries.filter(entry => Object.hasOwn(data.reviewed, entry.key));
  const today = at => localDay(at) === localDay(now);
  const correct = answers.filter(answer => answer.correct).length;
  const latest = new Map();
  // Insertion order resolves answers submitted in the same millisecond.
  for (const answer of answers) if (!latest.has(answer.questionId) || latest.get(answer.questionId).at <= answer.at) latest.set(answer.questionId, answer);
  return { practiceCount: practices.length, answerCount: answers.length, correct, accuracy: answers.length ? Math.round(correct / answers.length * 100) : null,
    reviewedCount: reviewed.length, pendingCount: reviewEntries.length - reviewed.length,
    todayPractices: practices.filter(entry => today(entry.at)).length, todayAnswers: answers.filter(entry => today(entry.at)).length,
    todayReviewed: reviewed.filter(entry => today(data.reviewed[entry.key])).length,
    missedIds: [...latest.values()].filter(answer => !answer.correct).map(answer => answer.questionId) };
}
export function progressError(code, ja) {
  const messages = {
    unreadable: ['学習記録を読み込めません。既存データは変更していません。', 'Learning progress could not be read. Existing data has not been changed.'],
    limit: ['学習記録が保存上限に達しました。今回の進捗は保存できません。', 'Learning progress storage is full. This progress could not be saved.'],
    storage: ['学習の進捗を保存できませんでした。', 'Could not save learning progress.'],
  };
  return (messages[code] ?? messages.storage)[ja ? 0 : 1];
}
