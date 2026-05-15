import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import LearningDashboardPreview from "../components/LearningDashboardPreview.jsx";
import { createLearningDashboardFilterStore } from "../coaching/dashboard/learningDashboardFilterStore.js";
import { learningDashboardPreviewFixture } from "../coaching/dashboard/learningDashboardPreviewFixture.js";
import { safePreviewStorage } from "../coaching/previewFeatureFlags.js";

export default function LearningDashboardPreviewScreen({
  fixture = learningDashboardPreviewFixture,
  locale = "jp",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const menuPath = location.pathname.startsWith("/dev") ? "/dev/menu?mgxPreview=coaching" : "/menu?mgxPreview=coaching";
  const variants = useMemo(() => Object.keys(fixture.dashboard?.byVariant ?? {}).sort(), [fixture.dashboard]);
  const store = useMemo(
    () =>
      createLearningDashboardFilterStore({
        storage: safePreviewStorage(),
        availableVariants: variants,
      }),
    [variants],
  );
  const [selectedVariant, setSelectedVariant] = useState(() => store.getSelectedVariant());
  const [cleared, setCleared] = useState(false);

  const handleVariantChange = (variantId) => {
    setSelectedVariant(store.setSelectedVariant(variantId));
  };

  const handleReplay = (item) => {
    if (item?.href) navigate(item.href);
  };

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-6 text-white sm:px-8" data-testid="learning-dashboard-preview-screen">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-yellow-200">MGX Preview</p>
            <h1 className="mt-1 text-xl font-semibold text-yellow-50">
              {locale === "en" ? "Learning Dashboard Preview" : "学習ダッシュボード Preview"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              {locale === "en"
                ? "Local preview data only. No routing, model, dataset, or backend analytics changes are active."
                : "ローカルのプレビューデータのみです。routing / model / dataset / backend analytics は変更していません。"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(menuPath)}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 hover:bg-white/10"
            data-testid="learning-dashboard-preview-back"
          >
            {locale === "en" ? "Back" : "戻る"}
          </button>
        </div>

        {cleared ? (
          <LearningDashboardPreview
            dashboard={{ global: { sessions: [] }, byVariant: {} }}
            chartSeries={{}}
            replayQueue={{ items: [] }}
            selectedVariant="all"
            locale={locale}
          />
        ) : (
          <LearningDashboardPreview
            dashboard={fixture.dashboard}
            chartSeries={fixture.chartSeries}
            replayQueue={fixture.replayQueue}
            selectedVariant={selectedVariant}
            onVariantChange={handleVariantChange}
            onReplay={handleReplay}
            onClear={() => setCleared(true)}
            locale={locale}
          />
        )}
      </div>
    </main>
  );
}
