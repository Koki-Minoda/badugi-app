import fs from "node:fs";
import { execFileSync } from "node:child_process";
execFileSync(
  "xcrun",
  [
    "devicectl",
    "list",
    "devices",
    "--json-output",
    "/tmp/mgx-perf-devices.json",
  ],
  { stdio: "ignore", timeout: 15000 },
);
const devices = JSON.parse(
  fs.readFileSync("/tmp/mgx-perf-devices.json", "utf8"),
).result.devices;
const device = devices.find(
  (row) => row.hardwareProperties?.marketingName === "iPhone 16",
);
if (!device) throw new Error("Paired iPhone 16 not found");
const response = await fetch("http://127.0.0.1:9450/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    capabilities: {
      alwaysMatch: {
        browserName: "Safari",
        platformName: "iOS",
        "safari:useSimulator": false,
        "safari:deviceUDID": device.hardwareProperties.udid,
      },
    },
  }),
  signal: AbortSignal.timeout(45000),
});
const data = await response.json();
if (!response.ok) throw new Error(data.value?.message.replace(/\(.*?\)/g, ""));
fs.writeFileSync("/tmp/mgx-perf-ios-session.json", JSON.stringify(data));
const url = `http://127.0.0.1:9450/session/${data.value.sessionId}/url`;
const navigation = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: process.env.MGX_PERF_ORIGIN ?? "https://mgx-poker.com/",
  }),
  signal: AbortSignal.timeout(30000),
});
if (!navigation.ok) throw new Error("Could not open the test origin");
console.log("Physical Safari session ready");
