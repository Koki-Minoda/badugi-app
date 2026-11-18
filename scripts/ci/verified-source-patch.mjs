import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function readSourcePatch(directory, patchName, testFile) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'))
  return {
    manifest,
    patchFile: fileURLToPath(new URL(patchName, directory)),
    testFile: fileURLToPath(testFile),
  }
}

export function isPackagePath(path, name) {
  return path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)
}

export async function verifySourcePatch(patch, directory, state = 'patched') {
  const { manifest } = patch
  const metadata = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'))
  if (metadata.name !== manifest.package || metadata.version !== manifest.version) {
    throw new Error(`Unexpected ${manifest.package} package at ${directory}`)
  }
  for (const [file, hashes] of Object.entries(manifest.files)) {
    const bytes = await readFile(resolve(directory, file))
    const hash = createHash('sha256').update(bytes).digest('hex')
    if (hash !== hashes[state]) {
      throw new Error(`${manifest.package} source patch: ${state} checksum mismatch for ${file} in ${directory}`)
    }
  }
}

export async function applySourcePatch(patch, directory) {
  try {
    await verifySourcePatch(patch, directory)
    return
  } catch {
    // Only the exact published source can be patched.
    await verifySourcePatch(patch, directory, 'original')
  }
  // Keep source checksums identical on Windows when core.autocrlf is enabled.
  execFileSync('git', ['-c', 'core.autocrlf=false', 'apply', '--no-index', patch.patchFile], {
    cwd: directory, stdio: 'pipe',
  })
  await verifySourcePatch(patch, directory)
}

export async function applyInstalledSourcePatches(root, name, patches) {
  const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'))
  for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
    if (!isPackagePath(path, name)) continue
    const directory = resolve(root, path)
    // npm ci --omit=dev legitimately omits development dependencies.
    try { await readFile(resolve(directory, 'package.json')) } catch (error) {
      if (error.code === 'ENOENT' && metadata.dev) continue
      throw error
    }
    const patch = patches.find(({ manifest }) => manifest.version === metadata.version)
    if (!patch) throw new Error(`No source patch for ${name}@${metadata.version} at ${path}`)
    await applySourcePatch(patch, directory)
    console.log(`Verified ${patch.manifest.advisory} source patch: ${path}`)
  }
}
