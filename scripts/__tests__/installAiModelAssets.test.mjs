import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { installAiModelAssets } from "../installAiModelAssets.mjs";

const tempDirs = [];

function makeTempProject() {
  const root = mkdtempSync(path.join(os.tmpdir(), "mgx-model-install-"));
  tempDirs.push(root);
  return {
    root,
    registryPath: path.join(root, "modelRegistry.json"),
    publicRoot: path.join(root, "public"),
    sourceDir: path.join(root, "incoming"),
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("installAiModelAssets", () => {
  it("copies explicit ONNX mapping and updates registry checksum", () => {
    const temp = makeTempProject();
    const sourcePath = path.join(temp.root, "badugi_pro_v1.onnx");
    writeFileSync(sourcePath, "real-ish onnx bytes");
    writeFileSync(
      temp.registryPath,
      JSON.stringify(
        [
          {
            id: "model-badugi-pro-v1",
            version: "v1",
            onnx: "models/badugi_pro_v1.onnx",
            checksumSha256: null,
            productionRequired: true,
          },
        ],
        null,
        2,
      ),
    );

    const report = installAiModelAssets({
      mappings: [{ modelId: "model-badugi-pro-v1", sourcePath }],
      registryPath: temp.registryPath,
      publicRoot: temp.publicRoot,
    });

    expect(report.installed).toHaveLength(1);
    const registry = JSON.parse(readFileSync(temp.registryPath, "utf8"));
    expect(registry[0].checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(path.join(temp.publicRoot, "models/badugi_pro_v1.onnx"), "utf8")).toBe(
      "real-ish onnx bytes",
    );
  });

  it("installs required models from a source directory without touching optional entries", () => {
    const temp = makeTempProject();
    mkdirSync(temp.sourceDir, { recursive: true });
    writeFileSync(
      temp.registryPath,
      JSON.stringify(
        [
          {
            id: "model-badugi-iron-v1",
            version: "v1",
            onnx: "models/badugi_iron_v1.onnx",
            checksumSha256: null,
            productionRequired: true,
          },
          {
            id: "model-generic-v1",
            version: "v1",
            onnx: "models/generic_standard.onnx",
            checksumSha256: null,
            productionRequired: false,
          },
        ],
        null,
        2,
      ),
    );
    writeFileSync(path.join(temp.sourceDir, "badugi_iron_v1.onnx"), "iron bytes", {
      flag: "w",
    });
    writeFileSync(path.join(temp.sourceDir, "generic_standard.onnx"), "generic bytes", {
      flag: "w",
    });
    const report = installAiModelAssets({
      sourceDir: temp.sourceDir,
      requiredOnly: true,
      registryPath: temp.registryPath,
      publicRoot: temp.publicRoot,
    });

    expect(report.installed.map((item) => item.id)).toEqual(["model-badugi-iron-v1"]);
    const registry = JSON.parse(readFileSync(temp.registryPath, "utf8"));
    expect(registry[0].checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(registry[1].checksumSha256).toBeNull();
  });

  it("supports dry-run without editing registry", () => {
    const temp = makeTempProject();
    const sourcePath = path.join(temp.root, "badugi_worldmaster_v1.onnx");
    writeFileSync(sourcePath, "worldmaster bytes");
    writeFileSync(
      temp.registryPath,
      JSON.stringify(
        [
          {
            id: "model-badugi-worldmaster-v1",
            version: "v1",
            onnx: "models/badugi_worldmaster_v1.onnx",
            checksumSha256: null,
            productionRequired: true,
          },
        ],
        null,
        2,
      ),
    );

    const report = installAiModelAssets({
      mappings: [{ modelId: "model-badugi-worldmaster-v1", sourcePath }],
      registryPath: temp.registryPath,
      publicRoot: temp.publicRoot,
      dryRun: true,
    });

    expect(report.installed[0].checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    const registry = JSON.parse(readFileSync(temp.registryPath, "utf8"));
    expect(registry[0].checksumSha256).toBeNull();
  });
});
