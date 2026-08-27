export const TOURNAMENT_REVIEW_CONTRACT_TYPE = "mgx.tournament-review";
export const TOURNAMENT_REVIEW_SCHEMA_VERSION = 2;

export const TOURNAMENT_REVIEW_FEEDBACK_STATUS = Object.freeze({
  SUMMARY: "summary",
  LOADING: "loading",
  COMPLETE: "complete",
  INSUFFICIENT_LOGS: "insufficient_logs",
  UNAUTHENTICATED: "unauthenticated",
  ERROR: "error",
});

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function getHandId(hand = {}) {
  if (!hand) return null;
  return nullableString(hand.handId ?? hand.id);
}

function getTournamentId(tournament = {}) {
  return nullableString(
    tournament.tournamentId ??
      tournament.id ??
      tournament.config?.id ??
      tournament.result?.tournamentId,
  );
}

function getVariantId(hand = {}, fallback = null) {
  return nullableString(
    hand.variantId ??
      hand.variantKey ??
      hand.gameId ??
      hand.metadata?.variantId ??
      fallback,
  ) ?? "unknown";
}

function getSeatIndex(entry = {}) {
  const seat = entry.seat ?? entry.seatIndex ?? entry.index;
  return Number.isInteger(seat) && seat >= 0 ? seat : null;
}

function isHeroSeat(entry = {}, heroSeat = 0) {
  const seatIndex = getSeatIndex(entry);
  return seatIndex === heroSeat || entry.isHero === true || entry.hero === true;
}

function actionSeq(action = {}) {
  const seq = Number(action.actionSeq ?? action.seq ?? action.sequence);
  return Number.isInteger(seq) && seq > 0 ? seq : null;
}

function normalizeActionType(action = {}) {
  const value = action.type ?? action.action ?? action.actionType ?? action.decision;
  const text = String(value ?? "").trim().toLowerCase();
  return text || "action";
}

function normalizePhase(value) {
  return nullableString(value)?.toUpperCase() ?? null;
}

function collectHeroActions(hand = {}, heroSeat = 0) {
  const seats = Array.isArray(hand.seats) ? hand.seats : [];
  const seatEntry = seats.find((seat) => isHeroSeat(seat, heroSeat));
  if (Array.isArray(seatEntry?.actions)) return seatEntry.actions;
  return (Array.isArray(hand.actions) ? hand.actions : []).filter((action) =>
    isHeroSeat(action, heroSeat),
  );
}

function buildActionSeqRange(actions = []) {
  const seqs = actions.map(actionSeq).filter((seq) => seq !== null);
  if (!seqs.length) return null;
  return {
    start: Math.min(...seqs),
    end: Math.max(...seqs),
  };
}

function normalizeAction(action = {}, hand = {}, heroSeat = 0) {
  const metadata = action.metadata ?? {};
  const betInfo = metadata.betInfo ?? {};
  const drawInfo = metadata.drawInfo ?? {};
  return {
    handId: hand.handId ?? hand.id ?? null,
    variantId: getVariantId(hand),
    actionSeq: actionSeq(action),
    seatIndex: getSeatIndex(action) ?? heroSeat,
    phase: nullableString(action.phase ?? action.street ?? hand.phase ?? hand.street),
    round: Number.isFinite(Number(action.round)) ? Number(action.round) : null,
    action: normalizeActionType(action),
    amount: Number.isFinite(Number(action.amount)) ? Number(action.amount) : null,
    toCall: Number.isFinite(Number(action.toCall ?? betInfo.toCall))
      ? Number(action.toCall ?? betInfo.toCall)
      : null,
    currentBet: Number.isFinite(Number(action.currentBet ?? betInfo.currentBet))
      ? Number(action.currentBet ?? betInfo.currentBet)
      : null,
    pot: Number.isFinite(Number(action.pot ?? hand.pot ?? hand.totalPot))
      ? Number(action.pot ?? hand.pot ?? hand.totalPot)
      : null,
    stackBefore: Number.isFinite(Number(action.stackBefore))
      ? Number(action.stackBefore)
      : null,
    stackAfter: Number.isFinite(Number(action.stackAfter)) ? Number(action.stackAfter) : null,
    position: nullableString(action.position ?? action.pos ?? hand.heroPosition),
    legalActions: Array.isArray(action.legalActions)
      ? action.legalActions.map((entry) => String(entry)).filter(Boolean)
      : [],
    drawCount: Number.isFinite(Number(action.drawCount ?? drawInfo.drawCount))
      ? Number(action.drawCount ?? drawInfo.drawCount)
      : null,
  };
}

