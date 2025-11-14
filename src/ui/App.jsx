// src/ui/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Player from "./components/Player";
import Controls from "./components/Controls";
import { DeckManager   } from "../games/badugi/utils/deck";
import { debugLog } from "../utils/debugLog";
import { runDrawRound } from "../games/badugi/logic/drawRound";
import { runShowdown } from "../games/badugi/logic/showdown";
import { evaluateBadugi, compareBadugi, getWinnersByBadugi } from "../games/badugi/utils/badugiEvaluator";

import {
   aliveBetPlayers,
   aliveDrawPlayers,
   nextAliveFrom,
   maxBetThisRound,
   settleStreetToPots,
   isBetRoundComplete,
   finishBetRoundFrom,
} from "../games/badugi/logic/roundFlow.js"; 

// 履歴保存API
import {
  saveRLHandHistory,
  getAllRLHandHistories,
  exportRLHistoryAsJSONL,
} from "../utils/history_rl";
import { useNavigate } from "react-router-dom";

// === TRACE HELPER (デバッグ用) ===
function trace(tag, extra = {}) {
  const now = new Date().toISOString().split("T")[1].split(".")[0]; // 時:分:秒
  const hand = typeof handIdRef !== "undefined" && handIdRef?.current
    ? handIdRef.current
    : "-";
  console.log(`[TRACE ${now}] [HAND ${hand}] [${typeof phase !== "undefined" ? phase : "-"}] ${tag}`, extra);
}

export default function App() {
  const navigate = useNavigate();
  /* --- constants --- */
  const NUM_PLAYERS = 6;
  const SB = 10;
  const BB = 20;
  const betSize = BB;
  const MAX_DRAWS = 3; // DRAWは3回（= DRAW1,2,3）

  // state定義の上部などに deckRef を設置
  const deckRef = useRef(new DeckManager());

  /* --- states --- */
  const [players, setPlayers] = useState([]);
  const [deck, setDeck] = useState([]);
  const [dealerIdx, setDealerIdx] = useState(0);

  const [phase, setPhase] = useState("BET"); // BET / DRAW / SHOWDOWN

  // 新規追加：BETラウンド開始時の先頭プレイヤーを保持
  const [drawRound, setDrawRound] = useState(0); // 完了したDRAW数 0..3

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

  const raiseCountRef = useRef(raiseCountThisRound);
  useEffect(() => {
    raiseCountRef.current = raiseCountThisRound;
  }, [raiseCountThisRound]);

  // === ポジション名を返す関数（Dealer基準） ===
  // dealerIdx が「BTN（ディーラー）」なので、BTN → SB → BB → UTG → MP → CO の順で回す
  function positionName(index, dealer = dealerIdx) {
    const order = ["BTN", "SB", "BB", "UTG", "MP", "CO"];
    const rel = (index - dealer + NUM_PLAYERS) % NUM_PLAYERS;
    return order[rel] ?? `Seat${index}`;
  }
  
  // === 座席ヘルパー（SB起点の左回り順） ===
  const sbIndex = (d = dealerIdx) => (d + 1) % NUM_PLAYERS;        // SB
  const orderFromSB = (d = dealerIdx) =>
    Array.from({ length: NUM_PLAYERS }, (_, k) => (sbIndex(d) + k) % NUM_PLAYERS);
  // 見つからなければ必ず -1 を返す（呼び出し側と契約を合わせる）
  const firstUndrawnFromSB = (snap) => {
    const order = orderFromSB();
    for (const i of order) {
      const p = snap[i];
      if (!p?.folded && !p?.hasDrawn) return i;
    }
    return -1;
  };

  // === デバッグ: 現在のポジション順序確認 ===
  useEffect(() => {
    if (!debugMode) return;
    console.table(
      players.map((p, i) => ({
        seat: i,
        name: p.name,
        folded: p.folded ? "✓" : "",
        drawn: p.hasDrawn ? "✓" : "",
        stack: p.stack,
        bet: p.betThisRound,
        allIn: p.allIn,
        lastAction: p.lastAction
      }))
    );
  }, [players, dealerIdx, debugMode]);

  // ======== DEBUG LOGGER (add just under debugLog) ========
const actionSeqRef = useRef(0); // 連番

// 🧩 スタックを監視して 0 以下を allIn 扱いに補正
function sanitizeStacks(snap, setPlayers) {
  const corrected = snap.map(p => {
    if (p.stack <= 0 && !p.allIn) {
      console.warn(`[SANITIZE] ${p.name} stack=${p.stack} → allIn`);
      return { ...p, stack: 0, allIn: true };
    }
    return p;
  });
  if (setPlayers) setPlayers(corrected);
  return corrected;
}


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
  if (phase === "DRAW") return `DRAW#${drawRound + 1}`;
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
    const potNow = (pots || []).reduce((s, p) => s + (p.amount || 0), 0);
    console.log("pots:", pots, "totalPotNow:", potNow);
  } finally {
    console.groupEnd();
  }
}

function logPhaseState(tag="") {
  const msg = `[STATECHK] ${tag} → phase=${phase}, drawRound=${drawRound}, transitioning=${transitioning}, turn=${turn}`;
  console.log(msg);
}


