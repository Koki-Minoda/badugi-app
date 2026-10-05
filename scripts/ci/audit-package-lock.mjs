#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { patchedAdvisory, verifyBracesPatch } from './braces-depth-patch.mjs'

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch'

const args = new Set(process.argv.slice(2))
const omitDev = args.has('--omit-dev')

const lockfile = JSON.parse(await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'))
if (lockfile.lockfileVersion !== 3 || !lockfile.packages) {
  throw new Error('Expected a package-lock v3 file with a packages map')
}

const dependencies = {}
for (const [packagePath, metadata] of Object.entries(lockfile.packages)) {
  if (!packagePath || !metadata.version || (omitDev && metadata.dev === true)) continue
  const marker = 'node_modules/'
  const markerIndex = packagePath.lastIndexOf(marker)
  if (markerIndex < 0) continue
  const name = packagePath.slice(markerIndex + marker.length)
  if (!name) continue
  dependencies[name] ??= []
  if (!dependencies[name].includes(metadata.version)) dependencies[name].push(metadata.version)
}

const queries = Object.entries(dependencies).flatMap(([name, versions]) =>
  versions.map((version) => ({ package: { name, ecosystem: 'npm' }, version })),
)

async function fetchAdvisories(attempt = 1) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(OSV_BATCH_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'mgx-lockfile-audit/1.0',
      },
      body: JSON.stringify({ queries }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`registry returned HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (attempt >= 3) throw error
    await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt))
    return fetchAdvisories(attempt + 1)
  } finally {
    clearTimeout(timeout)
  }
}

const response = await fetchAdvisories()
if (!Array.isArray(response.results) || response.results.length !== queries.length) {
  throw new Error('OSV returned an incomplete dependency audit response')
}
const advisories = response.results.flatMap((result, index) =>
  (result.vulns ?? []).map((advisory) => ({
    id: advisory.id,
    package: queries[index].package.name,
    version: queries[index].version,
  })),
)

// A source patch is required while upstream has no fixed release. This is not
// a version allowlist: every installed copy must match the reviewed full-source
// hashes and pass adversarial tests. Skipped install scripts or any new advisory
// still fail this gate. Keep reporting the original advisory for visibility.
const unresolved = []
for (const advisory of advisories) {
  if (advisory.id !== patchedAdvisory || advisory.package !== 'braces' || advisory.version !== '3.0.3') {
    unresolved.push(advisory)
    continue
  }
  for (const [packagePath, metadata] of Object.entries(lockfile.packages)) {
    if (!packagePath.endsWith('node_modules/braces') || metadata.version !== '3.0.3') continue
    await verifyBracesPatch(fileURLToPath(new URL(`../../${packagePath}/`, import.meta.url)))
  }
  execFileSync(process.execPath, ['--test', fileURLToPath(new URL('./braces-depth-patch.test.mjs', import.meta.url))], {
    stdio: 'inherit',
  })
  console.log(`${advisory.id} braces@3.0.3: verified source remediation (upstream release pending).`)
}

console.log(
  `Audited ${Object.keys(dependencies).length} locked ${omitDev ? 'production ' : ''}packages: ` +
    `${advisories.length} known advisories.`,
)

for (const advisory of advisories) {
  console.error(`${advisory.id} ${advisory.package}@${advisory.version}`)
}

// All unremediated advisories fail, regardless of severity or dev/prod scope.
if (unresolved.length > 0) process.exitCode = 1
