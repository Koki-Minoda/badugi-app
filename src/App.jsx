// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Player from "./components/Player";
import Controls from "./components/Controls";
import { createDeck, shuffleDeck } from "./utils/deck";
import { runDrawRound } from "./gameLogic/drawRound";
import { runShowdown } from "./gameLogic/showdown";
import { evaluateBadugi } from "./utils/badugi";
import {
  alivePlayers,
  nextAliveFrom,
  maxBetThisRound,
  settleStreetToPots,
  isBetRoundComplete,
} from "./gameLogic/roundFlow";

// 履歴保存API
import {
  saveRLHandHistory as saveHandHistory,
  getAllRLHandHistories as getAllHandHistories,
  exportRLHistoryAsJSONL as exportHistoryAsJSONL,
} from "./utils/history_rl";


export default function App() {
  /* --- constants --- */
  const NUM_PLAYERS = 6;
  const SB = 10;
  const BB = 20;
  const betSize = BB;
  const MAX_DRAWS = 3; // DRAWは3回（= DRAW1,2,3）

  /* --- states --- */
  const [players, setPlayers] = useState([]);
  const [deck, setDeck] = useState([]);
  const [dealerIdx, setDealerIdx] = useState(0);

  const [phase, setPhase] = useState("BET"); // BET / DRAW / SHOWDOWN

  // 新規追加：BETラウンド開始時の先頭プレイヤーを保持
  const [drawRound, setDrawRound] = useState(0); // 完了したDRAW数 0..3
  // states
  const [raisePerRound, setRaisePerRound] = useState([0, 0, 0, 0]); // 各BETラウンドの合計Raise回数
  const [raisePerSeatRound, setRaisePerSeatRound] = useState(
    () => Array(NUM_PLAYERS).fill(0).map(() => [0, 0, 0, 0]) // [seat][round]
  );
  // === 新規: 行動ログ（AI学習用） ===
  const [actionLog, setActionLog] = useState([]);

  // 便利ヘルパー：今がどのBETラウンドか（0=プリ, 1=1回目後, 2=2回目後, 3=3回目後）
  function currentBetRoundIndex() {
    // drawRound=0 の間はプリドローBET中なので 0、
    // 以降は drawRound と同じ番号（最大3）でOK
    return Math.min(drawRound, 3);
  }

  
  const [pots, setPots] = useState([]);

  const [turn, setTurn] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);

    // 各BETラウンドのRaise回数を記録
  const [raiseCountThisRound, setRaiseCountThisRound] = useState(0);


  // 再入防止：ラウンド遷移やNPC処理が二重発火しておかしくならないように
  const [transitioning, setTransitioning] = useState(false);
  const [betHead, setBetHead] = useState(null);
  const [showNextButton, setShowNextButton] = useState(false);

  // ▼ 追記：このハンドを保存済みかどうか（多重保存防止）
  const handSavedRef = useRef(false);
  // 便宜上の handId（ディーラー座席＋タイムスタンプ）
  const handIdRef = useRef(null);

  // ▼ デバッグトグル追加
  const [debugMode, setDebugMode] = useState(false);
  function debugLog(...args) {
    if (debugMode) console.log(...args);
  }
  
  // ======== DEBUG LOGGER (add just under debugLog) ========
const actionSeqRef = useRef(0); // 連番

function betRoundNo() {
  // BET の回数は「完了した DRAW 数」に一致（0..3）
  return Math.min(drawRound, MAX_DRAWS);
}
function drawRoundNo() {
  // 表示用（1..3）
  return Math.min(drawRound + 1, MAX_DRAWS);
}
function phaseTagLocal() {
  if (phase === "BET")  return `BET#${betRoundNo()}`;
  if (phase === "DRAW") return `DRAW#${drawRoundNo()}`;
  return "SHOWDOWN";
}

