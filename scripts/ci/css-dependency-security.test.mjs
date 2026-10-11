import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { SourceMapConsumer } = require('source-map-js')
const parser = require('postcss-selector-parser')
const originalMap = { version: 3, sources: ['input.js'], names: [], mappings: 'AAAA' }
const section = (line, column = 0, map = originalMap) => ({
  version: 3, sections: [{ offset: { line, column }, map }],
})

test('indexed source maps reject hostile section offsets before expansion', () => {
  for (const value of [Infinity, NaN, -1, 0.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => new SourceMapConsumer(section(value)), /offset/i)
    assert.throws(() => new SourceMapConsumer(section(0, value)), /offset/i)
  }
  assert.throws(() => new SourceMapConsumer(section(1e7 + 1)), /must not exceed/)
  assert.throws(() => new SourceMapConsumer(section(6e6, 0, section(6e6))), /nested/)
})

test('valid indexed source maps preserve original source positions', () => {
  const consumer = new SourceMapConsumer(section(10, 0, section(20)))
  const mappings = []
  consumer.eachMapping((mapping) => mappings.push(mapping))
  assert.equal(mappings.length, 1)
  assert.equal(mappings[0].generatedLine, 31)
  assert.equal(mappings[0].originalLine, 1)
  assert.equal(mappings[0].source, 'input.js')
})

test('flat selector parsing does not amplify work relative to spaced selectors', () => {
  // Same-machine control follows the upstream GHSA-rj75-hqrm-r3gf regression.
  // A child process bounds a reintroduced synchronous CPU exhaustion bug.
  execFileSync(process.execPath, ['--input-type=commonjs', '-e', `
    const assert = require('node:assert/strict');
    const parser = require(${JSON.stringify(require.resolve('postcss-selector-parser'))});
    const fastest = (input) => {
      let best = Infinity;
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        parser().astSync(input);
        best = Math.min(best, performance.now() - start);
      }
      return best;
    };
    for (const atom of ['.a', '#a', '#{a}']) {
      const hostile = fastest(atom.repeat(60000));
      const control = fastest((atom + ' ').repeat(60000));
      assert.ok(hostile / Math.max(control, 1) < 2, atom + ' parsing became super-linear');
    }
  `], { timeout: 30000, stdio: 'pipe' })
})

test('Tailwind escaped classes and nested selector syntax round-trip unchanged', () => {
  for (const selector of [
    '.hover\\:bg-emerald-500:hover',
    '.w-\\[calc\\(100\\%-2rem\\)\\]',
    ':is(.dark .group:hover) .group-hover\\:text-white',
    '& > [data-state="open"]:not(:first-child)',
    '.a.b#c',
  ]) assert.equal(parser().processSync(selector), selector)
})