function normalizeHand(hand = {}, heroSeat = 0) {
  const heroActions = collectHeroActions(hand, heroSeat);
  return {
    handId: hand.handId ?? hand.id ?? null,
    tournamentId: nullableString(hand.tournamentId ?? hand.metadata?.tournamentId),
    variantId: getVariantId(hand),
    startedAt: hand.startedAt ?? hand.ts ?? null,
    endedAt: hand.endedAt ?? null,
    heroSeat,
    heroNet: toNumber(hand.heroNet ?? hand.net ?? hand.result?.heroNet, 0),
    totalPot: toNumber(hand.totalPot ?? hand.pot ?? hand.result?.totalPot, 0),
    actionCount: heroActions.length,
    heroActionSeqRange: buildActionSeqRange(heroActions),
  };
}

function getHandHeroNet(hand = {}) {
  return toNumber(hand.heroNet ?? hand.net ?? hand.result?.heroNet, 0);
}

function getHandPot(hand = {}) {
  return toNumber(hand.totalPot ?? hand.pot ?? hand.result?.totalPot, 0);
}

function dedupeHandsById(hands = [], heroSeat = 0) {
  const byId = new Map();
  const anonymous = [];
  (Array.isArray(hands) ? hands : []).forEach((hand) => {
    const handId = getHandId(hand);
    if (!handId) {
      anonymous.push(hand);
      return;
    }
    const current = byId.get(handId);
    if (!current) {
      byId.set(handId, hand);
      return;
    }
    const currentActions = collectHeroActions(current, heroSeat).length;
    const candidateActions = collectHeroActions(hand, heroSeat).length;
    const primary = candidateActions > currentActions ? hand : current;
    const secondary = primary === hand ? current : hand;
    byId.set(handId, {
      ...secondary,
      ...primary,
      handId,
      heroBusted: Boolean(
        current.heroBusted ||
        hand.heroBusted ||
        [current, hand].some((record) =>
          (Array.isArray(record?.seats) ? record.seats : []).some(
            (seat) =>
              isHeroSeat(seat, heroSeat) &&
              (seat.busted === true || seat.stack === 0),
          ),
        )
      ),
      bustHand: Boolean(current.bustHand || hand.bustHand),
      showdown: hasShowdownEvidence(current) || hasShowdownEvidence(hand),
      heroNet:
        getHandHeroNet(primary) !== 0
          ? getHandHeroNet(primary)
          : getHandHeroNet(secondary),
      pot: Math.max(getHandPot(current), getHandPot(hand)),
      totalPot: Math.max(getHandPot(current), getHandPot(hand)),
    });
  });
  return [...byId.values(), ...anonymous];
}

function normalizePlacement(entry = {}) {
  return {
    id: entry.id ?? entry.playerId ?? null,
    place: Number.isFinite(Number(entry.place ?? entry.finishPlace))
      ? Number(entry.place ?? entry.finishPlace)
      : null,
    name: entry.name ?? entry.playerName ?? null,
    stack: toNumber(entry.stack, 0),
    payout: toNumber(entry.payout ?? entry.prize, 0),
  };
}

function buildResult({ tournament = {}, placements = [], heroPlayerId = null } = {}) {
  const safePlacements = (Array.isArray(placements) ? placements : [])
    .map(normalizePlacement)
    .filter((entry) => entry.place !== null || entry.id !== null);
  const heroPlacement =
    safePlacements.find((entry) => heroPlayerId && entry.id === heroPlayerId) ??
    safePlacements.find((entry) => entry.name === "Hero" || entry.name === "You") ??
    null;
  const buyIn = toNumber(tournament.buyIn ?? tournament.entryFee ?? tournament.entry, 0);
  const payout = toNumber(heroPlacement?.payout ?? tournament.prize ?? tournament.payout, 0);
  return {
    tournamentId: getTournamentId(tournament),
    title: tournament.name ?? tournament.title ?? "Tournament Results",
    placement: heroPlacement?.place ?? tournament.finish ?? tournament.placement ?? null,
    payout,
    buyIn,
    netResult: payout - buyIn,
    roi: buyIn ? (payout - buyIn) / buyIn : null,
    championId:
      tournament.championId ??
      safePlacements.find((entry) => entry.place === 1)?.id ??
      null,
    players: safePlacements.length || null,
    placements: safePlacements,
  };
}

