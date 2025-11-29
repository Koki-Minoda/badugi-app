import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { designTokens } from "../../styles/designTokens.js";
import { getEnabledVariants } from "../game/variants.js";

function VariantOption({ variant, isSelected, onSelect }) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition ${
        isSelected
          ? "border-emerald-400/70 bg-emerald-500/10"
          : "border-white/15 bg-slate-950/60 hover:border-emerald-300/50"
      }`}
    >
      <div className="flex flex-col">
        <span className="text-sm text-slate-300">{variant.label}</span>
        <span className="text-xs text-slate-500">Enabled</span>
      </div>
      <input
        type="radio"
        name="friend-variant"
        value={variant.id}
        checked={isSelected}
        onChange={() => onSelect(variant.id)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`h-4 w-4 rounded-full border-2 ${
          isSelected ? "border-emerald-300 bg-emerald-300" : "border-white/30"
        }`}
      />
    </label>
  );
}

export default function FriendMatchSetupScreen() {
  const navigate = useNavigate();
  const enabledVariants = useMemo(() => getEnabledVariants(), []);
  const [variantId, setVariantId] = useState(enabledVariants[0]?.id ?? "badugi");
  const [seats, setSeats] = useState(4);
  const [stack, setStack] = useState(2000);
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [ante, setAnte] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatusMessage(
      "Friend match lobbies are not implemented yet. This screen will later be used to create P2P rooms.",
    );
  };

  const handleBackToMenu = () => {
    navigate("/menu");
  };

  return (
    <div
      className="min-h-screen px-4 py-10 text-white"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, ${designTokens.colors.surface} 0%, ${designTokens.colors.background} 60%)`,
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Friend Match</p>
          <h1 className="text-3xl font-bold text-white">Create a Room</h1>
          <p className="text-sm text-slate-300">
            Configure a private table for friends. Networking will arrive soon; for now this is a
            configuration preview.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-8"
        >
          <section aria-label="Game variant" className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Variant</p>
              <h2 className="text-xl font-semibold text-white">Choose your game</h2>
            </div>
            <div className="space-y-3" role="radiogroup" aria-label="Game variant options">
              {enabledVariants.map((variant) => (
                <VariantOption
                  key={variant.id}
                  variant={variant}
                  isSelected={variantId === variant.id}
                  onSelect={setVariantId}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Table Rules</p>
              <h2 className="text-xl font-semibold text-white">Set table parameters</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col text-sm text-slate-300 gap-1">
                <label htmlFor="friend-seats">Seats</label>
                <input
                  id="friend-seats"
                  name="seats"
                  type="number"
                  min="2"
                  max="8"
                  value={seats}
                  onChange={(event) => setSeats(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-col text-sm text-slate-300 gap-1">
                <label htmlFor="friend-starting-stack">Starting Stack</label>
                <input
                  id="friend-starting-stack"
                  name="startingStack"
                  type="number"
                  min="500"
                  step="100"
                  value={stack}
                  onChange={(event) => setStack(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-col text-sm text-slate-300 gap-1">
                <label htmlFor="friend-small-blind">Small Blind</label>
                <input
                  id="friend-small-blind"
                  name="smallBlind"
                  type="number"
                  min="1"
                  value={smallBlind}
                  onChange={(event) => setSmallBlind(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-col text-sm text-slate-300 gap-1">
                <label htmlFor="friend-big-blind">Big Blind</label>
                <input
                  id="friend-big-blind"
                  name="bigBlind"
                  type="number"
                  min="2"
                  value={bigBlind}
                  onChange={(event) => setBigBlind(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-col text-sm text-slate-300 gap-1 md:col-span-2">
                <label htmlFor="friend-ante">Ante (Optional)</label>
                <input
                  id="friend-ante"
                  name="ante"
                  type="number"
                  min="0"
                  value={ante}
                  onChange={(event) => setAnte(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              type="submit"
              className="flex-1 rounded-3xl bg-emerald-500/90 px-6 py-3 text-lg font-semibold text-slate-950 hover:bg-emerald-400 transition"
            >
              Create Room
            </button>
            <button
              type="button"
              onClick={handleBackToMenu}
              className="flex-1 rounded-3xl border border-white/20 px-6 py-3 text-lg font-semibold text-white hover:border-emerald-400/60 hover:text-emerald-200 transition"
            >
              Back to Menu
            </button>
          </div>

          {statusMessage && (
            <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-amber-200 text-sm">
              {statusMessage}
            </p>
          )}
        </form>

        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300 space-y-2">
          <p>Features coming soon:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Room codes with spectator slots.</li>
            <li>Invite links that pre-fill your preferred variant.</li>
            <li>In-room chat and emote reactions.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
