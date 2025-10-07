// src/components/Card.jsx
import React from "react";

export default function Card({ value, hidden, selected, onClick, folded }) {
  // ------------------------------
  // 1️⃣ 非表示またはフォールド中カード（裏面）
  // ------------------------------
  if (hidden || folded) {
    return (
      <div
        className={`w-16 h-24 rounded-lg shadow-lg border-4 border-yellow-500 
        flex items-center justify-center 
        bg-gradient-to-br from-gray-900 via-black to-gray-800 
        relative overflow-hidden 
        ${folded ? "opacity-50" : ""} 
        select-none`}
      >
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 gap-1 opacity-20">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-yellow-400 rounded-full mx-auto my-auto"
            />
          ))}
        </div>
        <div className="absolute w-10 h-10 rounded-full border-2 border-yellow-400 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-yellow-500 shadow-inner" />
        </div>
      </div>
    );
  }

  // ------------------------------
  // 2️⃣ 表面カード（クリック選択可能）
  // ------------------------------
  const suit = value.slice(-1);
  const rank = value.slice(0, -1);

  let color = "text-black";
  if (suit === "♥") color = "text-red-600";
  if (suit === "♦") color = "text-blue-600";
  if (suit === "♣") color = "text-green-600";

  return (
    <div
      onClick={onClick}
      className={`
        w-16 h-24 bg-white rounded-lg shadow-md 
        flex items-center justify-center 
        font-bold text-lg select-none cursor-pointer transition-transform
        ${selected ? "border-4 border-blue-500 scale-105" : "border-4 border-gray-300"}
        hover:scale-105 active:scale-95
      `}
    >
      <span className={color}>
        {rank}
        {suit}
      </span>
    </div>
  );
}
