import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";
import { GAME_VARIANT_CATEGORIES, getVariantById } from "../../games/config/variantCatalog.js";
import {
  enqueueDealerChoiceVariant,
  getDealerChoiceQueue,
  clearDealerChoiceQueue,
  setDealerChoiceModeActive,
} from "../dealersChoice/dealerChoiceManager.js";

const WHEEL_VARIANTS = ["B01", "B02", "B05", "B06", "ST1", "ST2", "ST3", "D01", "D03", "S01"];

function useRoulette(variants) {
  const [current, setCurrent] = useState(variants[0]);
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef(null);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const start = Date.now();
    const duration = 1500 + Math.random() * 800;

    const tick = () => {
      const next = variants[Math.floor(Math.random() * variants.length)];
      setCurrent(next);
      if (Date.now() - start >= duration) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setSpinning(false);
        return;
      }
    };

    timerRef.current = setInterval(tick, 120);
  };

  return { current, spinning, spin };
}

export default function DealersChoiceScreen() {
  const navigate = useNavigate();
  const progress = usePlayerProgress();
  const unlock = computeUnlockState(progress);
  const locked = unlock.dealerChoiceLocked;
  const [queue, setQueue] = useState(() => getDealerChoiceQueue());
  const [lastQueuedLabel, setLastQueuedLabel] = useState("");

  const variantEntries = useMemo(() => {
    return WHEEL_VARIANTS.map((id) => {
      const data = getVariantById(id);
      return {
        id,
        name: data?.name ?? id,
        category: data?.category ?? GAME_VARIANT_CATEGORIES.SINGLE_DRAW,
      };
    });
  }, []);

  const roulette = useRoulette(variantEntries.map((entry) => entry.id));
  const currentVariant = variantEntries.find((entry) => entry.id === roulette.current);

  useEffect(() => {
    setQueue(getDealerChoiceQueue());
  }, []);

  const addToQueue = () => {
    if (locked || !currentVariant) return;
    const nextQueue = enqueueDealerChoiceVariant(currentVariant.id);
    setQueue(nextQueue);
    setLastQueuedLabel(currentVariant.name);
  };

  const clearQueue = () => {
    setQueue(clearDealerChoiceQueue());
    setLastQueuedLabel("");
    setDealerChoiceModeActive(false);
  };

  const launchTable = () => {
    if (locked || !currentVariant) return;
    const nextQueue = enqueueDealerChoiceVariant(currentVariant.id);
    setQueue(nextQueue);
    setLastQueuedLabel(currentVariant.name);
    setDealerChoiceModeActive(true);
    navigate("/game?mode=dealers-choice");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-300">
            Dealer&apos;s Choice
          </p>
          <h1 className="text-3xl font-extrabold">Dealer&apos;s Choice Roulette</h1>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition"
          >
            Titleへ戻る
          </button>
          <button
            type="button"
            onClick={() => navigate("/games")}
            className="px-4 py-2 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10 transition"
          >
            Game Catalog
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-10">
        {locked && (
          <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 text-amber-100 text-sm p-4">
            World Championship を制覇すると Dealer&apos;s Choice が解放されます。
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Roulette</h2>
            <div className="relative h-64 w-64 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-400/30 animate-spin pointer-events-none" />
              <div className="absolute inset-4 rounded-full bg-slate-950 flex flex-col items-center justify-center text-center px-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">Next Game</p>
                <p className="text-2xl font-bold mt-2">{currentVariant?.name ?? "??"}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {currentVariant?.category ?? "Unknown"}
                </p>
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-0 h-0 border-l-8 border-r-8 border-b-16 border-transparent border-b-amber-400" />
            </div>
            <button
              type="button"
              disabled={locked || roulette.spinning}
              onClick={roulette.spin}
              data-testid="roulette-spin"
              className={`w-full mt-4 rounded-2xl px-4 py-3 font-semibold transition ${
                locked
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
              }`}
            >
              {roulette.spinning ? "Spinning..." : locked ? "COMING SOON" : "Spin Roulette"}
            </button>
            <button
              type="button"
              disabled={locked || !currentVariant}
              onClick={addToQueue}
              data-testid="roulette-add"
              className={`w-full rounded-2xl px-4 py-2 font-semibold transition ${
                locked
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-600 text-slate-50 hover:bg-emerald-500"
              }`}
            >
              {currentVariant ? `${currentVariant.name} をキューに追加` : "スピンしてください"}
            </button>
            <button
              type="button"
              disabled={locked || !currentVariant}
              onClick={launchTable}
              data-testid="roulette-launch"
              className={`w-full rounded-2xl px-4 py-2 font-semibold transition ${
                locked
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-cyan-500 text-slate-900 hover:bg-cyan-400"
              }`}
            >
              {currentVariant ? "このゲームですぐスタート" : "スピンしてください"}
            </button>
            <button
              type="button"
              disabled={!queue.length}
              onClick={clearQueue}
              data-testid="roulette-clear"
              className="w-full rounded-2xl px-4 py-2 font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition disabled:opacity-40"
            >
              キューをクリア ({queue.length})
            </button>
            </button>
            {lastQueuedLabel && (
              <p className="text-xs text-emerald-300 text-center">
                {lastQueuedLabel} を追加しました。
              </p>
            )}
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">キュー / スピン履歴</h2>
            <p className="text-sm text-slate-300">
              「このゲームですぐスタート」を押すと Badugi テーブルに Dealer&apos;s Choice モードで遷移します。
            </p>
            <ul className="space-y-2 text-sm max-h-80 overflow-y-auto">
              {queue.length === 0 && (
                <li className="text-slate-500">まだキューに追加されていません。</li>
              )}
              {queue.map((id, index) => {
                const variant = variantEntries.find((entry) => entry.id === id);
                return (
                  <li
                    key={`${id}-${index}`}
                    className="flex items-center justify-between rounded-xl bg-slate-950/50 px-3 py-2"
                  >
                    <span className="font-semibold">{variant?.name ?? id}</span>
                    <span className="text-xs text-slate-400">{variant?.category ?? "Unknown"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="bg-slate-900/70 border border-white/10 rounded-3xl p-6 space-y-3">
          <h2 className="text-lg font-semibold">Roadmap Notes</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>- Final tableでの自動 Dealer&apos;s Choice 適用（トーナメント連動）。</li>
            <li>- RL ログへキュー内容を保存しリプレイで閲覧可能にする。</li>
            <li>- Playwright シナリオ `dealers_choice.md` をもとにUIスモークを追加予定。</li>
            <li>- ルーレット演出をテーブル上に投影し、配当チップ移動と同期させる。</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
