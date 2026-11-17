import React from "react";
import BadugiTrainingTable from "./BadugiTrainingTable.jsx";
import ReviewPracticeLink from "../practice/ReviewPracticeLink.jsx";
import { validatePracticeSetup } from "../practice/practiceSetup.js";
import { reviewVariant } from "../review/reviewStore.js";

const actionNames = {
  fold: ["フォールド", "Fold"],
  check: ["チェック", "Check"],
  call: ["コール", "Call"],
  bet: ["ベット", "Bet"],
  raise: ["レイズ", "Raise"],
  allin: ["オールイン", "All-in"],
};

function actionLabel(action, ja) {
  return Object.hasOwn(actionNames, action) ? actionNames[action][ja ? 0 : 1] : null;
}

function isDecision(event) {
  return event?.type === "BET_ACTION" || event?.type === "DRAW_ACTION";
}

function drawCount(event) {
  const count = event.drawCount ?? (Array.isArray(event.discarded) ? event.discarded.length : null);
  return Number.isInteger(count) && count >= 0 && count <= 4 ? count : null;
}

function describeAction(event, ja, number) {
  if (event.type === "DRAW_ACTION") {
    const count = drawCount(event);
    if (count === null) return ja ? "交換枚数の記録なし" : "Draw count unavailable";
    return ja ? `${count}枚交換` : `Draw ${count}`;
  }
  const action = actionLabel(event.action, ja) ?? (ja ? "ベット操作" : "Betting action");
  return Number.isFinite(event.amount) && event.amount > 0
    ? `${action} ${number.format(event.amount)}`
    : action;
}

function getHero(hand) {
  const seats = hand.seats ?? [];
  const markedHeroes = seats.filter((seat) => seat?.isHero === true);
  if (markedHeroes.length > 1) return null;
  const [markedHero] = markedHeroes;
  if (!Number.isInteger(hand.heroSeat)) return Number.isInteger(markedHero?.seat) ? markedHero : null;
  if (markedHero && markedHero.seat !== hand.heroSeat) return null;
  return seats.find((seat) => seat?.seat === hand.heroSeat && seat.isHero !== false) ?? null;
}

function cardsAtDecision(hero, before, previousFrames) {
  if (!validatePracticeSetup("badugi", hero.initialHand)) return null;
  const lastDraw = previousFrames.findLast(({ event }) =>
    event?.seat === hero.seat && event.type === "DRAW_ACTION" && drawCount(event) !== 0,
  )?.event;
  if (lastDraw) {
    const detail = hero.actions?.find(({ seq }) => seq === lastDraw.actionSeq);
    const drawInfo = lastDraw.drawInfo ?? detail?.metadata?.drawInfo;
    const after = lastDraw.after ?? drawInfo?.after ?? drawInfo?.handAfter
      ?? lastDraw.playersAfter?.find(({ seat }) => seat === hero.seat)?.hand;
    const replacements = lastDraw.replacedCards ?? drawInfo?.replacedCards;
    if (!validatePracticeSetup("badugi", after) && !replacements?.length) return null;
  }
  const cards = before?.players.find(({ seat }) => seat === hero.seat)?.hand;
  return validatePracticeSetup("badugi", cards) ? cards : null;
}

function recordedPotBefore(before, previousFrames) {
  const latestPotEvent = previousFrames.findLast(({ event }) =>
    event?.type === "BET_ACTION" || (event?.type === "DRAW_ACTION" && Number.isFinite(event.potAfter)),
  )?.event;
  // Replay retains the preceding pot when a legacy BET event omitted potAfter.
  if (latestPotEvent && !Number.isFinite(latestPotEvent.potAfter)) return null;
  if (!latestPotEvent && !previousFrames.some(({ event }) => event?.type === "BLINDS_POSTED")) return null;
  return Number.isFinite(before?.pot) ? before.pot : null;
}

