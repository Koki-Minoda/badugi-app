import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const patchDirectory = fileURLToPath(new URL('./patches/braces-3.0.3/', import.meta.url))
const manifest = JSON.parse(await readFile(resolve(patchDirectory, 'manifest.json'), 'utf8'))
const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
export const patchedAdvisory = manifest.advisory

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export async function verifyBracesPatch(packageDirectory, state = 'patched') {
  const metadata = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'))
  if (metadata.name !== manifest.package || metadata.version !== manifest.version) {
    throw new Error(`Unexpected braces package at ${packageDirectory}`)
  }
  for (const [file, hashes] of Object.entries(manifest.files)) {
    const bytes = await readFile(resolve(packageDirectory, file))
    if (sha256(bytes) !== hashes[state]) {
      throw new Error(`braces depth protection: ${state} checksum mismatch for ${file}`)
    }
  }
}

export async function applyBracesPatch(packageDirectory) {
  try {
    await verifyBracesPatch(packageDirectory)
    return
  } catch {
    // Only the exact published source can be patched. A partial/tampered
    // installation must fail, not be silently repaired or marked protected.
    await verifyBracesPatch(packageDirectory, 'original')
  }
  execFileSync('git', ['apply', '--no-index', resolve(patchDirectory, 'depth-limit.patch')], {
    cwd: packageDirectory, stdio: 'pipe',
  })
  await verifyBracesPatch(packageDirectory)
}

export async function applyInstalledBracesPatches(root = projectRoot) {
  const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'))
  for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
    if (!packagePath.endsWith('node_modules/braces')) continue
    const packageDirectory = resolve(root, packagePath)
    // npm ci --omit=dev legitimately omits this build-time dependency.
    try { await readFile(resolve(packageDirectory, 'package.json')) } catch (error) {
      if (error.code === 'ENOENT' && metadata.dev) continue
      throw error
    }
    await applyBracesPatch(packageDirectory)
    console.log(`Applied and verified ${patchedAdvisory} depth protection: ${packagePath}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await applyInstalledBracesPatches()
}
