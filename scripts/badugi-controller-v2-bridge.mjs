#!/usr/bin/env node
// JSONL stdin/stdout controller bridge. No training or model routing occurs here.
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const source = fileURLToPath(new URL('../src/rl/badugiControllerInteractiveV2Draft.js', import.meta.url));
const temporary = join(tmpdir(), `mgx-d03-v2-bridge-${randomUUID()}.mjs`);
let InteractiveSession;
try {
  await build({ entryPoints: [source], bundle: true, platform: 'node',
    format: 'esm', outfile: temporary, logLevel: 'silent' });
  process.env.NODE_ENV = 'production';
  ({ BadugiControllerInteractiveV2Draft: InteractiveSession } =
    await import(pathToFileURL(temporary).href));
} finally {
  rmSync(temporary, { force: true });
}
let session = null;
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  try {
    const request = JSON.parse(line);
    let response;
    if (request.command === 'reset') {
      session = new InteractiveSession(request);
      response = session.nextHand();
    } else if (request.command === 'step' && session) {
      response = session.step(request.actionIndex);
    } else if (request.command === 'next_hand' && session) {
      response = session.nextHand();
    } else {
      throw new TypeError('bridge expects reset, step or next_hand in an active session');
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ type: 'error', message: String(error?.message ?? error) })}\n`);
  }
}
