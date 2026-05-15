import React from "react";
import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import ReplayScreen from "../ReplayScreen.jsx";
import { setHandHistoryAccessors } from "../../state/handHistoryStore.js";

let fixtureReport;

function annotationFromFixture(fixture) {
  return {
    lessonId: fixture.lessonId,
    variantId: fixture.variantId,
    actionIndex: fixture.actionIndex,
    severity: fixture.coaching.severity,
    lessonTag: fixture.coaching.lessonTag,
    evDelta: fixture.coaching.evDelta,
    jp: fixture.coaching.jp,
    en: fixture.coaching.en,
    highlightAction: fixture.coaching.recommendedAction,
    baselineAction: fixture.coaching.baselineAction,
    replayDeterministic: true,
  };
}

function focusFromFixture(fixture) {
  return {
    status: "ready",
    safe: true,
    replayRefValid: true,
    lessonId: fixture.lessonId,
    actionIndex: fixture.actionIndex,
    focusMode: "coaching-lesson",
    target: {
      handId: fixture.handId,
      actionSeq: fixture.actionIndex,
      actionSeqStart: fixture.actionIndex,
      replayTarget: {
        handId: fixture.handId,
        actionSeqStart: fixture.actionIndex,
      },
    },
  };
}

describe("ReplayScreen real coaching fixture", () => {
  beforeAll(() => {
    fixtureReport = JSON.parse(
      fs.readFileSync(
        path.resolve("reports/ai-iron/step51-real-replay-coaching-fixture.json"),
        "utf8",
      ),
    );
  });

  afterEach(() => {
    cleanup();
    setHandHistoryAccessors({
      readCurrent: () => null,
      readBuffer: () => [],
      findById: () => null,
    });
  });

  it("highlights the real replay action row and shows coaching annotation", async () => {
    const fixture = fixtureReport.fixtures[0];
    setHandHistoryAccessors({
      readCurrent: () => fixture.handHistory,
      readBuffer: () => [fixture.handHistory],
      findById: (handId) => (handId === fixture.handId ? fixture.handHistory : null),
    });

    render(
      <ReplayScreen
        handId={fixture.handId}
        lessonFocus={focusFromFixture(fixture)}
        coachingAnnotation={annotationFromFixture(fixture)}
      />,
    );

    const row = await screen.findByTestId(`replay-event-row-${fixture.actionIndex}`);
    await waitFor(() => expect(row.getAttribute("data-coaching-highlight")).toBe("true"));
    expect(screen.getByTestId("replay-coaching-overlay")).toBeTruthy();
    expect(screen.getByTestId("replay-coaching-ev").textContent).toBe("EV +32.2");
    expect(screen.getByTestId("replay-coaching-timeline-marker")).toBeTruthy();
    expect(screen.getByTestId("replay-coaching-focus").textContent).toContain(fixture.lessonId);

    fireEvent.click(screen.getByTestId("replay-coaching-close"));
    await waitFor(() => expect(screen.queryByTestId("replay-coaching-overlay")).toBeNull());
  });

  it("keeps the safe fallback visible when real replay data is missing", async () => {
    const fixture = fixtureReport.fixtures[0];
    render(
      <ReplayScreen
        handId="missing-real-hand"
        lessonFocus={{
          status: "preview-unavailable",
          safe: true,
          focusMode: "fallback",
          lessonId: fixture.lessonId,
          actionIndex: fixture.actionIndex,
          reasons: ["hand-id-missing"],
        }}
      />,
    );

    expect(await screen.findByTestId("replay-coaching-fallback")).toBeTruthy();
    expect(screen.getByTestId("hand-replay-screen")).toBeTruthy();
  });
});