function logState(tag, snap = players) {
  if (!debugMode) return;
  const head = `[${phaseTagLocal()}] ${tag} (turn=${turn}, betHead=${betHead}, currentBet=${currentBet})`;
  console.groupCollapsed(head);
  try {
    console.table(
      snap.map((p, i) => ({
        i,
        name: p.name,
        act: p.lastAction || "",
        folded: p.folded ? "✓" : "",
        allIn: p.allIn ? "✓" : "",
        stack: p.stack,
        betThisRound: p.betThisRound,
        drawn: p.hasDrawn ? "✓" : "",
      }))
    );
    console.log("pots:", pots, "totalPot:", totalPotForDisplay);
  } finally {
    console.groupEnd();
  }
}

function logAction(i, type, payload = {}) {
  if (!debugMode) return;
  const seq = ++actionSeqRef.current;
  const nm = players[i]?.name ?? `P${i}`;
  console.log(`[${phaseTagLocal()}][#${seq}] ${nm} ${type}`, payload);
}

// === 新規: 行動記録をAI学習用ログに保存 ===
function recordActionToLog({ round, seat, type, stackBefore, betAfter, raiseCountTable }) {
  setActionLog(prev => [
    ...prev,
    {
      round,
      seat,
      type,
      stackBefore,
      betAfter,
      raiseCountTable,
      ts: Date.now(),
    }
  ]);
}

  /* --- utils --- */
  function makeEmptyPlayers() {
    const names = ["You", "P2", "P3", "P4", "P5", "P6"];
    return Array.from({ length: NUM_PLAYERS }, (_, i) => ({
      name: names[i] ?? `P${i + 1}`,
      hand: [],
      folded: false,
      allIn: false,
      stack: 1000,
      betThisRound: 0,
      selected: [],
      showHand: false,
      lastAction: "",
      hasDrawn: false,
      lastDrawCount: 0,
    }));
  }

  const totalPotForDisplay = useMemo(() => {
    const settled = pots.reduce((acc, p) => acc + (p.amount || 0), 0);
    const onStreet = players.reduce((acc, p) => acc + (p.betThisRound || 0), 0);
    return settled + onStreet;
  }, [pots, players]);

  /* --- phase helpers --- */
  function goShowdownNow(playersSnap) {
    const { pots: newPots } = settleStreetToPots(playersSnap, pots);
    setPots(newPots);
    setPlayers(playersSnap.map((p) => ({ ...p, showHand: !p.folded })));
    setPhase("SHOWDOWN");

    setTimeout(
      () =>
        runShowdown({
          players: playersSnap,
          setPlayers,
          pots: newPots,
          setPots,
          dealerIdx,
          dealNewHand,
          setShowNextButton,
        }),
      200
    );
  }

  function getNextAliveAfter(idx) {
    if (!players || players.length === 0) return null;
    const n = players.length;
    let next = (idx + 1) % n;
    let safety = 0;
    while (players[next]?.folded) {
      next = (next + 1) % n;
      safety++;
      if (safety > n) return null; // 全員フォールド等の保険
    }
    return next;
  }

  function checkIfOneLeftThenEnd() {
    if (!players || players.length === 0) return false;

    const active = players.filter((p) => !p.folded);
    if (active.length === 1) {
      const winnerIdx = players.findIndex((p) => !p.folded);
      const newPlayers = [...players];
      const potSum = totalPotForDisplay;
      newPlayers[winnerIdx] = {
        ...newPlayers[winnerIdx],
        stack: newPlayers[winnerIdx].stack + potSum,
      };
      setPlayers(newPlayers);

      // ハンド保存（フォールド勝ちの早期終了）
      trySaveHandOnce({
        playersSnap: newPlayers,
        dealerIdx,
        pots,
        potOverride: potSum,
      });

      const nextDealer = (dealerIdx + 1) % NUM_PLAYERS;
      setTimeout(() => dealNewHand(nextDealer), 600);
      return true;
    }
    return false;
  }

