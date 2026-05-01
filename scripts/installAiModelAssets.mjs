import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultRegistryPath = path.join(projectRoot, "src/config/ai/modelRegistry.json");
const defaultPublicRoot = path.join(projectRoot, "public");

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function parseModelMapping(value) {
  const splitAt = value.indexOf("=");
  if (splitAt <= 0 || splitAt === value.length - 1) {
    throw new Error(`Invalid --model mapping "${value}". Expected model-id=/path/file.onnx`);
  }
  return {
    modelId: value.slice(0, splitAt),
    sourcePath: value.slice(splitAt + 1),
  };
}

function parseArgs(argv) {
  const options = {
    mappings: [],
    sourceDir: null,
    requiredOnly: false,
    dryRun: false,
    json: false,
    registryPath: defaultRegistryPath,
    publicRoot: defaultPublicRoot,
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx];
    if (arg === "--model") {
      options.mappings.push(parseModelMapping(argv[idx + 1] ?? ""));
      idx += 1;
    } else if (arg.startsWith("--model=")) {
      options.mappings.push(parseModelMapping(arg.slice("--model=".length)));
    } else if (arg === "--source-dir") {
      options.sourceDir = argv[idx + 1] ?? null;
      idx += 1;
    } else if (arg.startsWith("--source-dir=")) {
      options.sourceDir = arg.slice("--source-dir=".length);
    } else if (arg === "--required-only") {
      options.requiredOnly = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--registry") {
      options.registryPath = argv[idx + 1] ?? options.registryPath;
      idx += 1;
    } else if (arg === "--public-root") {
      options.publicRoot = argv[idx + 1] ?? options.publicRoot;
      idx += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function readRegistry(registryPath) {
  return JSON.parse(readFileSync(registryPath, "utf8"));
}

function writeRegistry(registryPath, registry) {
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}

function findSourceInDirectory(sourceDir, entry) {
  if (!sourceDir || !entry.onnx) return null;
  const basename = path.basename(entry.onnx);
  const candidates = [
    path.join(sourceDir, basename),
    path.join(sourceDir, entry.onnx),
    path.join(sourceDir, "models", basename),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function normalizeSourcePath(sourcePath) {
  const resolved = path.resolve(sourcePath);
  if (!existsSync(resolved)) {
    throw new Error(`Source ONNX file does not exist: ${sourcePath}`);
  }
  if (!statSync(resolved).isFile()) {
    throw new Error(`Source ONNX path is not a file: ${sourcePath}`);
  }
  if (path.extname(resolved).toLowerCase() !== ".onnx") {
    throw new Error(`Source model must be an .onnx file: ${sourcePath}`);
  }
  return resolved;
}

function buildInstallPlan(registry, options) {
  const sourceByModelId = new Map(options.mappings.map((mapping) => [mapping.modelId, mapping.sourcePath]));
  return registry
    .filter((entry) => !options.requiredOnly || entry.productionRequired)
    .map((entry) => {
      const sourcePath = sourceByModelId.get(entry.id) ?? findSourceInDirectory(options.sourceDir, entry);
      return {
        entry,
        sourcePath: sourcePath ? normalizeSourcePath(sourcePath) : null,
        destinationPath: entry.onnx ? path.join(options.publicRoot, entry.onnx) : null,
      };
    })
    .filter((plan) => plan.sourcePath);
}

export function installAiModelAssets(options = {}) {
  const normalized = {
    mappings: options.mappings ?? [],
    sourceDir: options.sourceDir ?? null,
    requiredOnly: Boolean(options.requiredOnly),
    dryRun: Boolean(options.dryRun),
    registryPath: options.registryPath ?? defaultRegistryPath,
    publicRoot: options.publicRoot ?? defaultPublicRoot,
  };
  const registry = readRegistry(normalized.registryPath);
  const installPlan = buildInstallPlan(registry, normalized);
  if (installPlan.length === 0) {
    throw new Error("No matching ONNX model assets found to install");
  }

  const installed = installPlan.map(({ entry, sourcePath, destinationPath }) => {
    if (!destinationPath) {
      throw new Error(`Registry entry ${entry.id} is missing onnx path`);
    }
    const checksum = sha256(sourcePath);
    if (!normalized.dryRun) {
      mkdirSync(path.dirname(destinationPath), { recursive: true });
      copyFileSync(sourcePath, destinationPath);
      entry.checksumSha256 = checksum;
    }
    return {
      id: entry.id,
      version: entry.version,
      sourcePath,
      destinationPath,
      checksumSha256: checksum,
      dryRun: normalized.dryRun,
    };
  });

  if (!normalized.dryRun) {
    writeRegistry(normalized.registryPath, registry);
  }

  return { installed };
}

function printHelp() {
  console.log(`Usage:
  npm run ai:install-models -- --model model-badugi-pro-v1=/tmp/badugi_pro_v1.onnx
  npm run ai:install-models -- --source-dir /tmp/mgx-models --required-only

Options:
  --model <model-id=/path/file.onnx>  Install one explicit model. Repeatable.
  --source-dir <dir>                  Find registry filenames inside a directory.
  --required-only                     Only install productionRequired registry entries.
  --dry-run                           Compute checksums without copying or editing registry.
  --json                              Print JSON report.
`);
}

function formatInstalled(item) {
  const prefix = item.dryRun ? "DRY-RUN" : "INSTALLED";
  return `[${prefix}] ${item.id} ${item.version} -> ${path.relative(projectRoot, item.destinationPath)} sha256=${item.checksumSha256}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      process.exit(0);
    }
    const report = installAiModelAssets(options);
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      report.installed.forEach((item) => console.log(formatInstalled(item)));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
