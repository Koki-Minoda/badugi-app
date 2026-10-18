import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtemp, cp, rm, appendFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { applyBracesPatch, verifyBracesPatch } from './braces-depth-patch.mjs'

const require = createRequire(import.meta.url)
const packageDirectory = dirname(require.resolve('braces/package.json'))
const braces = require('braces')
const nesting = (depth, open = '{', close = '}') => open.repeat(depth) + 'a' + close.repeat(depth)

test('all public walkers reject hostile nesting with a bounded, descriptive error', () => {
  for (const method of ['parse', 'compile', 'expand', 'stringify']) {
    for (const [open, close] of [['{', '}'], ['(', ')']]) {
      assert.doesNotThrow(() => braces[method](nesting(100, open, close)))
      for (const depth of [101, 3500, 4000]) {
        for (const maxDepth of [undefined, 10000, Infinity]) {
          assert.throws(() => braces[method](nesting(depth, open, close), { maxDepth }), /exceeds max depth/)
        }
      }
    }
    assert.doesNotThrow(() => braces[method]('{a}', { maxDepth: 1.5 }))
    assert.throws(() => braces[method]('{{a}}', { maxDepth: 1.5 }), /exceeds max depth/)
  }
})

test('caller-supplied deep ASTs cannot bypass the parser limit', () => {
  for (const method of ['compile', 'expand', 'stringify']) {
    let ast = { type: 'text', value: 'a' }
    for (let i = 0; i < 4000; i++) ast = { type: 'brace', nodes: [ast] }
    assert.throws(() => braces[method]({ type: 'root', nodes: [ast] }), /exceeds max depth/)
  }
})

test('ordinary build globs and escapeInvalid output stay compatible', () => {
  assert.deepEqual(braces.expand('./src/**/*.{js,ts,jsx,tsx}'), [
    './src/**/*.js', './src/**/*.ts', './src/**/*.jsx', './src/**/*.tsx',
  ])
  assert.deepEqual(braces.expand('a{1..3}'), ['a1', 'a2', 'a3'])
  assert.deepEqual(braces.expand('foo/({a,b})'), ['foo/(a)', 'foo/(b)'])
  for (const pattern of ['{{a}}', '{a,{b}}', '{{x}y}', '{a,{b,{c}}', '{}{a}']) {
    assert.equal(braces.stringify(braces.parse(pattern), { escapeInvalid: true }), pattern)
  }
})

test('cyclic AST parent links are rejected without hanging the build', () => {
  for (const selfReference of [true, false]) {
    const ast = { type: 'paren', nodes: [{ type: 'text', value: 'a' }] }
    ast.parent = selfReference ? ast : { type: 'paren', parent: ast }
    assert.throws(
      () => runInNewContext('braces.expand(ast)', { braces, ast }, { timeout: 250 }),
      /AST parent chain contains a cycle/,
    )
  }
})

test('protection is verified, idempotent, and fails closed for unpatched/tampered code', async () => {
  await verifyBracesPatch(packageDirectory)
  const temporary = await mkdtemp(resolve(tmpdir(), 'mgx-braces-test-'))
  try {
    await cp(packageDirectory, temporary, { recursive: true })
    await applyBracesPatch(temporary)
    const patch = fileURLToPath(new URL('./patches/braces-3.0.3/depth-limit.patch', import.meta.url))
    execFileSync('git', ['apply', '--no-index', '--reverse', patch], { cwd: temporary })
    await assert.rejects(verifyBracesPatch(temporary), /checksum mismatch/)
    await applyBracesPatch(temporary)
    await verifyBracesPatch(temporary)
    await appendFile(resolve(temporary, 'lib/parse.js'), '\n// unexpected modification\n')
    await assert.rejects(verifyBracesPatch(temporary), /checksum mismatch/)
    await assert.rejects(applyBracesPatch(temporary), /checksum mismatch/)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