function finishBetRoundFrom(playersSnap) {
  debugLog(
    "[BET] Round complete → finishBetRoundFrom, drawRound(current)=",
    drawRound
  );

  // 現在のストリートを清算
  logState("BET round complete → settle", playersSnap);
  const { pots: newPots, clearedPlayers } = settleStreetToPots(playersSnap, pots);
  const reset = clearedPlayers.map((p) => ({
    ...p,
    hasDrawn: false,
    lastDrawCount: 0,
  }));

  setPots(newPots);
  setPlayers(reset);

  // DRAWがまだ最大回数に達していなければ次のDRAWへ
  if (drawRound < MAX_DRAWS) {
  
    const nextRound = drawRound + 1;

    setTimeout(() => logState(`→ ENTER DRAW#${nextRound}`, reset), 0);
    setCurrentBet(0);
    setBetHead(null);
    setPhase("DRAW");

    // ✅ ラウンドカウンタをインクリメント
    setDrawRound(nextRound);
    debugLog(`[FLOW] drawRound advanced → ${nextRound}`);

    // DRAW完了後はSBから次のBET開始するための準備
    const nextTurn = (dealerIdx + 1) % NUM_PLAYERS;
    setTurn(nextTurn);
    debugLog(`[BET] → DRAW #${nextRound} (next BET will start from SB=${nextTurn})`);

    return;
  }

  // ✅ 全ドローが終わった → SHOWDOWNへ
  setTimeout(() => logState("→ ENTER SHOWDOWN", reset), 0);
  setPhase("SHOWDOWN");
  setTimeout(
    () =>
      runShowdown({
        players: playersSnap,
        setPlayers,
        pots: newPots,
        setPots,
        dealerIdx,
        dealNewHand,
        setShowNextButton,
      }),
    200
  );
  debugLog("[BET] All draws done → SHOWDOWN");
}


  function advanceAfterAction(updatedPlayers) {
  debugLog("[FLOW] advanceAfterAction called");
  const snap = updatedPlayers || players;
  debugLog("[FLOW] phase:", phase, "drawRound:", drawRound);

  // 勝負決まってたら終了
  if (checkIfOneLeftThenEnd()) return;

  // ------------------------
  // BETフェーズ中の進行
  // ------------------------
  if (phase === "BET") {
    const next = getNextAliveAfter(turn);
    if (next === null) return;

    const active = snap.filter((p) => !p.folded);
    const everyoneMatched = active.every((p) => p.betThisRound === currentBet);

    // 💡 全員コール or チェック完了 → BET終了
    if (everyoneMatched && next === betHead) {
      debugLog("[BET] Round complete detected → finishBetRoundFrom");
      finishBetRoundFrom(snap); // ← これがBET→DRAW遷移を担当
      return;
    } else {
      // まだBET継続
      setTurn(next);
      return;
    }
  }

  // ------------------------
  // DRAWフェーズ中の進行
  // ------------------------
  if (phase === "DRAW") {
    debugLog("[DRAW] Checking if allActiveDrawn...");

    // 全員ドロー済みなら BET ラウンドへ
    const allActiveDrawn = snap.every((p) => p.folded || p.hasDrawn);

    // 万が一、全員ドロー済みにならない場合の保険（手番がリセットされていないケース）
    if (!allActiveDrawn && turn === 0) {
      debugLog("[DRAW] Safety fallback: forcing DRAW→BET transition (timeout)");
      setTimeout(() => finishDrawRound(), 200);
      return;
    }

    if (allActiveDrawn) {
      debugLog("[DRAW] allActiveDrawn = true → move to BET phase");

      const reset = snap.map((p) => ({
        ...p,
        betThisRound: 0,
        hasDrawn: false,
        lastAction: "",
      }));

      setPlayers(reset);
      setCurrentBet(0);

      // ✅ DRAWラウンド完了後は常にSBからBET開始
      const firstToAct =
        drawRound === 0
          ? (dealerIdx + 3) % snap.length // プリドロー後: UTG
          : (dealerIdx + 1) % snap.length; // DRAW後: SB

      setTurn(firstToAct);
      setBetHead(firstToAct);
      setPhase("BET");
      debugLog(`[DRAW→BET] next BET starts from ${firstToAct === (dealerIdx + 3) % snap.length ? "UTG" : "SB"} (seat=${firstToAct})`);
      return;
    }

    // まだドローしていない次のNPCに進行
    const nextIdx = snap.findIndex(
      (p, i) => !p.folded && !p.hasDrawn && i !== 0
    );

    if (nextIdx !== -1) {
      setTurn(nextIdx);
      runDrawRound({
        players: snap,
        turn: nextIdx,
        deck,
        setPlayers,
        setDeck,
        advanceAfterAction,
      });
    }
  }
}


  function finishDrawRound() {
    setRaiseCountThisRound(0);
    const firstToAct =
      drawRound === 0
        ? (dealerIdx + 3) % NUM_PLAYERS // 最初だけUTG
        : (dealerIdx + 1) % NUM_PLAYERS; // 以降はSB
    // ドロー完了数を進める
    setDrawRound((prev) => prev + 1);

    // BET準備
    const reset = players.map((p) => ({
      ...p,
      betThisRound: 0,
      lastAction: "",
      hasDrawn: false,
    }));
    setPlayers(reset);
    setCurrentBet(0);
    setBetHead(firstToAct);
    setTurn(firstToAct);
    setRaiseCountThisRound(0); // 新しいBETラウンド開始時にリセット
    setPhase("BET");
    debugLog(`[BET] === START BET #${drawRound + 2} (after DRAW #${drawRound + 1}) ===`);
    setTimeout(() => logState(`ENTER BET#${drawRound + 1}`), 0);
  }


  /* --- dealing --- */
  function dealNewHand(nextDealerIdx = 0) {
  debugLog(`[HAND] dealNewHand start → dealer=${nextDealerIdx}`);
  const deckSrc = createDeck();
  const newDeck = shuffleDeck([...deckSrc]); // ← clone して確実に独立参照に

  // 🧱 既存プレイヤーからスタックと名前を引き継ぐ（座席固定）
  const prev = players.length === NUM_PLAYERS ? players : makeEmptyPlayers();

  // 🆕 完全新規配列を生成
  const newPlayers = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
    name: prev[i].name ?? `P${i + 1}`,
    stack: prev[i].stack ?? 1000,
    hand: newDeck.splice(0, 4),
    folded: false,
    allIn: false,
    betThisRound: 0,
    hasDrawn: false,
    lastDrawCount: 0,
    selected: [],
    showHand: false,
    isDealer: i === nextDealerIdx,
    lastAction: "",
  }));

  // SB/BB のブラインド支払い
  const sbIdx = (nextDealerIdx + 1) % NUM_PLAYERS;
  const bbIdx = (nextDealerIdx + 2) % NUM_PLAYERS;
  newPlayers[sbIdx].stack -= SB;
  newPlayers[sbIdx].betThisRound = SB;
  newPlayers[bbIdx].stack -= BB;
  newPlayers[bbIdx].betThisRound = BB;

  // --- 状態更新 ---
  setPlayers(newPlayers);
  setDeck(newDeck);
  setPots([{ amount: SB + BB, eligible: [...Array(NUM_PLAYERS).keys()] }]);
  setCurrentBet(BB);
  setDealerIdx(nextDealerIdx);
  setDrawRound(0);
  setPhase("BET");
  setTurn((nextDealerIdx + 3) % NUM_PLAYERS); // UTG
  setBetHead((nextDealerIdx + 3) % NUM_PLAYERS);
  setShowNextButton(false);
  setTransitioning(false);

  // Raiseカウンタ・学習ログ初期化
  setRaiseCountThisRound(0);
  setRaisePerRound([0, 0, 0, 0]);
  setRaisePerSeatRound(Array(NUM_PLAYERS).fill(0).map(() => [0, 0, 0, 0]));
  setActionLog([]);

  // 次ハンド準備
  handSavedRef.current = false;
  handIdRef.current = `${nextDealerIdx}-${Date.now()}`;

  debugLog("[HAND] New players dealt:", newPlayers.map(p => p.name));
  setTimeout(() => logState("NEW HAND"), 0);
}


  useEffect(() => {
    dealNewHand(0);
  }, []);

  // ▼ 状態変化を監視してログ出力
