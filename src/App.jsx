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

// ▼ 追記：履歴保存API
import { saveHandHistory } from "./utils/history";

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
  const [drawRound, setDrawRound] = useState(0); // 完了したDRAW数 0..3
  const [pots, setPots] = useState([]);

  const [turn, setTurn] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);

  // 再入防止：ラウンド遷移やNPC処理が二重発火しておかしくならないように
  const [transitioning, setTransitioning] = useState(false);

  const [showNextButton, setShowNextButton] = useState(false);

  // ▼ 追記：このハンドを保存済みかどうか（多重保存防止）
  const handSavedRef = useRef(false);
  // 便宜上の handId（ディーラー座席＋タイムスタンプ）
  const handIdRef = useRef(null);

  /* --- utils --- */
  function makeEmptyPlayers() {
    const names = ["You", "P2", "P3", "P4", "P5", "P6"];
    return Array.from({ length: NUM_PLAYERS }).map((_, i) => ({
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
    const { pots: newPots, clearedPlayers } = settleStreetToPots(playersSnap, pots);
    const reset = clearedPlayers.map((p) => ({ ...p, hasDrawn: false, lastDrawCount: 0 }));
    setPots(newPots);
    setPlayers(reset);

    if (drawRound < MAX_DRAWS) {
      // 次は DRAW（SBから）
      setPhase("DRAW");
      setTurn((dealerIdx + 1) % NUM_PLAYERS);
    } else {
      // 3回のDRAWを終えた後のBETが終了 → SHOWDOWN
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
  }

  function advanceAfterAction(updatedPlayers) {
    const snap = updatedPlayers || players; // 最新があれば優先

    // 途中で勝負が決まったら即終了
    if (checkIfOneLeftThenEnd()) return;

    if (phase === "BET") {
      const next = getNextAliveAfter(turn);
      if (next === null) return;

      const active = snap.filter((p) => !p.folded);
      const everyoneMatched = active.every((p) => p.betThisRound === currentBet);

      // 💡 全員コール/チェック完了 → 次のラウンドへ
      if (everyoneMatched && next === betHead) {
        if (drawRound < 3) {
          // 次は DRAW → SB から
          setPhase("DRAW");
          setTurn((dealerIdx + 1) % NUM_PLAYERS);
        } else {
          // → SHOWDOWN
          setPhase("SHOWDOWN");
          setTimeout(() => {
            runShowdown({
              players: snap,
              setPlayers,
              pot: totalPotForDisplay,
              setPot: () => {},
              dealerIdx,
              dealNewHand,
            });
          }, 250);
        }
      } else {
        // まだラウンド継続
        setTurn(next);
      }
      return;
    }

    if (phase === "DRAW") {
      // 全員ドロー済みなら BET ラウンドへ移行
      const allDrawn = snap.every((pl) => pl.folded || pl.hasDrawn);
      if (allDrawn) {
        const reset = snap.map((p) => ({
          ...p,
          betThisRound: 0,
          hasDrawn: false,
        }));
        setPlayers(reset);
        setCurrentBet(0); // チェック可能に戻す
        const firstToAct = (dealerIdx + 3) % snap.length; // UTG
        setTurn(firstToAct);
        setBetHead(firstToAct);
        setPhase("BET");
        return;
      }

      // まだ全員ドローしてない → runDrawRound で次へ
      runDrawRound({
        players: snap,
        turn,
        deck,
        setPlayers,
        setDeck,
        advanceAfterAction,
      });
    }
  }

  function finishDrawRound() {
    setDrawRound((prev) => prev + 1);

    // 各プレイヤーの hasDrawn をリセットし、BET の準備
    const reset = players.map((p) => ({
      ...p,
      betThisRound: 0,
      lastAction: "",
      hasDrawn: false,
    }));

    setPlayers(reset);
    setCurrentBet(0);
    setPhase("BET");
    setTurn((dealerIdx + 1) % NUM_PLAYERS); // SBからBET開始
  }

  /* --- dealing --- */
  function dealNewHand(nextDealerIdx = 0) {
    const newDeck = shuffleDeck(createDeck());
    const newPlayers = makeEmptyPlayers();

    for (let i = 0; i < NUM_PLAYERS; i++) {
      newPlayers[i].hand = newDeck.splice(0, 4);
      newPlayers[i].hasDrawn = false; // 👈 ドロー済みフラグ初期化
      newPlayers[i].lastDrawCount = 0; // 👈 ドロー枚数初期化
    }

    const sbIdx = (nextDealerIdx + 1) % NUM_PLAYERS;
    const bbIdx = (nextDealerIdx + 2) % NUM_PLAYERS;
    newPlayers[sbIdx].stack -= SB;
    newPlayers[sbIdx].betThisRound = SB;
    newPlayers[bbIdx].stack -= BB;
    newPlayers[bbIdx].betThisRound = BB;

    setPlayers(newPlayers);
    setDeck(newDeck);
    setPots([{ amount: SB + BB, eligible: [...Array(NUM_PLAYERS).keys()] }]);

    setCurrentBet(BB);
    setDealerIdx(nextDealerIdx);
    setDrawRound(0);
    setPhase("BET");
    setTurn((nextDealerIdx + 3) % NUM_PLAYERS); // UTG
    setShowNextButton(false);
    setTransitioning(false);

    // 次ハンド開始時は保存フラグをリセット
    handSavedRef.current = false;
    handIdRef.current = `${nextDealerIdx}-${Date.now()}`;
  }

  useEffect(() => {
    dealNewHand(0);
  }, []);

  /* --- common: after BET action (snapshot-based) --- */
  function afterBetActionWithSnapshot(snap, actedIndex) {
    if (transitioning) {
      // 進行中のトランジションがあれば弾く（多重遷移防止）
      setPlayers(snap);
      return;
    }

    // 残り1人なら即ショーダウン
    if (checkIfOneLeftThenEnd(snap)) return;

    // 現在の最大ベットを反映
    const maxNow = maxBetThisRound(snap);
    if (currentBet !== maxNow) setCurrentBet(maxNow);

    // 全員一致 or All-inで停止 → BET終了
    if (isBetRoundComplete(snap)) {
      setTransitioning(true);
      finishBetRoundFrom(snap);
      setTimeout(() => setTransitioning(false), 0);
      return;
    }

    // 次のアクティブへ
    const next = nextAliveFrom(snap, actedIndex);
    setPlayers(snap);
    if (next !== null) setTurn(next);
  }

  /* --- actions: BET --- */
  function playerFold() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    me.folded = true;
    me.lastAction = "Fold";
    snap[0] = me;
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
    if (me.stack === 0) me.allIn = true;

    snap[0] = me;
    afterBetActionWithSnapshot(snap, 0);
  }

  function playerCheck() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    const maxNow = maxBetThisRound(snap);
    if (me.betThisRound === maxNow || me.allIn) {
      me.lastAction = "Check";
      snap[0] = me;
      afterBetActionWithSnapshot(snap, 0);
    } else {
      playerCall();
    }
  }

  function playerRaise() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };

    const maxNow = maxBetThisRound(snap);
    const toCall = Math.max(0, maxNow - me.betThisRound);
    const raiseAmt = betSize;
    const total = toCall + raiseAmt;

    const pay = Math.min(me.stack, total);
    me.stack -= pay;
    me.betThisRound += pay;
    me.lastAction = pay < total ? "Raise (All-in)" : "Raise";
    if (me.stack === 0) me.allIn = true;

    snap[0] = me;

    // レイズ後の max を即反映
    const newMax = maxBetThisRound(snap);
    if (currentBet !== newMax) setCurrentBet(newMax);

    afterBetActionWithSnapshot(snap, 0);
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
    if (phase !== "DRAW" || drawRound >= 3) return;

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

        if (toCall > 0 && r < 0.18 && score <= 2) {
          me.folded = true;
          me.lastAction = "Fold";
        } else {
          const pay = Math.min(me.stack, toCall);
          me.stack -= pay;
          me.betThisRound += pay;
          me.lastAction = toCall === 0 ? "Check" : pay < toCall ? "Call (All-in)" : "Call";
          if (me.stack === 0) me.allIn = true;

          if (!me.allIn && Math.random() > 0.85) {
            const add = Math.min(me.stack, betSize);
            me.stack -= add;
            me.betThisRound += add;
            me.lastAction = add < betSize ? "Raise (All-in)" : "Raise";
            if (me.stack === 0) me.allIn = true;
          }
        }

        snap[turn] = me;
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
    try {
      const handId = handIdRef.current ?? `${dealerIdx}-${Date.now()}`;
      handIdRef.current = handId;

      // 総ポット（settled + 現在のbet）を安全に計算
      const pot =
        typeof potOverride === "number"
          ? potOverride
          : (pots || []).reduce((s, p) => s + (p?.amount || 0), 0) +
            (playersSnap || []).reduce((s, p) => s + (p?.betThisRound || 0), 0);

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
      };

      saveHandHistory(record);
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
      <div className="absolute top-4 right-4 text-white font-bold">
        Phase: {phase} &nbsp; Draw: {drawRound}/{MAX_DRAWS}
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
    </div>
  );
}
