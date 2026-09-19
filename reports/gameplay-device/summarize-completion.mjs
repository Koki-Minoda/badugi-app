import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const runs = [
  'completion-final', 'usability-last', 'preview-ten-final', 'preview-portrait-final',
  'mobile-all-final', 'regression-after-auth', 'variant-tournament-final',
  'multi-natural-final', 'multi-stage-natural-final', 'multi-hud-final',
];
const suites = [];
for (const run of runs) {
  let report;
  try { report = JSON.parse(await readFile(new URL(`artifacts/${run}.json`, root), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const tests = [];
  function walk(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const result = test.results.at(-1);
      // Only copy test names, statuses, timings and the explicitly anonymous hand counts.
      // Raw error messages, stdout, credentials and browser state remain local.
      const item = { title: spec.title, project: test.projectName, status: result?.status, durationMs: result?.duration };
      const attachment = result?.attachments?.find(a => a.name === 'natural-completion');
      if (attachment?.body) item.naturalCompletion = JSON.parse(Buffer.from(attachment.body, 'base64').toString());
      tests.push(item);
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  for (const suite of report.suites) walk(suite);
  suites.push({ run, startedAt: report.stats.startTime, durationMs: report.stats.duration, tests });
}
await writeFile(new URL('completion-evidence.json', root), JSON.stringify({
  generatedAt: new Date().toISOString(), baselineCommit: 'bc35b25', implementationCommit: '9d72e29',
  unitChecks: [{ scope: 'related frontend suites', files: 37, passed: 266 }, { scope: 'all variant progression', files: 2, passed: 54 }, { scope: 'final Player, HandResultOverlay, MultiGame', files: 3, passed: 40 }, { scope: 'all backend tests', passed: 83 }],
  notes: ['Each suite records its own run; overlapping runs are not distinct feature counts.', 'The initial stage natural-play audit failed because the progress key omitted the Stud street. See the later multi-stage-natural-final run.', 'Browser device emulation is not physical-device verification.'], suites,
}, null, 2) + '\n');
