import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(projectRoot, "src/config/ai/modelRegistry.json");
const publicRoot = path.join(projectRoot, "public");

function parseArgs(argv) {
  return {
    allowMissing: argv.includes("--allow-missing"),
    json: argv.includes("--json"),
  };
}

function readRegistry() {
  return JSON.parse(readFileSync(registryPath, "utf8"));
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function verifyEntry(entry) {
  const assetPath = entry.onnx ? path.join(publicRoot, entry.onnx) : null;
  const result = {
    id: entry.id,
    version: entry.version ?? null,
    onnx: entry.onnx ?? null,
    productionRequired: Boolean(entry.productionRequired),
    expectedChecksum: entry.checksumSha256 ?? null,
    actualChecksum: null,
    status: "ok",
    reason: null,
  };

  if (!entry.id || !entry.version || !entry.onnx) {
    return {
      ...result,
      status: "error",
      reason: "registry entry must include id, version, and onnx",
    };
  }

  if (!assetPath || !existsSync(assetPath)) {
    return {
      ...result,
      status: entry.productionRequired ? "missing-required" : "missing-optional",
      reason: `missing ${entry.onnx}`,
    };
  }

  const actualChecksum = sha256(assetPath);
  if (!entry.checksumSha256) {
    return {
      ...result,
      actualChecksum,
      status: "missing-checksum",
      reason: "registry checksumSha256 is required when the asset is present",
    };
  }

  if (actualChecksum !== entry.checksumSha256) {
    return {
      ...result,
      actualChecksum,
      status: "checksum-mismatch",
      reason: `expected ${entry.checksumSha256}, got ${actualChecksum}`,
    };
  }

  return {
    ...result,
    actualChecksum,
  };
}

function isFailure(result, { allowMissing }) {
  if (result.status === "ok") return false;
  if (allowMissing && ["missing-required", "missing-optional"].includes(result.status)) {
    return false;
  }
  return true;
}

function formatResult(result) {
  const label = result.status === "ok" ? "OK" : result.status.toUpperCase();
  const required = result.productionRequired ? "required" : "optional";
  const suffix = result.reason ? ` - ${result.reason}` : "";
  return `[${label}] ${result.id} ${result.version} ${required} ${result.onnx}${suffix}`;
}

export function verifyAiModelAssets(options = {}) {
  const registry = readRegistry();
  const results = registry.map(verifyEntry);
  return {
    results,
    failures: results.filter((result) => isFailure(result, options)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const report = verifyAiModelAssets(options);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    report.results.forEach((result) => console.log(formatResult(result)));
  }

  if (report.failures.length > 0) {
    console.error(
      `AI model asset verification failed: ${report.failures.length} issue(s). ` +
        "Use --allow-missing only for local fallback smoke without production assets.",
    );
    process.exit(1);
  }
}
