import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import TournamentResultOverlay from "../TournamentResultOverlay.jsx";

const basePlacements = [
  { id: "p1", place: 2, name: "CPU 2", stack: 420, payout: 300 },
  { id: "p2", place: 1, name: "Hero", stack: 1200, payout: 500 },
  { id: "p3", place: 3, name: "CPU 3", stack: 210, payout: 200 },
];

function makeTournamentReview(state = "summary", overrides = {}) {
  return {
    mode: "tournament",
    variantId: "mixed",
    variantIds: ["D01", "D02"],
    result: {
      placement: 2,
      payout: 300,
      buyIn: 100,
      netResult: 200,
      roi: 2,
    },
    dataQuality: {
      totalHands: 12,
      heroActionCount: 18,
    },
    feedbackStatus: {
      state,
      reason: `${state}_reason`,
      totalHands: 12,
      handCount: 12,
      heroActionCount: 18,
    },
    nextImprovements: {
      source: "local-summary",
      items: ["大きくチップが動いたハンドをリプレイで確認しましょう。"],
    },
    keyHands: [
      {
        keyHandId: "biggest-win:h-7",
        handId: "h-7",
        title: "Biggest win",
        description: "チップ獲得が最も大きかったハンドです。",
        reason: "biggest-win",
        replayRef: {
          target: {
            handId: "h-7",
            actionSeqStart: 2,
            actionSeqEnd: 2,
          },
        },
      },
    ],
    aiFeedback: {
      enabled: false,
      response: null,
    },
    ...overrides,
  };
}

