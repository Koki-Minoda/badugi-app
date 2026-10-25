export function core5SoakGateStatus({ playwrightExitCode, blockingFailureCount, monitorFailureCount, artifactIssues }) {
  return playwrightExitCode === 0 &&
    blockingFailureCount === 0 &&
    monitorFailureCount === 0 &&
    artifactIssues.length === 0
    ? "PASS"
    : "FAIL";
}
