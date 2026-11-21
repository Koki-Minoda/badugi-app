import { afterEach, expect, it } from "vitest";
import {
  recordBrowserCpuDecisionTrace,
  MAX_BROWSER_CPU_DECISION_TRACES,
} from "../qa/cpuDecisionTraceCore.js";
afterEach(() => {
  delete window.__MGX_CPU_DECISION_TRACE__;
});
it("bounds browser CPU evidence while retaining the latest decisions and array identity", () => {
  window.__MGX_CPU_DECISION_TRACE__ = [];
  const rows = window.__MGX_CPU_DECISION_TRACE__;
  for (let index = 0; index < 2020; index++)
    recordBrowserCpuDecisionTrace({ index });
  expect(window.__MGX_CPU_DECISION_TRACE__).toBe(rows);
  expect(rows).toHaveLength(MAX_BROWSER_CPU_DECISION_TRACES);
  expect(rows[0]).toEqual({ index: 20 });
  expect(rows.at(-1)).toEqual({ index: 2019 });
});