function buildReplayRef({ handId, variantId, actionSeqRange = null }) {
  if (!handId) return null;
  return {
    handId,
    variantId: variantId ?? null,
    target: {
      handId,
      actionSeqStart: actionSeqRange?.start ?? null,
      actionSeqEnd: actionSeqRange?.end ?? null,
    },
    available: true,
  };
}

function isAllInAction(action = {}) {
  const actionType = normalizeActionType(action);
  if (actionType.includes("all")) return true;
  if (action.allIn === true || action.isAllIn === true) return true;
  const stackBefore = Number(action.stackBefore);
  const amount = Number(action.amount);
  const stackAfter = Number(action.stackAfter);
  return (
    (Number.isFinite(stackAfter) && stackAfter === 0) ||
    (Number.isFinite(stackBefore) && stackBefore > 0 && Number.isFinite(amount) && amount >= stackBefore)
  );
}

function isDrawAction(action = {}) {
  const actionType = normalizeActionType(action);
  const phase = normalizePhase(action.phase ?? action.street);
  return phase === "DRAW" || actionType === "draw" || actionType === "discard" || actionType === "stand-pat";
}

function hasShowdownEvidence(hand = {}) {
  if (hand.showdown === true || hand.result?.showdown === true) return true;
  const events = Array.isArray(hand.events) ? hand.events : [];
  if (events.some((event) => normalizePhase(event.type) === "SHOWDOWN")) return true;
  const actions = Array.isArray(hand.actions) ? hand.actions : [];
  if (actions.some((action) => normalizePhase(action.phase ?? action.street) === "SHOWDOWN")) return true;
  return (Array.isArray(hand.seats) ? hand.seats : []).some((seat) =>
    (Array.isArray(seat?.actions) ? seat.actions : []).some(
      (action) => normalizePhase(action.phase ?? action.street) === "SHOWDOWN",
    ),
  );
}

function getReasonCopy(reason) {
  switch (reason) {
    case "bust-hand":
      return {
        title: "Bust hand",
        description: "トーナメント終了につながった最終局面です。",
      };
    case "biggest-loss":
      return {
        title: "Biggest loss",
        description: "チップ減少が最も大きかったハンドです。",
      };
    case "biggest-win":
      return {
        title: "Biggest win",
        description: "チップ獲得が最も大きかったハンドです。",
      };
    case "hero-all-in":
      return {
        title: "Hero all-in",
        description: "Heroが全チップを投入した重要局面です。",
      };
    case "showdown":
      return {
        title: "Showdown",
        description: "ショーダウンまで進んだ判断確認用のハンドです。",
      };
    case "large-pot":
      return {
        title: "Large pot",
        description: "大きなポットになったハンドです。",
      };
    case "draw-decision":
      return {
        title: "Draw decision",
        description: "ドロー判断を振り返るためのハンドです。",
      };
    case "final-hand":
      return {
        title: "Final hand",
        description: "大会の最後に記録されたハンドです。",
      };
    default:
      return {
        title: "Key hand",
        description: "振り返り対象のハンドです。",
      };
  }
}

function findHeroActionForReason(hand = {}, reason, heroSeat = 0) {
  const heroActions = collectHeroActions(hand, heroSeat);
  if (!heroActions.length) return null;
  if (reason === "hero-all-in") {
    return heroActions.find(isAllInAction) ?? heroActions[0];
  }
  if (reason === "draw-decision") {
    return heroActions.find(isDrawAction) ?? heroActions[0];
  }
  return heroActions[0];
}

