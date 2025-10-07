// src/components/Controls.jsx
import React from "react";

export default function Controls({ phase, currentBet, player, onFold, onCall, onCheck, onRaise, onDraw }) {
  if (!player) return null;

  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-gray-800 p-2 rounded shadow-lg z-50">
      {phase === "BET" && (
        <>
          <div className="flex gap-2">
            <button onClick={onFold} className="px-3 py-2 rounded bg-gray-700 text-white">Fold</button>
            {currentBet > player.betThisRound ? (
              <button onClick={onCall} className="px-3 py-2 rounded bg-blue-600 text-white">Call</button>
            ) : (
              <button onClick={onCheck} className="px-3 py-2 rounded bg-yellow-500 text-black">Check</button>
            )}
            <button onClick={onRaise} className="px-3 py-2 rounded bg-red-600 text-white">Raise</button>
          </div>
        </>
      )}
      {phase === "DRAW" && (
        <button
        onClick={onDraw}
        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold whitespace-nowrap"
        >
          Draw Selected
          </button>
      )}
    </div>
  );
}
