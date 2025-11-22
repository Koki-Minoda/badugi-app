import React from "react";

const VARIANT_STYLES = {
  info: "bg-slate-900 border border-emerald-500 text-emerald-200",
  success: "bg-slate-900 border border-white/10 text-slate-100",
  warning: "bg-slate-900 border border-amber-400 text-amber-200",
};

export default function Notification({ variant = "success", message }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-[11px] tracking-wide ${VARIANT_STYLES[variant] ?? VARIANT_STYLES.success}`}>
      {message}
    </div>
  );
}
