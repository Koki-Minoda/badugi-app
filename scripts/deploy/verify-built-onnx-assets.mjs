import { open, stat } from "node:fs/promises";
import path from "node:path";

const expectedPath = path.resolve(
  "dist/assets/ort-wasm-simd-threaded.jsep.wasm",
);
const minimumBytes = 1_000_000;

const details = await stat(expectedPath).catch(() => null);
if (!details?.isFile() || details.size < minimumBytes) {
  throw new Error(
    `Missing deployable ONNX WASM at ${expectedPath} (minimum ${minimumBytes} bytes)`,
  );
}

const handle = await open(expectedPath, "r");
try {
  const magic = Buffer.alloc(4);
  await handle.read(magic, 0, magic.length, 0);
  if (!magic.equals(Buffer.from([0x00, 0x61, 0x73, 0x6d]))) {
    throw new Error(`ONNX WASM has an invalid header: ${expectedPath}`);
  }
} finally {
  await handle.close();
}

console.log(`ONNX deploy asset: PASS (${details.size} bytes)`);
