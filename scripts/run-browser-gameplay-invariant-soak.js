#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const env = {
  ...process.env,
  BROWSER_GAMEPLAY_HANDS: args.hands ?? process.env.BROWSER_GAMEPLAY_HANDS ?? "10",
  BROWSER_GAMEPLAY_VARIANTS: args.variants ?? process.env.BROWSER_GAMEPLAY_VARIANTS ?? "badugi,D01,D02,S01,S02",
  BROWSER_GAMEPLAY_MODES: args.modes ?? process.env.BROWSER_GAMEPLAY_MODES ?? "cash,tournament",
  BROWSER_GAMEPLAY_VIEWPORTS: args.viewports ?? process.env.BROWSER_GAMEPLAY_VIEWPORTS ?? "desktop,portrait,landscape",
};

const result = spawnSync(
  "npx",
  ["playwright", "test", "tests/e2e/browser-gameplay-invariant-harness.spec.ts", "--project=badugi-flow"],
  { stdio: "inherit", env },
);

process.exit(result.status ?? 1);

