// Read-only diagnostic: exercise cold ONNX initialization in the same Linux
// WebKit build used by release-candidate-browser-qa. No model is trained or
// published, and this script does not change the application's runtime.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { platform, release, arch } from 'node:os';
import { devices, webkit } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3000/dev/';
const rounds = Number(process.env.MGX_ORT_DIAGNOSTIC_ROUNDS ?? 60);
const concurrency = Number(process.env.MGX_ORT_DIAGNOSTIC_CONCURRENCY ?? 2);
const reportPath = process.env.MGX_ORT_DIAGNOSTIC_REPORT ?? 'webkit-ort-init-diagnostic.json';
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 200 ||
    !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
  throw new Error('Diagnostic rounds must be 1..200 and concurrency must be 1..4');
}

const readOptional = (path) => {
  try { return readFileSync(path, 'utf8').trim(); } catch { return null; }
};
const memorySnapshot = () => ({
  cgroupCurrent: readOptional('/sys/fs/cgroup/memory.current'),
  cgroupMax: readOptional('/sys/fs/cgroup/memory.max'),
  cgroupEvents: readOptional('/sys/fs/cgroup/memory.events'),
  memAvailable: readOptional('/proc/meminfo')?.match(/^MemAvailable:\s+(.+)$/m)?.[1] ?? null,
  processes: (() => {
    try {
      const [header, ...rows] = execFileSync('ps', ['-eo', 'pid,ppid,rss,comm'], { encoding: 'utf8' })
        .trim().split('\n');
      return [header, ...rows.sort((a, b) => Number(b.trim().split(/\s+/)[2]) -
        Number(a.trim().split(/\s+/)[2])).slice(0, 14)];
    } catch { return null; }
  })(),
});
const wasmPath = 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm';
const report = {
  sourceSha: process.env.GITHUB_SHA ?? null,
  platform: { platform: platform(), release: release(), arch: arch(), node: process.version },
  wasmSha256: createHash('sha256').update(readFileSync(wasmPath)).digest('hex'),
  rounds, concurrency, samples: [], attempts: [],
};
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2));
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '3000'], {
  stdio: 'ignore', detached: true,
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 120; i += 1) {
    try { if ((await fetch(baseUrl)).ok) { ready = true; break; } } catch { /* server starting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Vite server did not start within 60 seconds');
  browser = await webkit.launch();
  report.browserVersion = browser.version();
  report.samples.push({ round: -1, memory: memorySnapshot() });
  for (let round = 0; round < rounds; round += 1) {
    const attempts = await Promise.all(Array.from({ length: concurrency }, async (_, slot) => {
      const context = await browser.newContext({ ...devices['iPhone 13 landscape'] });
      const page = await context.newPage();
      try {
        await page.goto(baseUrl);
        return await page.evaluate(async () => {
          const environment = {
            crossOriginIsolated: self.crossOriginIsolated,
            sharedArrayBuffer: typeof SharedArrayBuffer,
            hardwareConcurrency: navigator.hardwareConcurrency,
            userAgent: navigator.userAgent,
          };
          const start = performance.now();
          try {
            const { getOrt } = await import('/dev/src/ai/onnxExecutor.js');
            const ort = await getOrt();
            if (!ort) throw new Error('getOrt returned null');
            const session = await ort.InferenceSession.create(
              '/dev/models/badugi_pro_controller_v2_20261105.onnx');
            await session.release();
            return { ok: true, elapsedMs: performance.now() - start,
              numThreads: ort.env.wasm.numThreads, environment };
          } catch (error) {
            return { ok: false, elapsedMs: performance.now() - start,
              error: String(error), stack: error?.stack ?? null, environment };
          }
        });
      } catch (error) {
        return { ok: false, error: String(error), stack: error?.stack ?? null };
      } finally {
        await context.close();
      }
    }).map(async (promise, slot) => ({ round, slot, ...(await promise) })));
    report.attempts.push(...attempts);
    if (round % 5 === 0 || attempts.some(attempt => !attempt.ok)) {
      report.samples.push({ round, memory: memorySnapshot() });
      console.log(JSON.stringify({ round, successes: report.attempts.filter(x => x.ok).length,
        failures: report.attempts.filter(x => !x.ok).length,
        cgroupCurrent: report.samples.at(-1).memory.cgroupCurrent }));
      save();
    }
  }
  report.samples.push({ round: rounds, memory: memorySnapshot() });
  save();
  if (report.attempts.some(attempt => !attempt.ok)) process.exitCode = 1;
} catch (error) {
  report.fatal = { error: String(error), stack: error?.stack ?? null };
  save();
  process.exitCode = 1;
} finally {
  await browser?.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already exited */ }
}