function buildKeyHand({ hand, reason, label, title, description, heroSeat = 0 }) {
  if (!getHandId(hand)) return null;
  const normalized = normalizeHand(hand, heroSeat);
  const selectedAction = findHeroActionForReason(hand, reason, heroSeat);
  const selectedSeq = actionSeq(selectedAction ?? {});
  const selectedRange =
    selectedSeq !== null
      ? { start: selectedSeq, end: selectedSeq }
      : normalized.heroActionSeqRange;
  const replayRef = buildReplayRef({
    handId: normalized.handId,
    variantId: normalized.variantId,
    actionSeqRange: selectedRange,
  });
  const copy = getReasonCopy(reason);
  const phase = normalizePhase(
    selectedAction?.phase ?? selectedAction?.street ?? hand.phase ?? hand.street,
  );
  return {
    keyHandId: normalized.handId,
    handId: normalized.handId,
    variantId: normalized.variantId,
    reason,
    label: label ?? title ?? copy.title,
    title: title ?? label ?? copy.title,
    description: description ?? copy.description,
    phase,
    street: phase,
    heroAction: selectedAction ? normalizeActionType(selectedAction) : null,
    pot: getHandPot(hand),
    heroNet: normalized.heroNet,
    resultDelta: normalized.heroNet,
    actionSeqRange: selectedRange,
    reasonTags: [reason],
    evidence: [
      {
        reason,
        handId: normalized.handId,
        actionSeqRange: selectedRange,
        phase,
        heroAction: selectedAction ? normalizeActionType(selectedAction) : null,
      },
    ],
    replayRef,
  };
}

function mergeKeyHands(entries = []) {
  const merged = new Map();
  entries.filter(Boolean).forEach((entry) => {
    if (!entry?.handId) return;
    const current = merged.get(entry.handId);
    if (!current) {
      merged.set(entry.handId, {
        ...entry,
        keyHandId: entry.handId,
        reasonTags: [...new Set(entry.reasonTags ?? [entry.reason])],
        evidence: [...(entry.evidence ?? [])],
      });
      return;
    }
    const reasonTags = [
      ...(current.reasonTags ?? [current.reason]),
      ...(entry.reasonTags ?? [entry.reason]),
    ].filter(Boolean);
    const evidence = [...(current.evidence ?? []), ...(entry.evidence ?? [])].filter(
      (item, index, list) =>
        list.findIndex(
          (candidate) =>
            candidate.reason === item.reason &&
            candidate.handId === item.handId &&
            candidate.actionSeqRange?.start === item.actionSeqRange?.start &&
            candidate.actionSeqRange?.end === item.actionSeqRange?.end,
        ) === index,
    );
    merged.set(entry.handId, {
      ...current,
      reasonTags: [...new Set(reasonTags)],
      evidence,
    });
  });
  return [...merged.values()];
}

function buildTournamentKeyHands(hands = [], heroSeat = 0) {
  const safeHands = Array.isArray(hands) ? hands : [];
  const biggestWinHand = [...safeHands]
    .filter((hand) => getHandHeroNet(hand) > 0)
    .sort((a, b) => getHandHeroNet(b) - getHandHeroNet(a))[0] ?? null;
  const biggestLossHand = [...safeHands]
    .filter((hand) => getHandHeroNet(hand) < 0)
    .sort((a, b) => getHandHeroNet(a) - getHandHeroNet(b))[0] ?? null;
  const bustHand =
    [...safeHands].reverse().find((hand) => {
      if (hand?.bustHand === true || hand?.heroBusted === true) return true;
      return (Array.isArray(hand?.seats) ? hand.seats : []).some(
        (seat) => isHeroSeat(seat, heroSeat) && (seat.busted === true || seat.stack === 0),
      );
    }) ?? null;
  const heroAllInHand =
    safeHands.find((hand) => collectHeroActions(hand, heroSeat).some(isAllInAction)) ?? null;
  const showdownHand = safeHands.find(hasShowdownEvidence) ?? null;
  const largePotHand = [...safeHands].sort((a, b) => getHandPot(b) - getHandPot(a))[0] ?? null;
  const drawDecisionHand =
    safeHands.find((hand) => collectHeroActions(hand, heroSeat).some(isDrawAction)) ?? null;
  const finalHand = safeHands[safeHands.length - 1] ?? null;

  const biggestWin = buildKeyHand({
    hand: biggestWinHand,
    reason: "biggest-win",
    label: "Biggest win",
    heroSeat,
  });
  const biggestLoss = buildKeyHand({
    hand: biggestLossHand,
    reason: "biggest-loss",
    label: "Biggest loss",
    heroSeat,
  });
  const bust = buildKeyHand({
    hand: bustHand,
    reason: "bust-hand",
    label: "Bust hand",
    heroSeat,
  });
  const keyHands = mergeKeyHands([
    bust,
    biggestLoss,
    biggestWin,
    buildKeyHand({ hand: heroAllInHand, reason: "hero-all-in", heroSeat }),
    buildKeyHand({ hand: showdownHand, reason: "showdown", heroSeat }),
    buildKeyHand({ hand: largePotHand, reason: "large-pot", heroSeat }),
    buildKeyHand({ hand: drawDecisionHand, reason: "draw-decision", heroSeat }),
    buildKeyHand({ hand: finalHand, reason: "final-hand", heroSeat }),
  ]).slice(0, 8);

  return {
    bustHand: bust,
    biggestWin,
    biggestLoss,
    keyHands,
    replayRefs: keyHands.map((entry) => entry.replayRef).filter(Boolean),
  };
}

