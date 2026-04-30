// src/ui/components/Card.jsx
import React from "react";

export default function Card({ value, hidden, selected, onClick, folded, ...rest }) {
  const { style: restStyle, ...restProps } = rest;
  const cardSizeStyle = {
    width: "var(--card-w, clamp(40px, 6vw, 64px))",
    height: "var(--card-h, clamp(56px, 9vw, 96px))",
  };
  const cardStyle = { ...cardSizeStyle, ...restStyle };
  const cardFontStyle = {
    ...cardStyle,
    fontSize: "var(--card-font-size, clamp(12px, 2.5vw, 18px))",
  };

  // ------------------------------
  // 1️⃣ 非表示またはフォールド中カード（裏面）
  // ------------------------------
  if (hidden || folded) {
    return (
      <div
        {...restProps}
        style={cardStyle}
        className={`rounded-lg shadow-lg border-4 border-yellow-500 
        flex items-center justify-center 
        bg-gradient-to-br from-gray-900 via-black to-gray-800 
        relative overflow-hidden 
        ${folded ? "opacity-50" : ""} 
        select-none touch-manipulation`}
      >
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 gap-1 opacity-20">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="bg-yellow-400 rounded-full mx-auto my-auto"
              style={{
                width: "var(--card-dot-size, clamp(6px, 1vw, 8px))",
                height: "var(--card-dot-size, clamp(6px, 1vw, 8px))",
              }}
            />
          ))}
        </div>
        <div
          className="absolute rounded-full border-2 border-yellow-400 flex items-center justify-center"
          style={{
            width: "var(--card-center-size, clamp(28px, 4vw, 40px))",
            height: "var(--card-center-size, clamp(28px, 4vw, 40px))",
          }}
        >
          <div
            className="rounded-full bg-yellow-500 shadow-inner"
            style={{
              width: "var(--card-center-inner-size, clamp(12px, 2vw, 16px))",
              height: "var(--card-center-inner-size, clamp(12px, 2vw, 16px))",
            }}
          />
        </div>
      </div>
    );
  }

  // ------------------------------
  // 2️⃣ 表面カード（クリック選択可能）
  // ------------------------------
  const normalized = typeof value === "string" ? value.trim() : "";
  const rawSuit = normalized.slice(-1).toUpperCase();
  const rank = normalized.slice(0, -1);

  const suitMap = {
    S: { symbol: "♠", color: "text-gray-900" },
    H: { symbol: "♥", color: "text-red-600" },
    D: { symbol: "♦", color: "text-blue-600" },
    C: { symbol: "♣", color: "text-green-600" },
  };
  const fallbackSuit = { symbol: rawSuit || "?", color: "text-black" };
  const { symbol, color } = suitMap[rawSuit] || fallbackSuit;

  return (
    <div
      {...restProps}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? Boolean(selected) : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(event);
        }
      }}
      style={cardFontStyle}
      className={`
        bg-white rounded-lg shadow-md 
        flex items-center justify-center 
        font-bold select-none cursor-pointer transition-transform touch-manipulation
        ${selected ? "border-4 border-blue-500 scale-105" : "border-4 border-gray-300"}
        hover:scale-105 active:scale-95
      `}
    >
      <span className={color}>
        {rank}
        {symbol}
      </span>
    </div>
  );
}