useEffect(() => {
  debugLog(
    `[STATE] phase=${phase}, drawRound=${drawRound}, turn=${turn}, currentBet=${currentBet}`
  );
}, [phase, drawRound, turn, currentBet]);


  /* --- common: after BET action (snapshot-based) --- */
    /* --- common: after BET action (snapshot-based) --- */
  function afterBetActionWithSnapshot(snap, actedIndex) {
    if (transitioning) {
      setPlayers(snap);
      return;
    }

    // --- ログ出力強化 ---
    const phaseLabel = `[${phase}] Round=${drawRound}`;
    debugLog(
      `${phaseLabel} acted=${snap[actedIndex]?.name}, turn=${actedIndex}, currentBet=${currentBet}`
    );
    snap.forEach((p, i) =>
      debugLog(
        `  P${i + 1}(${p.name}): bet=${p.betThisRound}, stack=${p.stack}, folded=${p.folded}, allIn=${p.allIn}`
      )
    );

    // 途中で勝負決着なら終了
    if (checkIfOneLeftThenEnd(snap)) return;

    // 現在の最大ベットを反映
    const maxNow = maxBetThisRound(snap);
    if (currentBet !== maxNow) setCurrentBet(maxNow);

    // 次のアクティブ
    const next = nextAliveFrom(snap, actedIndex);
    setPlayers(snap);
    if (next === null) return;

    // ------------------------
    // BETフェーズ中
    // ------------------------
    if (phase === "BET") {
      const active = snap.filter((p) => !p.folded);
      const everyoneMatched = active.every(
        (p) => p.allIn || p.betThisRound === maxNow
      );

      debugLog(
        `[BET] Check status: everyoneMatched=${everyoneMatched}, next=${next}, betHead=${betHead}`
      );

      if (everyoneMatched && next === betHead) {
        debugLog(`[BET] ✅ Round complete! → finishBetRoundFrom(drawRound=${drawRound})`);
        setTransitioning(true);
        setTimeout(() => {
          finishBetRoundFrom(snap);
          setTransitioning(false);
        }, 50); // ← 少しディレイを入れる
        return;
      }

      setTurn(next);
      return;
    }

    // ------------------------
    // DRAWフェーズ中
    // ------------------------
    if (phase === "DRAW") {
      const allActiveDrawn = snap.every((p) => p.folded || p.hasDrawn);
      debugLog(`[DRAW] Check: allActiveDrawn=${allActiveDrawn}`);

      if (allActiveDrawn) {
        finishDrawRound();
        return;
      }

      const nextIdx = snap.findIndex(
        (p, i) => !p.folded && !p.hasDrawn && i !== 0
      );
      if (nextIdx !== -1) {
        setTurn(nextIdx);
        runDrawRound({
          players: snap,
          turn: nextIdx,
          deck,
          setPlayers,
          setDeck,
          advanceAfterAction,
        });
      }
    }
  }




  /* --- actions: BET --- */
  function playerFold() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    me.folded = true;
    me.lastAction = "Fold";
    logAction(0, "Fold");
    snap[0] = me;
    recordActionToLog({
      round: currentBetRoundIndex(),
      seat: 0,
      type: me.lastAction,
      stackBefore: me.stack,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound,
    });

    afterBetActionWithSnapshot(snap, 0);
  }

  function playerCall() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    const maxNow = maxBetThisRound(snap);
    const toCall = Math.max(0, maxNow - me.betThisRound);
    const pay = Math.min(me.stack, toCall);

    me.stack -= pay;
    me.betThisRound += pay;
    me.lastAction = toCall === 0 ? "Check" : pay < toCall ? "Call (All-in)" : "Call";
    logAction(0, me.lastAction, { toCall, pay, newBet: me.betThisRound });
    if (me.stack === 0) me.allIn = true;

    snap[0] = me;
    afterBetActionWithSnapshot(snap, 0);

    recordActionToLog({
      round: currentBetRoundIndex(),
      seat: 0,
      type: me.lastAction,
      stackBefore: me.stack + pay,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound,
    });

  }

  function playerCheck() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    const maxNow = maxBetThisRound(snap);
    if (me.betThisRound === maxNow || me.allIn) {
      me.lastAction = "Check";
      logAction(0, "Check");
      snap[0] = me;
      recordActionToLog({
        round: currentBetRoundIndex(),
        seat: 0,
        type: me.lastAction,
        stackBefore: me.stack,
        betAfter: me.betThisRound,
        raiseCountTable: raiseCountThisRound,
      });

      afterBetActionWithSnapshot(snap, 0);
    } else {
      playerCall();
    }
  }

    // --- 5ベットキャップ付き Raise 処理 ---
  function playerRaise() {
     if (phase !== "BET") return;
     const snap = [...players];
     const me = { ...snap[0] };

    // ✅ 5betキャップ判定（Raise上限4回）
     if (raiseCountThisRound >= 4) {
       logAction(0, "Raise blocked (5-bet cap reached)", { raiseCountThisRound });
       debugLog(`[CAP] 5-bet cap reached (Raise blocked after ${raiseCountThisRound})`);
       playerCall(); // Call扱い
       return;
     }

    // 現在の最大ベット額
    const maxNow = maxBetThisRound(snap);
    const toCall = Math.max(0, maxNow - me.betThisRound);
    const raiseAmt = betSize;
    const total = toCall + raiseAmt;

    // --- Raise 実行 ---
    const pay = Math.min(me.stack, total);
    me.stack -= pay;
    me.betThisRound += pay;
    me.lastAction = pay < total ? "Raise (All-in)" : "Raise";
    
    if (me.stack === 0) me.allIn = true;

    snap[0] = me;

    // ✅ Raise回数インクリメント
    setRaiseCountThisRound((c) => c + 1);

    // ✅ 最後にRaiseしたプレイヤーをベットヘッドに更新
    setBetHead(0); // ← 自分がRaiseしたのでbetHeadを更新

     logAction(0, me.lastAction, {
       toCall,
       raise: raiseAmt,
       pay,
       newBet: me.betThisRound,
       raiseCount: raiseCountThisRound + 1,
    });

    // レイズ後の最大ベット額を更新
    const newMax = maxBetThisRound(snap);
    if (currentBet !== newMax) setCurrentBet(newMax);

    afterBetActionWithSnapshot(snap, 0);

    // === ログ追記 ===
    recordActionToLog({
      round: currentBetRoundIndex(),
      seat: 0,
      type: me.lastAction,
      stackBefore: me.stack + pay,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound + 1,
    });

  }


  /* --- actions: DRAW --- */
  function toggleSelectCard(cardIdx) {
    if (phase !== "DRAW" || turn !== 0) return;
    const newPlayers = players.map((p) => ({ ...p, hand: [...p.hand] }));
    const p = { ...newPlayers[0] };
    const sel = p.selected ?? [];
    p.selected = sel.includes(cardIdx) ? sel.filter((x) => x !== cardIdx) : [...sel, cardIdx];
    newPlayers[0] = p;
    setPlayers(newPlayers);
  }

  function drawSelected() {
    if (phase !== "DRAW" || drawRound > 3) return;

    const newDeck = [...deck];
    const newPlayers = [...players];
    const p = { ...newPlayers[0] };
    const sel = p.selected || [];

    if (sel.length > 0) {
      const newHand = [...p.hand];
      sel.forEach((i) => {
        if (newDeck.length > 0) newHand[i] = newDeck.pop();
      });
      p.hand = newHand;
    }

    p.selected = [];
    p.hasDrawn = true;
    p.lastDrawCount = sel.length;
    newPlayers[0] = p;

    setPlayers(newPlayers);
    setDeck(newDeck);

    // advanceAfterAction に最新 players を渡す
    setTimeout(() => {
      advanceAfterAction(newPlayers);
    }, 100);
  }

  /* --- NPC auto --- */
  useEffect(() => {
    if (!players || players.length === 0) return;
    if (turn === 0) return; // 自分の番はUI操作

    const p = players[turn];
    if (!p || p.folded) {
      const nxt = nextAliveFrom(players, turn);
      if (nxt !== null) setTurn(nxt);
      return;
    }

    const timer = setTimeout(() => {
      if (phase === "BET") {
        // BET: スナップショットで処理
        const snap = [...players];
        const me = { ...snap[turn] };

        const maxNow = maxBetThisRound(snap);
        const toCall = Math.max(0, maxNow - me.betThisRound);

        const score = evaluateBadugi(me.hand).score;
        const r = Math.random();

        let pay = 0; //

        if (toCall > 0 && r < 0.18 && score <= 2) {
          me.folded = true;
          me.lastAction = "Fold";
        } else {
          const pay = Math.min(me.stack, toCall);
          me.stack -= pay;
          me.betThisRound += pay;
          me.lastAction = toCall === 0 ? "Check" : pay < toCall ? "Call (All-in)" : "Call";
          if (me.stack === 0) me.allIn = true;

         if (!me.allIn && Math.random() > 0.92 && raiseCountThisRound < 4) {
            const add = Math.min(me.stack, betSize);
            me.stack -= add;
            me.betThisRound += add;
            me.lastAction = add < betSize ? "Raise (All-in)" : "Raise";
            if (me.stack === 0) me.allIn = true;
            setRaiseCountThisRound((c) => c + 1);
            setBetHead(turn); // ← RaiseしたNPCをベットヘッドに設定

            // ✅ 学習用の集計にも反映
             const ri = currentBetRoundIndex();
             setRaisePerRound((arr) => {
              const a = [...arr];
              a[ri] += 1;
              return a;
            });
            setRaisePerSeatRound((mat) => {
              const m = mat.map((row) => [...row]);
              m[turn][ri] += 1;
              return m;
            });
          }
        }

        snap[turn] = me;
        // === NPCログ記録 ===
        recordActionToLog({
          round: currentBetRoundIndex(),
          seat: turn,
          type: me.lastAction,
          stackBefore: me.stack + pay,
          betAfter: me.betThisRound,
          raiseCountTable: raiseCountThisRound,
        });


        logAction(turn, me.lastAction, { toCall, pay, bet: me.betThisRound });
        // スナップショットで終了判定と次手番決定（再入防止あり）
        afterBetActionWithSnapshot(snap, turn);
      } else if (phase === "DRAW") {
        // DRAW: 既存ロジック（NPCは自動交換）
        runDrawRound({
          players,
          turn,
          deck,
          setPlayers,
          setDeck,
          advanceAfterAction: () => {
            // 全員ドロー済みチェック → BETへ
            const done = players.filter((pl) => !pl.folded).every((pl) => pl.hasDrawn);
            if (done) finishDrawRound();
            else {
              const nxt = nextAliveFrom(players, turn);
              if (nxt !== null) setTurn(nxt);
            }
          },
        });
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [turn, phase, players, deck, currentBet, transitioning]);

  /* --- SHOWDOWN完了 → 履歴保存（1ハンド1回） --- */
  useEffect(() => {
    if (phase !== "SHOWDOWN") return;
    if (!showNextButton) return; // 勝敗決定表示が出たタイミングをトリガにする
    if (handSavedRef.current) return;

    trySaveHandOnce({ playersSnap: players, dealerIdx, pots });
  }, [phase, showNextButton]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== 履歴保存ユーティリティ =====
  function trySaveHandOnce({ playersSnap, dealerIdx, pots, potOverride }) {
    debugLog("[HISTORY] trySaveHandOnce called");
    try {
      const handId = handIdRef.current ?? `${dealerIdx}-${Date.now()}`;
      handIdRef.current = handId;

      // 総ポット（settled + 現在のbet）を安全に計算
      const pot =
        typeof potOverride === "number"
          ? potOverride
          : Number(
           ((pots || []).reduce((s, p) => s + (p?.amount || 0), 0) || 0) +
           ((playersSnap || []).reduce((s, p) => s + (p?.betThisRound || 0), 0) || 0)
          ) || 0;

      // 勝者推定（evaluateBadugi で最良スコアを持つ非フォールドの名前）
      const active = (playersSnap || []).filter((p) => !p.folded);
      let bestScore = Infinity;
      let winners = [];
      active.forEach((p) => {
        const sc = evaluateBadugi(p.hand).score; // あなたの評価関数を利用
        if (sc < bestScore) {
          bestScore = sc;
          winners = [p.name];
        } else if (sc === bestScore) {
          winners.push(p.name);
        }
      });

      const record = {
        handId,
        ts: Date.now(),
        tableSize: playersSnap.length,
        dealerIdx,
        players: playersSnap.map((p, i) => ({
          name: p.name ?? `P${i + 1}`,
          seat: i,
          stack: p.stack,
          folded: !!p.folded,
          // result は配分まで追いづらいので今回は省略（将来: runShowdownから受け取る）
        })),
        actions: [], // 今は未集計。将来: ベット/ドローのログを詰める
        pot,
        winner: winners.length > 1 ? "split" : winners[0] ?? "-",
        raiseStats: {
          perRound: raisePerRound,                 // 例: [2,0,3,1]
          perSeatPerRound: raisePerSeatRound,      // 例: [[1,0,1,0],[1,0,2,1],...]
          totalRaises: raisePerRound.reduce((a,b)=>a+b,0),
          roundsPlayed: Math.max(
            1, // プリは必ずある
            Math.min(drawRound + 1, 4) // 進行状況に応じたBET数
          ),
          lastRoundIndex: Math.min(drawRound, 3),  // 0..3
          actionLog: actionLog,
          },
      };

      saveRLHandHistory(record);
      debugLog("[HISTORY] saved:", record.handId, record.winner);
      handSavedRef.current = true;
      // console.debug("Hand saved:", record);
    } catch (e) {
      // 保存に失敗してもゲームは継続
      // console.error("save hand failed", e);
    }
  }

  /* --- UI --- */
  const centerX = typeof window !== "undefined" ? window.innerWidth / 2 : 400;
  const centerY = typeof window !== "undefined" ? window.innerHeight / 2 : 300;
  const radiusX = 350;
  const radiusY = 220;

  return (
    <div className="relative w-full h-screen bg-green-700 overflow-hidden">
      {/* table */}
      <div
        className="absolute rounded-full border-8 border-yellow-700"
        style={{
          width: `${radiusX * 2}px`,
          height: `${radiusY * 2}px`,
          left: `${centerX - radiusX}px`,
          top: `${centerY - radiusY}px`,
        }}
      />

      {/* info */}
      <div className="absolute top-4 left-4 text-white font-bold space-y-1">
        <div>Total Pot: {totalPotForDisplay}</div>
      </div>
      <div className="absolute top-4 right-4 text-white font-bold text-right">
         <div>Phase: {phase}</div>
         <div>Draw: {drawRound}/{MAX_DRAWS}</div>
         {phase === "BET" && (
           <div>Raise Count (Table): {raiseCountThisRound} / 4</div>
         )}
      </div>

      <div className="absolute top-10 right-4 text-white font-bold">
        Dealer: {players[dealerIdx]?.name ?? "-"}
      </div>

      {/* players */}
      {players.map((p, idx) => (
        <Player
          key={idx}
          player={p}
          index={idx}
          selfIndex={0}
          turn={turn}
          dealerIdx={dealerIdx}
          onCardClick={(cardIdx) => {
            if (phase === "DRAW" && turn === 0 && !p.folded) {
              toggleSelectCard(cardIdx);
            }
          }}
        />
      ))}

      {/* controls */}
      {turn === 0 && players[0] && !players[0].folded && (
        <Controls
          phase={phase}
          currentBet={currentBet}
          player={players[0]}
          onFold={playerFold}
          onCall={playerCall}
          onCheck={playerCheck}
          onRaise={playerRaise}
          onDraw={drawSelected}
        />
      )}

      {/* showdown後の Next Hand は showdown.js 側で setShowNextButton(true) を呼ぶ */}
      {showNextButton && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
          <button
            onClick={() => {
              const nextDealer = (dealerIdx + 1) % NUM_PLAYERS;
              dealNewHand(nextDealer);
              setShowNextButton(false);
            }}
            className="px-6 py-3 bg-yellow-500 text-black font-bold rounded shadow-lg"
          >
            Next Hand
          </button>
        </div>
      )}
      {/* ▼ デバッグトグルスイッチ */}
<div className="absolute bottom-4 right-4">
  <button
    onClick={() => setDebugMode((v) => !v)}
    className={`px-4 py-2 rounded font-bold ${
      debugMode ? "bg-red-500" : "bg-gray-500"
    }`}
  >
    {debugMode ? "DEBUG ON" : "DEBUG OFF"}
  </button>
</div>

    </div>
  );
}