function normalizeFeedbackStatus({
  requestState = {},
  savedFeedback = null,
  hasAuth = false,
  handCount = 0,
  heroActionCount = 0,
} = {}) {
  if (requestState.loading) {
    return {
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.LOADING,
      reason: "request_in_flight",
      hasAuth,
      error: null,
      source: null,
      feedbackId: null,
      sessionKey: null,
      storedAt: null,
    };
  }
  if (requestState.error) {
    return {
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.ERROR,
      reason: "request_failed",
      hasAuth,
      error: String(requestState.error),
      source: null,
      feedbackId: null,
      sessionKey: null,
      storedAt: null,
    };
  }
  const response = requestState.response ?? savedFeedback?.response ?? null;
  if (response) {
    return {
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.COMPLETE,
      reason: "feedback_available",
      hasAuth,
      error: null,
      source: response.source ?? savedFeedback?.source ?? null,
      feedbackId: response.feedbackId ?? savedFeedback?.id ?? null,
      sessionKey: response.sessionKey ?? savedFeedback?.sessionKey ?? null,
      storedAt: response.storedAt ?? savedFeedback?.createdAt ?? null,
    };
  }
  if (handCount === 0 || heroActionCount === 0) {
    return {
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.INSUFFICIENT_LOGS,
      reason: "insufficient_logs",
      hasAuth,
      error: null,
      source: "local-summary",
      feedbackId: null,
      sessionKey: null,
      storedAt: null,
    };
  }
  if (!hasAuth) {
    return {
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.UNAUTHENTICATED,
      reason: "login_required_for_saved_ai_review",
      hasAuth,
      error: null,
      source: "local-summary",
      feedbackId: null,
      sessionKey: null,
      storedAt: null,
    };
  }
  return {
    state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.SUMMARY,
    reason: "local_summary_ready",
    hasAuth,
    error: null,
    source: "local-summary",
    feedbackId: null,
    sessionKey: null,
    storedAt: null,
  };
}

function evidenceForKeyHand(keyHand) {
  if (!keyHand?.handId) return [];
  const evidence = Array.isArray(keyHand.evidence) ? keyHand.evidence : [];
  if (evidence.length) return evidence;
  return [
    {
      reason: keyHand.reason ?? "key-hand",
      handId: keyHand.handId,
      actionSeqRange: keyHand.actionSeqRange ?? null,
      phase: keyHand.phase ?? null,
      heroAction: keyHand.heroAction ?? null,
    },
  ];
}

function reviewItem({ text, kind, keyHand = null, caveat = null }) {
  return {
    kind,
    text,
    evidence: evidenceForKeyHand(keyHand),
    caveat,
  };
}

function findKeyHand(keyHands = [], reason) {
  return keyHands.find((hand) =>
    (hand.reasonTags ?? [hand.reason]).includes(reason),
  ) ?? null;
}