describe("TournamentResultOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders final placements in ascending order", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        title="Store Tournament"
        onBackToMenu={() => {}}
      />,
    );
    const placeCells = screen
      .getAllByTestId("mtt-result-place")
      .slice(0, basePlacements.length)
      .map((node) => node.textContent);
    expect(placeCells).toEqual(["1", "2", "3"]);
    const payoutCells = screen
      .getAllByTestId("mtt-result-payout")
      .slice(0, basePlacements.length)
      .map((node) => node.textContent);
    expect(payoutCells).toEqual(["Payout 500", "Payout 300", "Payout 200"]);
    const nameCells = screen
      .getAllByTestId("mtt-result-name")
      .slice(0, basePlacements.length)
      .map((node) => node.textContent);
    expect(nameCells).toEqual(["Hero", "CPU 2", "CPU 3"]);
    expect(screen.getByTestId("mtt-tournament-review")).toBeTruthy();
    expect(screen.queryByTestId("mtt-review-placeholder-button")).toBeNull();
  });

  it("highlights the champion row", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        onBackToMenu={() => {}}
      />,
    );
    const championLabels = screen
      .getAllByTestId("mtt-result-champion")
      .map((node) => node.textContent);
    expect(championLabels[0]).toContain("Hero");
    const badgeText = screen
      .getAllByTestId("mtt-result-champion-badge")
      .map((node) => node.textContent);
    expect(badgeText[0]).toBe("Champion");
  });

  it("renders champion celebration details", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        title="Badugi Store Tournament"
        onBackToMenu={() => {}}
      />,
    );

    const celebration = screen.getByTestId("mtt-champion-celebration");
    expect(celebration.textContent).toContain("Champion");
    expect(celebration.textContent).toContain("BADUGI STORE TOURNAMENT");
    expect(celebration.textContent).toContain("1st Place");
    expect(celebration.textContent).toContain("Prize");
    expect(celebration.textContent).toContain("Entrants");
    expect(celebration.textContent).toContain("Final Stack");
    expect(celebration.textContent).toContain("Knockouts");
  });

  it("renders payout column even when all payouts are zero", () => {
    const zeroPayoutPlacements = basePlacements.map((entry) => ({
      ...entry,
      payout: 0,
    }));
    render(
      <TournamentResultOverlay
        visible
        placements={zeroPayoutPlacements}
        onBackToMenu={() => {}}
      />,
    );
    const payoutCells = screen.getAllByTestId("mtt-result-payout").map((node) => node.textContent);
    expect(payoutCells).toEqual(["Payout 0", "Payout 0", "Payout 0"]);
  });

  it("shows a compact summary tournament review automatically", () => {
    const onOpenReviewReplay = vi.fn();
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        title="Store Tournament"
        tournamentReview={makeTournamentReview("summary")}
        onOpenReviewReplay={onOpenReviewReplay}
        onBackToMenu={() => {}}
      />,
    );

    const review = screen.getByTestId("mtt-tournament-review");
    expect(review.textContent).toContain("Tournament Review");
    expect(review.textContent).toContain("簡易レビュー");
    expect(review.textContent).toContain("Place");
    expect(review.textContent).toContain("Payout");
    expect(review.textContent).toContain("Hands");
    expect(review.textContent).toContain("Mixed (D01 / D02)");
    expect(screen.getByTestId("mtt-tournament-review-key-hand").textContent).toContain("Biggest win");
    expect(screen.getByTestId("mtt-tournament-review-key-hand").textContent).toContain("h-7");
    fireEvent.click(screen.getByTestId("mtt-tournament-review-replay"));
    expect(onOpenReviewReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        handId: "h-7",
        actionSeqStart: 2,
        actionSeqEnd: 2,
        replayReview: expect.objectContaining({
          reviewMode: "tournament",
          handId: "h-7",
        }),
      }),
    );
    expect(screen.getAllByTestId("mtt-result-row")).toHaveLength(3);
  });

  it("shows the loading tournament review state without hiding results", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        tournamentReview={makeTournamentReview("loading")}
      />,
    );

    expect(screen.getByTestId("mtt-tournament-review-status").textContent).toContain("レビュー作成中");
    expect(screen.getAllByTestId("mtt-result-row")).toHaveLength(3);
  });

  it("does not show a replay CTA when a key hand has no replay target", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        tournamentReview={makeTournamentReview("summary", {
          keyHands: [
            {
              keyHandId: "biggest-loss:h-2",
              handId: "h-2",
              title: "Biggest loss",
              description: "チップ減少が最も大きかったハンドです。",
              reason: "biggest-loss",
              replayRef: null,
            },
          ],
        })}
        onOpenReviewReplay={vi.fn()}
      />,
    );

    expect(screen.getByTestId("mtt-tournament-review-key-hand").textContent).toContain("h-2");
    expect(screen.queryByTestId("mtt-tournament-review-replay")).toBeNull();
  });

  it("shows the complete tournament review state without numeric EV claims", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        tournamentReview={makeTournamentReview("complete", {
          aiFeedback: {
            enabled: false,
            response: {
              adviceJa: "終盤のリスク管理が結果につながりました。",
            },
          },
        })}
      />,
    );

    const review = screen.getByTestId("mtt-tournament-review");
    expect(screen.getByTestId("mtt-tournament-review-status").textContent).toContain("レビュー完了");
    expect(review.textContent).toContain("終盤のリスク管理");
    expect(review.textContent).not.toMatch(/EV\s*[+-]?\d/i);
  });

  it("shows insufficient logs as a natural simplified review state", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        tournamentReview={makeTournamentReview("insufficient_logs", {
          dataQuality: { totalHands: 0, heroActionCount: 0 },
          feedbackStatus: {
            state: "insufficient_logs",
            totalHands: 0,
            handCount: 0,
            heroActionCount: 0,
          },
          keyHands: [],
        })}
      />,
    );

    const review = screen.getByTestId("mtt-tournament-review");
    expect(screen.getByTestId("mtt-tournament-review-status").textContent).toContain("簡易レビューのみ");
    expect(review.textContent).toContain("ハンド履歴が少ないため");
  });

  it("shows unauthenticated as a saved-review limitation, not a blocker", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        tournamentReview={makeTournamentReview("unauthenticated")}
      />,
    );

    const review = screen.getByTestId("mtt-tournament-review");
    expect(screen.getByTestId("mtt-tournament-review-status").textContent).toContain("保存なし");
    expect(review.textContent).toContain("ログインすると詳細AIレビューを保存できます");
  });

  it("shows the error tournament review state without hiding champion and payout data", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        tournamentReview={makeTournamentReview("error")}
      />,
    );

    const review = screen.getByTestId("mtt-tournament-review");
    expect(screen.getByTestId("mtt-tournament-review-status").textContent).toContain("レビュー未作成");
    expect(review.textContent).toContain("レビューを作成できませんでした");
    expect(screen.getByTestId("mtt-result-champion").textContent).toContain("Hero");
    expect(screen.getAllByTestId("mtt-result-payout").map((node) => node.textContent)).toEqual([
      "Payout 500",
      "Payout 300",
      "Payout 200",
    ]);
  });
});
