#!/usr/bin/env node
// Offline JSONL real-controller initial-deal screen; no policy action.
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const source = fileURLToPath(new URL('../src/rl/badugiFourCardRangeScreenDraft.js', import.meta.url));
const temporary = join(tmpdir(), `mgx-d03-four-card-screen-${randomUUID()}.mjs`);
let screen;
try {
  await build({ entryPoints: [source], bundle: true, platform: 'node',
    format: 'esm', outfile: temporary, logLevel: 'silent' });
  process.env.NODE_ENV = 'production';
  ({ screenFourCardRangeInitialDealDraft: screen } =
    await import(pathToFileURL(temporary).href));
} finally {
  rmSync(temporary, { force: true });
}
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  process.stdout.write(`${JSON.stringify(screen(JSON.parse(line)))}\n`);
}