function buildLocalReviewSummary({
  feedbackStatus = {},
  handCount = 0,
  heroActionCount = 0,
  result = {},
  keyHands = [],
} = {}) {
  const biggestWin = findKeyHand(keyHands, "biggest-win");
  const biggestLoss = findKeyHand(keyHands, "biggest-loss");
  const drawDecision = findKeyHand(keyHands, "draw-decision");
  const firstEvidenceHand = keyHands[0] ?? null;
  const facts = [
    reviewItem({
      kind: "fact",
      text: `記録されたハンドは${handCount}件、Heroのアクションは${heroActionCount}件です。`,
    }),
  ];
  if (result.placement != null || Number.isFinite(result.payout)) {
    facts.push(
      reviewItem({
        kind: "fact",
        text: `大会結果は${result.placement ?? "--"}位、獲得賞金は${toNumber(result.payout, 0)}です。`,
      }),
    );
  }
  if (biggestWin) {
    facts.push(
      reviewItem({
        kind: "fact",
        text: `Hand ${biggestWin.handId}で記録上最大のチップ増加（${biggestWin.heroNet >= 0 ? "+" : ""}${biggestWin.heroNet}）がありました。`,
        keyHand: biggestWin,
      }),
    );
  }
  if (biggestLoss) {
    facts.push(
      reviewItem({
        kind: "fact",
        text: `Hand ${biggestLoss.handId}で記録上最大のチップ減少（${biggestLoss.heroNet}）がありました。`,
        keyHand: biggestLoss,
      }),
    );
  }

  const goodPoints = [];
  if (biggestWin) {
    goodPoints.push(
      reviewItem({
        kind: "interpretation",
        text: `Hand ${biggestWin.handId}は獲得局面の判断過程を確認する候補です。`,
        keyHand: biggestWin,
        caveat: "チップ増加だけでは、その判断が最善だったとは断定できません。",
      }),
    );
  } else if (firstEvidenceHand) {
    goodPoints.push(
      reviewItem({
        kind: "interpretation",
        text: `Hand ${firstEvidenceHand.handId}には具体的なアクション記録があり、判断過程を振り返れます。`,
        keyHand: firstEvidenceHand,
        caveat: "大会順位や収支だけから判断の質は評価しません。",
      }),
    );
  }

  const improvementPoints = [];
  if (biggestLoss) {
    improvementPoints.push(
      reviewItem({
        kind: "interpretation",
        text: `Hand ${biggestLoss.handId}は損失局面の選択肢を比較する候補です。`,
        keyHand: biggestLoss,
        caveat: "損失した事実だけでは、ミスだったとは断定できません。",
      }),
    );
  }
  if (drawDecision && drawDecision.handId !== biggestLoss?.handId) {
    improvementPoints.push(
      reviewItem({
        kind: "interpretation",
        text: `Hand ${drawDecision.handId}のドロー枚数と、その時点の選択肢を再確認できます。`,
        keyHand: drawDecision,
        caveat: "最終結果だけではドロー判断の良否は決まりません。",
      }),
    );
  }

  const actionTarget = biggestLoss ?? drawDecision ?? biggestWin ?? firstEvidenceHand;
  const nextActions = actionTarget
    ? [
        reviewItem({
          kind: "next-action",
          text: `Hand ${actionTarget.handId}をリプレイし、表示されたHero actionと当時のlegal actionsを比較してください。`,
          keyHand: actionTarget,
        }),
      ]
    : [
        reviewItem({
          kind: "next-action",
          text: "次回はハンド履歴とHero actionが残る状態でプレイしてください。",
        }),
      ];

  return {
    state: feedbackStatus.state ?? TOURNAMENT_REVIEW_FEEDBACK_STATUS.SUMMARY,
    source: "local-summary",
    reviewedHands: handCount,
    heroActionCount,
    keyHandCount: keyHands.length,
    facts,
    goodPoints,
    improvementPoints,
    interpretations: [...goodPoints, ...improvementPoints],
    nextActions,
    causalDisclaimer:
      "順位・ROI・単一ハンドの結果だけから、意思決定の良否や結果との因果関係は断定しません。",
  };
}