export default function BadugiReplayDecisionPreview({ hand, frames, frameIndex, onJump, language }) {
  if (reviewVariant(hand) !== "badugi") return null;
  const hero = getHero(hand);
  const selected = frames[frameIndex]?.event;
  const isHeroDecision = (event) => isDecision(event) && event.seat === hero?.seat;
  const firstDecision = hero ? frames.findIndex(({ event }) => isHeroDecision(event)) : -1;
  if (firstDecision === -1) return null;

  const ja = language === "ja";
  const number = new Intl.NumberFormat(ja ? "ja-JP" : "en");
  const title = ja ? "判断の振り返り" : "Review your decision";
  const atDecision = isHeroDecision(selected);
  const before = frames[frameIndex - 1];
  const previousFrames = atDecision ? frames.slice(0, frameIndex) : [];
  const cards = atDecision ? cardsAtDecision(hero, before, previousFrames) : null;
  const pot = atDecision ? recordedPotBefore(before, previousFrames) : null;
  const blinds = previousFrames.find(({ event }) => event?.type === "BLINDS_POSTED")?.event;
  const dealer = hand.buttonSeat ?? hand.dealerSeat ?? blinds?.buttonSeat;
  const tablePlayers = before?.players.map(({ seat, name, stack, folded, allIn, betThisRound }) => ({
    seat, name, stack, folded, allIn, betThisRound,
    hand: seat === hero.seat ? (cards ?? []) : Array(4).fill(null),
    position: seat === dealer ? "BTN" : seat === blinds?.sbSeat ? "SB" : seat === blinds?.bbSeat ? "BB" : undefined,
  }));
  const drawing = selected?.type === "DRAW_ACTION";
  const phaseLabel = drawing ? (ja ? "交換" : "Draw") : (ja ? "ベット" : "Betting");
  const otherActions = previousFrames
    .filter(({ event }) => isDecision(event) && Number.isInteger(event.seat) && event.seat !== hero.seat)
    .slice(-4);
  const recordedDecision = Number.isInteger(selected?.actionSeq)
    ? hero.actions?.find(({ seq }) => seq === selected.actionSeq) : null;
  const recordedLegal = recordedDecision?.legalActions ?? selected?.legalActions;
  const legal = Array.isArray(recordedLegal)
    ? recordedLegal.map((action) => actionLabel(action, ja)).filter(Boolean)
    : [];

  return (
    <section aria-label={title} data-testid="badugi-replay-decision-preview"
      className="space-y-4 rounded-2xl border border-sky-300/30 bg-slate-900/90 p-4 text-slate-100 sm:p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {atDecision ? (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-sky-100">{ja ? "操作前の卓" : "Table before your action"}</h3>
            <BadugiTrainingTable players={tablePlayers ?? []} heroSeat={hero.seat} actor={hero.seat}
              dealer={dealer} phase={drawing ? "DRAW" : "BET"} phaseLabel={phaseLabel} pot={pot}
              potLabel={ja ? "操作前のポット" : "Pot before acting"}
              heroTestId="badugi-replay-before-cards" language={language} />
            {!cards && <p className="text-sm text-slate-300">{ja ? "手札の記録なし" : "Cards unavailable"}</p>}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-sky-100">{ja ? "それまでの相手の操作" : "Recent opponent actions"}</h3>
            {otherActions.length ? (
              <ol className="space-y-1 text-sm text-slate-300" data-testid="badugi-replay-public-actions">
                {otherActions.map(({ event, index }) => (
                  <li key={index}>{ja ? "席" : "Seat "}{event.seat + 1} · {describeAction(event, ja, number)}</li>
                ))}
              </ol>
            ) : <p className="text-sm text-slate-300">{ja ? "記録された操作なし" : "No recorded actions yet"}</p>}
          </div>
          <div className="space-y-1 rounded-xl bg-slate-800/75 p-3 text-sm">
            <p>{ja ? "選んだ操作" : "Your action"} <strong>{describeAction(selected, ja, number)}</strong></p>
            {legal.length > 0 && <p>{ja ? "その場で選べた操作" : "Available actions"} {legal.join(" · ")}</p>}
            <p className="text-amber-100"><strong>{ja ? "EV差 — 採点保留" : "EV difference — unscored"}</strong></p>
            <p className="text-slate-300">{ja ? "この局面の行動別EVは品質確認を終えていません。" : "Action EV for this decision is awaiting validation."}</p>
          </div>
          <ReviewPracticeLink hand={{ variantId: "badugi", seats: [hero] }} language={language} replayPreview />
        </>
      ) : (
        <button type="button" onClick={() => onJump(firstDecision)}
          className="min-h-11 rounded-xl border border-sky-300/40 px-4 text-sm font-semibold text-sky-100">
          {ja ? "最初の判断へ" : "Go to your first decision"}
        </button>
      )}
    </section>
  );
}
