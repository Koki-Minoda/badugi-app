import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCardLabel } from "../utils/cardLabel.js";
import BadugiTrainingTable from "./BadugiTrainingTable.jsx";
import ReviewPracticeLink from "../practice/ReviewPracticeLink.jsx";
import { validatePracticeSetup } from "../practice/practiceSetup.js";

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

function cardsAtDecision(hero, previousFrames) {
  let cards = validatePracticeSetup("badugi", hero.initialHand) ? hero.initialHand : null;
  for (const { event } of previousFrames) {
    if (event?.seat !== hero.seat || event.type !== "DRAW_ACTION") continue;
    const count = drawCount(event);
    if (count === 0) continue;

    const detail = hero.actions?.find(({ seq }) => seq === event.actionSeq);
    const drawInfo = event.drawInfo ?? detail?.metadata?.drawInfo;
    const after = event.after ?? drawInfo?.after ?? drawInfo?.handAfter
      ?? event.playersAfter?.find(({ seat }) => seat === hero.seat)?.hand;
    if (validatePracticeSetup("badugi", after)) {
      cards = after;
      continue;
    }

    const replacements = event.replacedCards ?? drawInfo?.replacedCards;
    const indexes = Array.isArray(replacements) ? replacements.map(entry => entry?.index) : [];
    if (!cards || !indexes.length || (count !== null && indexes.length !== count)
      || new Set(indexes).size !== indexes.length
      || indexes.some(index => !Number.isInteger(index) || index < 0 || index >= cards.length)) {
      cards = null;
      continue;
    }
    const next = [...cards];
    replacements.forEach(({ index, newCard }) => { next[index] = newCard; });
    cards = validatePracticeSetup("badugi", next) ? next : null;
  }
  return cards;
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

function ReplayGameDialog({ onClose, title, children }) {
  const dialog = useRef(null);
  const content = useRef(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    element.showModal();
    content.current.focus();
    return () => element.close();
  }, []);
  return createPortal(
    <dialog ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-gray-900">
      <div ref={content} tabIndex={-1} className="outline-none">{children}</div>
    </dialog>,
    document.body,
  );
}

export default function BadugiReplayDecisionPreview({ hand, frames, frameIndex, onJump, onPause, language }) {
  const [openFrame, setOpenFrame] = useState(null);
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
  const cards = atDecision ? cardsAtDecision(hero, previousFrames) : null;
  const pot = atDecision ? recordedPotBefore(before, previousFrames) : null;
  const blinds = previousFrames.find(({ event }) => event?.type === "BLINDS_POSTED")?.event;
  const dealer = hand.buttonSeat ?? hand.dealerSeat ?? blinds?.buttonSeat;
  const previousDraws = new Map();
  for (const { event } of previousFrames) {
    if (event?.type === "DRAW_ACTION") previousDraws.set(event.seat, drawCount(event));
  }
  const tablePlayers = Array(6);
  for (const { seat, name, stack, folded, allIn, betThisRound } of before?.players ?? []) {
    if (!Number.isInteger(seat) || seat < 0 || seat >= tablePlayers.length) continue;
    tablePlayers[seat] = {
      name, stack, folded, allIn, betThisRound, lastDrawCount: previousDraws.get(seat),
      hand: seat === hero.seat ? (cards ?? []) : Array(4).fill(null),
      position: seat === blinds?.sbSeat ? 'SB' : seat === blinds?.bbSeat ? 'BB' : undefined,
    };
  }
  const drawing = selected?.type === "DRAW_ACTION";
  const streetStart = previousFrames.findLastIndex(({ event }) => event?.type === "PHASE_TRANSITION" && event.to === "BET");
  const streetBets = previousFrames.slice(streetStart + 1).filter(({ event }) => event?.type === "BET_ACTION");
  const hasBetAmounts = Boolean(blinds || streetStart >= 0) && streetBets.every(({ event }) =>
    Number.isFinite(event.amount) || Number.isFinite(event.betAfter),
  );
  const currentBet = hasBetAmounts ? Math.max(0, ...(before?.players ?? []).map(player => player.betThisRound ?? 0)) : null;
  const raiseCount = streetBets.filter(({ event }) => event.action === "raise").length;
  const round = selected?.drawRound ?? previousFrames.filter(({ event }) =>
    event?.type === "PHASE_TRANSITION" && event.to === "DRAW").length;
  const viewTitle = ja ? "操作前の対局画面" : "Table before your action";
  const closeTable = () => setOpenFrame(null);
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
          {tablePlayers[hero.seat] && (
            <button type="button" onClick={() => { onPause(); setOpenFrame(frameIndex); }}
              className="min-h-11 rounded-xl border border-sky-300/40 px-4 text-sm font-semibold text-sky-100">
              {ja ? "対局画面で見る" : "View at the table"}
            </button>
          )}
          {tablePlayers[hero.seat] && openFrame === frameIndex && (
            <ReplayGameDialog title={viewTitle} onClose={closeTable}>
              <BadugiTrainingTable players={tablePlayers} heroSeat={hero.seat} actor={hero.seat}
                dealer={dealer} phase={drawing ? "DRAW" : "BET"} pot={pot} language={language}
                smallBlind={blinds?.sbAmount ?? "–"} bigBlind={blinds?.bbAmount ?? "–"}
                drawRound={round} betRound={drawing ? Math.max(0, round - 1) : round} currentBet={currentBet} raiseCount={raiseCount}
                raiseUnit={Number.isFinite(blinds?.bbAmount) ? blinds.bbAmount * (round >= 2 ? 2 : 1) : "–"}
                exitLabel={ja ? "判断の振り返りに戻る" : "Back to decision review"} onExit={closeTable} />
            </ReplayGameDialog>
          )}
          <div className="space-y-1 rounded-xl bg-slate-800/75 p-3 text-sm">
            <p>{ja ? "操作前の自分の手札" : "Your cards before acting"} {cards ? (
              <strong data-testid="badugi-replay-before-cards">{cards.map(formatCardLabel).join(" ")}</strong>
            ) : (ja ? "記録なし" : "Unavailable")}</p>
            <p>{ja ? "操作前のポット" : "Pot before acting"} {pot == null
              ? (ja ? "記録なし" : "Unavailable") : number.format(pot)}</p>
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
          <ReviewPracticeLink hand={{ variantId: "badugi", seats: [hero] }} language={language} source="replay" />
        </>
      ) : (
        <button type="button" onClick={() => { onPause(); onJump(firstDecision); }}
          className="min-h-11 rounded-xl border border-sky-300/40 px-4 text-sm font-semibold text-sky-100">
          {ja ? "最初の判断へ" : "Go to your first decision"}
        </button>
      )}
    </section>
  );
}
