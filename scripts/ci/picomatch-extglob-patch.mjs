import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyInstalledSourcePatches, readSourcePatch } from './verified-source-patch.mjs'

const testFile = new URL('./picomatch-extglob-patch.test.mjs', import.meta.url)
export const picomatchPatches = await Promise.all(['2.3.2', '4.0.7'].map(version => readSourcePatch(
  new URL(`./patches/picomatch-${version}/`, import.meta.url),
  'disable-repeated-extglob.patch',
  testFile,
)))

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await applyInstalledSourcePatches(fileURLToPath(new URL('../../', import.meta.url)), 'picomatch', picomatchPatches)
}
