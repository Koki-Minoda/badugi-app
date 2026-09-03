#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

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

console.log(
  `Audited ${Object.keys(dependencies).length} locked ${omitDev ? 'production ' : ''}packages: ` +
    `${advisories.length} known advisories.`,
)

for (const advisory of advisories) {
  console.error(`${advisory.id} ${advisory.package}@${advisory.version}`)
}

// This is intentionally stricter than npm's high-severity release threshold:
// a fully clean lockfile is required before production deployment.
if (advisories.length > 0) process.exitCode = 1
