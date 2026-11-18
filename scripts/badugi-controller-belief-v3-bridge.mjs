#!/usr/bin/env node
// JSONL stdin/stdout controller bridge. Candidate-only actor-visible range evidence; no training or model routing occurs here.
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const source = fileURLToPath(new URL('../src/rl/badugiControllerBeliefInteractiveV3Draft.js', import.meta.url));
const temporary = join(tmpdir(), `mgx-d03-belief-v3-bridge-${randomUUID()}.mjs`);
let InteractiveSession;
try {
  await build({ entryPoints: [source], bundle: true, platform: 'node',
    format: 'esm', outfile: temporary, logLevel: 'silent' });
  process.env.NODE_ENV = 'production';
  ({ BadugiControllerBeliefInteractiveV3Draft: InteractiveSession } =
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
    } else if (request.command === 'public_pat_response_history' && session) {
      // Diagnostic read of completed hands only; the active hand is still buffered.
      response = { type: 'public_pat_response_history',
        bySeat: session.publicPatResponseHistory.map((row) => ({ byStreet: row.byStreet.map(
          (street) => ({ pat: { ...street.pat }, draw: { ...street.draw } })) })) };
    } else {
      throw new TypeError('bridge expects reset, step, next_hand or public history in an active session');
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ type: 'error', message: String(error?.message ?? error) })}\n`);
  }
}
