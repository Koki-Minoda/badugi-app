import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyInstalledSourcePatches, applySourcePatch, readSourcePatch, verifySourcePatch } from './verified-source-patch.mjs'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
export const bracesPatch = await readSourcePatch(
  new URL('./patches/braces-3.0.3/', import.meta.url),
  'depth-limit.patch',
  new URL('./braces-depth-patch.test.mjs', import.meta.url),
)

export function verifyBracesPatch(packageDirectory) {
  return verifySourcePatch(bracesPatch, packageDirectory)
}

export function applyBracesPatch(packageDirectory) {
  return applySourcePatch(bracesPatch, packageDirectory)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await applyInstalledSourcePatches(projectRoot, 'braces', [bracesPatch])
}
