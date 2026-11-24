#!/usr/bin/env node
// Offline JSONL initial-deal screen; it never emits a policy action.
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const source = fileURLToPath(new URL('../src/rl/badugiFiveLowInitialScreenDraft.js', import.meta.url));
const temporary = join(tmpdir(), `mgx-d03-a5-screen-${randomUUID()}.mjs`);
let screen;
try {
  await build({ entryPoints: [source], bundle: true, platform: 'node',
    format: 'esm', outfile: temporary, logLevel: 'silent' });
  process.env.NODE_ENV = 'production';
  ({ screenFiveLowInitialDealDraft: screen } = await import(pathToFileURL(temporary).href));
} finally {
  rmSync(temporary, { force: true });
}
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  const request = JSON.parse(line);
  process.stdout.write(`${JSON.stringify(screen(request))}\n`);
}
