import React from "react";

export default function Modal({ open, title, onClose, children, className = "" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`max-w-2xl w-full bg-slate-950 border border-white/10 rounded-2xl shadow-xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            type="button"
            className="text-sm text-slate-400 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="px-4 py-5 space-y-3 text-xs text-slate-200">
          {children}
        </div>
      </div>
    </div>
  );
}
