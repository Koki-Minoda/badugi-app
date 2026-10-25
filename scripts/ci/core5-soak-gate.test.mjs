import assert from "node:assert/strict";
import test from "node:test";
import { core5SoakGateStatus } from "./core5-soak-gate.mjs";

const passing = {
  playwrightExitCode: 0,
  blockingFailureCount: 0,
  monitorFailureCount: 0,
  artifactIssues: [],
};

test("passes a complete soak with no invariant violations", () => {
  assert.equal(core5SoakGateStatus(passing), "PASS");
});

test("fails when a phase or pot monitor records a mismatch", () => {
  assert.equal(core5SoakGateStatus({ ...passing, monitorFailureCount: 1 }), "FAIL");
});

test("fails incomplete or blocked runs", () => {
  assert.equal(core5SoakGateStatus({ ...passing, playwrightExitCode: 1 }), "FAIL");
  assert.equal(core5SoakGateStatus({ ...passing, blockingFailureCount: 1 }), "FAIL");
  assert.equal(core5SoakGateStatus({ ...passing, artifactIssues: ["summary-missing"] }), "FAIL");
});
