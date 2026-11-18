import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { picomatchPatches } from './picomatch-extglob-patch.mjs'
import { isPackagePath, verifySourcePatch } from './verified-source-patch.mjs'

const require = createRequire(import.meta.url)
const root = new URL('../../', import.meta.url)
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'))

test('every locked picomatch copy rejects repeated extglobs and preserves build globs', async () => {
  for (const patch of picomatchPatches) {
    const paths = Object.entries(lock.packages)
      .filter(([path, entry]) => isPackagePath(path, 'picomatch') && entry.version === patch.manifest.version)
    assert.ok(paths.length, `No locked picomatch@${patch.manifest.version}`)
    for (const [path] of paths) {
      const directory = fileURLToPath(new URL(`${path}/`, root))
      await verifySourcePatch(patch, directory)
      const picomatch = require(directory)
      for (const pattern of ['+(test|spec)', '*(draft|tmp)', 'src/@(unit|+(integration))/*.js']) {
        assert.throws(() => picomatch.makeRe(pattern), /Repeated extglobs are disabled/)
        assert.throws(() => picomatch.parse(pattern), /Repeated extglobs are disabled/)
      }
      const sourceFile = picomatch('src/**/*.{js,ts,jsx,tsx}')
      assert.ok(sourceFile('src/ui/App.jsx'))
      assert.equal(sourceFile('src/ui/report.json'), false)
      assert.ok(picomatch('src/@(ui|games)/*.js')('src/ui/tools.js'))
    }
  }
})
