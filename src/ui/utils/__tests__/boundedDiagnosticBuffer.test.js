import { describe, it, expect } from "vitest";
import {
  appendBoundedDiagnosticLog,
  MAX_CONSOLE_ENTRIES,
  MAX_CONSOLE_CHARACTERS,
  MAX_CONSOLE_ENTRY_CHARACTERS,
} from "../boundedDiagnosticBuffer.js";
describe("browser diagnostic retention", () => {
  it("keeps the newest entries and supports the existing drain operation", () => {
    const rows = [];
    for (let index = 0; index < 1000; index++)
      appendBoundedDiagnosticLog(rows, `entry-${index}`);
    expect(rows).toHaveLength(MAX_CONSOLE_ENTRIES);
    expect(rows.at(-1)).toBe("entry-999");
    expect(rows[0]).toBe(`entry-${1000 - MAX_CONSOLE_ENTRIES}`);
    expect(rows.splice(0)).toHaveLength(MAX_CONSOLE_ENTRIES);
    expect(rows).toEqual([]);
    appendBoundedDiagnosticLog(rows, "after-drain");
    expect(rows).toEqual(["after-drain"]);
  });
  it("bounds total characters even when every log contains a large game snapshot", () => {
    const rows = [];
    for (let index = 0; index < 1000; index++)
      appendBoundedDiagnosticLog(rows, `${index}:` + "x".repeat(12000));
    expect(
      rows.reduce((total, row) => total + row.length, 0),
    ).toBeLessThanOrEqual(MAX_CONSOLE_CHARACTERS);
    expect(rows.at(-1)).toMatch(/^999:/);
  });
  it("marks oversized entries and can reclaim an existing oversized buffer in one append", () => {
    const rows = Array.from({ length: 1000 }, () => "old".repeat(1000));
    appendBoundedDiagnosticLog(rows, "x".repeat(MAX_CONSOLE_CHARACTERS * 2));
    expect(rows.at(-1)).toHaveLength(MAX_CONSOLE_ENTRY_CHARACTERS);
    expect(rows.at(-1)).toContain("[truncated]");
    expect(rows.length).toBeLessThanOrEqual(MAX_CONSOLE_ENTRIES);
    expect(
      rows.reduce((total, row) => total + row.length, 0),
    ).toBeLessThanOrEqual(MAX_CONSOLE_CHARACTERS);
  });
});
