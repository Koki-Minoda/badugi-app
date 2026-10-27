import React from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Controls from "../Controls.jsx";

describe("Controls", () => {
  test("uses Japanese action labels when the table language is Japanese", () => {
    render(
      <Controls
        phase="BET"
        currentBet={20}
        player={{ stack: 500, betThisRound: 0 }}
        onCall={vi.fn()}
        onRaise={vi.fn()}
        onFold={vi.fn()}
        language="ja"
      />,
    );

    expect(screen.getByTestId("action-call").textContent).toBe("コール 20");
    expect(screen.getByTestId("action-raise").textContent).toBe("レイズ");
    expect(screen.getByTestId("action-fold").textContent).toBe("フォールド");
  });
});