function normalizeAiEvidence(evidence, knownHands, heroActions) {
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  const normalized = evidence.map((entry) => {
    const handId = nullableString(entry?.handId);
    if (!handId || !knownHands.has(handId)) return null;
    const start = Number(entry?.actionSeqStart ?? entry?.actionSeqRange?.start);
    const end = Number(entry?.actionSeqEnd ?? entry?.actionSeqRange?.end ?? start);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
      return null;
    }
    const actionExists = heroActions.some(
      (action) =>
        action.handId === handId &&
        Number.isInteger(action.actionSeq) &&
        action.actionSeq >= start &&
        action.actionSeq <= end,
    );
    if (!actionExists) return null;
    return { handId, actionSeqRange: { start, end } };
  });
  return normalized.every(Boolean) ? normalized : null;
}

function normalizeAiItems(items, kind, knownHands, heroActions) {
  if (!Array.isArray(items)) return null;
  const normalized = items.slice(0, 4).map((item) => {
    if (!item || typeof item !== "object") return null;
    const text = nullableString(item.text);
    const evidence = normalizeAiEvidence(item.evidence, knownHands, heroActions);
    if (!text || text.length > 240 || !evidence) return null;
    return {
      kind,
      text,
      evidence,
      caveat:
        kind === "interpretation"
          ? nullableString(item.caveat) ??
            "結果だけから意思決定の良否や因果関係は断定できません。"
          : null,
    };
  });
  return normalized.every(Boolean) ? normalized : null;
}

function normalizeStructuredAiReview(response, keyHands, heroActions) {
  const payload = response?.reviewV2 ?? response?.structuredReview ?? null;
  if (!payload || typeof payload !== "object" || Number(payload.schemaVersion) !== 2) {
    return { accepted: false, reason: "structured-review-v2-missing", summary: null };
  }
  const knownHands = new Set(keyHands.map((hand) => hand.handId));
  const facts = normalizeAiItems(payload.facts, "fact", knownHands, heroActions);
  const goodPoints = normalizeAiItems(
    payload.goodPoints,
    "interpretation",
    knownHands,
    heroActions,
  );
  const improvementPoints = normalizeAiItems(
    payload.improvementPoints,
    "interpretation",
    knownHands,
    heroActions,
  );
  const nextActions = normalizeAiItems(
    payload.nextActions,
    "next-action",
    knownHands,
    heroActions,
  );
  if (
    !facts ||
    !facts.length ||
    !goodPoints ||
    !improvementPoints ||
    !nextActions ||
    !nextActions.length
  ) {
    return { accepted: false, reason: "invalid-or-ungrounded-ai-review", summary: null };
  }
  return {
    accepted: true,
    reason: null,
    summary: {
      facts,
      goodPoints,
      improvementPoints,
      interpretations: [...goodPoints, ...improvementPoints],
      nextActions,
      causalDisclaimer:
        "AIの解釈は参考情報です。順位・ROI・結果だけから因果関係を断定しません。",
    },
  };
}

/**
 * @typedef {Object} TournamentReviewContract
 * @property {string} contractType
 * @property {number} schemaVersion
 * @property {string|null} tournamentId
 * @property {string} variantId
 * @property {string[]} variantIds
 * @property {number|null} placement
 * @property {number} payout
 * @property {number|null} roi
 * @property {number} heroNet
 * @property {number} totalHands
 * @property {Object[]} hands
 * @property {Object[]} heroActions
 * @property {Object|null} bustHand
 * @property {Object|null} biggestWin
 * @property {Object|null} biggestLoss
 * @property {Object[]} keyHands
 * @property {Object} result
 * @property {Object[]} replayRefs
 * @property {Object} reviewSummary
 * @property {Object} dataQuality
 * @property {Object} feedbackStatus
 */
