import {getProgressState} from './gameProgressHelper.js';

export async function clickHeroAction(page, testId, {timeout = 5000} = {}) {
  try {
    await page.getByTestId(testId).first().click({timeout});
    return true;
  } catch (error) {
    const visible = await page.getByTestId('hand-result-overlay').isVisible();
    const progress = await getProgressState(page);
    const phases = [progress.snapshot?.phase, progress.snapshot?.street,
      progress.phaseState?.phase, progress.state?.phase];
    const settled = phases.some(phase => ['SHOWDOWN','HAND_RESULT','WAITING_NEXT_HAND','COMPLETE','TERMINAL'].includes(String(phase)))
      || progress.snapshot?.lastHandResult || progress.state?.lastHandResult;
    if (visible && settled) return false;
    throw error;
  }
}
