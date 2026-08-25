import fs from "node:fs";
import path from "node:path";
import { summarizeCpuDecisionTrace } from "./summarizeCpuDecisionTrace.js";
export {
  classifyDecisionSource,
  classifyHandStrengthBucket,
  normalizeCpuActionType,
  recordBrowserCpuDecisionTrace,
} from "./cpuDecisionTraceCore.js";

import { buildCpuDecisionTraceRow } from "./cpuDecisionTraceCore.js";

export function createCpuDecisionTrace() {
  const rows = [];
  return {
    rows,
    record(row) {
      rows.push(row);
      return row;
    },
    summarize() {
      return summarizeCpuDecisionTrace(rows);
    },
    writeJsonl(filePath) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n"));
    },
    writeSummary(filePath) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(this.summarize(), null, 2)}\n`);
    },
  };
}

export { buildCpuDecisionTraceRow };
export default createCpuDecisionTrace;
