import { describe, expect, it } from "vitest";

import { buildFutureCandidateQueue } from "../buildFutureCandidateQueue.js";

describe("build future candidate queue", () => {
  it("combines entropy, rarity, and rejection outputs into a safe future queue", () => {
    const report = buildFutureCandidateQueue({
      entropyCandidates: [
        {
          candidate: "S02 strongSDA5 bet-pressure",
          variant: "S02",
          bucket: "strongSDA5 bet-pressure",
          classification: "SAFE_CANDIDATE",
          reason: ["medium-entropy"],
        },
        {
          candidate: "S01 rareSD27 raise-pressure",
          variant: "S01",
          bucket: "rareSD27 raise-pressure",
          classification: "COUNTERFACTUAL_ONLY",
          reason: ["needs-forced-replay-or-confidence"],
        },
        {
          candidate: "D02 trashA5 FOLD/CALL verify",
          variant: "D02",
          bucket: "trashA5 FOLD/CALL verify",
          classification: "DO_NOT_TOUCH",
          reason: ["trash-bucket"],
        },
      ],
      rarityCandidates: [
        { candidate: "S02 strongSDA5 bet-pressure", classification: "VIABLE" },
        { candidate: "S01 rareSD27 raise-pressure", classification: "TOO_RARE" },
        { candidate: "D02 trashA5 FOLD/CALL verify", classification: "VIABLE" },
      ],
      rejected: [{ candidate: "D02 trashA5 FOLD/CALL verify", rejectReason: ["trash-bucket"] }],
    });

    expect(report.queue.map((entry) => entry.status)).toEqual(["SAFE_NEXT", "TOO_RARE", "DO_NOT_TOUCH"]);
    expect(report.safeNext).toHaveLength(1);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
