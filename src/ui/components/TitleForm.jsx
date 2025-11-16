import React, { useEffect, useState } from "react";
import { getDefaultTitleSettings } from "../utils/titleSettings";

const avatarChoices = ["♦️", "♠️", "♥️", "♣️", "★", "⚡️"];

export default function TitleForm({ initialValues, onSave, onReset }) {
  const [formState, setFormState] = useState(() => initialValues ?? getDefaultTitleSettings());
  const [status, setStatus] = useState("");

  useEffect(() => {
    setFormState(initialValues ?? getDefaultTitleSettings());
    setStatus("");
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
    onSave?.(formState);
    setStatus("保存しました");
    setTimeout(() => setStatus(""), 2000);
  }

  function handleReset() {
    const defaults = getDefaultTitleSettings();
    onReset?.(defaults);
    setFormState(defaults);
    setStatus("初期化しました");
    setTimeout(() => setStatus(""), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          プレイヤー名
        </label>
        <input
          name="playerName"
          value={formState.playerName}
          onChange={handleChange}
          maxLength={16}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="例: ミッドナイト・バドゥーギ"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          タイトル / バッジ
        </label>
        <input
          name="playerTitle"
          value={formState.playerTitle}
          onChange={handleChange}
          maxLength={24}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="例: Emerald Hunter"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          アバター
        </label>
        <select
          name="avatar"
          value={formState.avatar}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        >
          {avatarChoices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </div>

      {status && <p className="text-sm text-emerald-600">{status}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-emerald-600 text-white font-semibold py-2 hover:bg-emerald-500 transition"
        >
          保存する
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
        >
          デフォルト
        </button>
      </div>
    </form>
  );
}