function logAction(i, type, payload = {}) {
  if (!debugMode) return;
  const seq = ++actionSeqRef.current;
  const nm = players[i]?.name ?? `P${i}`;
  const pos = positionName(i);
  console.log(
    `[${phaseTagLocal()}][#${seq}] ${nm} (${pos}) → ${type}`,
    payload
  );
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
      isBusted: false,
      stack: 100,
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

  function goShowdownNow(playersSnap) {
    debugLog("[SHOWDOWN] goShowdownNow (All-in対応) called");

    // 1️⃣ 有効プレイヤー（foldしていない人）
    const active = playersSnap.filter((p) => !p.folded);
    if (active.length === 0) return;

    // 2️⃣ 現在のポットを安全に確定
    const settledPots = settleStreetToPots(playersSnap, pots).pots;
    const allPots =
      settledPots && settledPots.length > 0
        ? settledPots
        : [
            {
              amount:
                playersSnap.reduce(
                  (sum, p) => sum + (p.betThisRound || 0),
                  0
                ) || 0,
              eligible: active.map((p, i) => i),
            },
          ];

    // === Badugi評価ロジックに統一 ===
    console.log("[SHOWDOWN] === RESULTS (BADUGI) ===");
    const newStacks = [...playersSnap.map((p) => p.stack)];
    allPots.forEach((pot, potIdx) => {
      const eligiblePlayers = pot.eligible
        .map((i) => ({ seat: i, name: playersSnap[i].name, hand: playersSnap[i].hand }))
        .filter((p) => !playersSnap[p.seat].folded);

      if (eligiblePlayers.length === 0) return;

      // getWinnersByBadugi で最強者群取得
      const winners = getWinnersByBadugi(eligiblePlayers);
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount % winners.length;

      for (const w of winners) {
        const idx = w.seat ?? playersSnap.findIndex(p => p.name === w.name);
        if (idx >= 0) {
          newStacks[idx] += share;
          if (remainder > 0) {
            newStacks[idx] += 1;
            remainder -= 1;
          }
        }
      }

      console.log(
        `[SHOWDOWN] Pot#${potIdx}: ${pot.amount} → ${winners
          .map((w) => w.name)
          .join(", ")}`
      );
    });

    // 6️⃣ スタック更新・全員のハンド公開
    const updated = playersSnap.map((p, i) => ({
      ...p,
      stack: newStacks[i],
      showHand: true,
      result: p.folded ? "FOLD" : "SHOW",
      isBusted: newStacks[i] <= 0,
    }));

    // 7️⃣ 状態更新
    setPots([]);
    setShowNextButton(true);
    setPlayers(updated);
    setPhase("SHOWDOWN");

    // 8️⃣ 履歴保存だけ実行（次ハンドはボタン押下で）
    const totalPot = allPots.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (!handSavedRef.current) {
      trySaveHandOnce({
        playersSnap: updated,
        dealerIdx,
        pots: allPots,
        potOverride: totalPot,
      });
    }

    console.log("[SHOWDOWN] === STACKS AFTER ===");
    updated.forEach((p) => {
      if (p.folded) return;
      const ev = evaluateBadugi(p.hand);
      console.log(
        `Seat ${p.name}: ${p.hand.join(" ")} | score=${ev.score}, unique=${ev.uniqueCount}`
      );
    });
    console.log("🕒 Waiting for Next Hand button...");
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

  function checkIfOneLeftThenEnd(snapOpt) {
    const snap = snapOpt || players;
    if (!snap || snap.length === 0) return false;

    // ⬇️ 修正: foldしていない＆all-inではないプレイヤーのみをカウント
    const active = snap.filter(p => !p.folded && !p.allIn);

    if (active.length === 1) {
      const winnerIdx = snap.findIndex(p => !p.folded && !p.allIn);
      const newPlayers = snap.map(p => ({ ...p }));
      const { pots: finalPots } = settleStreetToPots(snap, pots);
      const potSum = finalPots.reduce((acc, p) => acc + (p.amount || 0), 0);
      newPlayers[winnerIdx].stack += potSum;
      newPlayers.forEach((pl) => {
        pl.isBusted = pl.stack <= 0;
      });
      setPlayers(newPlayers);

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


  // 🩵 SHOWDOWN後に dealNewHand 二重呼び出し防止フラグ
  const dealingRef = useRef(false);

  function safeDealNewHand(nextDealer) {
    if (dealingRef.current) {
      debugLog("[HAND] dealNewHand skipped (already in progress)");
      return;
    }
    dealingRef.current = true;
    dealNewHand(nextDealer);
    setTimeout(() => (dealingRef.current = false), 800);
  }

  function advanceAfterAction(updatedPlayers) {
    trace("advanceAfterAction()", { phase, drawRound, turn, transitioning });
    logPhaseState("[ADVANCE]")
    debugLog("[FLOW] advanceAfterAction called");
    const snap = updatedPlayers || players;
    debugLog("[FLOW] phase:", phase, "drawRound:", drawRound);

    // 🧩 デバッグ出力：全員の hasDrawn 状態を毎回表示
    if (phase === "DRAW") {
      console.table(
        snap.map((p, i) => ({
          seat: i,
          name: p.name,
          folded: p.folded ? "✓" : "",
          drawn: p.hasDrawn ? "✓" : "",
          stack: p.stack,
          bet: p.betThisRound,
        }))
      );
    }

    // 勝負決まってたら終了
    if (checkIfOneLeftThenEnd(snap)) return;

    // 🆕 All-in含むショート状態の強制ショーダウン
    const activeNoFold = (updatedPlayers || players).filter(p => !p.folded);

    const allInCount = activeNoFold.filter(p => p.allIn).length;
    if (allInCount > 0 && activeNoFold.every(p => p.allIn || p.folded)) {
      console.log("[ALL-IN] All remaining players all-in → goShowdownNow()");
      goShowdownNow(updatedPlayers);
      return;
    }

    // ------------------------
    // BETフェーズ中
    // ------------------------
    if (phase === "BET") {
      const active = snap.filter(p => !p.folded);
      const maxNow = maxBetThisRound(snap);

      // 🔧 actedIndex 未定義バグ修正：turn を使用
      const nextAlive = nextAliveFrom(snap, turn);

      // === BB 情報 ===
      const bbIndex = (dealerIdx + 2) % NUM_PLAYERS;
      const bb = snap[bbIndex];

      // === BB が「行動済み」と見なせる条件 ===
      let isBBActed = true;

      if (phase === "BET") {
        // ドロー後BETなら常にtrue
        if (drawRound === 0) {
          // プリドローBETのみBB行動を厳密に判定
          if (bb) {
            const acted = ["Bet", "Call", "Raise", "Check"].includes(bb.lastAction);
            // Fold, All-in, Action済みなら行動済み扱い
            isBBActed = bb.folded || bb.allIn || acted;
          } else {
          // ドロー後BETは常にtrue（BTN先行 or HU判定で十分）
          isBBActed = true;
          }
        }
      }

      if (bb) {
        isBBActed = bb.folded || ["Bet", "Call", "Raise", "Check"].includes(bb.lastAction);
      }
      if (drawRound > 0) isBBActed = true;

      // === ラウンド完了判定 ===
      // ✅ Fold済プレイヤーを除外して厳密に判定
      const nonFolded = snap.filter(p => !p.folded);
      const everyoneMatched = nonFolded.every(p => p.allIn || p.betThisRound === maxNow);
      const allChecked = (maxNow === 0) && nonFolded.every(p => p.lastAction === "Check" || p.allIn);

      // HU（2人）かどうか
      const isHU = active.length === 2;

      // デバッグ出力
      console.groupCollapsed("[DEBUG][BET_CONDITION_CHECK]");
      console.table(active.map((p, i) => ({
        seat: i,
        name: p.name,
        lastAction: p.lastAction,
        folded: p.folded,
        allIn: p.allIn,
        betThisRound: p.betThisRound,
        stack: p.stack,
      })));
      console.log("[BET_STATE]", {
        phase, drawRound, dealerIdx, bbIndex,
        isBBActed, isHU, everyoneMatched, allChecked,
        betHead, actedIndex, nextAlive, maxNow
      });
      console.groupEnd();

      let shouldEnd = false;

      if (maxNow > 0) {
        // ベットあり → 全員が最大額に一致（コール済み）で終了
        shouldEnd = everyoneMatched && isBBActed;
      } else if (isHU) {
        // HU特例：
        // プリドロー(HUでBB行動必須) → BBが行動済ならOK
        // ドロー後BET(HUでBTN先行) → 両者行動済でOK
        if (drawRound === 0) {
          shouldEnd = allChecked && isBBActed;
        } else {
          const bothActed = active.every(p => !!p.lastAction);
          shouldEnd = bothActed && everyoneMatched;
        }
      } else {
        // 通常ラウンド：全員Check済みで終了
        shouldEnd = allChecked;
      }

      // HUは両者が何らかの行動を終え、かつ everyoneMatched なら必ず閉じる
      if (isHU && everyoneMatched && active.every(p => !!p.lastAction)) {
        shouldEnd = true;
      }

      console.log("[BET][RESULT]", {
        shouldEnd, everyoneMatched, allChecked,
        isBBActed, isHU, drawRound, nextAlive, betHead
      });

      if (shouldEnd) {
        setTransitioning(true);
        setTimeout(() => {
          finishBetRoundFrom({
            players: snap,
            pots,
            setPlayers,
            setPots,
            drawRound,
            setDrawRound,
            setPhase,
            setTurn,
            dealerIdx,
            NUM_PLAYERS,
            MAX_DRAWS,
            runShowdown,
            dealNewHand,
            setShowNextButton,
          });
          setTransitioning(false);
        }, 80);
        return;
      }

      // 次の手番へ
      if (nextAlive !== null) setTurn(nextAlive);
      return;
    }



    // ------------------------
    // 🟨 DRAWフェーズ中
    // ------------------------
    if (phase === "DRAW" && !transitioning) {
      // 🧩 All-in プレイヤーは自動的にドロー完了扱い
      const patched = snap.map(p =>
        p.allIn ? { ...p, hasDrawn: true } : p
      );
      if (JSON.stringify(patched) !== JSON.stringify(snap)) {
        setPlayers(patched);
      }
      const snapEffective = patched;
      console.groupCollapsed("[DEBUG][DRAW_START_STATE]");
      console.table(
        snapEffective.map((p, i) => ({
          seat: i,
          name: p.name,
          folded: p.folded,
          hasDrawn: p.hasDrawn,
          allIn: p.allIn,
          stack: p.stack,
        }))
      );
      console.log("[DRAW STATE]", {
        drawRound,
        turn,
        transitioning,
        activesCount: aliveDrawPlayers(snap).length,
      });
      console.groupEnd();

      const actives = aliveDrawPlayers(snap);
      const allDrawn = actives.every(p => p.hasDrawn);

      if (allDrawn) {
        debugLog("[DRAW] ✅ All active drawn → finishDrawRound()");
        setTransitioning(true);
        finishDrawRound(snap);
        setTimeout(() => setTransitioning(false), 400);
        return;
      }

      // 👇 ここが復活ポイント：次の未ドロー者へ進める（SB起点の左回り）
      const nextToDraw = firstUndrawnFromSB(snap);
      console.log("[DRAW][NEXT_TO_DRAW]", nextToDraw);
      if (nextToDraw !== -1) {
        if (turn !== nextToDraw) {
          setTurn(nextToDraw);
          return;
        }
        // 今がNPCの番なら即ドローを自動実行（プレイヤー番ならUI待ち）
        if (nextToDraw !== 0) {
          console.log("[DRAW][RUNNING]", { nextToDraw, phase, drawRound });
          runDrawRound({
            players: snap,
            turn: nextToDraw,
            deckManager: deckRef.current,
            setPlayers,
            drawRound,
            setTurn,
            dealerIdx,
            NUM_PLAYERS,
          });
          console.log("[DRAW][RUNNING]", { nextToDraw, phase, drawRound });
        }
      }
      return;
    }

    // 💡 保険：ドロー対象がゼロの場合は即遷移（全folded扱い）
    if (actives.length === 0) {
      debugLog("[DRAW] ⚠️ No active players left — skipping to finishDrawRound()");
      finishDrawRound(snap);
      return;
    }
    return;
  }

  function finishDrawRound(snapOpt) {
    logPhaseState("[ADVANCE]")
    const base = snapOpt ?? players; // 最新スナップを優先
    // DRAW を引き終えた瞬間に「完了したドロー回数」を +1 する（上限 3）
    const completed = Math.min(drawRound + 1, MAX_DRAWS);
    setDrawRound(completed);

    // ベットラウンドを開始する（3回目のドロー後も必ずベット！）
    setRaiseCountThisRound(0);

    // Pre-draw だけは UTG（dealer+3）、それ以降のベットは常に SB（dealer+1）
    const firstToAct =
      completed === 0
        ? (dealerIdx + 3) % NUM_PLAYERS // ここには来ないが保険
        : (dealerIdx + 1) % NUM_PLAYERS;

    const reset = base.map((p) => ({
      ...p,
      betThisRound: 0,
      lastAction: "",
      hasDrawn: false, // 次のドローに備えて戻す
    }));

    setPlayers(reset);
    setCurrentBet(0);
    setBetHead(firstToAct);
    setTurn(firstToAct);
    setPhase("BET");

    debugLog(`[BET] === START BET (after DRAW#${completed}) firstToAct=${firstToAct} ===`);
    setTimeout(() => logState(`ENTER BET(after DRAW#${completed})`), 0);
  }


  /* --- dealing --- */
  function dealNewHand(nextDealerIdx = 0, prevPlayers = null) {
    trace("🆕 dealNewHand START", { nextDealerIdx, prevPlayersCount: prevPlayers?.length ?? 0 });
    if (dealingRef.current) {
      debugLog("[HAND] dealNewHand skipped (already in progress)");
      return;
    }
    dealingRef.current = true;
    debugLog(`[HAND] dealNewHand start → dealer=${nextDealerIdx}`);
    // ✅ DeckManager でリセットして1デッキ管理
    deckRef.current.reset();
    const newDeck = deckRef.current; // ← createShuffledDeckは使わない

    // ✅ スタック引き継ぎ優先順位：
    //  1. prevPlayers（showdownから渡された最新状態）
    //  2. 現在のplayers（テーブルに残っている状態）
    //  3. デフォルト初期値
    const prev = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
      name:
        prevPlayers?.[i]?.name ??
        players?.[i]?.name ??
        `P${i + 1}`,
      stack:
        prevPlayers?.[i]?.stack ??
        players?.[i]?.stack ??
        100,
      isBusted:
        prevPlayers?.[i]?.isBusted ??
        players?.[i]?.isBusted ??
        false,
    }));

    // 💥 シートアウト判定
    const filteredPrev = prev.map((p) => {
      const busted = p.isBusted || p.stack <= 0;
      if (busted) {
        console.warn(`[SEAT-OUT] ${p.name} is out (stack=${p.stack})`);
        return { ...p, stack: 0, folded: true, allIn: true, seatOut: true, isBusted: true };
      }
      return { ...p, seatOut: false, isBusted: false };
    });

    // 🆕 プレイヤー配列を生成
    const newPlayers = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
      name: filteredPrev[i].name ?? `P${i + 1}`,
      stack: Math.max(filteredPrev[i].stack ?? 100, 0),
      seatOut: filteredPrev[i].seatOut ?? false,
      isBusted: filteredPrev[i].isBusted ?? false,
      hand: deckRef.current.draw(4), 
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

    // シートアウトは即fold扱い
    for (const p of newPlayers) {
      if (p.seatOut) {
        p.folded = true;
        p.allIn = true;
        p.hand = [];
        p.isBusted = true;
      }
    }

    // 🧩 アクティブ人数判定
    const activeCount = newPlayers.filter(p => !p.seatOut).length;
    if (activeCount === 2) {
      console.log("[FINALS] Start heads-up match!");
      setPlayers(newPlayers);
      setPhase("TOURNAMENT_FINAL");
      setTimeout(() => dealHeadsUpFinal(newPlayers), 800);
      return;
    } else if (activeCount < 2) {
      console.warn(`[TOURNAMENT END] Only ${activeCount} active players remain.`);
      setPlayers(newPlayers);
      setShowNextButton(false);
      setPhase("TOURNAMENT_END");
      return;
    }

    // SB/BB のブラインド支払い
    const sbIdx = (nextDealerIdx + 1) % NUM_PLAYERS;
    const bbIdx = (nextDealerIdx + 2) % NUM_PLAYERS;
    const sbPay = Math.min(newPlayers[sbIdx].stack, SB);
    newPlayers[sbIdx].stack -= sbPay;
    newPlayers[sbIdx].betThisRound = sbPay;
    if (newPlayers[sbIdx].stack === 0) {
      newPlayers[sbIdx].allIn = true;
    }
    const bbPay = Math.min(newPlayers[bbIdx].stack, BB);
    newPlayers[bbIdx].stack -= bbPay;
    newPlayers[bbIdx].betThisRound = bbPay;
    if (newPlayers[bbIdx].stack === 0) {
      newPlayers[bbIdx].allIn = true;
    }
    // --- 状態更新 ---
    const initialPot = sbPay + bbPay;
    const initialCurrentBet = Math.max(sbPay, bbPay);
    setPlayers(newPlayers);
    setDeck([]);
    setPots([{ amount: initialPot, eligible: [...Array(NUM_PLAYERS).keys()] }]);
    setCurrentBet(initialCurrentBet);
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
    setRaisePerSeatRound(
      Array(NUM_PLAYERS)
        .fill(0)
        .map(() => [0, 0, 0, 0])
    );
    setActionLog([]);

    // 次ハンド準備
    handSavedRef.current = false;
    handIdRef.current = `${nextDealerIdx}-${Date.now()}`;

    debugLog("[HAND] New players dealt:", newPlayers.map((p) => p.name));
    debugLog(
      `[STATE] phase=BET, drawRound=0, turn=${
        (nextDealerIdx + 3) % NUM_PLAYERS
      }, currentBet=${initialCurrentBet}`
    );

    // 🧩 追加: デバッグ検証用に「新ハンド全プレイヤー状態」をコンソール出力
    console.groupCollapsed(`[DEBUG][NEW HAND] Dealer=${nextDealerIdx}`);
    newPlayers.forEach((p, i) => {
      console.log(
        `Seat ${i}: ${p.name}`,
        {
          stack: p.stack,
          folded: p.folded,
          allIn: p.allIn,
          hasDrawn: p.hasDrawn,
          betThisRound: p.betThisRound,
          lastAction: p.lastAction,
        }
      );
    });
    console.groupEnd();

    // 🧩 参照チェックは prevPlayers だけに限定（players は更新前参照なので誤警告の原因）
    if (Array.isArray(prevPlayers) && prevPlayers.some(p => p?.hasDrawn || p?.showHand)) {
      console.warn("[INFO] previous hand snapshot had SHOWDOWN flags (expected):", prevPlayers);
    }

    setTimeout(() => logState("NEW HAND"), 0);

    // 再入防止フラグを短時間で解除
    setTimeout(() => { dealingRef.current = false; }, 100);
     trace("🆗 dealNewHand END", { dealerIdx: nextDealerIdx });
  }

  // === 🏁 ヘッズアップ決勝戦用 ===
  function dealHeadsUpFinal(prevPlayers) {
    debugLog("[FINALS] dealHeadsUpFinal start");

    const heads = prevPlayers.filter(p => !p.seatOut);
    if (heads.length !== 2) {
      console.warn("[FINALS] Cannot start: not exactly 2 active players");
      setPhase("TOURNAMENT_END");
      return;
    }

    const nextDealerIdx = 0; // BTN固定
    deckRef.current.reset();

    const newPlayers = heads.map((p, i) => ({
      ...p,
      folded: false,
      allIn: false,
      seatOut: false,
      isBusted: false,
      hand: deckRef.current.draw(4),
      betThisRound: 0,
      hasDrawn: false,
      lastAction: "",
      isDealer: i === nextDealerIdx,
    }));

    // Small blind / big blind設定
    const sbPay = Math.min(newPlayers[0].stack, SB);
    newPlayers[0].stack -= sbPay;
    newPlayers[0].betThisRound = sbPay;
    if (newPlayers[0].stack === 0) {
      newPlayers[0].allIn = true;
    }
    const bbPay = Math.min(newPlayers[1].stack, BB);
    newPlayers[1].stack -= bbPay;
    newPlayers[1].betThisRound = bbPay;
    if (newPlayers[1].stack === 0) {
      newPlayers[1].allIn = true;
    }

    setPlayers(newPlayers);
    setPots([{ amount: sbPay + bbPay, eligible: [0, 1] }]);
    setCurrentBet(Math.max(sbPay, bbPay));
    setDealerIdx(nextDealerIdx);
    setDrawRound(0);
    setPhase("BET");
    setTurn(1); // UTG = BB
    setBetHead(1);
    setShowNextButton(false);
    setTransitioning(false);

    console.log("[FINALS] Heads-up match started:", newPlayers.map(p => p.name));
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
  function afterBetActionWithSnapshot(snap, actedIndex) {
    // --- オールインプレイヤーはBETフェーズでスキップ ---
    if (snap[turn]?.allIn) {
      console.log(`[SKIP] Player ${snap[turn].name} is all-in → skip action`);
      const nxt = nextAliveFrom(snap, turn);
      if (nxt !== null) setTurn(nxt);
      return;
    }

    trace("afterBetActionWithSnapshot()", { phase, drawRound, actedIndex });
    if (transitioning) {
      setPlayers(snap);
      return;
    }

    // 💡 オールイン補正：stack<=0 のプレイヤーを allIn=true に統一
    for (let i = 0; i < snap.length; i++) {
      const p = snap[i];
      if (!p.folded && p.stack <= 0 && !p.allIn) {
        console.warn(`[AUTO-FIX] ${p.name} stack=${p.stack} → allIn=true`);
        snap[i] = { ...p, stack: 0, allIn: true };
      }
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

    // 💡 追加：現在アクションしたプレイヤーを明示的に取得
    const me = { ...snap[actedIndex] };
    
    // ------------------------
    // BETフェーズ中
    // ------------------------
    if (phase === "BET") {
      const active = snap.filter((p) => !p.folded);
      const everyoneMatched = active.every(
        (p) => p.allIn || p.betThisRound === maxNow
      );
      const noOneBet = maxNow === 0;
      const nextAlive = nextAliveFrom(snap, actedIndex);

      debugLog(
        `[BET] Check status: everyoneMatched=${everyoneMatched}, next=${next}, betHead=${betHead}`
      );

      // 💡 BBがまだアクションしていない場合は絶対に終了させない
      const bbIndex = (dealerIdx + 2) % NUM_PLAYERS;
      let isBBActed = true;

      // 💡 プリドロー(BET#0)のみBB行動必須
      if (drawRound === 0) {
        const bb = snap[bbIndex];
        if (bb) {
          const acted = ["Bet", "Call", "Raise", "Check"].includes(bb.lastAction);
          isBBActed = bb.folded || bb.allIn || acted;
        }
      }
 
      const allChecked = (maxNow === 0) && active.every(p => p.lastAction === "Check");
      const isHU = active.length === 2;
      let shouldEnd = false;

      // 🧠 BET終了条件の詳細ログ出力（検証用）
      console.groupCollapsed("[DEBUG][BET_CONDITION_CHECK]");
      try {
        console.table(active.map((p, i) => ({
          seat: i,
          name: p.name,
          lastAction: p.lastAction,
          folded: p.folded,
          allIn: p.allIn,
          betThisRound: p.betThisRound,
          stack: p.stack,
        })));

        console.log("[BET_CONDITION]", {
          phase,
          drawRound,
          turn,
          betHead,
          dealerIdx,
          bbIndex,
          everyoneMatched,
          noOneBet,
          allChecked,
          nextAlive,
          isBBActed,
          maxNow,
          activeCount: active.length,
          transitioning,
        });
      } finally {
        console.groupEnd();
      }

      if (maxNow > 0) {
        // ベット/レイズがある → 全員コール一致で終了（プリのみBB行動必須）
        shouldEnd = everyoneMatched && isBBActed;
      } else if (isHU) {
        // HUのチェックアラウンド：両者行動済みなら終了
        const bothActed = active.every(p => !!p.lastAction);
        shouldEnd = bothActed;
      } else {
        // マルチウェイ：全員Checkで終了
        shouldEnd = allChecked;
      }

      console.log("[BET][RESULT]", { shouldEnd, everyoneMatched, allChecked, isBBActed, nextAlive, betHead });

      if (shouldEnd) {
        debugLog(`[BET] ✅ Round complete (everyone matched) → schedule finishBetRoundFrom()`);
          if (checkIfOneLeftThenEnd(snap)) {
            debugLog("[FORCE_END] Only one active player remains → goShowdownNow()");
            return;
          }

        setTransitioning(true);
        setTimeout(() => {
          finishBetRoundFrom({
            players: snap,
            pots,
            setPlayers,
            setPots,
            drawRound,
            setDrawRound,
            setPhase,
            setTurn,
            dealerIdx,
            NUM_PLAYERS,
            MAX_DRAWS,
            runShowdown,
            dealNewHand,
            setShowNextButton,
          });
          setTransitioning(false);
        }, 100);
        return;
      }
      if (next === null) return;
      if (nextAlive !== null) setTurn(nextAlive);
      return;
    }

    // ------------------------
    // DRAWフェーズ中
    // ------------------------
    if (phase === "DRAW") {
      const nextIdx = firstUndrawnFromSB(snap);
      console.log("[TRACE][DRAW] acted=", actedIndex, 
            "nextIdx=", nextIdx, typeof nextIdx, 
            "drawRound=", drawRound);

      const actives = snap.filter((p) => !p.folded);
      const allActiveDrawn = actives.every((p) => p.hasDrawn);

      if (allActiveDrawn) {
        finishDrawRound(snap);
        return;
      }

      if (nextIdx === -1) {
        // 全員（fold/all-in 以外）が引き終わり
        finishDrawRound(snap);
        return;
      }
      if (turn !== nextIdx) {
        setTurn(nextIdx);
        return;
      }
      // ここまで来たら「今がその人の番」。
      // 人間(0)ならUI待ち、NPCなら useEffect 側が自動ドロー。

    }
  }

  // App() 内に追加
  function recycleFoldedAndDiscardsBeforeCurrent(snap, currentIdx) {
    const order = orderFromSB();
    const pos = order.indexOf(currentIdx);
    if (pos <= 0) return;

    // 直前までのフォールドプレイヤーの手札を回収
    const toCheck = order.slice(0, pos);
    const muck = [];
    toCheck.forEach(i => {
      const pl = snap[i];
      if (pl?.folded && Array.isArray(pl.hand)) {
        muck.push(...pl.hand);
      }
    });

    // 捨て札（deckManager.discardPile）も再利用
    const dm = deckRef.current;
    if (muck.length || (dm.discardPile && dm.discardPile.length)) {
      dm.recycleNow(muck);
      debugLog(`[RECYCLE] +${muck.length} cards (folded) + existing discard → new deck=${dm.deck.length}`);
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
    
    // 💥 スタックが無い場合は何もしない
    if (me.stack <= 0) {
      console.warn("[BLOCK] Player has no stack — cannot act");
      return;
    }

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

     // 💥 スタックが無い場合は Raise 不可
     if (me.stack <= 0) {
       console.warn("[BLOCK] Player has no stack — cannot raise");
       return;
     }

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
    debugLog(`[CHECK] phase=${phase}, drawRound=${drawRound}, MAX_DRAWS=${MAX_DRAWS}`);
    if (phase !== "DRAW" || turn !== 0) return;

    const deckManager = deckRef.current;
    const newPlayers = players.map(p => ({ ...p, hand: [...p.hand] }));
    const p = { ...newPlayers[0], hand: [...newPlayers[0].hand] };

    const sel = p.selected || [];

    if (sel.length > 0) {
      const oldHand = [...p.hand];
      const replaced = [];
      const newHand = [...p.hand];

      sel.forEach((i) => {
        let pack = deckManager.draw(1);
        if (!pack || pack.length === 0) {
          recycleFoldedAndDiscardsBeforeCurrent(newPlayers, 0);
          pack = deckManager.draw(1);
        }

        if (pack && pack.length > 0) {
          const newCard = pack[0];
          deckManager.discard([newHand[i]]); // ← 交換前カードを捨て札に
          replaced.push({ index: i, oldCard: newHand[i], newCard });
          newHand[i] = newCard;
        } else {
          debugLog(`[DRAW] No card for slot[${i}] → keep`);
        }
      });

      p.hand = [...newHand];

      console.log(`[DRAW] You exchanged ${replaced.length} card(s):`);
      replaced.forEach(({ index, oldCard, newCard }) =>
        console.log(`   slot[${index}] ${oldCard} → ${newCard}`)
      );

      recordActionToLog({
        round: currentBetRoundIndex(),
        seat: 0,
        type: `DRAW (${replaced.length})`,
        stackBefore: p.stack,
        betAfter: p.betThisRound,
        raiseCountTable: raiseCountThisRound,
        drawInfo: {
          drawCount: replaced.length,
          replacedCards: replaced,
          before: oldHand,
          after: p.hand,
        },
      });
    }

    p.selected = [];
    p.hasDrawn = true;
    p.lastDrawCount = sel.length;
    newPlayers[0] = p;

    setPlayers(newPlayers.map(pl => ({ ...pl })));
    setTimeout(() => afterBetActionWithSnapshot([...newPlayers], 0), 0);
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

  // 💥 All-in は行動スキップ
  if (p.allIn || p.stack <= 0) {
    const nxt = nextAliveFrom(players, turn);
    if (nxt !== null) setTurn(nxt);
    return;
  }

  const timer = setTimeout(() => {
    if (phase === "BET") {
      const snap = [...players];
      const me = { ...snap[turn] };
      const maxNow = maxBetThisRound(snap);
      const toCall = Math.max(0, maxNow - me.betThisRound);
      const { score } = evaluateBadugi(me.hand); // 役評価をそのまま強さスコアとして使用
      const r = Math.random();

      if (toCall > 0 && r < 0.15 && score > 5) {
        me.folded = true;
        me.lastAction = "Fold";
      } else {
        const pay = Math.min(me.stack, toCall);
        me.stack -= pay;
        me.betThisRound += pay;
        me.lastAction = toCall === 0 ? "Check" : "Call";
      }

      // たまにRaise
      if (!me.allIn && Math.random() > 0.9 && raiseCountThisRound < 4) {
        const add = Math.min(me.stack, betSize);
        me.stack -= add;
        me.betThisRound += add;
        me.lastAction = "Raise";
        setRaiseCountThisRound(c => c + 1);
        setBetHead(turn);
      }

      snap[turn] = me;
      logAction(turn, me.lastAction);
      recordActionToLog({
        round: currentBetRoundIndex(),
        seat: turn,
        type: me.lastAction,
        stackBefore: me.stack,
        betAfter: me.betThisRound,
        raiseCountTable: raiseCountThisRound,
      });
      afterBetActionWithSnapshot(snap, turn);
      } else if (phase === "DRAW") {
    const snap = [...players];

    // 1) 有効プレイヤー（フォールド/オールイン以外）
    const actives = snap.filter(p => !p.folded);
    const everyoneDrawn = actives.every(p => p.hasDrawn);

    // 2) 全員ドロー済みなら一回だけBETへ遷移
    if (everyoneDrawn) {
      if (!transitioning) {
        setTransitioning(true);
        setTimeout(() => {
          finishDrawRound(snap);
          setTransitioning(false);
        }, 50);
      }
      return;
    }

    // 3) 次にドローすべき人（hasDrawn=false の最初の人）を固定
    const nextToDraw = firstUndrawnFromSB(snap);
    console.log("[DRAW][NEXT_TO_DRAW]", nextToDraw);
    if (nextToDraw === -1) {
      if (!transitioning) {
        setTransitioning(true);
        setTimeout(() => { finishDrawRound(snap); setTransitioning(false); }, 50);
      }
      return;
    }

    // 4) ターンポインタを次にすべき人へ合わせる（ぐるぐる回さない）
    if (turn !== nextToDraw) {
      setTurn(nextToDraw);
      return;
    }

    // 5) 実際のドロー（今が番のプレイヤーだけ）
    const me = { ...snap[nextToDraw] };
    const { score } = evaluateBadugi(me.hand);
    const drawCount = score > 8 ? 3 : score > 5 ? 2 : score > 3 ? 1 : 0;
    const deckManager = deckRef.current;
    const newHand = [...me.hand];
    for (let i = 0; i < drawCount; i++) {
      let pack = deckManager.draw(1);
      if (!pack || pack.length === 0) {
        recycleFoldedAndDiscardsBeforeCurrent(snap, nextToDraw);
        pack = deckManager.draw(1);
      }
      if (pack && pack.length > 0) {
        deckManager.discard([newHand[i]]);
        newHand[i] = pack[0];
      } else {
        debugLog(`[DRAW][NPC seat=${nextToDraw}] no card for slot[${i}] → keep`);
      }
    }
    me.hand = newHand;
    me.hasDrawn = true;
    me.lastDrawCount = drawCount;
    me.lastAction = `DRAW(${drawCount})`;
    snap[nextToDraw] = me;

    setDeck([]);
    setPlayers(snap);
    logAction(nextToDraw, me.lastAction);
    recordActionToLog({
      round: currentBetRoundIndex(),
      seat: nextToDraw,
      type: me.lastAction,
      stackBefore: me.stack,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound,
    });

    // 6) 次の未ドロー者へ。いなければBETへ
    const nextAfter = firstUndrawnFromSB(snap);
    if (nextAfter !== -1) {
      setTurn(nextAfter);
    } else {
      if (!transitioning) {
        setTransitioning(true);
        setTimeout(() => {
          finishDrawRound(snap);
          setTransitioning(false);
        }, 50);
      }
    }
  }

  }, 250);

  return () => clearTimeout(timer);
}, [
  turn,
  phase,
  deck,
  currentBet,
  transitioning,
  raiseCountThisRound,
  dealerIdx,
  betSize,
]);


  /* --- SHOWDOWN完了 → 履歴保存（1ハンド1回） --- */
  useEffect(() => {
    if (phase !== "SHOWDOWN") return;
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
      if (active.length === 0) return;
      let best = active[0];
      for (const p of active) {
        if (compareBadugi(p.hand, best.hand) < 0) best = p;
      }
      const winners = active
        .filter((p) => compareBadugi(p.hand, best.hand) === 0)
        .map((p) => p.name);

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
        // === Badugi評価ロジックを使って勝敗結果を保存 ===
        showdown: playersSnap.map(p => ({
          name: p.name,
          hand: p.hand,
          folded: !!p.folded,
          badugiEval: evaluateBadugi(p.hand),
        })),
        winners: (() => {
          const active = playersSnap.filter(p => !p.folded);
          if (active.length === 0) return [];
          // 最良Badugiを決定
          let best = active[0];
          for (const p of active) {
            if (compareBadugi(p.hand, best.hand) < 0) best = p;
          }
          return active
            .filter(p => compareBadugi(p.hand, best.hand) === 0)
            .map(p => p.name);
        })(),
        winner: (() => {
          const w = (() => {
            const active = playersSnap.filter(p => !p.folded);
            if (active.length === 0) return [];
            let best = active[0];
            for (const p of active) {
              if (compareBadugi(p.hand, best.hand) < 0) best = p;
            }
            return active
              .filter(p => compareBadugi(p.hand, best.hand) === 0)
              .map(p => p.name);
          })();
          return w.length > 1 ? "split" : w[0] ?? "-";
        })(),


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
      console.log("[HISTORY] saveRLHandHistory() called successfully");
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

  // 🃏 手札クリック処理
function handleCardClick(i) {
  // プレイヤーの選択状態をトグル
  setPlayers((prev) => {
    return prev.map((p, idx) => {
      if (idx !== 0) return p; // 自分以外はそのまま

      const selected = p.selected ? [...p.selected] : [];
      const already = selected.includes(i);
      const newSelected = already
        ? selected.filter((x) => x !== i)
        : [...selected, i];

      // まったく新しいオブジェクトを返す
      return {
        ...p,
        selected: newSelected,
      };
    });
  });
}


  return (
  <div className="flex flex-col h-screen bg-gray-900 text-white">
    {/* ──────────────── ヘッダー固定 ──────────────── */}
    <header className="flex justify-between items-center px-6 py-3 bg-gray-800 shadow-md fixed top-0 left-0 right-0 z-50">
      <h1 className="text-2xl font-bold text-white">Badugi App</h1>

      <nav className="flex gap-4">
        <button
          onClick={() => navigate("/home")}
          className="hover:text-yellow-400 transition"
        >
          Home
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="hover:text-yellow-400 transition"
        >
          Profile
        </button>
        <button
          onClick={() => navigate("/history")}
          className="hover:text-yellow-400 transition"
        >
          History
        </button>
      </nav>
    </header>

    {/* ──────────────── メインテーブル領域 ──────────────── */}
    <main className="flex-1 mt-20 relative flex items-center justify-center overflow-auto bg-green-700">
      {/* テーブル（既存ゲーム部分） */}
      <div className="relative w-[95%] max-w-[1200px] aspect-[4/3] bg-green-700 border-4 border-yellow-600 rounded-3xl shadow-inner">
        {/* 左上：Pot */}
        <div className="absolute top-4 left-4 text-white font-bold space-y-1">
          <div>Total Pot: {totalPotForDisplay}</div>
        </div>

        {/* 右上：Phase, Dealer など */}
        <div className="absolute top-4 right-4 text-white font-bold text-right space-y-1">
          <div>Phase: {phaseTagLocal()}</div>
          <div>Draw Progress: {drawRound}/{MAX_DRAWS}</div>
          {phase === "BET" && (
            <div>Raise Count (Table): {raiseCountThisRound} / 4</div>
          )}
          <div>Dealer: {players[dealerIdx]?.name ?? "-"}</div>
        </div>

        {/* ▼ プレイヤー配置部分 */}
        {players.map((p, i) => (
          <Player
            key={i}
            player={{
              ...p,
              name: `${p.name} (${positionName(i)})`,
            }}    
            index={i}
            selfIndex={0}
            phase={phase}
            turn={turn}
            dealerIdx={dealerIdx}
            onCardClick={handleCardClick}
          />
        ))}

        {/* controls：BET時 or DRAW時 いずれか一方だけ */}
        {turn === 0 && players[0] && !players[0].folded && (
        <div className="absolute bottom-8 right-8 z-50 flex flex-col items-end space-y-2">
          {phase === "BET" && (
            <Controls
              phase="BET"
              currentBet={currentBet}
              player={players[0]}
              onFold={playerFold}
              onCall={playerCall}
              onCheck={playerCheck}
              onRaise={playerRaise}
            />
          )}
          {phase === "DRAW" && (
            <Controls
              phase="DRAW"
              player={players[0]}
              onDraw={drawSelected}
            />
          )}
        </div>
      )}

        {/* showdown後の Next Hand */}
      {showNextButton && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={() => {
              if (!handSavedRef.current) {
                trySaveHandOnce({ playersSnap: players, dealerIdx, pots });
              }
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

      {phase === "TOURNAMENT_END" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-50">
          <h2 className="text-4xl font-bold text-yellow-400 mb-4">🏆 TOURNAMENT FINISHED 🏆</h2>
          <p className="text-lg mb-6 text-white">
            Congratulations to the Champion!
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-yellow-500 text-black font-bold rounded shadow-lg hover:bg-yellow-400"
          >
            Return to Home
          </button>
        </div>
      )}


      {/* ▼ デバッグトグルスイッチ */}
      <div className="absolute bottom-4 left-4 z-50">
        <button
          onClick={() => setDebugMode((v) => !v)}
          className={`px-4 py-2 rounded font-bold ${
      debugMode ? "bg-red-500" : "bg-gray-600"
          }`}
        >
          {debugMode ? "DEBUG ON" : "DEBUG OFF"}
        </button>
      </div>
      </div>
    </main>
  </div>
);
}
