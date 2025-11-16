import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TitleForm from "../components/TitleForm";
import { loadTitleSettings, resetTitleSettings, saveTitleSettings } from "../utils/titleSettings";

export default function TitleSettingsScreen() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(() => loadTitleSettings());

  const preview = useMemo(
    () => ({
      name: settings.playerName || "You",
      title: settings.playerTitle || "Badugi Rookie",
      avatar: settings.avatar || "♦️",
    }),
    [settings]
  );

  const handleSave = (next) => {
    const saved = saveTitleSettings(next);
    setSettings(saved);
  };

  const handleReset = () => {
    const defaults = resetTitleSettings();
    setSettings(defaults);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-emerald-300">Settings</p>
          <h1 className="text-3xl font-extrabold">Title & Avatar</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg border border-white/30 hover:bg-white/10 transition"
          >
            タイトルに戻る
          </button>
          <button
            onClick={() => navigate("/game")}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition"
          >
            ゲームを開始
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 grid gap-8 lg:grid-cols-2">
        <section className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{preview.avatar}</div>
            <div>
              <p className="text-sm uppercase tracking-widest text-emerald-300">Preview</p>
              <h2 className="text-2xl font-bold">{preview.name}</h2>
              <span className="inline-flex mt-2 px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-300 text-xs uppercase tracking-wide">
                {preview.title}
              </span>
            </div>
          </div>
          <div className="space-y-3 text-sm text-slate-200">
            <p>この名前とタイトルはゲーム内のプレイヤーカードに表示されます。</p>
            <p>アバターはチャットログや将来の演出にも使用される予定です。</p>
          </div>
        </section>

        <section className="bg-white text-slate-900 rounded-3xl p-6 shadow-xl">
          <h3 className="text-xl font-semibold mb-4">プレイヤープロフィールを設定</h3>
          <TitleForm initialValues={settings} onSave={handleSave} onReset={handleReset} />
        </section>
      </main>
    </div>
  );
}
