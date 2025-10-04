import { computeBasicStats } from "../utils/history";

export default function ProfileStats() {
  const s = computeBasicStats();
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold">プロフィール・スタッツ（簡易）</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="トーナメント数" value={s.tournaments} />
        <Stat label="ITM回数" value={s.itmCount} />
        <Stat label="ITM率" value={(s.itmRate * 100).toFixed(1) + "%"} />
        <Stat label="総バイイン" value={fmtJpy(s.totalBuyIn)} />
        <Stat label="総賞金" value={fmtJpy(s.totalPrize)} />
        <Stat label="ROI" value={(s.roi * 100).toFixed(1) + "%"} />
        <Stat label="最高順位" value={s.bestFinish ?? "-"} />
      </div>
      <p className="text-xs opacity-70">
        ここはまず最小限のKPI。後で VPIP/PFR/AGG/バドゥーギ固有KPI をハンド履歴から算出して拡張予定。
      </p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function fmtJpy(n) {
  if (typeof n !== "number") return "-";
  try {
    return n.toLocaleString("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    });
  } catch {
    return n.toLocaleString();
  }
}
