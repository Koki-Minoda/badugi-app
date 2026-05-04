import React from "react";

export default function MobileOrientationGate({
  enabled = false,
  isPortrait = false,
  message = "Please rotate your device to landscape to continue.",
  children,
}) {
  if (!enabled || !isPortrait) return <>{children}</>;

  const requestLandscape = async () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation?.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch {
      // iOS Safari and some embedded browsers do not allow web pages to lock orientation.
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gradient-to-br from-slate-950 via-black to-slate-900 px-6 text-center text-white">
      <div className="max-w-sm space-y-4 rounded-2xl border border-white/15 bg-black/45 p-6 shadow-2xl backdrop-blur">
        <div className="text-4xl" aria-hidden="true">
          📱↻
        </div>
        <h1 className="text-xl font-semibold">横向きでプレイしてください</h1>
        <p className="text-sm leading-relaxed text-slate-200">
          MGXはスマホ横画面に最適化されています。
        </p>
        <p className="text-xs leading-relaxed text-slate-400">{message}</p>
        <p className="text-xs text-amber-200/90">
          Landscape mode required on mobile.
        </p>
        <button
          type="button"
          onClick={requestLandscape}
          className="w-full rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-300/15"
        >
          横向き表示を試す
        </button>
      </div>
    </div>
  );
}
