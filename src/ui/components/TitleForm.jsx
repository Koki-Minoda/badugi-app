import { useLanguage } from "../preferences/language.js";
import React, { useEffect, useState } from "react";
import { getDefaultTitleSettings, isEmailPlayerName } from "../utils/titleSettings";

const avatarChoices = [
  { value: "/characters/hero.png", label: "主人公" },
  { value: "♦️", label: "♦️ Diamond" },
  { value: "♠️", label: "♠️ Spade" },
  { value: "♥️", label: "♥️ Heart" },
  { value: "♣️", label: "♣️ Club" },
  { value: "★", label: "★ Star" },
  { value: "⚡️", label: "⚡️ Flash" },
];

export default function TitleForm({ initialValues, onSave, onReset }) {
  const ja = useLanguage() === "ja";
  const [formState, setFormState] = useState(() => initialValues ?? getDefaultTitleSettings());
  const [status, setStatus] = useState("");

  useEffect(() => {
    setFormState(initialValues ?? getDefaultTitleSettings());
  }, [initialValues]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (isEmailPlayerName(formState.playerName)) {
      setStatus("invalidName");
      return;
    }
    onSave?.(formState);
    setStatus("saved");
    setTimeout(() => setStatus(""), 2000);
  }

  function handleReset() {
    const defaults = getDefaultTitleSettings();
    onReset?.(defaults);
    setFormState(defaults);
    setStatus("reset");
    setTimeout(() => setStatus(""), 2000);
  }

  const statusCopy = {
    invalidName: ja ? "メールアドレスではなく、対局で使う名前を入力してください。" : "Use a player name instead of an email address.",
    saved: ja ? "保存しました" : "Saved",
    reset: ja ? "初期化しました" : "Reset to defaults",
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="title-player-name" className="block text-sm font-semibold text-slate-700 mb-1">
          {ja ? "プレイヤー名" : "Player name"}
        </label>
        <input
          id="title-player-name"
          name="playerName"
          aria-describedby="player-name-help"
          value={formState.playerName}
          onChange={handleChange}
          maxLength={16}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder={ja ? "例: ミッドナイト・バドゥーギ" : "e.g. Midnight Badugi"}
        />
        <p id="player-name-help" className="mt-2 text-sm text-slate-600">
          {ja ? "対局中と優勝・順位画面に表示する名前です。16文字まで。このブラウザに保存されます。未設定時はYouと表示します。" : "Shown at the table and in results. Up to 16 characters, saved in this browser. Defaults to You."}
        </p>
      </div>

      <div>
        <label htmlFor="title-player-title" className="block text-sm font-semibold text-slate-700 mb-1">
          {ja ? "タイトル / バッジ" : "Title / badge"}
        </label>
        <input
          id="title-player-title"
          name="playerTitle"
          value={formState.playerTitle}
          onChange={handleChange}
          maxLength={24}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder={ja ? "例: Emerald Hunter" : "e.g. Emerald Hunter"}
        />
      </div>

      <div>
        <label htmlFor="title-avatar" className="block text-sm font-semibold text-slate-700 mb-1">
          {ja ? "アバター" : "Avatar"}
        </label>
        <select
          id="title-avatar"
          name="avatar"
          value={formState.avatar}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        >
          {avatarChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.value === "/characters/hero.png" && !ja ? "Hero" : choice.label}
            </option>
          ))}
        </select>
      </div>

      {status && <p className="text-sm text-emerald-600">{statusCopy[status]}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-emerald-600 text-white font-semibold py-2 hover:bg-emerald-500 transition"
        >
          {ja ? "保存する" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
        >
          {ja ? "デフォルト" : "Defaults"}
        </button>
      </div>
    </form>
  );
}