export function buildTournamentReviewContract({
  tournament = {},
  hands = [],
  placements = [],
  heroSeat = 0,
  heroPlayerId = null,
  requestState = {},
  savedFeedback = null,
  hasAuth = false,
} = {}) {
  const safeHands = dedupeHandsById(hands, heroSeat);
  const tournamentId = getTournamentId(tournament);
  const normalizedHands = safeHands.map((hand) => normalizeHand(hand, heroSeat));
  const variantIds = [...new Set(normalizedHands.map((hand) => hand.variantId).filter(Boolean))];
  const variantId = variantIds.length === 1 ? variantIds[0] : variantIds.length > 1 ? "mixed" : "unknown";
  const result = buildResult({ tournament, placements, heroPlayerId });
  const heroActions = safeHands.flatMap((hand) =>
    collectHeroActions(hand, heroSeat).map((action) => normalizeAction(action, hand, heroSeat)),
  );
  const { bustHand, biggestWin, biggestLoss, keyHands, replayRefs } =
    buildTournamentKeyHands(safeHands, heroSeat);
  const handCount = normalizedHands.length;
  const heroActionCount = heroActions.length;
  const aggregateHeroNet = normalizedHands.reduce((sum, hand) => sum + toNumber(hand.heroNet, 0), 0);
  const heroNet = toNumber(
    tournament.heroNet ?? tournament.netResult ?? tournament.result?.heroNet,
    aggregateHeroNet,
  );
  const feedbackStatus = normalizeFeedbackStatus({
    requestState,
    savedFeedback,
    hasAuth,
    handCount,
    heroActionCount,
  });
  const localReviewSummary = buildLocalReviewSummary({
    feedbackStatus,
    handCount,
    heroActionCount,
    result,
    keyHands,
  });
  const rawAiResponse = requestState.response ?? savedFeedback?.response ?? null;
  const structuredAiReview = normalizeStructuredAiReview(
    rawAiResponse,
    keyHands,
    heroActions,
  );
  const reviewSummary = structuredAiReview.accepted
    ? {
        ...localReviewSummary,
        ...structuredAiReview.summary,
        source: "structured-ai",
      }
    : localReviewSummary;
  const limitations = [];
  if (!handCount) limitations.push("hand-history-missing");
  if (!heroActionCount) limitations.push("hero-actions-missing");
  if (result.placement !== 1 && !bustHand) limitations.push("bust-hand-not-identified");
  if (!replayRefs.length) limitations.push("replay-refs-missing");

  return {
    contractType: TOURNAMENT_REVIEW_CONTRACT_TYPE,
    schemaVersion: TOURNAMENT_REVIEW_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "tournament",
    tournamentId,
    title: result.title,
    variantId,
    variantIds,
    placement: result.placement,
    payout: result.payout,
    roi: result.roi,
    heroNet,
    totalHands: handCount,
    hands: normalizedHands,
    heroActions,
    bustHand,
    biggestWin,
    biggestLoss,
    keyHands,
    result,
    replayRefs,
    reviewSummary,
    reviewDepth:
      structuredAiReview.accepted
        ? "ai-assisted"
        : handCount && heroActionCount
          ? "hand-history"
          : "result-only",
    dataQuality: {
      hasResult: Boolean(result),
      handCount,
      totalHands: handCount,
      heroActionCount,
      hasBustHand: Boolean(bustHand),
      hasReplayRefs: replayRefs.length > 0,
      limitations,
    },
    nextImprovements: {
      source: reviewSummary.source,
      items: reviewSummary.nextActions.map((item) => item.text),
    },
    feedbackStatus: {
      ...feedbackStatus,
      handCount,
      totalHands: handCount,
      heroActionCount,
    },
    aiFeedback: {
      enabled: structuredAiReview.accepted,
      optional: true,
      state: feedbackStatus.state,
      source: structuredAiReview.accepted ? "structured-ai" : "local-summary",
      accepted: structuredAiReview.accepted,
      rejectionReason: structuredAiReview.reason,
      response: structuredAiReview.accepted ? rawAiResponse : null,
      error: feedbackStatus.error,
    },
  };
}

export function isTournamentReviewContract(value) {
  return Boolean(
    value?.contractType === TOURNAMENT_REVIEW_CONTRACT_TYPE &&
      value?.schemaVersion === TOURNAMENT_REVIEW_SCHEMA_VERSION &&
      value?.mode === "tournament" &&
      Array.isArray(value?.hands) &&
      Array.isArray(value?.heroActions) &&
      Array.isArray(value?.keyHands) &&
      Array.isArray(value?.replayRefs) &&
      value?.result &&
      value?.dataQuality &&
      value?.feedbackStatus
  );
}
