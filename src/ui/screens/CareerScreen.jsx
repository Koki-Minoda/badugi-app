import React, { useMemo } from "react";
import { buildCareerViewModel, loadCareerProfile } from "../career/careerProfile.js";

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function formatDate(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function StageMarker({ stage }) {
  const marker = stage.locked ? "LOCKED" : stage.champion ? "DONE" : "OPEN";
  return (
    <div
      data-testid={`career-stage-${stage.stageId}`}
      className="grid grid-cols-[80px_minmax(0,1fr)_72px] items-center gap-3 border-b border-white/10 py-3 last:border-b-0"
    >
      <span
        className={`text-xs font-black uppercase tracking-[0.16em] ${
          stage.champion
            ? "text-emerald-200"
            : stage.locked
              ? "text-slate-500"
              : "text-yellow-200"
        }`}
      >
        {marker}
      </span>
      <span className="text-sm font-black text-white">{stage.label}</span>
      <span className="text-right text-sm text-slate-300">
        {stage.champion ? "✓" : stage.locked ? "LOCK" : "○"}
      </span>
    </div>
  );
}

export default function CareerScreen({
  profile = null,
  onBack = null,
}) {
  const viewModel = useMemo(
    () => buildCareerViewModel(profile ?? loadCareerProfile()),
    [profile],
  );
  const { badugiProgress, variants, championRecords, statistics } = viewModel;

  return (
    <div className="min-h-screen bg-[#050507] px-5 py-6 text-slate-100 md:px-8 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
              Career
            </p>
            <h1 className="mt-2 text-3xl font-black text-white">BADUGI SERIES</h1>
          </div>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="w-fit rounded-md border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-200 hover:border-emerald-300/70 hover:text-emerald-100"
            >
              Back
            </button>
          ) : null}
        </header>

        <main className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-white/10 bg-slate-950/85 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                  Badugi
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  Progress {badugiProgress.percent}%
                </h2>
              </div>
              <p className="text-sm font-black text-slate-300">
                {badugiProgress.completed} / {badugiProgress.total}
              </p>
            </div>
            <div
              className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"
              data-testid="career-progress-bar"
            >
              <div
                className="h-full rounded-full bg-emerald-300"
                style={{ width: `${badugiProgress.percent}%` }}
              />
            </div>
            <div className="mt-5" data-testid="career-progress-map">
              {badugiProgress.stages.map((stage) => (
                <StageMarker key={stage.stageId} stage={stage} />
              ))}
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <section className="rounded-lg border border-white/10 bg-slate-950/85 p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white">
                Statistics
              </h2>
              <dl className="mt-4 space-y-3 text-sm" data-testid="career-statistics">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Tournaments Played</dt>
                  <dd className="font-black text-white">
                    {formatNumber(statistics.tournamentsPlayed)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Tournaments Won</dt>
                  <dd className="font-black text-white">
                    {formatNumber(statistics.tournamentsWon)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Final Tables</dt>
                  <dd className="font-black text-white">
                    {formatNumber(statistics.finalTables)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Heads Up Appearances</dt>
                  <dd className="font-black text-white">
                    {formatNumber(statistics.headsUps)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Total Prize</dt>
                  <dd className="font-black text-white">
                    {formatNumber(statistics.totalPrize)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-white/10 bg-slate-950/85 p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white">
                Variants
              </h2>
              <div className="mt-4 space-y-2" data-testid="career-variant-progress">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    data-testid={`career-variant-${variant.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  >
                    <span className="font-black text-white">{variant.label}</span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-[0.16em] ${
                        variant.playable ? "text-emerald-200" : "text-slate-500"
                      }`}
                    >
                      {variant.playable ? "PLAYABLE" : "LOCKED"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="rounded-lg border border-white/10 bg-slate-950/85 p-5 lg:col-span-2">
            <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white">
              Champion Record
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2" data-testid="career-champion-record">
              {championRecords.length ? (
                championRecords.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-4 py-3"
                  >
                    <p className="text-sm font-black text-white">{record.label}</p>
                    <p className="mt-1 text-xs text-slate-300">
                      {formatDate(record.achievedAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No championships recorded yet.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
