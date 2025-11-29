import React, { useEffect, useLayoutEffect, useRef } from "react";
import { GAME_VARIANTS } from "../game/variants.js";

function VariantButton({ variant, onSelect }) {
  const disabled = !variant.enabled;
  return (
    <button
      type="button"
      disabled={disabled}
      data-variant-option={disabled ? "disabled" : "enabled"}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect(variant.id)}
      className={`w-full rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
        disabled
          ? "border-white/10 bg-slate-900/40 text-slate-500 cursor-not-allowed opacity-60"
          : "border-white/20 bg-slate-900/80 hover:border-emerald-400/60 hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold text-white">{variant.label}</p>
        {!disabled && <span className="text-xs uppercase text-emerald-300">Available</span>}
      </div>
      {disabled ? (
        <p className="text-sm text-amber-300 mt-1">Coming soon</p>
      ) : (
        <p className="text-sm text-slate-300 mt-1">Jump in immediately</p>
      )}
    </button>
  );
}

export default function VariantSelectModal({ isOpen, onClose, onSelectVariant }) {
  const modalRef = useRef(null);
  const headingId = "variant-select-title";

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const focusFirstInteractive = () => {
      const firstInteractive = modalRef.current?.querySelector(
        '[data-variant-option="enabled"]',
      );
      if (firstInteractive && typeof firstInteractive.focus === "function") {
        firstInteractive.focus();
      }
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      const frame = window.requestAnimationFrame(() => focusFirstInteractive());
      return () => {
        if (typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(frame);
        }
      };
    }
    const timeoutId = setTimeout(focusFirstInteractive, 0);
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const handleVariantSelection = (variantId) => {
    if (!variantId) return;
    if (typeof onSelectVariant === "function") {
      onSelectVariant(variantId);
    }
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6"
      onMouseDown={handleOverlayClick}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl focus:outline-none"
        data-testid="variant-select-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={modalRef}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Cash Game</p>
            <h2 id={headingId} className="text-2xl font-semibold text-white">
              Select a Variant
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 text-sm text-white hover:bg-white/10 transition focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Close
          </button>
        </div>
        <div className="space-y-3">
          {GAME_VARIANTS.map((variant) => (
            <VariantButton key={variant.id} variant={variant} onSelect={handleVariantSelection} />
          ))}
        </div>
      </div>
    </div>
  );
}
