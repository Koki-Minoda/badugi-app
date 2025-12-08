import React from "react";

export default function MobileOrientationGate({
  enabled = false,
  isPortrait = false,
  message = "Please rotate your device to landscape to continue.",
  children,
}) {
  if (!enabled || !isPortrait) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-gray-900 via-black to-black text-center text-white px-6">
      <div className="max-w-xs space-y-4">
        <div className="text-4xl" aria-hidden="true">
          📱↻
        </div>
        <h1 className="text-2xl font-semibold">Rotate to play</h1>
        <p className="text-sm text-slate-200 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
