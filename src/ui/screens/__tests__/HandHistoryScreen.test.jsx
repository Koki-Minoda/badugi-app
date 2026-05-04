import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HandHistoryScreen from "../HandHistoryScreen.jsx";

const completedHands = Array.from({ length: 30 }, (_, index) => ({
  handId: `modal-hand-${index + 1}`,
  startedAt: Date.UTC(2026, 4, 4, 8, index),
  endedAt: Date.UTC(2026, 4, 4, 8, index + 1),
  variantId: "badugi",
  heroNet: index % 2 === 0 ? 20 : -10,
  seats: [
    {
      seat: 0,
      name: "Hero",
      actions: [{ street: "BET", type: "call" }],
      handLabel: "Badugi 8-4-3-A",
    },
  ],
  pots: [{ winners: [{ seat: 0, amount: 40 }] }],
  events: [{ type: "HAND_END", totalPot: 40, winners: [{ seat: 0, amount: 40 }] }],
}));

vi.mock("../../state/handHistoryStore.js", () => ({
  getCurrentHandHistorySnapshot: () => null,
  getHandHistoryBufferSnapshot: () => completedHands,
}));

describe("HandHistoryScreen", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("requests play feedback from the in-game history modal", async () => {
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({ accessToken: "token-1", tokenType: "Bearer" }),
    );
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        adviceJa: "ゲーム内モーダル助言",
        adviceEn: "Modal advice",
        source: "fallback",
        feedbackId: 9,
        sessionKey: "cash:cash:mixed",
      }),
    });

    const onReplay = vi.fn();
    render(<HandHistoryScreen embedded language="ja" onReplay={onReplay} />);

    fireEvent.click(screen.getByRole("button", { name: "AIフィードバック作成" }));

    await waitFor(() => expect(screen.getByText("ゲーム内モーダル助言")).toBeTruthy());
    expect(screen.getByText("該当ハンド")).toBeTruthy();
    expect(screen.getAllByText(/modal-hand-1/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "リプレイ" })[0]);
    expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ handId: "modal-hand-1" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analysis/play-feedback",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
      }),
    );
    expect(window.localStorage.getItem("mgx.playFeedback.results.v1")).toContain(
      "ゲーム内モーダル助言",
    );
  });
});
