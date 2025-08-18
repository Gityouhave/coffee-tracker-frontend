// src/components/DripForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
} from "recharts";
import { flagify, flagifyOriginList, splitOrigins } from "../utils/flags";

import { filterSortBeans, beanOptionLabel, ROASTS } from "../utils/beanFilters";
import { ORIGINS } from "../constants/origins";
import { ORIGIN_THEORIES } from "../constants/originTheories";
// === scoring config (top-level) ===
export const SCORE_WEIGHTS = { rule: 0.5, profile: 0.3, empirical: 0.2 };

const ORIGIN_GROUPS = {
  aroma: [
    "エチオピア",
    "ケニア",
    "ルワンダ",
    "ブルンジ",
    "コロンビア",
    "グアテマラ",
    "パナマ",
    "ボリビア",
    "タンザニア",
    "DRコンゴ",
  ],
  heavy: [
    "インドネシア",
    "スマトラ",
    "マンデリン",
    "ブラジル",
    "ウガンダ",
    "インド",
    "ベトナム",
    "ラオス",
  ],
};
const aromaOrigin = new RegExp(ORIGIN_GROUPS.aroma.join("|"));
const heavyOrigin = new RegExp(ORIGIN_GROUPS.heavy.join("|"));
const safeFixed = (v: any, d = 1) =>
  Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—";
// ファイル先頭付近（importの下あたり）に追加
const ChartFrame: React.FC<
  React.PropsWithChildren<{ aspect?: number; className?: string }>
> = ({ aspect = 1, className, children }) => {
  // aspect比で高さを決める共通枠。親の幅に応じて自動で高さ調整。
  return (
    <div
      className={`relative w-full ${className || ""}`}
      style={{ aspectRatio: String(aspect) }}
    >
      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
type ScopeKey = "thisBean" | "sameRoast" | "originNear";

const scopeTitle = (s: ScopeKey) =>
  s === "thisBean"
    ? "同豆ベスト"
    : s === "sameRoast"
    ? "同焙煎度ベスト"
    : "産地×近焙煎度ベスト";
const scopeTitleWorst = (s: ScopeKey) =>
  s === "thisBean"
    ? "同豆ワースト"
    : s === "sameRoast"
    ? "同焙煎度ワースト"
    : "産地×近焙煎度ワースト";

// === BEGIN: scoring helpers (add) ===
const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

/** 0..10の平均点と件数からウィルソン下限(0..1)を返す（母数補正） */
const wilsonLowerBound = (mean0to10: number, n: number, z = 1.96) => {
  const p = clamp((mean0to10 || 0) / 10, 0, 1);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return clamp((centre - margin) / denom, 0, 1);
};

/** [min,max] を [0,1] へ（全要素が同値なら 0） */
const normalize01 = (val: number, min: number, max: number) => {
  if (
    !Number.isFinite(val) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max <= min
  )
    return 0;
  return clamp((val - min) / (max - min), 0, 1);
};

/** 加点を減衰合成（同カテゴリ内の“盛りすぎ”抑制）。wは>0のみ想定。 */
const dampedSum = (weights: number[], wMax = 2.0) => {
  const ws = weights.filter((w) => w > 0).map((w) => Math.min(1, w / wMax));
  // 1 - ∏(1-w) ：wが増えるほど限界に収束
  return 1 - ws.reduce((p, w) => p * (1 - w), 1);
};
// === END: scoring helpers (add) ===
const grind20 = (d: any) => d?.derive?.grind?.label20 || d?.label20 || "";
const grindGroup6 = (label20?: string | null) => {
  if (!label20) return "";
  if (label20.startsWith("粗")) return "粗";
  if (label20.startsWith("中粗")) return "中粗";
  if (["中++", "中+", "中", "中-", "中--"].includes(label20)) return "中";
  if (label20.startsWith("中細")) return "中細";
  if (label20.startsWith("細")) return "細";
  if (label20 === "極細") return "極細";
  return "";
};

const recommendForDrip = (d: any) => {
  const roast = d?.roast_level ?? "シティ";
  let recTemp = ROAST_TEMP[roast] ?? 82.5;
  const g20 = grind20(d);
  const group = grindGroup6(g20);
  let recTime = group ? GRIND_TIME[group] : undefined;

  const name = d?.dripper ? String(d.dripper) : "";
  const r = name ? (DRIPPER_RUNTIME as any)[name] : undefined;
  if (r) {
    if (Number.isFinite(r?.tempOffset)) recTemp += r.tempOffset as number;
    if (Number.isFinite(r?.timeFactor) && Number.isFinite(recTime))
      recTime = Math.round((recTime as number) * (r.timeFactor as number));
  }
  return { recTemp, recTime };
};

const fmtDeltaTemp = (d: any) => {
  const { recTemp } = recommendForDrip(d);
  const t = Number(d?.water_temp_c);
  if (!Number.isFinite(t) || !Number.isFinite(recTemp)) return "—";
  const delta = Math.round((t - recTemp) * 10) / 10;
  return (delta > 0 ? `+${delta}` : `${delta}`) + "℃";
};

const fmtDeltaTime = (d: any) => {
  const { recTime } = recommendForDrip(d);
  const s = Number(d?.time_sec);
  if (!Number.isFinite(s) || !Number.isFinite(recTime)) return "—";
  const delta = s - recTime!;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatSecFriendly(Math.abs(delta))}`;
};

const fmtAgingDays = (bean: any, brew_date?: string) => {
  const roastDate =
    bean?.roast_date ||
    bean?.roasted_on ||
    bean?.purchase_date ||
    bean?.purchased_on ||
    null;
  if (!roastDate || !brew_date) return "—";
  const dd = daysBetween(roastDate, brew_date);
  return dd == null ? "—" : `${dd}日目`;
};
// === END: pattern label helpers ===

const RADAR_COLORS = {
  beanAvg: { stroke: "#111827", fill: "#11182733" }, // 黒（平均）
  last: { stroke: "#8b5cf6", fill: "#8b5cf633" }, // 紫（前回）
  sameRoastBest: { stroke: "#ef4444", fill: "#ef444433" }, // 赤（同焙煎度ベスト）
  originNearBest: { stroke: "#3b82f6", fill: "#3b82f633" }, // 青（産地×近焙煎度ベスト）
  thisBeanBest: { stroke: "#10b981", fill: "#10b98133" }, // 緑（その豆ベスト）
};

const TASTE_KEYS = [
  { key: "overall", label: "総合" },
  { key: "clean", label: "クリーンさ" },
  { key: "flavor", label: "風味" },
  { key: "acidity", label: "酸味" },
  { key: "bitterness", label: "苦味" },
  { key: "sweetness", label: "甘味" },
  { key: "body", label: "コク" },
  { key: "aftertaste", label: "後味" },
] as const;

// 評価8項目（保存は 1–10 の既存ルール）
const RATING_KEYS = [
  "overall",
  "clean",
  "flavor",
  "acidity",
  "bitterness",
  "sweetness",
  "body",
  "aftertaste",
] as const;
type RatingKey = (typeof RATING_KEYS)[number];
type TasteKey = (typeof TASTE_KEYS)[number]["key"];

/** 60秒未満は "xx秒"、それ以上は "m:ss" で返す */
const formatSecFriendly = (s?: number) => {
  if (s == null || !Number.isFinite(s)) return "—";
  return s < 60 ? `${s}秒` : secToMMSS(s);
};
/** ±記号付きの温度Δ（℃） */
const deltaTemp = (actual?: number | null, rec?: number | null) => {
  if (!Number.isFinite(actual) || !Number.isFinite(rec)) return "";
  const d = Number(actual) - Number(rec);
  const s = (d > 0 ? "+" : "") + Math.round(d * 10) / 10 + "℃";
  return `(${s})`;
};
/** ±記号付きの時間Δ（mm:ss） */
const deltaTime = (actualSec?: number | null, recSec?: number | null) => {
  if (!Number.isFinite(actualSec) || !Number.isFinite(recSec)) return "";
  const d = Math.round(Number(actualSec) - Number(recSec));
  const sign = d > 0 ? "+" : "";
  const abs = Math.abs(d);
  const mm = Math.floor(abs / 60),
    ss = abs % 60;
  return `(${sign}${mm}:${String(ss).padStart(2, "0")})`;
};

// ---- ラベル/旗/⭐️ 共通ヘルパ ----
const joinFlags = (originsRaw: any) => {
  try {
    const arr = Array.isArray(originsRaw)
      ? originsRaw
      : String(originsRaw || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    const flagged = flagifyOriginList(arr as string[]);
    return Array.isArray(flagged) ? flagged.join("・") : String(flagged || "");
  } catch {
    return "—";
  }
};
const star5 = (x: any) => {
  const n = Number(x);
  if (!Number.isFinite(n)) return "☆☆☆☆☆";
  const s = Math.max(0, Math.min(5, Math.round(n / 2)));
  return "★★★★★".slice(0, s) + "☆☆☆☆☆".slice(0, 5 - s);
};
const metricJp = (k: TasteKey) =>
  k === "overall"
    ? "総合"
    : k === "clean"
    ? "クリーンさ"
    : k === "flavor"
    ? "風味"
    : k === "acidity"
    ? "酸味"
    : k === "bitterness"
    ? "苦味"
    : k === "sweetness"
    ? "甘味"
    : k === "body"
    ? "コク"
    : "後味";

/** 改行フォーマットのラベル */
const makeMultilineLabel = (
  d: any,
  bean: any,
  title: string,
  metric?: TasteKey
) => {
  const origins = bean?.origin ? splitOrigins(String(bean.origin)) : [];
  const flags = origins.length ? joinFlags(origins) : "—";
  const age = fmtAgingDays(bean, d?.brew_date);
  const { recTemp, recTime } = recommendForDrip({
    roast_level: d?.roast_level,
    derive: d?.derive,
    label20: d?.label20,
  });
  const g20 = grind20(d);
  const g6 = grindGroup6(g20);

  const line1 = `${title}${star5(d?.ratings?.overall)}：${
    bean?.name || "—"
  }（${flags}｜${bean?.roast_level || "—"}｜${age}）`;
  const line2 =
    `${d?.dripper || "—"}・` +
    [
      Number.isFinite(d?.grind)
        ? `挽き${d.grind}${g6 ? `（${g6}）` : ""}`
        : null,
      Number.isFinite(d?.water_temp_c)
        ? `湯温${d.water_temp_c}℃${deltaTemp(d?.water_temp_c, recTemp ?? null)}`
        : null,
      Number.isFinite(d?.dose_g) ? `豆${d.dose_g}g` : null,
      Number.isFinite(d?.water_g) ? `湯量${d.water_g}g` : null,
      Number.isFinite(d?.time_sec)
        ? `時間${secToMMSS(d.time_sec)}${deltaTime(
            d?.time_sec,
            recTime ?? null
          )}`
        : null,
    ]
      .filter(Boolean)
      .join("・");
  const line3 = metric
    ? `〈${metricJp(metric)}〉${Number(d?.ratings?.[metric]) || "—"}`
    : "";
  return [line1, line2, line3].filter(Boolean).join("\n");
};

// === Dripper recommendation (TOP5 with reasons) ===
// === Dripper details (丁寧説明+短タグ) ===
type DripperDetail = {
  short: string; // 一言サマリ
  desc: string; // 2〜3行説明
  tags: string[]; // ①向き（焙煎/精製/産地/風味）→②抽出形式→③流速→④その他
};

const DRIPPER_DETAILS: Record<string, DripperDetail> = {
  ハリオ: {
    short: "クリアで酸を活かす",
    desc: "円すい＋単穴。注湯で流速を作るタイプ。適切な細口・パルスで澄んだ輪郭。浅〜中浅の香りを伸ばしやすい基軸。",
    tags: [
      "焙煎: 浅〜中浅◎",
      "精製: ウォッシュト/ハニー向き",
      "産地: 東アフリカ/中米",
      "風味: 高香り/クリーン",
      "抽出: 透過式",
      "流速: 注湯依存（中〜速）",
      "輪郭が出る",
      "軽快",
      "再現性=中（手技影響大）",
    ],
  },
  フラワー: {
    short: "華やかな香りを引き出す",
    desc: "深いリブでペーパーが壁に貼り付きにくい設計。ガス抜け良くアロマが立つ。浅〜中浅のフルーティと好相性。",
    tags: [
      "焙煎: 浅〜中浅◎",
      "精製: ナチュラル/ウォッシュト",
      "産地: 東アフリカ",
      "風味: 高香り/華やか",
      "抽出: 透過式",
      "流速: やや速",
      "高香り系",
      "軽やか",
      "リブ深めで通気",
    ],
  },
  カリタウェーブ: {
    short: "バランス型、均一抽出",
    desc: "平底＋3穴。ウェーブペーパーで壁面影響を抑え、湯面がフラットになりやすい。丸く整い再現性が高い。",
    tags: [
      "焙煎: 全域対応（中庸）",
      "精製: 全般",
      "産地: 汎用",
      "風味: バランス/まとまり",
      "抽出: 透過式（平底/3穴）",
      "流速: 中",
      "再現性高",
      "丸み",
      "安定志向",
    ],
  },
  コーノ: {
    short: "柔らかい質感と甘み",
    desc: "リブが途中で終わり、初期は浸漬寄りに接液。後半で透過が立ちやすく、とろみのある口当たりに。",
    tags: [
      "焙煎: 中〜中深◎",
      "精製: ウォッシュト/ハニー",
      "産地: 中米/南米",
      "風味: 甘み/質感",
      "抽出: 透過×浸漬",
      "流速: 中〜やや遅",
      "とろみ",
      "甘みが乗る",
    ],
  },
  クレバー: {
    short: "甘みとボディを強調",
    desc: "全量浸漬→開放。粗めでも安定して甘みとボディが出る。発酵系/ナチュラルを丸めやすい第一候補。",
    tags: [
      "焙煎: 中〜深◎",
      "精製: ナチュラル/発酵系◎",
      "産地: ブラジル/スマトラ系",
      "風味: 甘み/ボディ",
      "抽出: 浸漬式（バルブ開放）",
      "流速: 遅（浸漬）",
      "再現性高",
      "丸め/角を取る",
    ],
  },
  ハリオスイッチ: {
    short: "透過と浸漬の中間",
    desc: "バルブで浸漬→透過へ切替。甘みとクリアさの両立を狙える可変型で、深めの救済や設計検証に向く。",
    tags: [
      "焙煎: 幅広い",
      "精製: 全般",
      "産地: 汎用",
      "風味: 甘み×クリア両立",
      "抽出: 浸漬→透過（切替）",
      "流速: 可変",
      "可変性高",
      "幅広い調整",
      "深煎り救済",
    ],
  },
  ネル: {
    short: "コクと深みを増す",
    desc: "布が微粉やオイルを保持しつつ独特の口当たりに。丸み・厚み・余韻の伸び。深煎りの甘苦表現に強い。",
    tags: [
      "焙煎: 中深〜深◎",
      "精製: ナチュラル/ウェットハル",
      "産地: スマトラ/ブラジル",
      "風味: 厚み/余韻",
      "抽出: 濾過穏やか（布）",
      "流速: 遅",
      "オイル感",
      "管理必要",
      "クラシック",
    ],
  },
  フレンチプレス: {
    short: "オイル感と重厚",
    desc: "金属メッシュで成分を広く通す全浸漬。素材感がダイレクトで後味にふくらみ。クリーン狙いには不向き。",
    tags: [
      "焙煎: 中深〜深◎",
      "精製: ナチュラル/ウェットハル",
      "産地: ブラジル/スマトラ",
      "風味: オイル/重厚",
      "抽出: 浸漬式（金属フィルタ）",
      "流速: 遅",
      "複雑味ダイレクト",
      "微粉残存",
      "クリーンさは下がる",
    ],
  },
  エアロプレス: {
    short: "可変性高く実験的",
    desc: "加圧抽出。粉量・水量・時間・攪拌・フィルタ（紙/金属）で幅広く設計可能。小ロット検証にも最適。",
    tags: [
      "焙煎: 中心は中前後（全域可）",
      "精製: 全般",
      "産地: 汎用",
      "風味: 自由度MAX",
      "抽出: 加圧",
      "流速: 可変（短〜中）",
      "外でも◎",
      "設計依存度高",
    ],
  },
  水出し: {
    short: "まろやか＆低酸味",
    desc: "低温長時間の浸出で渋みが出にくく丸い甘み。浅〜中浅の酸を抑えたいときや大量抽出に向く。",
    tags: [
      "焙煎: 浅〜中浅/中",
      "精製: ナチュラル/ウォッシュト",
      "産地: フルーティ系",
      "風味: まろやか/低酸",
      "抽出: 低温長時間浸漬",
      "流速: 極遅",
      "大容量向き",
      "香り立ちは控えめ",
    ],
  },
  サイフォン: {
    short: "香りと透明感",
    desc: "加熱上昇→減圧ろ過。クリーンさと香りの両立でクラシックな味わい。見た目のショー性も高い。",
    tags: [
      "焙煎: 浅〜中◎",
      "精製: ウォッシュト",
      "産地: 高香り系",
      "風味: クリーン×アロマ",
      "抽出: 減圧ろ過（サイフォン）",
      "流速: 中",
      "クラシック",
      "器具手間あり",
    ],
  },
  モカポット: {
    short: "濃厚・エスプレッソ風",
    desc: "加圧蒸気で高濃度抽出。苦味とボディが立ち、ミルク合わせにも向く（直火は弱火推奨）。",
    tags: [
      "焙煎: 中深〜深◎",
      "精製: ブレンド/ナチュラル",
      "産地: 南米中心",
      "風味: 濃厚/ビター",
      "抽出: 加圧蒸気",
      "流速: 短時間（速）",
      "ミルク◎",
      "過抽出注意",
    ],
  },
  エスプレッソ: {
    short: "凝縮感・厚み",
    desc: "高圧・短時間で濃縮。焙煎差・粉砕の影響が非常に大きい。単体でもミルク展開でも主役。",
    tags: [
      "焙煎: 中深〜深◎",
      "精製: ブレンド/単一ともに可",
      "産地: 南米/アジア軸",
      "風味: 凝縮/厚み/余韻",
      "抽出: 高圧短時間",
      "流速: 極短",
      "ミルク展開",
      "設計難度高",
    ],
  },
  クリスタル: {
    short: "高い透明感",
    desc: "フィルタ干渉を抑えるリブ設計で湯通りが安定しやすいタイプ。微粉の影響を最小化しやすく輪郭がシャープ。",
    tags: [
      "焙煎: 浅〜中浅◎",
      "精製: ウォッシュト中心",
      "産地: 東アフリカ/中米",
      "風味: 超クリーン/シャープ",
      "抽出: 透過式",
      "流速: 中〜やや速",
      "検証向き",
      "ペーパー性能の影響大",
    ],
  },
  ブルーボトル: {
    short: "やや早流速・整う",
    desc: "大径単穴＋浅いリブ系の設計。素直にクリアで軽快にまとまる。浅〜中浅で扱いやすい。",
    tags: [
      "焙煎: 浅〜中浅◎",
      "精製: ウォッシュト",
      "産地: 中米/東アフリカ",
      "風味: 軽快/クリーン",
      "抽出: 透過式（単穴）",
      "流速: やや速",
      "素直に整う",
      "再現性=中",
    ],
  },
  フィン: {
    short: "しっかり抽出",
    desc: "金属フィルタの滴下式。じんわり濃度が上がり甘苦を凝縮。練乳合わせやロブスタにも相性が良い。",
    tags: [
      "焙煎: 中深〜深◎",
      "精製: ロブスタ/ナチュラル",
      "産地: ベトナム中心",
      "風味: 濃厚/甘苦",
      "抽出: 金属フィルタ滴下",
      "流速: 遅",
      "再現性=中",
      "紙なし/エコ",
    ],
  },
};
// 各ドリッパーの強み/弱み と 最適手法（プリセット）
// howto: 粒度(6段階), 温度の目安(℃), 時間の目安(mm:ss), 注湯の要点, レシオ目安
type DripperKnowhow = {
  pros: string[];
  cons: string[];
  howto: {
    grindGroup: "粗" | "中粗" | "中" | "中細" | "細" | "極細";
    tempC?: number;
    time?: string; // mm:ss or h:mm:ss
    pour?: string;
    ratioHint?: string;
  };
  examples: Array<{
    origin: string; // 産地
    process: string; // 精製（ウォッシュト/ナチュラル/ハニー/ウェットハル/発酵系など）
    roast: string; // 焙煎度（例: 浅/中浅/中/中深/深）
    flavor: string; // 味わいの狙い
  }>;
};

const DRIPPER_KNOWHOW: Record<string, DripperKnowhow> = {
  ハリオ: {
    pros: ["清澄感と香りの伸び", "軽快〜シャープな輪郭"],
    cons: ["重厚/発酵系だと細くなりやすい"],
    howto: {
      grindGroup: "中細",
      tempC: 86,
      time: "2:20",
      pour: "センター主体→細かめパルス",
      ratioHint: "1:15〜1:16",
    },
    examples: [
      {
        origin: "エチオピア",
        process: "ウォッシュト",
        roast: "浅〜中浅",
        flavor: "ジャスミン/シトラスをクリアに",
      },
      {
        origin: "ケニア",
        process: "ウォッシュト",
        roast: "浅〜中",
        flavor: "ベリー/黒スグリ系を輪郭良く",
      },
      {
        origin: "コスタリカ",
        process: "ハニー",
        roast: "中浅",
        flavor: "明るい甘みと酸のバランス",
      },
    ],
  },
  フラワー: {
    pros: ["ガス抜け良好でアロマ立ち", "浅〜中浅で華やか"],
    cons: ["深煎りはキレ過多になりがち"],
    howto: {
      grindGroup: "中細",
      tempC: 86,
      time: "2:30",
      pour: "中心やや外→薄く広く",
      ratioHint: "1:15.5",
    },
    examples: [
      {
        origin: "エチオピア",
        process: "ナチュラル",
        roast: "浅",
        flavor: "フルーティ/発酵香を華やかに",
      },
      {
        origin: "ルワンダ",
        process: "ウォッシュト",
        roast: "浅〜中浅",
        flavor: "紅茶様のフローラルを伸ばす",
      },
      {
        origin: "パナマ",
        process: "ウォッシュト",
        roast: "浅",
        flavor: "明瞭なフローラル（ゲイシャ系）",
      },
      {
        origin: "イエメン",
        process: "ナチュラル",
        roast: "浅",
        flavor: "レーズンの甘みとスパイス感",
      },
    ],
  },
  カリタウェーブ: {
    pros: ["平底で均一抽出", "バランスがまとまりやすい"],
    cons: ["ピークの立ち上がりはやや穏やか"],
    howto: {
      grindGroup: "中",
      tempC: 84,
      time: "2:40",
      pour: "3投・湯面フラット維持",
      ratioHint: "1:15〜1:16",
    },
    examples: [
      {
        origin: "グアテマラ",
        process: "ウォッシュト",
        roast: "中",
        flavor: "チョコ/柑橘の均整",
      },
      {
        origin: "コロンビア",
        process: "ウォッシュト",
        roast: "中",
        flavor: "ブライト＆バランス",
      },
      {
        origin: "ペルー",
        process: "ウォッシュト",
        roast: "中〜中深",
        flavor: "柔らかい甘みを丸く",
      },
      {
        origin: "ボリビア",
        process: "ウォッシュト",
        roast: "中浅",
        flavor: "キャラメル的甘味と程よい酸",
      },
    ],
  },
  コーノ: {
    pros: ["甘みと質感", "とろみのある口当たり"],
    cons: ["浅煎り×清澄狙いには鈍重"],
    howto: {
      grindGroup: "中",
      tempC: 84,
      time: "2:30",
      pour: "序盤浸漬寄り→後半細口",
      ratioHint: "1:15",
    },
    examples: [
      {
        origin: "エルサルバドル",
        process: "ハニー",
        roast: "中",
        flavor: "蜂蜜感/粘性のある甘み",
      },
      {
        origin: "ブラジル",
        process: "パルプドナチュラル",
        roast: "中〜中深",
        flavor: "ナッツ/ミルクチョコを厚めに",
      },
      {
        origin: "ニカラグア",
        process: "ウォッシュト",
        roast: "中",
        flavor: "キャラメル/カカオを滑らかに",
      },
      {
        origin: "ホンジュラス",
        process: "ハニー",
        roast: "中",
        flavor: "チョコナッツと柔らかい甘み",
      },
    ],
  },
  クリスタル: {
    pros: ["超クリーン", "微粉影響を最小化"],
    cons: ["重厚産地だと細さが出やすい"],
    howto: {
      grindGroup: "中細",
      tempC: 85,
      time: "2:20",
      pour: "薄く速く・湯止め早め",
      ratioHint: "1:15.5",
    },
    examples: [
      {
        origin: "エチオピア",
        process: "ウォッシュト",
        roast: "浅",
        flavor: "柑橘/白花の精緻さ",
      },
      {
        origin: "パナマ",
        process: "ウォッシュト",
        roast: "浅",
        flavor: "繊細なフローラルの輪郭",
      },
      {
        origin: "コスタリカ",
        process: "ホワイトハニー",
        roast: "中浅",
        flavor: "明るい甘みをクリアに",
      },
      {
        origin: "タンザニア",
        process: "ウォッシュト",
        roast: "浅〜中浅",
        flavor: "ブラックベリー系の果実味と酸",
      },
    ],
  },
  ブルーボトル: {
    pros: ["流速やや速で軽快", "素直に整う"],
    cons: ["厚み狙いだと軽い"],
    howto: {
      grindGroup: "中細",
      tempC: 85,
      time: "2:15",
      pour: "中心主体でスッと落とす",
      ratioHint: "1:15.5",
    },
    examples: [
      {
        origin: "グアテマラ",
        process: "ウォッシュト",
        roast: "浅〜中浅",
        flavor: "軽快なカカオ/柑橘",
      },
      {
        origin: "ルワンダ",
        process: "ウォッシュト",
        roast: "浅〜中浅",
        flavor: "紅茶様の軽やかさ",
      },
      {
        origin: "コロンビア",
        process: "ウォッシュト",
        roast: "中浅",
        flavor: "明るいバランス",
      },
      {
        origin: "DRコンゴ",
        process: "ウォッシュト",
        roast: "中",
        flavor: "野性味ある柑橘とハーブ節",
      },
    ],
  },
  クレバー: {
    pros: ["再現性と甘み/ボディ", "発酵/ナチュラルの丸め"],
    cons: ["過抽出気味だと鈍る"],
    howto: {
      grindGroup: "中粗",
      tempC: 82,
      time: "3:00",
      pour: "全量浸漬→ドロー",
      ratioHint: "1:15",
    },
    examples: [
      {
        origin: "ブラジル",
        process: "ナチュラル",
        roast: "中〜中深",
        flavor: "ナッツ/チョコをまろやかに",
      },
      {
        origin: "インドネシア",
        process: "ウェットハル",
        roast: "中深",
        flavor: "スパイス/アーシーを丸く",
      },
      {
        origin: "エチオピア",
        process: "ナチュラル",
        roast: "中",
        flavor: "発酵香の角を整える",
      },
    ],
  },
  ハリオスイッチ: {
    pros: ["甘み×クリアの両立", "幅広い調整幅"],
    cons: ["設計が甘いとどっちつかず"],
    howto: {
      grindGroup: "中",
      tempC: 83,
      time: "2:40",
      pour: "浸漬1:00→開放",
      ratioHint: "1:15",
    },
    examples: [
      {
        origin: "ブラジル",
        process: "ナチュラル",
        roast: "中〜中深",
        flavor: "甘苦を穏やかに凝縮",
      },
      {
        origin: "コロンビア",
        process: "ウォッシュト",
        roast: "中",
        flavor: "甘みとクリアの両立",
      },
      {
        origin: "コスタリカ",
        process: "ハニー",
        roast: "中浅",
        flavor: "粘性の甘み×輪郭",
      },
    ],
  },
  フレンチプレス: {
    pros: ["オイル感と重厚ボディ", "素材感がダイレクト"],
    cons: ["クリーン狙いには不向き"],
    howto: {
      grindGroup: "粗",
      tempC: 80,
      time: "4:00",
      pour: "全量注湯・攪拌控えめ",
      ratioHint: "1:14",
    },
    examples: [
      {
        origin: "インドネシア（スマトラ）",
        process: "ウェットハル",
        roast: "中深〜深",
        flavor: "スパイス/アーシーの厚み",
      },
      {
        origin: "ブラジル",
        process: "ナチュラル",
        roast: "中深",
        flavor: "ナッツ/ダークチョコのボディ",
      },
      {
        origin: "エチオピア",
        process: "ナチュラル",
        roast: "中",
        flavor: "果実味を重厚に",
      },
      {
        origin: "パプアニューギニア",
        process: "ナチュラル",
        roast: "中深〜深",
        flavor: "土っぽさと甘苦の厚み",
      },
    ],
  },
  ネル: {
    pros: ["丸みと余韻", "深煎りの甘苦をふくよかに"],
    cons: ["布の管理が必要/軽快さは出にくい"],
    howto: {
      grindGroup: "中粗",
      tempC: 80,
      time: "3:30",
      pour: "低速で面を作る",
      ratioHint: "1:14",
    },
    examples: [
      {
        origin: "マンデリン（スマトラ）",
        process: "ウェットハル",
        roast: "深",
        flavor: "重心を下げ甘苦と余韻",
      },
      {
        origin: "ブラジル",
        process: "ナチュラル",
        roast: "中深〜深",
        flavor: "丸い甘みと厚み",
      },
      {
        origin: "インド",
        process: "モンスーン",
        roast: "中深",
        flavor: "低酸/スパイス感をふくよかに",
      },
      {
        origin: "ウガンダ",
        process: "ナチュラル",
        roast: "中深",
        flavor: "熟したベリー＋スパイスの厚み",
      },
      {
        origin: "ラオス",
        process: "ナチュラル",
        roast: "中深",
        flavor: "スモーキーかつ土感の甘さ",
      },
    ],
  },
  エアロプレス: {
    pros: ["可変性が高い", "小ロット検証に最適"],
    cons: ["設計依存度が高くブレやすい"],
    howto: {
      grindGroup: "中",
      tempC: 82,
      time: "1:45",
      pour: "インバート推奨・軽く攪拌",
      ratioHint: "1:12〜1:15",
    },
    examples: [
      {
        origin: "コロンビア",
        process: "ウォッシュト",
        roast: "中",
        flavor: "クリーン/甘みを短時間で",
      },
      {
        origin: "ケニア",
        process: "ウォッシュト",
        roast: "浅",
        flavor: "ベリー酸を締めて整える",
      },
      {
        origin: "エチオピア",
        process: "ナチュラル",
        roast: "中",
        flavor: "発酵香をコントロール",
      },
    ],
  },
  水出し: {
    pros: ["低酸・まろやか", "渋みが出にくい"],
    cons: ["香りの立ち上がりは弱い"],
    howto: {
      grindGroup: "中粗",
      tempC: -1,
      time: "8:00:00",
      pour: "浸漬(冷蔵)",
      ratioHint: "1:10〜1:12",
    },
    examples: [
      {
        origin: "エチオピア",
        process: "ナチュラル",
        roast: "浅〜中浅",
        flavor: "酸を抑え果実の甘みを前へ",
      },
      {
        origin: "ブラジル",
        process: "ナチュラル",
        roast: "中",
        flavor: "丸いナッツ/チョコ",
      },
      {
        origin: "コロンビア",
        process: "ウォッシュト",
        roast: "中",
        flavor: "柔らかい甘み主体",
      },
    ],
  },
  サイフォン: {
    pros: ["香り×透明感の両立", "クラシックな質感"],
    cons: ["器具・手間が大きい"],
    howto: {
      grindGroup: "中",
      tempC: 90,
      time: "1:30",
      pour: "攪拌少なめ",
      ratioHint: "1:15",
    },
    examples: [
      {
        origin: "ケニア",
        process: "ウォッシュト",
        roast: "浅〜中",
        flavor: "アロマと鋭い酸の両立",
      },
      {
        origin: "グアテマラ",
        process: "ウォッシュト",
        roast: "中",
        flavor: "クリーンな甘みと香り",
      },
      {
        origin: "コロンビア",
        process: "ウォッシュト",
        roast: "中",
        flavor: "香りの伸びと透明感",
      },
    ],
  },
  フィン: {
    pros: ["濃度をじんわり上げられる", "甘苦の凝縮"],
    cons: ["再現性に慣れが必要"],
    howto: {
      grindGroup: "中",
      tempC: 83,
      time: "3:30",
      pour: "滴下＝詰めすぎ注意",
      ratioHint: "1:12〜1:14",
    },
    examples: [
      {
        origin: "ベトナム",
        process: "ロブスタ主体",
        roast: "中深〜深",
        flavor: "濃厚/甘苦（練乳合わせ）",
      },
      {
        origin: "ベトナム",
        process: "アラビカ",
        roast: "中深",
        flavor: "ビターカラメル",
      },
      {
        origin: "ブレンド",
        process: "ロブスタ混合",
        roast: "深",
        flavor: "コク重視",
      },
    ],
  },
  エスプレッソ: {
    pros: ["凝縮・厚み・余韻"],
    cons: ["設計難度が高い（粉砕/配合/圧力管理）"],
    howto: {
      grindGroup: "極細",
      tempC: 93,
      time: "0:30",
      pour: "9bar基準",
      ratioHint: "1:2",
    },
    examples: [
      {
        origin: "ブラジル中心ブレンド",
        process: "ナチュラル主体",
        roast: "中深〜深",
        flavor: "チョコ/ナッツの土台",
      },
      {
        origin: "コロンビア",
        process: "ウォッシュト",
        roast: "中深",
        flavor: "甘み/酸の支え",
      },
      {
        origin: "インド",
        process: "ロブスタ混合",
        roast: "深",
        flavor: "クレマ/苦味の補強",
      },
    ],
  },
  モカポット: {
    pros: ["濃厚・エスプレッソ風"],
    cons: ["苦味が立ちやすい/温度管理必須"],
    howto: {
      grindGroup: "細",
      tempC: -1,
      time: "—",
      pour: "弱火でゆっくり",
      ratioHint: "—",
    },
    examples: [
      {
        origin: "ブラジル",
        process: "ナチュラル",
        roast: "中深〜深",
        flavor: "ビター/カカオ",
      },
      {
        origin: "メキシコ",
        process: "ウォッシュト",
        roast: "中深",
        flavor: "ナッツ/キャラメル",
      },
      {
        origin: "ブレンド",
        process: "各種",
        roast: "深",
        flavor: "ミルク合わせ前提",
      },
    ],
  },
};
// src/components/DripForm.tsx など同ファイル内
import { deriveOptimalRecipe } from "../utils/recipeEngine"; // ← 追加import

const DripperExplainer: React.FC<{ name: string; bean: any }> = ({
  name,
  bean,
}) => {
  const k = DRIPPER_KNOWHOW[name];
  if (!k) return null;

  // 既存の recommendForDrip で焙煎に基づく温度/時間のベースを作る
  const rec = recommendForDrip({
    roast_level: bean?.roast_level,
    derive: null,
    label20: null,
  });

  // ベースレシピ（器具howto優先、無ければrec）
  const baseTimeSec = (() => {
    const txt = k.howto.time;
    if (!txt) return rec.recTime ?? 150;
    const ps = txt.split(":").map(Number);
    if (ps.length === 3)
      return (ps[0] || 0) * 3600 + (ps[1] || 0) * 60 + (ps[2] || 0);
    if (ps.length === 2) return (ps[0] || 0) * 60 + (ps[1] || 0);
    const n = Number(txt);
    return Number.isFinite(n) ? n : rec.recTime ?? 150;
  })();

  const ratioFromHint = Number(
    (k.howto.ratioHint || "").match(/1:(\d+(\.\d+)?)/)?.[1] ?? 15
  );

  const base = {
    grindGroup: k.howto.grindGroup,
    tempC: Number.isFinite(k.howto.tempC) ? k.howto.tempC! : rec.recTemp ?? 82,
    timeSec: baseTimeSec,
    ratio: ratioFromHint,
    pour: { style: "pulse" as const, notes: [] },
  };

  // エイジング日数（焙煎日が無ければ null）
  const agingDays = (() => {
    const roastDate =
      bean?.roast_date ||
      bean?.roasted_on ||
      bean?.purchase_date ||
      bean?.purchased_on;
    if (!roastDate) return null;
    const today = new Date().toISOString().slice(0, 10);
    return Math.floor(
      (new Date(today).getTime() - new Date(String(roastDate)).getTime()) /
        (1000 * 60 * 60 * 24)
    );
  })();

  // 文脈
  const ctx = {
    dripper: name,
    roast: String(bean?.roast_level || ""),
    process: [bean?.process, bean?.addl_process].filter(Boolean).join(" "),
    origin: String(bean?.origin || ""),
    agingDays,
    base,
  };

 // ← ここで最適化！（安全マージ）
const derived = deriveOptimalRecipe(ctx) || ({} as any);
const opt = {
  ...base,
  ...derived,
  // 入れ子オブジェクトは個別にマージ＆フォールバック
  pour: {
    style: derived?.pour?.style ?? base.pour.style,
    notes: derived?.pour?.notes ?? base.pour.notes,
  },
  // 数値は undefined/NaN を弾く
  tempC: Number.isFinite(derived?.tempC) ? Number(derived.tempC) : base.tempC,
  timeSec: Number.isFinite(derived?.timeSec) ? Number(derived.timeSec) : base.timeSec,
  ratio: Number.isFinite(derived?.ratio) ? Number(derived.ratio) : base.ratio,
} as typeof base & typeof derived;

  // 表示用
const safeTime = Number.isFinite(opt?.timeSec) ? Number(opt.timeSec) : base.timeSec;
const mm = Math.floor(safeTime / 60);
const ss = String(safeTime % 60).padStart(2, "0");

  return (
    <div className="mt-1.5 space-y-1">
      {/* 強み/注意：既存のまま */}
      <div className="flex flex-wrap gap-1">
        {k.pros.map((p, i) => (
          <span
            key={"p" + i}
            className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-100 text-slate-700"
          >
            強み {p}
          </span>
        ))}
        {k.cons.map((c, i) => (
          <span
            key={"c" + i}
            className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700"
          >
            注意 {c}
          </span>
        ))}
      </div>

      {/* 最適化後レシピの表出 */}
      <div className="text-[12px] leading-5 text-gray-800">
        <div>
          最適手法：粒度 <b>{opt.grindGroup}</b> ／ 目安温度{" "}
          <b>{Math.round(opt.tempC)}℃</b> ／ 目安時間{" "}
          <b>
            {mm}:{ss}
          </b>{" "}
／ 比率 <b>1:{Number.isFinite(opt?.ratio) ? Number(opt.ratio).toFixed(1) : "—"}</b>        </div>
        <div className="text-[11px] text-gray-600">
          抽出：{opt.pour?.style ?? "—"}／メモ：
{(opt.pour?.notes ?? []).join("・") || "—"}
          {k.howto.pour ? ` ／ 器具ヒント：${k.howto.pour}` : ""}
        </div>
      </div>

      {/* 相性の例（元のまま） */}
      {k.examples?.length > 0 && (
        <div className="mt-1.5">
          <div className="text-[12px] font-medium text-gray-700">相性の例</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {k.examples.map((ex, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded border bg-white text-gray-700"
              >
                {ex.origin}・{ex.process}／{ex.roast} — {ex.flavor}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
// ドリッパーの物性プロファイル（0..1）
const DRIPPER_PROFILE: Record<
  string,
  {
    clarity: number;
    body: number;
    oil: number;
    speed: number;
    immersion: number;
  }
> = {
  ハリオ: { clarity: 0.9, body: 0.3, oil: 0.1, speed: 0.7, immersion: 0.1 },
  フラワー: { clarity: 0.85, body: 0.35, oil: 0.1, speed: 0.7, immersion: 0.1 },
  カリタウェーブ: {
    clarity: 0.7,
    body: 0.6,
    oil: 0.2,
    speed: 0.5,
    immersion: 0.2,
  },
  コーノ: { clarity: 0.55, body: 0.65, oil: 0.2, speed: 0.45, immersion: 0.35 },
  クリスタル: {
    clarity: 0.98,
    body: 0.2,
    oil: 0.0,
    speed: 0.6,
    immersion: 0.05,
  },
  ブルーボトル: {
    clarity: 0.8,
    body: 0.45,
    oil: 0.15,
    speed: 0.75,
    immersion: 0.1,
  },
  クレバー: {
    clarity: 0.45,
    body: 0.8,
    oil: 0.35,
    speed: 0.2,
    immersion: 0.95,
  },
  ハリオスイッチ: {
    clarity: 0.6,
    body: 0.7,
    oil: 0.25,
    speed: 0.35,
    immersion: 0.7,
  },
  フレンチプレス: {
    clarity: 0.25,
    body: 0.95,
    oil: 0.9,
    speed: 0.15,
    immersion: 1.0,
  },
  ネル: { clarity: 0.35, body: 0.9, oil: 0.7, speed: 0.25, immersion: 0.6 },
  フィン: { clarity: 0.3, body: 0.85, oil: 0.6, speed: 0.2, immersion: 0.8 },
  水出し: { clarity: 0.6, body: 0.6, oil: 0.3, speed: 0.0, immersion: 1.0 },
  エアロプレス: {
    clarity: 0.55,
    body: 0.7,
    oil: 0.4,
    speed: 0.9,
    immersion: 0.7,
  },
  エスプレッソ: {
    clarity: 0.4,
    body: 1.0,
    oil: 0.85,
    speed: 1.0,
    immersion: 0.2,
  },
  モカポット: {
    clarity: 0.35,
    body: 0.9,
    oil: 0.7,
    speed: 0.8,
    immersion: 0.2,
  },
  サイフォン: {
    clarity: 0.8,
    body: 0.55,
    oil: 0.2,
    speed: 0.5,
    immersion: 0.4,
  },
};

// ---- 追加：根拠つきエビデンスメタ ----
type DripperSource = { title: string; url: string };
type DripperEvidence = {
  features: string[]; // 形状/フィルタ/流路など、メーカー/標準に基づく客観情報
  qualitative: string[]; // 「クリーン寄り」「厚み寄り」等の定性方向（学習/経験で一般化されている傾向）
  sources: DripperSource[]; // 出典URL（公的/メーカー/教科書/百科など）
};

// 注意：features は客観、qualitative は方向性（モデルの前提）として扱う
export const DRIPPER_EVIDENCE: Record<string, DripperEvidence> = {
  ハリオ: {
    features: ["円すい・単穴", "スパイラル状のリブ"],
    qualitative: ["注湯依存で流速を作る→クリア寄りになりやすい"],
    sources: [
      {
        title: "Hario V60 (Wikipedia)",
        url: "https://en.wikipedia.org/wiki/Hario_V60",
      }, // 円すい/単穴/リブの基本仕様
    ],
  },
  カリタウェーブ: {
    features: ["平底", "3つ穴", "ウェーブペーパー"],
    qualitative: ["湯面がフラットになりやすく均一抽出→バランス志向"],
    sources: [
      {
        title: "Clive Coffee – Kalita Wave Guide",
        url: "https://clivecoffee.com/blogs/learn/kalita-wave-brew-guide",
      }, // 平底/3穴と抽出傾向
    ],
  },
  コーノ: {
    features: ["円すい", "リブが途中で終わる（上部は壁面密着しやすい）"],
    qualitative: ["序盤は浸漬寄り→後半透過が立ちやすい＝甘み/粘性"],
    sources: [
      {
        title: "KONO式ドリッパーの特徴（解説記事）",
        url: "https://www.kurasu.kyoto/blogs/news/kono-dripper",
      },
    ],
  },
  クレバー: {
    features: ["バルブ付で全量浸漬→レバー開放で落とす"],
    qualitative: ["浸漬優位→甘み/ボディを出しやすい"],
    sources: [
      {
        title: "Perfect Daily Grind – Cleverは浸漬+ドリップ",
        url: "https://perfectdailygrind.com/2020/09/what-is-the-clever-dripper/",
      },
    ],
  },
  ハリオスイッチ: {
    features: ["バルブON/OFFで浸漬⇄透過を切替"],
    qualitative: ["甘み×クリアの両立を狙える可変型"],
    sources: [
      {
        title: "HARIO COFFEE STATION（スイッチ解説）",
        url: "https://coffee-station.hariocontactlab.com/entertainment/10",
      },
    ],
  },
  フレンチプレス: {
    features: ["金属メッシュ・全浸漬"],
    qualitative: ["オイル/微粉が残りやすく厚み寄り"],
    sources: [
      {
        title: "Coffee filter (Wikipedia)",
        url: "https://en.wikipedia.org/wiki/Coffee_filter",
      },
    ],
  },
  エアロプレス: {
    features: ["加圧抽出（紙/金属フィルタ可）"],
    qualitative: ["短時間・可変性が高い"],
    sources: [
      {
        title: "AeroPress – Brew Guides",
        url: "https://aeropress.com/pages/learn",
      },
    ],
  },
  サイフォン: {
    features: ["加熱上昇→減圧ろ過（真空式）"],
    qualitative: ["香りと透明感の両立（布/紙フィルタ）"],
    sources: [
      {
        title: "SeriousEats – How siphon works（真空原理の解説）",
        url: "https://www.seriouseats.com/best-siphon-coffee-makers-6746392",
      },
    ],
  },
  モカポット: {
    features: ["加圧蒸気で高濃度抽出"],
    qualitative: ["ビター/ボディ寄り、ミルク合わせ向き"],
    sources: [
      {
        title: "Wikipedia – Moka pot",
        url: "https://en.wikipedia.org/wiki/Moka_pot",
      },
    ],
  },
  フィン: {
    features: ["金属フィルタの滴下式（ベトナム式）"],
    qualitative: ["じんわり濃度上昇、甘苦凝縮"],
    sources: [
      {
        title: "Nguyen Coffee Supply – What is a Phin?",
        url: "https://nguyencoffeesupply.com/pages/what-is-a-phin",
      },
    ],
  },
  ネル: {
    features: ["布濾し（オイル保持・目が細かい）"],
    qualitative: ["厚みと余韻、管理前提"],
    sources: [
      {
        title: "Coffee filter (Wikipedia) – 布フィルタ言及",
        url: "https://en.wikipedia.org/wiki/Coffee_filter",
      },
    ],
  },
  フラワー: {
    features: ["深いリブ・通気性重視の円すい"],
    qualitative: ["香り立ち/高流速寄り"],
    sources: [
      {
        title: "製品解説（代表的な特徴まとめ）",
        url: "https://www.kurasu.kyoto/blogs/learn/pour-over-drippers-compared",
      },
    ],
  },
  ブルーボトル: {
    features: ["大径単穴・浅いリブ系（Blue Bottle Dripper）"],
    qualitative: ["軽快にまとまりやすい"],
    sources: [
      {
        title: "Blue Bottle Dripper（製品解説）",
        url: "https://bluebottlecoffee.com/us/eng/products/blue-bottle-pourover-coffee-dripper",
      },
    ],
  },
  クリスタル: {
    features: ["高透明感志向のリブ/ペーパー接触最適化設計"],
    qualitative: ["微粉干渉を抑えやすく輪郭鋭く"],
    sources: [
      {
        title: "各種比較記事（通気と透明感）",
        url: "https://www.kurasu.kyoto/blogs/learn/pour-over-drippers-compared",
      },
    ],
  },
  水出し: {
    features: ["低温長時間の浸漬"],
    qualitative: ["渋みが出にくく丸い甘み/低酸"],
    sources: [
      {
        title: "SCA – Brew Temp（低温は規格外だが原理は浸漬）",
        url: "https://sca.coffee",
      },
    ],
  },
  エスプレッソ: {
    features: ["高圧短時間（~9bar, 25–30s）"],
    qualitative: ["凝縮・厚み・余韻"],
    sources: [
      {
        title: "Wikipedia – Espresso",
        url: "https://en.wikipedia.org/wiki/Espresso",
      },
    ],
  },
};
const DRIPPER_RUNTIME: Record<
  string,
  { timeFactor?: number; tempOffset?: number }
> = {
  カリタウェーブ: { timeFactor: 1.1, tempOffset: -1 },
  クリスタル: { timeFactor: 0.9, tempOffset: -1 },
  フレンチプレス: { timeFactor: 1.2, tempOffset: -2 },
  ネル: { timeFactor: 1.15, tempOffset: -2 },
  ハリオ: { timeFactor: 1.0, tempOffset: 0 },
  フラワー: { timeFactor: 1.0, tempOffset: 0 },
  コーノ: { timeFactor: 1.05, tempOffset: -1 },
};

type DripPick = {
  name: string;
  short: string;
  desc: string;
  tags: string[];
  reasons: string[];
};

type Reason = { label: string; sign: "+" | "-"; weight: number };

export function pickRecommendedDrippers(args: {
  bean?: any;
  beanStats?: any | null;
  useEmpiricalRanking?: boolean;
  limit?: number | "all";
  objective?: "overall" | "clean" | "flavor" | "body";
}): Array<DripPick & { score: number; rank: number; reasons2: Reason[] }> {
  const {
    bean,
    beanStats,
    useEmpiricalRanking = true,
    objective = "overall",
  } = args || {};
  const roast = String(bean?.roast_level || "");
  const process = (bean?.process || "") + " " + (bean?.addl_process || "");
  const origin = String(bean?.origin || "");

  // flags
  const isFerment = /(anaer|carbonic|酵素|発酵|macera|yeast)/i.test(process);
  const isNatural = /(natural|ナチュラル)/i.test(process);
  const isHoney = /(honey|ハニー)/i.test(process);
  const isWashed = /(wash|ウォッシュ)/i.test(process);
  const light = /(ライト|シナモン|ミディアム|ハイ)/.test(roast);
  const dark = /(フルシティ|フレンチ|イタリアン)/.test(roast);

  // 実績（母数補正＋0..1正規化）
  const byMethod = Array.isArray(beanStats?.by_method)
    ? (beanStats!.by_method as Array<{
        dripper: string;
        avg_overall: number;
        count?: number;
      }>)
    : [];
  const empRaw: Record<string, number> = {};
  for (const x of byMethod) {
    empRaw[x.dripper] = wilsonLowerBound(
      Number(x.avg_overall || 0),
      Number(x.count || 0)
    );
  }
  const empVals = Object.values(empRaw);
  const empMin = empVals.length ? Math.min(...empVals) : 0;
  const empMax = empVals.length ? Math.max(...empVals) : 1;
  const emp01 = (name: string) =>
    normalize01(empRaw[name] ?? 0, empMin, empMax); // 0..1

  const baseList = Object.keys(DRIPPER_DETAILS);

  // ルール相性理由
  const push = (map: Record<string, Reason[]>, name: string, r: Reason) => {
    (map[name] ||= []).push(r);
  };
  const reasonMap: Record<string, Reason[]> = {};
  const add = (name: string, label: string, w: number) =>
    push(reasonMap, name, {
      label,
      sign: w >= 0 ? "+" : "-",
      weight: Math.abs(w),
    });

  // --- 精製 ---
  if (isFerment) {
    ["クレバー", "ハリオスイッチ", "フレンチプレス", "ネル"].forEach((n) =>
      add(n, "精製: 発酵系は甘み/ボディ寄せが◯", +1.8)
    );
    ["ハリオ", "フラワー"].forEach((n) =>
      add(n, "精製: 発酵系は輪郭が出過ぎやすい", -1.0)
    );
  }
  if (isNatural) {
    [
      "クレバー",
      "ハリオスイッチ",
      "カリタウェーブ",
      "ハリオ",
      "フラワー",
    ].forEach((n) => add(n, "精製: ナチュラルの香味を活かしやすい", +1.0));
    ["クリスタル"].forEach((n) =>
      add(n, "精製: ナチュラルは微粉が気になりやすい", -0.6)
    );
  }
  if (isHoney) {
    ["ハリオ", "カリタウェーブ", "フラワー", "クレバー"].forEach((n) =>
      add(n, "精製: ハニーの甘み/香りを伸ばせる", +0.8)
    );
  }
  if (isWashed) {
    ["ハリオ", "フラワー", "カリタウェーブ", "コーノ"].forEach((n) =>
      add(n, "精製: ウォッシュトは清澄系が◯", +0.8)
    );
    ["フレンチプレス", "ネル"].forEach((n) =>
      add(n, "精製: ウォッシュトは厚み寄せだと個性が鈍る", -0.6)
    );
  }

  // --- 焙煎 ---
  if (light) {
    ["ハリオ", "フラワー", "カリタウェーブ", "コーノ", "クリスタル"].forEach(
      (n) => add(n, "焙煎: 浅〜中浅はクリア/香り重視が◯", +1.2)
    );
    ["ネル", "フレンチプレス"].forEach((n) =>
      add(n, "焙煎: 浅煎り×厚み寄せは渋みが出やすい", -1.0)
    );
  }
  if (dark) {
    ["ネル", "フレンチプレス", "クレバー", "ハリオスイッチ"].forEach((n) =>
      add(n, "焙煎: 深煎りは甘苦/厚み寄せが◯", +1.6)
    );
    ["ハリオ", "フラワー", "クリスタル"].forEach((n) =>
      add(n, "焙煎: 深煎り×清澄はキレすぎ/えぐみ出やすい", -1.2)
    );
  }

  // --- 産地（ざっくり傾向） ---
  if (aromaOrigin.test(origin)) {
    ["フラワー", "ハリオ", "カリタウェーブ", "クリスタル"].forEach((n) =>
      add(n, "産地: 香り重視の豆は輪郭と香りを出しやすい", +1.0)
    );
  }
  if (heavyOrigin.test(origin)) {
    ["ネル", "フレンチプレス", "クレバー", "ハリオスイッチ"].forEach((n) =>
      add(n, "産地: コクが出やすく、オイル感が活きる", +1.0)
    );
    ["クリスタル"].forEach((n) =>
      add(n, "産地: コクの強い産地で超クリアに寄せると薄く感じやすい", -0.8)
    );
  }

  // --- 追加相性 ---
  if (light || isWashed || aromaOrigin.test(origin)) {
    ["エスプレッソ", "モカポット", "フィン", "フレンチプレス", "ネル"].forEach(
      (n) => add(n, "クリア/軽快狙いでは、重厚・オイルが出過ぎやすい", -1.0)
    );
  }
  if (dark || heavyOrigin.test(origin) || isFerment || isNatural) {
    ["ハリオ", "フラワー", "クリスタル", "ブルーボトル"].forEach((n) =>
      add(n, "厚みを出したい局面では、クリア特化にすると薄くなりやすい", -0.9)
    );
  }
  if (light || isNatural)
    add("水出し", "低温長時間で酸を穏やかにし甘みを前に出せる", +1.0);
  if (dark || heavyOrigin.test(origin))
    add("水出し", "ホットの香り立ち重視なら不利", -0.6);
  if (isWashed || aromaOrigin.test(origin))
    add("サイフォン", "減圧ろ過で香りと透明感の両立", +0.9);
  if (isFerment || isNatural)
    add("エアロプレス", "圧力/攪拌/フィルタ選択で味を整えやすい", +0.8);
  if (dark || heavyOrigin.test(origin) || isFerment)
    ["エスプレッソ", "モカポット"].forEach((n) =>
      add(n, "高圧・高濃度で甘苦の厚みを最優先", +1.1)
    );

  // 豆から推定する基礎ターゲット
  const target = {
    clarity: 0.5,
    body: 0.5,
    oil: 0.3,
    speed: 0.5,
    immersion: 0.4,
  };
  if (
    light ||
    isWashed ||
    /(エチオピア|ケニア|ルワンダ|ブルンジ)/.test(origin)
  ) {
    target.clarity += 0.25;
    target.body -= 0.1;
    target.oil -= 0.15;
    target.speed += 0.15;
    target.immersion -= 0.1;
  }
  if (
    dark ||
    /(インドネシア|スマトラ|マンデリン|ブラジル)/.test(origin) ||
    isFerment ||
    isNatural
  ) {
    target.body += 0.25;
    target.oil += 0.2;
    target.clarity -= 0.1;
    target.speed -= 0.15;
    target.immersion += 0.15;
  }
  if (isHoney) target.immersion += 0.1;

  // 目的関数（UI選択）で微調整
  if (objective === "clean") {
    target.clarity += 0.2;
    target.oil -= 0.1;
  } else if (objective === "body") {
    target.body += 0.2;
    target.oil += 0.1;
    target.clarity -= 0.1;
  } else if (objective === "flavor") {
    target.clarity += 0.1;
    target.body += 0.05;
    target.speed += 0.05;
  }

  // スコア集計
  const items = baseList
    .map((name) => {
      const d = DRIPPER_DETAILS[name] || { short: "", desc: "", tags: [] };
      const reasons = reasonMap[name] || [];

      // ルール：カテゴリ別減衰合成（“焙煎/精製/産地/その他”で括る）
      const posByCat: Record<string, number[]> = {};
      const negByCat: Record<string, number[]> = {};
      for (const r of reasons) {
        const cat = String(r.label || "").split(":")[0] || "その他";
        if (r.sign === "+") (posByCat[cat] ||= []).push(r.weight);
        else (negByCat[cat] ||= []).push(r.weight);
      }
      const posSum = Object.values(posByCat).reduce(
        (s, arr) => s + dampedSum(arr, 2.0),
        0
      );
      const negSum = Object.values(negByCat).reduce(
        (s, arr) => s + dampedSum(arr, 2.0),
        0
      );
      const ruleScoreRaw = posSum - negSum; // 理論上 -∞..+∞ だが実際は±数点に収まる
      const ruleN = clamp(ruleScoreRaw / 3.0, -1, 1); // -1..+1 に圧縮

      // プロファイル適合度（-1..+1）
      const prof = DRIPPER_PROFILE[name] || {
        clarity: 0.5,
        body: 0.5,
        oil: 0.3,
        speed: 0.5,
        immersion: 0.5,
      };
      const dot =
        prof.clarity * target.clarity +
        prof.body * target.body +
        prof.oil * target.oil +
        prof.speed * target.speed +
        prof.immersion * target.immersion;
      const normA = Math.sqrt(
        prof.clarity ** 2 +
          prof.body ** 2 +
          prof.oil ** 2 +
          prof.speed ** 2 +
          prof.immersion ** 2
      );
      const normB = Math.sqrt(
        target.clarity ** 2 +
          target.body ** 2 +
          target.oil ** 2 +
          target.speed ** 2 +
          target.immersion ** 2
      );
      const profCos = normA && normB ? dot / (normA * normB) : 0.5;
      const profN = clamp((profCos - 0.5) * 2.0, -1, 1); // -1..+1

      // 実績（0..1→-1..+1）
      const empN = useEmpiricalRanking ? emp01(name) * 2 - 1 : 0;

      // 合成（重みは保守的に：ルール0.5 / プロファイル0.3 / 実績0.2）
      const { rule: w_rule, profile: w_prof, empirical: w_emp } = SCORE_WEIGHTS;
      const score = round2(w_rule * ruleN + w_prof * profN + w_emp * empN);
// （ここは return オブジェクトを作る直前の位置に置く）
// 実績（n, 平均）を一度だけ取得し、数値チェックしてから表示テキストを作る
const bm = byMethod.find((x) => x.dripper === name);
const sampleN = Number(bm?.count ?? 0);
const avgOverall = Number(bm?.avg_overall);

// 平均が有限値のときだけ toFixed を使う
const legacyReasons =
  Number.isFinite(avgOverall)
    ? [`実績: 平均${avgOverall.toFixed(1)}（n=${sampleN}）`]
    : [];

// 返り値
return {
  name,
  short: d.short,
  desc: d.desc,
  tags: d.tags,
  reasons: legacyReasons,
  reasons2: reasons,
  score,
  rank: 0,
  n: sampleN,
  avg_overall: Number.isFinite(avgOverall) ? avgOverall : NaN,
} as (DripPick & { score: number; rank: number; reasons2: Reason[] }) & {
  n: number;
  avg_overall: number;
};
    })
    .sort((a, b) => b.score - a.score);

  items.forEach((x, i) => (x.rank = i + 1));

  const limit = args?.limit ?? 5;
  return limit === "all"
    ? items
    : items.slice(0, Math.max(0, Number(limit) || 0));
}

/** 焙煎度→推奨湯温（℃） */
const ROAST_TEMP: Record<string, number> = {
  ライト: 92.5,
  シナモン: 90.0,
  ミディアム: 87.5,
  ハイ: 85.0,
  シティ: 82.5,
  フルシティ: 80.0,
  フレンチ: 77.5,
  イタリアン: 75.0,
};
/** 粒度グループ→推奨時間（秒） */
const GRIND_TIME: Record<string, number> = {
  粗: 210,
  中粗: 180,
  中: 120,
  中細: 90,
  細: 60,
  極細: 40,
};
/** 20段階ラベル → 6グループ */
const toGrindGroup = (label20?: string | null) => {
  if (!label20) return null;
  if (label20.startsWith("粗")) return "粗";
  if (label20.startsWith("中粗")) return "中粗";
  if (["中++", "中+", "中", "中-", "中--"].includes(label20)) return "中";
  if (label20.startsWith("中細")) return "中細";
  if (label20.startsWith("細")) return "細";
  if (label20 === "極細") return "極細";
  return null;
};
/** 秒 → mm:ss */
const secToMMSS = (s?: number | null) => {
  if (s == null || !Number.isFinite(s)) return undefined;
  const m = Math.floor(s / 60),
    ss = Math.abs(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
};
/** 日付差（日） "yyyy-mm-dd" 前提 */
const daysBetween = (from?: string | null, to?: string | null) => {
  if (!from || !to) return null;
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};
/** Pearson 相関係数 */
const corr = (pairs: Array<[number, number]>) => {
  const xs = pairs.map((p) => p[0]).filter((v) => Number.isFinite(v));
  const ys = pairs
    .map((p) => p[1])
    .filter(
      (_, i) => Number.isFinite(pairs[i][0]) && Number.isFinite(pairs[i][1])
    );
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    dx2 = 0,
    dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx,
      dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? null : num / den;
};
/** 近焙煎度セット（前後1つ＋同一） */
const nearRoastSet = (level?: string | null) => {
  if (!level) return new Set<string>();
  const idx = ROASTS.indexOf(level);
  if (idx < 0) return new Set<string>([level]);
  return new Set(
    [ROASTS[idx - 1], ROASTS[idx], ROASTS[idx + 1]].filter(Boolean)
  );
};

export function DripForm({
  API,
  beans,
  onSaved,
}: {
  API: string;
  beans: any[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({ ratings: {} });
  const [derive, setDerive] = useState<any>(null);
  const [openAllDrippers, setOpenAllDrippers] = useState(false);
  const [listMode, setListMode] = useState<"top5" | "all">("top5");
  const [beanStats, setBeanStats] = useState<any>(null);
  const [dripDate, setDripDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [showDripperBlocks, setShowDripperBlocks] = useState(true); // ← 追加：ドリッパー群の表示ON/OFF
  const [beanDrips, setBeanDrips] = useState<any[]>([]);
  const [allDrips, setAllDrips] = useState<any[]>([]);
  // 実績スイッチ：ランキング反映と表示を独立制御
  const [weightVersion, setWeightVersion] = useState(0);
  const [useEmpiricalRanking, setUseEmpiricalRanking] = useState(true);
  const [showEmpiricalReasons, setShowEmpiricalReasons] = useState(true);

  // BEGIN: new states
  const [bestMetric, setBestMetric] = useState<TasteKey>("overall");
  const [visibleScopes, setVisibleScopes] = useState<Record<ScopeKey, boolean>>(
    {
      thisBean: true,
      sameRoast: true,
      originNear: true,
    }
  );
  const [bestByScopeMetric, setBestByScopeMetric] = useState<
    Record<ScopeKey, Partial<Record<TasteKey, any>>>
  >({ thisBean: {}, sameRoast: {}, originNear: {} });
  const [worstByScopeMetric, setWorstByScopeMetric] = useState<
    Record<ScopeKey, Partial<Record<TasteKey, any>>>
  >({ thisBean: {}, sameRoast: {}, originNear: {} });
  const [beanAvgRatings, setBeanAvgRatings] = useState<Record<string, number>>(
    {}
  );
  // END: new states

  const [yMetric, setYMetric] = useState<
    "overall" | "clean" | "flavor" | "body"
  >("overall");
  const [editingDripId, setEditingDripId] = useState<number | null>(null);
  const [last, setLast] = useState<any | null>(null);

  // 暫定最適：2系統のベスト
  const [bestSameRoast, setBestSameRoast] = useState<any | null>(null);
  const [bestOriginNear, setBestOriginNear] = useState<any | null>(null);
  type SectionKey = "radar" | "byMethod" | "corrTemp" | "corrTime";

  const [showSection, setShowSection] = useState<Record<SectionKey, boolean>>({
    radar: true,
    byMethod: true,
    corrTemp: true,
    corrTime: true,
  });

  // 追加: レーダー内の個別カード表示切替（同豆/同焙煎/近焙煎/平均/前回）
  type RadarItemKey =
    | "thisBean"
    | "sameRoast"
    | "originNear"
    | "average"
    | "previous";
  type RadarItemKeyExt =
    | "thisBean"
    | "sameRoast"
    | "originNear"
    | "thisBeanWorst"
    | "sameRoastWorst"
    | "originNearWorst"
    | "average"
    | "previous";
  const [showCharts, setShowCharts] = useState<
    Record<RadarItemKeyExt, boolean>
  >({
    thisBean: true,
    sameRoast: true,
    originNear: true,
    thisBeanWorst: false,
    sameRoastWorst: false,
    originNearWorst: false,
    average: false,
    previous: false,
  });

  const toggleChart = (k: RadarItemKeyExt) =>
    setShowCharts((s) => ({ ...s, [k]: !s[k] }));
  // セレクト＆適用ボタン用
  type BestPattern = {
    id: "thisBean" | "sameRoast" | "originNear";
    label: string;
    fields: Partial<{
      grind: number;
      water_temp_c: number;
      dose_g: number;
      water_g: number;
      drawdown_g: number | null;
      time: string; // mm:ss
      dripper: string | null;
      storage: string | null;
    }>;
  };
  const [bestPatterns, setBestPatterns] = useState<BestPattern[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<
    BestPattern["id"] | ""
  >("thisBean");

  // 前回値適用
  const applyLast = () => {
    if (!last) return;
    setForm((s: any) => ({
      ...s,
      grind: last.grind ?? s.grind,
      water_temp_c: last.water_temp_c ?? s.water_temp_c,
      dose_g: last.dose_g ?? s.dose_g,
      water_g: last.water_g ?? s.water_g,
      drawdown_g: last.drawdown_g ?? s.drawdown_g,
      time: last.time_sec != null ? secToMMSS(last.time_sec) : s.time,
      dripper: last.dripper ?? s.dripper,
      storage: last.storage ?? s.storage,
      ratings: { ...(s.ratings || {}), ...(last?.ratings || {}) },
    }));
  };

  // 暫定最適値適用
  const applyBest = () => {
    const pat =
      bestPatterns.find((p) => p.id === selectedPatternId) || bestPatterns[0];
    if (!pat) return;
    const src =
      pat.id === "thisBean"
        ? bestByScopeMetric?.thisBean?.[bestMetric]
        : pat.id === "sameRoast"
        ? bestByScopeMetric?.sameRoast?.[bestMetric]
        : bestByScopeMetric?.originNear?.[bestMetric];

    setForm((s: any) => ({
      ...s,
      grind: pat.fields.grind ?? s.grind,
      water_temp_c: pat.fields.water_temp_c ?? s.water_temp_c,
      dose_g: pat.fields.dose_g ?? s.dose_g,
      water_g: pat.fields.water_g ?? s.water_g,
      drawdown_g: pat.fields.drawdown_g ?? s.drawdown_g,
      time: pat.fields.time ?? s.time,
      dripper: pat.fields.dripper ?? s.dripper,
      storage: pat.fields.storage ?? s.storage,
      ratings: { ...(s.ratings || {}), ...(src?.ratings || {}) },
    }));
  };

  const applyFromDrip = (d: any) => {
    if (!d) return;
    setForm((s: any) => ({
      ...s,
      grind: d.grind ?? s.grind,
      water_temp_c: d.water_temp_c ?? s.water_temp_c,
      dose_g: d.dose_g ?? s.dose_g,
      water_g: d.water_g ?? s.water_g,
      drawdown_g: d.drawdown_g ?? s.drawdown_g,
      time: d.time_sec != null ? secToMMSS(d.time_sec) : s.time,
      dripper: d.dripper ?? s.dripper,
      storage: d.storage ?? s.storage,
      ratings: { ...(s.ratings || {}), ...(d?.ratings || {}) },
    }));
  };
  // ドリッパーの推奨レシピを適用（器具Knowhowと豆側推奨のマージ）
  const applySuggested = (name: string) => {
    const k = (DRIPPER_KNOWHOW as any)[name] || {};
    const rec = recommendForDrip({
      roast_level: selBean?.roast_level,
      derive: null,
      label20: null,
    });
    setForm((s: any) => ({
      ...s,
      dripper: name,
      // howto 優先、なければ rec
      water_temp_c: Number.isFinite(k?.howto?.tempC)
        ? k.howto.tempC
        : rec?.recTemp ?? s.water_temp_c,
      time:
        (k?.howto?.time
          ? k.howto.time.includes(":")
            ? k.howto.time
            : secToMMSS(Number(k.howto.time))
          : Number.isFinite(rec?.recTime)
          ? secToMMSS(rec.recTime)
          : s.time) || s.time,
    }));
  };

  const handle = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));
  const handleRating = (k: string, v: any) =>
    setForm((s: any) => ({ ...s, ratings: { ...s.ratings, [k]: v } }));

  // 統一フィルタ＆ソート
  type SortKey = "roast_date" | "roast_level" | "ppg" | "name";
  type StockFilter = "all" | "in" | "out";
  const LS = {
    q: "ct_beans_q",
    stock: "ct_beans_stock",
    origins: "ct_beans_origins",
    sort: "ct_beans_sort",
  };
  const [q, setQ] = useState<string>(() => localStorage.getItem(LS.q) || "");
  const [stock, setStock] = useState<StockFilter>(
    () => (localStorage.getItem(LS.stock) as StockFilter) || "all"
  );
  const [originFilter, setOriginFilter] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS.origins) || "[]");
    } catch {
      return [];
    }
  });
  const [sort, setSort] = useState<SortKey>(
    () => (localStorage.getItem(LS.sort) as SortKey) || "roast_date"
  );
  useEffect(() => {
    localStorage.setItem(LS.q, q);
  }, [q]);
  useEffect(() => {
    localStorage.setItem(LS.stock, stock);
  }, [stock]);
  useEffect(() => {
    localStorage.setItem(LS.origins, JSON.stringify(originFilter));
  }, [originFilter]);
  useEffect(() => {
    localStorage.setItem(LS.sort, sort);
  }, [sort]);
  const filteredSortedBeans = useMemo(
    () => filterSortBeans(beans, { q, stock, origins: originFilter, sort }),
    [beans, q, stock, originFilter, sort]
  );

  // セオリー/推奨/挽き目表記
  useEffect(() => {
    const bean_id = form.bean_id;
    if (!bean_id) {
      setDerive(null);
      return;
    }
    const params = new URLSearchParams();
    params.set("bean_id", bean_id);
    if (form.grind) params.set("grind", form.grind);
    if (form.dose_g) params.set("dose_g", form.dose_g);
    if (form.water_g) params.set("water_g", form.water_g);
    if (form.water_temp_c) params.set("water_temp_c", form.water_temp_c);
    if (form.dripper) params.set("dripper", form.dripper);
    if (form.brew_date) params.set("brew_date", form.brew_date);
    fetch(`${API}/api/derive?` + params.toString())
      .then((r) => r.json())
      .then(setDerive);
  }, [
    form.bean_id,
    form.grind,
    form.dose_g,
    form.water_g,
    form.water_temp_c,
    form.dripper,
    form.brew_date,
    API,
  ]);

  // 豆ごと統計
  useEffect(() => {
    if (!form.bean_id) {
      setBeanStats(null);
      return;
    }
    fetch(`${API}/api/stats?scope=bean&bean_id=${form.bean_id}`)
      .then((r) => r.json())
      .then(setBeanStats);
  }, [form.bean_id, API]);

  // 最新ドリップ
  useEffect(() => {
    if (!form.bean_id) {
      setLast(null);
      return;
    }
    fetch(`${API}/api/drips/last?bean_id=${form.bean_id}`)
      .then((r) => r.json())
      .then(setLast)
      .catch(() => setLast(null));
  }, [form.bean_id, API]);

  // ドリップ取得＆“ベスト”抽出
  useEffect(() => {
    if (!form.bean_id) {
      setBeanDrips([]);
      setAllDrips([]);
      setBestPatterns([]);
      setSelectedPatternId("");
      setBestSameRoast(null);
      setBestOriginNear(null);
      return;
    }
    (async () => {
      const r = await fetch(`${API}/api/drips`);
      const all = await r.json();
      setAllDrips(all);

      const targetBean = beans.find(
        (b) => String(b.id) === String(form.bean_id)
      );
      const beansById: Record<string, any> = {};
      for (const b of beans) beansById[String(b.id)] = b;

      const mine = all.filter(
        (d: any) => String(d.bean_id) === String(form.bean_id)
      );

      // 平均値
      const radarKeys = [
        { key: "clean", label: "クリーンさ" },
        { key: "flavor", label: "風味" },
        { key: "acidity", label: "酸味" },
        { key: "bitterness", label: "苦味" },
        { key: "sweetness", label: "甘味" },
        { key: "body", label: "コク" },
        { key: "aftertaste", label: "後味" },
      ];
      const beanAvgMap: Record<string, number> = {};
      for (const k of radarKeys) {
        const vals = mine
          .map((d: any) => d.ratings?.[k.key])
          .filter((x: any) => typeof x === "number");
        beanAvgMap[k.key] = vals.length
          ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length
          : 0;
      }

      // 相関用 Δ
      const withDeltas = mine.map((d: any) => {
        const roast = d.roast_level ?? "シティ";
        const recTemp =
          (d.derived?.recommended?.temp_c as number | undefined) ??
          ROAST_TEMP[roast] ??
          82.5;
        const tempDelta =
          typeof d.water_temp_c === "number" && Number.isFinite(recTemp)
            ? d.water_temp_c - recTemp
            : null;
        const label20 = d.derive?.grind?.label20 || d.label20 || null;
        const group = toGrindGroup(label20);
        const recTime = group ? GRIND_TIME[group] : null;
        const actSec = typeof d.time_sec === "number" ? d.time_sec : null;
        const timeDelta =
          actSec != null && recTime != null ? actSec - recTime : null;
        return {
          ...d,
          _deltas: { temp_delta: tempDelta, time_delta: timeDelta },
        };
      });
      setBeanDrips(withDeltas);

      // “ベスト”抽出
      const shareOrigin = (b1: any, b2: any) => {
        const a = String(b1?.origin || "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        const b = String(b2?.origin || "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        return a.some((x) => b.includes(x));
      };
      const nearSet = nearRoastSet(targetBean?.roast_level);

      const sortBest = (arr: any[]) =>
        arr
          .filter((d) => Number.isFinite(Number(d?.ratings?.overall)))
          .sort(
            (a, b) =>
              Number(b.ratings.overall) - Number(a.ratings.overall) ||
              new Date(b.brew_date).getTime() - new Date(a.brew_date).getTime()
          );

      const sameRoastCandidates = all.filter((d: any) => {
        const bb = beansById[String(d.bean_id)];
        return bb && targetBean && bb.roast_level === targetBean.roast_level;
      });
      const originNearCandidates = all.filter((d: any) => {
        const bb = beansById[String(d.bean_id)];
        return (
          bb &&
          targetBean &&
          shareOrigin(targetBean, bb) &&
          nearSet.has(bb.roast_level)
        );
      });

      const bestSR = sortBest(sameRoastCandidates)[0] || null;
      const bestON = sortBest(originNearCandidates)[0] || null;
      setBestSameRoast(bestSR);
      setBestOriginNear(bestON);

      // 3スコープ × 8指標ベスト
      const bestOf = (arr: any[], metric: TasteKey) =>
        arr
          .filter((d) => Number.isFinite(Number(d?.ratings?.[metric])))
          .sort(
            (a, b) =>
              Number(b.ratings[metric]) - Number(a.ratings[metric]) ||
              new Date(b.brew_date).getTime() - new Date(a.brew_date).getTime()
          )[0] || null;
      // 3スコープ × 8指標ワースト（※スコア昇順。日付は新しい方を優先）
      const worstOf = (arr: any[], metric: TasteKey) =>
        arr
          .filter((d) => Number.isFinite(Number(d?.ratings?.[metric])))
          .sort(
            (a, b) =>
              Number(a.ratings[metric]) - Number(b.ratings[metric]) ||
              new Date(b.brew_date).getTime() - new Date(a.brew_date).getTime()
          )[0] || null;
      const bestMap: Record<ScopeKey, Partial<Record<TasteKey, any>>> = {
        thisBean: {},
        sameRoast: {},
        originNear: {},
      };
      const worstMap: Record<ScopeKey, Partial<Record<TasteKey, any>>> = {
        thisBean: {},
        sameRoast: {},
        originNear: {},
      };
      for (const t of [
        "overall",
        "clean",
        "flavor",
        "acidity",
        "bitterness",
        "sweetness",
        "body",
        "aftertaste",
      ] as TasteKey[]) {
        bestMap.thisBean[t] = bestOf(mine, t);
        bestMap.sameRoast[t] = bestOf(sameRoastCandidates, t);
        bestMap.originNear[t] = bestOf(originNearCandidates, t);
        worstMap.thisBean[t] = worstOf(mine, t);
        worstMap.sameRoast[t] = worstOf(sameRoastCandidates, t);
        worstMap.originNear[t] = worstOf(originNearCandidates, t);
      }
      setBestByScopeMetric(bestMap);
      setWorstByScopeMetric(worstMap);
      setBeanAvgRatings(beanAvgMap);

      // 暫定最適“選択肢”
      const mkFields = (d: any) =>
        d
          ? {
              grind: d.grind,
              water_temp_c: d.water_temp_c,
              dose_g: d.dose_g,
              water_g: d.water_g,
              drawdown_g: d.drawdown_g ?? null,
              time: secToMMSS(d.time_sec),
              dripper: d.dripper ?? null,
              storage: d.storage ?? null,
            }
          : {};

      const bm = (metric: TasteKey) => [
        { id: "thisBean" as const, d: bestMap.thisBean[metric] },
        { id: "sameRoast" as const, d: bestMap.sameRoast[metric] },
        { id: "originNear" as const, d: bestMap.originNear[metric] },
      ];

      const pats = bm(bestMetric)
        .filter((x) => x.d)
        .map((x) => ({
          id: x.id,
          label: makeMultilineLabel(
            x.d,
            beansById[String(x.d.bean_id)],
            x.id === "thisBean"
              ? "同豆ベスト"
              : x.id === "sameRoast"
              ? "同焙煎度ベスト"
              : "産地×近焙煎度ベスト",
            bestMetric
          ),
          fields: mkFields(x.d),
        }));
      setBestPatterns(pats);
      setSelectedPatternId(pats[0]?.id || "");
    })();
  }, [form.bean_id, API, beans, bestMetric]);

  const getBest = (scope: ScopeKey, metric: TasteKey) => {
    const m = bestByScopeMetric?.[scope]?.[metric];
    return m || null;
  };

  const validate = () => {
    if (!form.bean_id) return "使用豆";
    if (form.grind === "" || form.grind == null) return "挽き目";
    if (form.water_temp_c === "" || form.water_temp_c == null) return "湯温(℃)";
    if (form.dose_g === "" || form.dose_g == null) return "豆(g)";
    if (form.water_g === "" || form.water_g == null) return "湯量(g)";
    if (!form.time) return "抽出時間(mm:ss)";
    if (!form.dripper) return "ドリッパー";
    if (!form.storage) return "保存状態";
    return null;
  };

  const submit = async (e: any) => {
    e.preventDefault();
    const miss = validate();
    if (!form.brew_date) {
      form.brew_date = dripDate || new Date().toISOString().slice(0, 10);
    }
    if (miss) {
      alert(`必須項目が不足：${miss}`);
      return;
    }
    const payload = {
      bean_id: parseInt(form.bean_id),
      brew_date:
        form.brew_date || dripDate || new Date().toISOString().slice(0, 10),
      grind: form.grind ? parseFloat(form.grind) : null,
      water_temp_c: form.water_temp_c ? parseFloat(form.water_temp_c) : null,
      dose_g: form.dose_g ? parseFloat(form.dose_g) : null,
      water_g: form.water_g ? parseFloat(form.water_g) : null,
      drawdown_g: form.drawdown_g ? parseFloat(form.drawdown_g) : null,
      time: form.time || null,
      dripper: form.dripper || null,
      storage: form.storage || null,
      method_memo: form.method_memo || null,
      note_memo: form.note_memo || null,
      clean: form.ratings?.clean ? parseInt(form.ratings.clean) : null,
      flavor: form.ratings?.flavor ? parseInt(form.ratings.flavor) : null,
      acidity: form.ratings?.acidity ? parseInt(form.ratings.acidity) : null,
      bitterness: form.ratings?.bitterness
        ? parseInt(form.ratings.bitterness)
        : null,
      sweetness: form.ratings?.sweetness
        ? parseInt(form.ratings.sweetness)
        : null,
      body: form.ratings?.body ? parseInt(form.ratings.body) : null,
      aftertaste: form.ratings?.aftertaste
        ? parseInt(form.ratings.aftertaste)
        : null,
      overall: form.ratings?.overall ? parseInt(form.ratings.overall) : null,
    };
    const url = editingDripId
      ? `${API}/api/drips/${editingDripId}`
      : `${API}/api/drips`;
    const method = editingDripId ? "PUT" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      setForm({ ratings: {} });
      setEditingDripId(null);
      onSaved();
    }
  };

  // 表示ヘルパ
  const selBean = beans.find((b) => String(b.id) === String(form.bean_id));

  // 推奨ドリッパーTOP5（実績→ルール）
  const recommendedDrippers = useMemo(
    () =>
      pickRecommendedDrippers({
        bean: selBean,
        beanStats,
        useEmpiricalRanking,
        objective: yMetric as "overall" | "clean" | "flavor" | "body",
      }),
    [selBean, beanStats?.by_method, useEmpiricalRanking, yMetric, weightVersion]
  );

  // 全ドリッパー（おすすめ順・全件）
  const allDrippersOrdered = useMemo(
    () =>
      pickRecommendedDrippers({
        bean: selBean,
        beanStats,
        useEmpiricalRanking,
        limit: "all",
        objective: yMetric as "overall" | "clean" | "flavor" | "body",
      }),
    [selBean, beanStats?.by_method, useEmpiricalRanking, yMetric, weightVersion]
  );

  // 表示切替用（TOP5 or 全部）
  const dripperList = useMemo(
    () => (listMode === "top5" ? recommendedDrippers : allDrippersOrdered),
    [listMode, recommendedDrippers, allDrippersOrdered]
  );
  // ★ 追加：TOP5を全体から除外
  const allDrippersExceptTop = useMemo(() => {
    const topNames = new Set(
      recommendedDrippers.map((d) => String(d.name || "").trim())
    );
    return (allDrippersOrdered || []).filter(
      (d) => !topNames.has(String(d.name || "").trim())
    );
  }, [allDrippersOrdered, recommendedDrippers]);

  const showOrDash = (cond: any, val: any, dashWhenBean?: string) =>
    cond ? val ?? "—" : dashWhenBean ?? "--";
  const isUnknown = (v?: any) => {
    const raw = String(v ?? "").trim();
    if (!raw) return true;
    const s = raw.replace(/[()（）［］【】]/g, "");
    return (
      s === "—" ||
      s === "-" ||
      s === "--" ||
      /^不明/.test(s) ||
      /^未指定/.test(s) ||
      /^未設定/.test(s) ||
      /^指定なし/.test(s) ||
      /^N\/A$/i.test(s)
    );
  };
  const theoryWithValue = (theory?: any, value?: any) => {
    const t = isUnknown(theory) ? "" : String(theory);
    const v = isUnknown(value) ? "" : String(value);
    if (v && t) return `${v}（${t}）`;
    if (v) return v;
    if (t) return t;
    return "";
  };
  const TheoryRow = ({
    label,
    theory,
    value,
    show = true,
  }: {
    label: string;
    theory: any;
    value: any;
    show?: boolean;
  }) => {
    if (!show) return null;
    const txt = theoryWithValue(theory, value);
    return txt ? (
      <div>
        {label}：{txt}
      </div>
    ) : null;
  };
  const StarRow = ({ avg }: { avg: number | undefined }) => {
    if (avg == null || isNaN(Number(avg))) return <span>--</span>;
    const s = Math.round(Number(avg) / 2);
    return (
      <span aria-label={`rating ${s} of 5`}>
        {"★★★★★".slice(0, s)}
        {"☆☆☆☆☆".slice(0, 5 - s)}{" "}
        <span className="text-[11px] text-gray-500">({avg})</span>
      </span>
    );
  };
  const originTheoryText = () => {
    if (!selBean?.origin) return "—";
    const cs = String(selBean.origin)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const notes = cs
      .map((c) => {
        const th = ORIGIN_THEORIES[c];
        if (!th || /未指定|不明/.test(th)) return "";
        return `${flagify(c)}（${th}）`;
      })
      .filter(Boolean);
    return notes.length ? notes.join(" ／ ") : "—";
  };

  // --- 5段階評価セレクト ---
  const to5step = (v: any) => {
    if (v === "" || v == null) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    const five = Math.min(5, Math.max(1, Math.round(n / 2)));
    return String(five);
  };
  const from5step = (v5: string) =>
    v5 === "" ? "" : String(Math.min(5, Math.max(1, Number(v5))) * 2);
  const RatingSelect = ({
    k,
    label,
  }: {
    k:
      | "overall"
      | "clean"
      | "flavor"
      | "acidity"
      | "bitterness"
      | "sweetness"
      | "body"
      | "aftertaste";
    label: string;
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-600">{label}</label>
      <select
        className="border rounded p-2 text-sm"
        value={to5step((form as any).ratings?.[k])}
        onChange={(e) => handleRating(k, from5step(e.target.value))}
      >
        <option value="">—</option>
        <option value="1">1（弱い）</option>
        <option value="2">2</option>
        <option value="3">3（中）</option>
        <option value="4">4</option>
        <option value="5">5（強い）</option>
      </select>
    </div>
  );

  // 指標切替
  const yAccessor = useMemo(
    () => ({
      key: `ratings.${yMetric}`,
      label:
        yMetric === "overall"
          ? "総合"
          : yMetric === "clean"
          ? "クリーンさ"
          : yMetric === "flavor"
          ? "風味"
          : "コク",
    }),
    [yMetric]
  );

  // 相関
  const beanPairsTemp = useMemo(() => {
    return beanDrips
      .map(
        (d: any) =>
          [d?._deltas?.temp_delta, d?.ratings?.[yMetric]] as [number, number]
      )
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  }, [beanDrips, yMetric]);
  const beanPairsTime = useMemo(() => {
    return beanDrips
      .map(
        (d: any) =>
          [d?._deltas?.time_delta, d?.ratings?.[yMetric]] as [number, number]
      )
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  }, [beanDrips, yMetric]);
  const rTempBean = useMemo(() => {
    const v = corr(beanPairsTemp);
    return v == null ? null : Math.round(v * 100) / 100;
  }, [beanPairsTemp]);
  const rTimeBean = useMemo(() => {
    const v = corr(beanPairsTime);
    return v == null ? null : Math.round(v * 100) / 100;
  }, [beanPairsTime]);

  // 表示条件
  const hasStats = !!(beanStats && Number(beanStats.count) > 0);
  const hasAvg = !!(hasStats && beanStats.avg_overall != null);
  const hasByMethod = !!(
    hasStats &&
    Array.isArray(beanStats.by_method) &&
    beanStats.by_method.length > 0
  );

  const hasPairsTemp = beanPairsTemp.length > 0;
  const hasPairsTime = beanPairsTime.length > 0;
  const hasRadar = useMemo(() => {
    const hasAvgMap = Object.keys(beanAvgRatings || {}).length > 0;
    const anyBest = !!(
      bestByScopeMetric?.thisBean?.[bestMetric] ||
      bestByScopeMetric?.sameRoast?.[bestMetric] ||
      bestByScopeMetric?.originNear?.[bestMetric]
    );
    const hasLast = !!last;
    return hasAvgMap || anyBest || hasLast;
  }, [beanAvgRatings, bestByScopeMetric, bestMetric, last]);
  // === レーダーカードの2行分割ヘルパ ===
  // 5→3,2／6→3,3／7→4,3／8→4,4 で並べる
  const splitForNiceRows = (nodes: React.ReactNode[]) => {
    const n = nodes.length;
    const first = n <= 4 ? n : n === 5 ? 3 : n === 6 ? 3 : n === 7 ? 4 : 4; // 8以上は4/残りに分割
    return [nodes.slice(0, first), nodes.slice(first)];
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      {/* ソート・絞り込み */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-600">
            フリーワード検索
          </label>
          <input
            className="border rounded p-2 w-full text-sm"
            placeholder="名前・産地・品種・精製など"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600">在庫</label>
          <select
            className="border rounded p-2 text-sm"
            value={stock}
            onChange={(e) => setStock(e.target.value as any)}
          >
            <option value="all">全部</option>
            <option value="in">あり</option>
            <option value="out">なし</option>
          </select>
        </div>
        <div className="min-w-[220px]">
          <label className="block text-xs text-gray-600">
            産地フィルタ（複数可）
          </label>
          <select
            multiple
            className="border rounded p-2 text-sm w-full h-24"
            value={originFilter}
            onChange={(e) => {
              const v = Array.from(e.target.selectedOptions).map(
                (o) => o.value
              );
              setOriginFilter(v);
            }}
          >
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {flagify(o)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">ソート（昇順）</label>
          <select
            className="border rounded p-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
          >
            <option value="roast_date">焙煎日</option>
            <option value="roast_level">焙煎度</option>
            <option value="ppg">g単価</option>
            <option value="name">名前</option>
          </select>
        </div>
      </div>

      {/* 1列目：豆＆日付 */}
      <div className="grid grid-cols-2 gap-2">
        <select
          className="border rounded p-2"
          value={form.bean_id || ""}
          onChange={(e) => handle("bean_id", e.target.value)}
          required
        >
          <option value="">使用豆を選択</option>
          {filteredSortedBeans.map((b: any) => (
            <option key={b.id} value={b.id}>
              {beanOptionLabel(b)}
            </option>
          ))}
        </select>
        <input
          className="border rounded p-2"
          type="date"
          value={form.brew_date || dripDate}
          onChange={(e) => {
            setDripDate(e.target.value);
            handle("brew_date", e.target.value);
          }}
        />
      </div>

      {/* エイジング日数 */}
      <div className="text-xs text-gray-700">
        エイジング日数：
        {(() => {
          const roastDate =
            (selBean?.roast_date as string | undefined) ||
            (selBean?.roasted_on as string | undefined) ||
            (selBean?.purchase_date as string | undefined) ||
            (selBean?.purchased_on as string | undefined);
          const brewDate = form.brew_date as string | undefined;
          const d = daysBetween(roastDate, brewDate);
          if (!form.bean_id || !brewDate) return "--";
          if (!roastDate) return "—（焙煎日未登録）";
          return `${d} 日`;
        })()}
      </div>

      {/* セオリー & 統計 */}
      {/* === グラフセクション見出し＋トグル === */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">比較グラフ</div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showCharts.thisBean}
              onChange={() => toggleChart("thisBean")}
            />
            同豆ベスト
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showCharts.sameRoast}
              onChange={() => toggleChart("sameRoast")}
            />
            同焙煎度ベスト
          </label>

          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showCharts.originNear}
              onChange={() => toggleChart("originNear")}
            />
            産地×近焙煎度
          </label>
          <span className="mx-1 text-gray-400">/</span>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showCharts.thisBeanWorst}
              onChange={() => toggleChart("thisBeanWorst")}
            />
            同豆ワースト
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showCharts.sameRoastWorst}
              onChange={() => toggleChart("sameRoastWorst")}
            />
            同焙煎ワースト
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showCharts.originNearWorst}
              onChange={() => toggleChart("originNearWorst")}
            />
            産地×近焙煎ワースト
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showCharts.average}
              onChange={() => toggleChart("average")}
            />
            平均
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showCharts.previous}
              onChange={() => toggleChart("previous")}
            />
            前回
          </label>
        </div>
      </div>
      <div className="bg-gray-50 border rounded p-2 space-y-2 text-sm">
        {/* 表示するグラフの選択 */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-gray-600">表示するグラフ：</span>
          {(
            [
              { k: "radar", label: "レーダー" },
              { k: "byMethod", label: "方法別バー" },
              { k: "corrTemp", label: "相関（温度Δ）" },
              { k: "corrTime", label: "相関（時間Δ）" },
            ] as { k: SectionKey; label: string }[]
          ).map((s) => (
            <label key={s.k} className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={showSection[s.k]}
                onChange={(e) =>
                  setShowSection((v) => ({ ...v, [s.k]: e.target.checked }))
                }
              />
              <span>{s.label}</span>
            </label>
          ))}
        </div>

        <div className="font-semibold">選択豆：{selBean?.name ?? "--"}</div>

        <TheoryRow
          label="産地セオリー"
          theory={originTheoryText()}
          value={""}
          show={!!form.bean_id}
        />
        <TheoryRow
          label="精製セオリー"
          theory={derive?.theory?.process}
          value={selBean?.process}
          show={!!form.bean_id}
        />
        <TheoryRow
          label="追加処理セオリー"
          theory={derive?.theory?.addl_process}
          value={selBean?.addl_process}
          show={!!form.bean_id}
        />

        {!isUnknown(selBean?.taste_memo) && (
          <div>テイストメモ：{selBean?.taste_memo}</div>
        )}
        {!isUnknown(selBean?.brew_policy) && (
          <div>ドリップ方針メモ：{selBean?.brew_policy}</div>
        )}

        {hasAvg && (
          <div className="text-sm">
            平均評価（★）：
            <StarRow avg={beanStats?.avg_overall} />
          </div>
        )}
        {hasRadar && showSection.radar && (
          <div className="space-y-2">
            {/* 基準セレクト（そのまま） */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span>暫定最適値の基準：</span>
              <select
                className="border rounded p-1"
                value={bestMetric}
                onChange={(e) => setBestMetric(e.target.value as TasteKey)}
              >
                {TASTE_KEYS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* コンパクトなカードグリッド（ベスト3 + ワースト3） */}
            {(() => {
              // まずカードを配列にためる
              const cards: React.ReactNode[] = [];

              // ベスト3
              (["thisBean", "sameRoast", "originNear"] as const).forEach(
                (scope) => {
                  if (!showCharts[scope]) return;
                  const d = bestByScopeMetric?.[scope]?.[bestMetric];
                  const title = scopeTitle(scope as ScopeKey);
                  cards.push(
                    <div
                      key={`best-${scope}`}
                      className="border rounded bg-white p-2 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold">
                          {title}（{metricJp(bestMetric)}）
                        </div>
                        {d && (
                          <button
                            type="button"
                            onClick={() => applyFromDrip(d)}
                            className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50 text-[11px]"
                          >
                            適用
                          </button>
                        )}
                      </div>
                      <ChartFrame aspect={0.9} className="min-h-[160px]">
                        <RadarChart
                          data={[
                            {
                              subject: "クリーンさ",
                              value: Number(d?.ratings?.clean) || 0,
                            },
                            {
                              subject: "風味",
                              value: Number(d?.ratings?.flavor) || 0,
                            },
                            {
                              subject: "酸味",
                              value: Number(d?.ratings?.acidity) || 0,
                            },
                            {
                              subject: "苦味",
                              value: Number(d?.ratings?.bitterness) || 0,
                            },
                            {
                              subject: "甘味",
                              value: Number(d?.ratings?.sweetness) || 0,
                            },
                            {
                              subject: "コク",
                              value: Number(d?.ratings?.body) || 0,
                            },
                            {
                              subject: "後味",
                              value: Number(d?.ratings?.aftertaste) || 0,
                            },
                          ]}
                          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                        >
                          <PolarGrid />
                          <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fontSize: 10 }}
                          />
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 10]}
                            tick={{ fontSize: 9 }}
                          />
                          <Radar
                            name={title}
                            dataKey="value"
                            stroke={
                              scope === "thisBean"
                                ? RADAR_COLORS.thisBeanBest.stroke
                                : scope === "sameRoast"
                                ? RADAR_COLORS.sameRoastBest.stroke
                                : RADAR_COLORS.originNearBest.stroke
                            }
                            fill={
                              scope === "thisBean"
                                ? RADAR_COLORS.thisBeanBest.fill
                                : scope === "sameRoast"
                                ? RADAR_COLORS.sameRoastBest.fill
                                : RADAR_COLORS.originNearBest.fill
                            }
                            fillOpacity={0.32}
                          />
                          <Tooltip />
                        </RadarChart>
                      </ChartFrame>
                      <div className="text-[11px] whitespace-pre-wrap leading-5">
                        {d
                          ? makeMultilineLabel(
                              d,
                              beans.find(
                                (b) => String(b.id) === String(d.bean_id)
                              ),
                              title,
                              bestMetric
                            )
                          : `${title}（${metricJp(bestMetric)}）：データなし`}
                      </div>
                    </div>
                  );
                }
              );

              // ワースト3
              (["thisBean", "sameRoast", "originNear"] as const).forEach(
                (scope) => {
                  const key = (scope + "Worst") as
                    | "thisBeanWorst"
                    | "sameRoastWorst"
                    | "originNearWorst";
                  if (!showCharts[key]) return;
                  const d = worstByScopeMetric?.[scope]?.[bestMetric];
                  const title = scopeTitleWorst(scope as ScopeKey);
                  cards.push(
                    <div
                      key={`worst-${scope}`}
                      className="border rounded bg-white p-2 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold">
                          {title}（{metricJp(bestMetric)}）
                        </div>
                        {d && (
                          <button
                            type="button"
                            onClick={() => applyFromDrip(d)}
                            className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50 text-[11px]"
                          >
                            適用
                          </button>
                        )}
                      </div>
                      <ChartFrame aspect={0.9} className="min-h-[160px]">
                        <RadarChart
                          data={[
                            {
                              subject: "クリーンさ",
                              value: Number(d?.ratings?.clean) || 0,
                            },
                            {
                              subject: "風味",
                              value: Number(d?.ratings?.flavor) || 0,
                            },
                            {
                              subject: "酸味",
                              value: Number(d?.ratings?.acidity) || 0,
                            },
                            {
                              subject: "苦味",
                              value: Number(d?.ratings?.bitterness) || 0,
                            },
                            {
                              subject: "甘味",
                              value: Number(d?.ratings?.sweetness) || 0,
                            },
                            {
                              subject: "コク",
                              value: Number(d?.ratings?.body) || 0,
                            },
                            {
                              subject: "後味",
                              value: Number(d?.ratings?.aftertaste) || 0,
                            },
                          ]}
                          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                        >
                          <PolarGrid />
                          <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fontSize: 10 }}
                          />
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 10]}
                            tick={{ fontSize: 9 }}
                          />
                          <Radar
                            name={title}
                            dataKey="value"
                            stroke={
                              scope === "thisBean"
                                ? RADAR_COLORS.thisBeanBest.stroke
                                : scope === "sameRoast"
                                ? RADAR_COLORS.sameRoastBest.stroke
                                : RADAR_COLORS.originNearBest.stroke
                            }
                            fill={
                              scope === "thisBean"
                                ? RADAR_COLORS.thisBeanBest.fill
                                : scope === "sameRoast"
                                ? RADAR_COLORS.sameRoastBest.fill
                                : RADAR_COLORS.originNearBest.fill
                            }
                            fillOpacity={0.32}
                          />
                          <Tooltip />
                        </RadarChart>
                      </ChartFrame>
                      <div className="text-[11px] whitespace-pre-wrap leading-5">
                        {d
                          ? makeMultilineLabel(
                              d,
                              beans.find(
                                (b) => String(b.id) === String(d.bean_id)
                              ),
                              title,
                              bestMetric
                            )
                          : `${title}（${metricJp(bestMetric)}）：データなし`}
                      </div>
                    </div>
                  );
                }
              );

              // 平均/前回（任意で追加）
              if (
                showCharts.average &&
                Object.keys(beanAvgRatings || {}).length > 0
              ) {
                cards.push(
                  <div
                    key="avg"
                    className="border rounded bg-white p-2 flex flex-col gap-1"
                  >
                    <div className="text-xs font-semibold">
                      平均（{metricJp(bestMetric)}）
                    </div>
                    <ChartFrame aspect={0.9} className="min-h-[160px]">
                      <RadarChart
                        data={[
                          {
                            subject: "クリーンさ",
                            value: Number(beanAvgRatings.clean) || 0,
                          },
                          {
                            subject: "風味",
                            value: Number(beanAvgRatings.flavor) || 0,
                          },
                          {
                            subject: "酸味",
                            value: Number(beanAvgRatings.acidity) || 0,
                          },
                          {
                            subject: "苦味",
                            value: Number(beanAvgRatings.bitterness) || 0,
                          },
                          {
                            subject: "甘味",
                            value: Number(beanAvgRatings.sweetness) || 0,
                          },
                          {
                            subject: "コク",
                            value: Number(beanAvgRatings.body) || 0,
                          },
                          {
                            subject: "後味",
                            value: Number(beanAvgRatings.aftertaste) || 0,
                          },
                        ]}
                        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                      >
                        <PolarGrid />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{ fontSize: 10 }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 10]}
                          tick={{ fontSize: 9 }}
                        />
                        <Radar
                          name="平均"
                          dataKey="value"
                          stroke={RADAR_COLORS.beanAvg.stroke}
                          fill={RADAR_COLORS.beanAvg.fill}
                          fillOpacity={0.32}
                        />
                        <Tooltip />
                      </RadarChart>
                    </ChartFrame>
                  </div>
                );
              }
              if (showCharts.previous && last) {
                cards.push(
                  <div
                    key="last"
                    className="border rounded bg-white p-2 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">
                        前回（{metricJp(bestMetric)}）
                      </div>
                      <button
                        type="button"
                        onClick={() => applyFromDrip(last)}
                        className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50 text-[11px]"
                      >
                        適用
                      </button>
                    </div>
                    <ChartFrame aspect={0.9} className="min-h-[160px]">
                      <RadarChart
                        data={[
                          {
                            subject: "クリーンさ",
                            value: Number(last?.ratings?.clean) || 0,
                          },
                          {
                            subject: "風味",
                            value: Number(last?.ratings?.flavor) || 0,
                          },
                          {
                            subject: "酸味",
                            value: Number(last?.ratings?.acidity) || 0,
                          },
                          {
                            subject: "苦味",
                            value: Number(last?.ratings?.bitterness) || 0,
                          },
                          {
                            subject: "甘味",
                            value: Number(last?.ratings?.sweetness) || 0,
                          },
                          {
                            subject: "コク",
                            value: Number(last?.ratings?.body) || 0,
                          },
                          {
                            subject: "後味",
                            value: Number(last?.ratings?.aftertaste) || 0,
                          },
                        ]}
                        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                      >
                        <PolarGrid />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{ fontSize: 10 }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 10]}
                          tick={{ fontSize: 9 }}
                        />
                        <Radar
                          name="前回"
                          dataKey="value"
                          stroke={RADAR_COLORS.last.stroke}
                          fill={RADAR_COLORS.last.fill}
                          fillOpacity={0.32}
                        />
                        <Tooltip />
                      </RadarChart>
                    </ChartFrame>
                    <div className="text-[11px] whitespace-pre-wrap leading-5">
                      {selBean
                        ? makeMultilineLabel(last, selBean, "前回", bestMetric)
                        : "—"}
                    </div>
                  </div>
                );
              }

              // ここで 2行に分割して描画（中央寄せ・最大4カラム想定）
              const [row1, row2] = splitForNiceRows(cards);

              return (
                <>
                  <div className="grid gap-2 justify-center [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] max-w-[1100px] mx-auto">
                    {row1}
                  </div>
                  {row2.length > 0 && (
                    <div className="grid gap-2 justify-center mt-2 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] max-w-[1100px] mx-auto">
                      {row2}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* 豆ごとバー（抽出方法別平均） */}
        {hasStats && (
          <div className="text-xs">
            記録数：{beanStats.count}　平均：{beanStats.avg_overall}　最高：
            {beanStats.max_overall}
          </div>
        )}
        {hasByMethod && showSection.byMethod && (
          <ChartFrame aspect={2.4} className="max-h-[180px]">
            <BarChart
              data={beanStats.by_method}
              margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              barSize={14}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dripper" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="avg_overall" />
            </BarChart>
          </ChartFrame>
        )}

        {/* 相関 */}
        <div className="flex items-center gap-2 text-xs">
          <span>評価指標：</span>
          <select
            className="border rounded p-1"
            value={yMetric}
            onChange={(e) => setYMetric(e.target.value as any)}
          >
            <option value="overall">総合</option>
            <option value="clean">クリーンさ</option>
            <option value="flavor">風味</option>
            <option value="body">コク</option>
          </select>
        </div>

        {/* 湯温差/時間差 グリッド配置 */}
        <div className="grid md:grid-cols-2 gap-2">
          {hasPairsTemp && showSection.corrTemp && (
            <div>
              <div className="font-semibold mb-1">
                湯温差（実測−推奨） vs {yAccessor.label}
                <span className="ml-2 text-xs text-gray-500">
                  r={rTempBean ?? "—"}
                </span>
              </div>
              <ChartFrame aspect={2.4} className="max-h-[180px]">
                <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid />
                  <XAxis
                    dataKey="_deltas.temp_delta"
                    name="tempΔ(°C)"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    dataKey={yAccessor.key}
                    name={yAccessor.label}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Scatter name="drips" data={beanDrips} shape="circle" r={2} />
                </ScatterChart>
              </ChartFrame>
            </div>
          )}
        </div>

        {/* 時間差 vs 指標 */}
        <div>
          {hasPairsTime && showSection.corrTime && (
            <div>
              <div className="font-semibold mb-1">
                時間差（実測秒−推奨秒） vs {yAccessor.label}
                <span className="ml-2 text-xs text-gray-500">
                  r={rTimeBean ?? "—"}
                </span>
              </div>

              <ChartFrame aspect={2.4} className="max-h-[180px]">
                <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid />
                  <XAxis
                    dataKey="_deltas.time_delta"
                    name="timeΔ(s)"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    dataKey={yAccessor.key}
                    name={yAccessor.label}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Scatter name="drips" data={beanDrips} shape="circle" r={2} />
                </ScatterChart>
              </ChartFrame>
            </div>
          )}
        </div>
      </div>

      {/* 入力群 */}
      {/* 3カラム：挽き目 / 湯温 / ドリッパー */}
      {/* ドリッパー */}

      {/* --- ドリッパー（先頭セクション） --- */}
      {/* --- ドリッパー（先頭セクション） --- */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-600 mt-2">ドリッパー候補</div>
          <div className="flex items-center gap-3 text-[11px]">
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={showDripperBlocks}
                onChange={() => setShowDripperBlocks((v) => !v)}
              />
              ドリッパー表示
            </label>
            {/* 重みプリセット（任意） */}
            <div className="inline-flex items-center gap-2">
              <span className="text-gray-500">重み</span>

              <button
                type="button"
                className="px-1.5 py-0.5 text-[11px] border rounded"
                onClick={() => {
                  Object.assign(SCORE_WEIGHTS, {
                    rule: 0.4,
                    profile: 0.4,
                    empirical: 0.2,
                  });
                  setWeightVersion((v) => v + 1);
                }}
              >
                バランス
              </button>

              <button
                type="button"
                className="px-1.5 py-0.5 text-[11px] border rounded"
                onClick={() => {
                  Object.assign(SCORE_WEIGHTS, {
                    rule: 0.2,
                    profile: 0.3,
                    empirical: 0.5,
                  });
                  setWeightVersion((v) => v + 1);
                }}
              >
                実績重視
              </button>

              <button
                type="button"
                className="px-1.5 py-0.5 text-[11px] border rounded"
                onClick={() => {
                  Object.assign(SCORE_WEIGHTS, {
                    rule: 0.6,
                    profile: 0.3,
                    empirical: 0.1,
                  });
                  setWeightVersion((v) => v + 1);
                }}
              >
                理論重視
              </button>
            </div>

            {/* 追加：TOP5だけ / 全部 */}
            <div className="inline-flex items-center gap-2">
              <span className="text-gray-500">表示</span>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="dripperListMode"
                  checked={listMode === "top5"}
                  onChange={() => setListMode("top5")}
                />
                TOP5だけ
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="dripperListMode"
                  checked={listMode === "all"}
                  onChange={() => setListMode("all")}
                />
                全部
              </label>
            </div>

            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={useEmpiricalRanking}
                onChange={() => setUseEmpiricalRanking((v) => !v)}
              />
              実績をランキングに反映
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={showEmpiricalReasons}
                onChange={() => setShowEmpiricalReasons((v) => !v)}
              />
              実績情報を表示
            </label>
          </div>
        </div>
      </div>

      {showDripperBlocks && (
        <div className="mt-2">
          <DripperList
            title={
              listMode === "top5"
                ? "おすすめTOP5"
                : "全ドリッパー（おすすめ順）"
            }
            bean={selBean}
            items={
              (listMode === "top5"
                ? recommendedDrippers
                : allDrippersOrdered) as any
            }
            showEmpiricalReasons={showEmpiricalReasons}
            onPick={(name) => handle("dripper", name)}
            onApplySuggested={(name) => applySuggested(name)}
          />
        </div>
      )}

      {/* セレクトは常に残す（表示OFFでも選べるように） */}
      <select
        className="border rounded p-2 w-full mt-2"
        value={form.dripper || ""}
        onChange={(e) => handle("dripper", e.target.value)}
      >
        <option value="">ドリッパー</option>
        {[
          "水出し",
          "エアロプレス",
          "クレバー",
          "ハリオスイッチ",
          "ハリオ",
          "フラワー",
          "クリスタル",
          "カリタウェーブ",
          "ブルーボトル",
          "コーノ",
          "フィン",
          "ネル",
          "フレンチプレス",
          "エスプレッソ",
          "モカポット",
          "サイフォン",
        ].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>

      <div className="text-xs text-gray-600 mt-1">
        ドリッパー理論：{form.dripper ? derive?.theory?.dripper ?? "—" : "--"}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* 挽き目 */}
        <div>
          <div className="text-[11px] text-gray-500 mb-1">
            目安（焙煎度基準）：
            {form.bean_id ? (
              <>
                粗 {derive?.grind?.markers_for_roast?.["粗"] ?? "—"} / 中粗{" "}
                {derive?.grind?.markers_for_roast?.["中粗"] ?? "—"} / 中{" "}
                {derive?.grind?.markers_for_roast?.["中"] ?? "—"} / 中細{" "}
                {derive?.grind?.markers_for_roast?.["中細"] ?? "—"} / 細{" "}
                {derive?.grind?.markers_for_roast?.["細"] ?? "—"} / 極細{" "}
                {derive?.grind?.markers_for_roast?.["極細"] ?? "—"}
              </>
            ) : (
              "--"
            )}
          </div>

          <input
            className="border rounded p-2 w-full"
            placeholder="挽き目 (1~17)"
            value={form.grind || ""}
            onChange={(e) => handle("grind", e.target.value)}
          />

          <div className="text-xs text-gray-600 mt-1">
            挽き目表記：
            <b>
              {form.bean_id && form.grind
                ? derive?.grind?.label20 ?? "—"
                : "--"}
            </b>
          </div>
        </div>

        {/* 湯温 */}
        <div>
          {/* ↑ 推奨（上） */}
          <div className="text-xs text-gray-600 mb-1">
            推奨湯温：{showOrDash(!!form.bean_id, derive?.temp?.recommended_c)}℃
          </div>

          <input
            className="border rounded p-2 w-full"
            placeholder="湯温 (℃)"
            value={form.water_temp_c || ""}
            onChange={(e) => handle("water_temp_c", e.target.value)}
          />

          {/* ↓ 差分（下） */}
          <div className="text-xs text-gray-600 mt-1">
            Δ：
            {form.bean_id && form.water_temp_c
              ? derive?.temp?.delta_from_input ?? "—"
              : "--"}
          </div>
        </div>

        {/* 3カラム：豆量 / 湯量 / 落ちきり量 */}
        <div className="grid grid-cols-3 gap-2">
          {/* 豆量 */}
          <div>
            <div className="text-xs text-gray-600 mb-1">
              推奨レシオ：
              {showOrDash(!!form.bean_id, derive?.ratio?.recommended_ratio)}倍
            </div>

            <input
              className="border rounded p-2 w-full"
              placeholder="豆 (g)"
              value={form.dose_g || ""}
              onChange={(e) => handle("dose_g", e.target.value)}
            />

            <div className="text-[11px] text-gray-500 mt-1">
              最大推奨量：
              {showOrDash(!!form.bean_id, derive?.dose?.max_recommended_g)}
            </div>
            {/* 差分は無し（比率なので） */}
          </div>

          {/* 湯量 */}
          <div>
            {/* ↑ 推奨（上） */}
            <div className="text-xs text-gray-600 mb-1">
              推奨湯量：
              {form.bean_id && form.dose_g
                ? derive?.ratio?.recommended_water_g ?? "—"
                : "--"}
              g
            </div>

            <input
              className="border rounded p-2 w-full"
              placeholder="湯量 (g)"
              value={form.water_g || ""}
              onChange={(e) => handle("water_g", e.target.value)}
            />

            {/* ↓ 差分（下） */}
            <div className="text-xs text-gray-600 mt-1">
              Δ：
              {form.bean_id && form.dose_g && form.water_g
                ? derive?.ratio?.delta_from_input ?? "—"
                : "--"}
            </div>
          </div>

          {/* 落ちきり量 */}
          <div>
            <input
              className="border rounded p-2 w-full"
              placeholder="落ちきり量 (g)"
              value={form.drawdown_g || ""}
              onChange={(e) => handle("drawdown_g", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* 抽出時間 */}
        <div>
          <div className="text-xs text-gray-600 mb-1">
            推奨所要時間：
            {showOrDash(
              !!form.bean_id,
              formatSecFriendly(Number(derive?.time?.recommended_sec))
            )}
          </div>
          <input
            className="border rounded p-2 w-full"
            placeholder="抽出時間 (mm:ss)"
            value={form.time || ""}
            onChange={(e) => handle("time", e.target.value)}
          />
          <div className="text-xs text-gray-600 mt-1">
            Δ：
            {(() => {
              const rec = Number(derive?.time?.recommended_sec);
              const mmssToSec = (s?: string | null) => {
                if (!s) return null;
                const [mm, ss] = String(s).trim().split(":");
                const m = Number(mm),
                  s2 = Number(ss);
                if (!Number.isFinite(m) || !Number.isFinite(s2)) return null;
                return m * 60 + s2;
              };
              const act = mmssToSec(form.time as string | null);
              if (!Number.isFinite(rec) || !Number.isFinite(act ?? NaN))
                return "—";
              const diff = Math.abs((act as number) - rec);
              const mm = Math.floor(diff / 60),
                ss = diff % 60;
              return `${String(mm).padStart(2, "0")}:${String(ss).padStart(
                2,
                "0"
              )}`;
            })()}
          </div>
        </div>

        {/* 保存状態 */}
        <div>
          <select
            className="border rounded p-2 w-full"
            value={form.storage || ""}
            onChange={(e) => handle("storage", e.target.value)}
          >
            <option value="">保存状態</option>
            <option value="🧊冷凍">🧊冷凍</option>
            <option value="常温">常温</option>
          </select>
        </div>
      </div>

      <textarea
        className="w-full border rounded p-2"
        placeholder="手法メモ"
        value={form.method_memo || ""}
        onChange={(e) => handle("method_memo", e.target.value)}
      />
      <textarea
        className="w-full border rounded p-2"
        placeholder="感想メモ"
        value={form.note_memo || ""}
        onChange={(e) => handle("note_memo", e.target.value)}
      />

      {/* 味の入力（5段階セレクト） */}
      <div className="space-y-3">
        {/* 全体（overall） */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          <RatingSelect k="overall" label="全体（overall）" />
        </div>
        {/* 残り7項目 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <RatingSelect k="clean" label="クリーンさ（clean）" />
          <RatingSelect k="flavor" label="風味（flavor）" />
          <RatingSelect k="acidity" label="酸味（acidity）" />
          <RatingSelect k="bitterness" label="苦味（bitterness）" />
          <RatingSelect k="sweetness" label="甘味（sweetness）" />
          <RatingSelect k="body" label="コク（body）" />
          <RatingSelect k="aftertaste" label="後味（aftertaste）" />
        </div>
      </div>

      {/* 価格見積 */}
      {(() => {
        const b = beans.find((b) => String(b.id) === String(form.bean_id));
        const price = Number(b?.price_yen);
        const weight = Number(b?.weight_g);
        const dose = Number(form.dose_g);
        if (
          !b ||
          !Number.isFinite(price) ||
          !Number.isFinite(weight) ||
          !Number.isFinite(dose) ||
          weight <= 0
        ) {
          return null;
        }
        const perG = Math.round((price / weight) * 100) / 100;
        const cost = Math.round(perG * dose * 100) / 100;
        return (
          <div className="text-sm bg-gray-50 border rounded p-2">
            費用見積：{cost} 円（単価 {perG} 円/g）
          </div>
        );
      })()}

      {/* 入力中プレビュー */}
      <div className="bg-white border rounded p-3 space-y-2">
        <div className="font-semibold text-sm">プレビュー（今回の抽出）</div>

        <div className="text-sm">
          {(() => {
            const r = form.ratings || {};
            const nums = Object.entries(r)
              .map(([k, v]: any) => (v !== "" && v != null ? Number(v) : null))
              .filter((x: any) => Number.isFinite(x)) as number[];
            const overall = Number(r.overall);
            const base = Number.isFinite(overall)
              ? overall
              : nums.length
              ? Math.round(
                  (nums.reduce((a, b) => a + b, 0) / nums.length) * 10
                ) / 10
              : null;
            return (
              <>
                総合（★）：
                {base == null ? (
                  "--"
                ) : (
                  <span aria-label={`rating ${Math.round(base / 2)} of 5`}>
                    {"★★★★★".slice(0, Math.round(base / 2))}
                    {"☆☆☆☆☆".slice(0, 5 - Math.round(base / 2))}
                    <span className="text-[11px] text-gray-500">
                      （{base}）
                    </span>
                  </span>
                )}
              </>
            );
          })()}
        </div>

        <ChartFrame aspect={0.85} className="max-h-[220px] sm:max-h-[200px]">
          <RadarChart
            data={[
              {
                subject: "クリーンさ",
                value: Number(form.ratings?.clean) || 0,
              },
              { subject: "風味", value: Number(form.ratings?.flavor) || 0 },
              { subject: "酸味", value: Number(form.ratings?.acidity) || 0 },
              { subject: "苦味", value: Number(form.ratings?.bitterness) || 0 },
              { subject: "甘味", value: Number(form.ratings?.sweetness) || 0 },
              { subject: "コク", value: Number(form.ratings?.body) || 0 },
              { subject: "後味", value: Number(form.ratings?.aftertaste) || 0 },
            ]}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
          >
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 10]}
              tick={{ fontSize: 9 }}
            />
            <Radar name="now" dataKey="value" fillOpacity={0.28} />
            <Tooltip />
          </RadarChart>
        </ChartFrame>

        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          <div className="border rounded p-2">
            <div className="font-medium">湯温</div>
            <div>
              推奨：{showOrDash(!!form.bean_id, derive?.temp?.recommended_c)}℃
            </div>
            <div>
              Δ：
              {form.bean_id && form.water_temp_c
                ? derive?.temp?.delta_from_input ?? "—"
                : "--"}
            </div>
          </div>
          <div className="border rounded p-2">
            <div className="font-medium">レシオ/湯量</div>
            <div>
              推奨比：
              {showOrDash(!!form.bean_id, derive?.ratio?.recommended_ratio)}倍
            </div>
            <div>
              推奨湯量：
              {form.bean_id && form.dose_g
                ? derive?.ratio?.recommended_water_g ?? "—"
                : "--"}
              g
            </div>
            <div>
              Δ：
              {form.bean_id && form.dose_g && form.water_g
                ? derive?.ratio?.delta_from_input ?? "—"
                : "--"}
            </div>
          </div>

          <div className="border rounded p-2">
            <div className="font-medium">時間</div>
            <div>
              推奨：
              {showOrDash(
                !!form.bean_id,
                formatSecFriendly(Number(derive?.time?.recommended_sec))
              )}
            </div>
            <div>
              Δ：
              {(() => {
                const rec = Number(derive?.time?.recommended_sec);
                const mmssToSec = (s?: string | null) => {
                  if (!s) return null;
                  const [mm, ss] = String(s).split(":");
                  const m = Number(mm),
                    s2 = Number(ss);
                  if (!Number.isFinite(m) || !Number.isFinite(s2)) return null;
                  return m * 60 + s2;
                };
                const act = mmssToSec(form.time as string | null);
                if (!Number.isFinite(rec) || !Number.isFinite(act ?? NaN))
                  return "—";
                return deltaTime(act!, rec) || "—";
              })()}
            </div>
          </div>
        </div>
      </div>

      <button className="px-3 py-2 rounded bg-blue-600 text-white">
        ドリップを記録
      </button>
    </form>
  );
}

// ランキングNo.常時・正負色分け・総合点バッジ表示版
// ランキングNo.常時・正負色分け・総合点バッジ表示版
// === Tag color mapping (焙煎/精製/産地/風味/抽出/流速/その他) ===
const TAG_COLOR_CLASS = (cat: string) => {
  const k = String(cat).trim();
  return k === "焙煎"
    ? "bg-amber-50  text-amber-800  border-amber-200"
    : k === "精製"
    ? "bg-blue-50   text-blue-700   border-blue-200"
    : k === "産地"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : k === "風味"
    ? "bg-orange-50 text-orange-700 border-orange-200"
    : k === "抽出"
    ? "bg-violet-50 text-violet-700 border-violet-200"
    : k === "流速"
    ? "bg-rose-50   text-rose-700   border-rose-200"
    : "bg-gray-50   text-gray-700   border-gray-200";
};
const tagClassFor = (raw: string) => {
  const m = String(raw || "").match(/^(\S+)\s*:/); // 先頭「カテゴリ:」
  const head = m ? m[1] : "その他";
  // 正規化（同義語→標準カテゴリ）
  const norm =
    head === "焙煎" || head === "焙煎度"
      ? "焙煎"
      : head === "精製" || head === "精製方法"
      ? "精製"
      : head === "産地"
      ? "産地"
      : head === "風味"
      ? "風味"
      : head === "抽出" || head === "抽出形式"
      ? "抽出"
      : head === "流速"
      ? "流速"
      : "その他";
  return TAG_COLOR_CLASS(norm);
};
const nBadgeClass = (n: number) =>
  n >= 10
    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
    : n >= 3
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-gray-50 text-gray-500 border-gray-200";

const DripperList: React.FC<{
  title: string;
  bean: any;
  items: Array<{
    name: string;
    short: string;
    desc: string;
    tags: string[];
    reasons: string[];
    score: number;
    rank: number;
    reasons2: { label: string; sign: "+" | "-"; weight: number }[];
    n?: number;
    avg_overall?: number;
  }>;
  showEmpiricalReasons: boolean;
  onPick: (name: string) => void;
  onApplySuggested: (name: string) => void;
}> = ({
  title,
  bean,
  items,
  showEmpiricalReasons,
  onPick,
  onApplySuggested,
}) => {
  const [expandReasons, setExpandReasons] = React.useState<
    Record<string, boolean>
  >({});
  const toggleReasons = (name: string) =>
    setExpandReasons((s) => ({ ...s, [name]: !s[name] }));
  // DripperList 冒頭の state 群に追加
  const [expandTags, setExpandTags] = React.useState<Record<string, boolean>>(
    {}
  );
  const toggleTags = (name: string) =>
    setExpandTags((s) => ({ ...s, [name]: !s[name] }));

  return (
    <div className="border rounded">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50">
        <div className="text-xs font-semibold">{title}</div>
      </div>

      <ul className="p-2 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {items.map((d) => {
          const empiricalTags = (d.reasons || []).filter((r) =>
            String(r).startsWith("実績:")
          );
          const showAll = !!expandReasons[d.name];
          const reasonsShown = (d.reasons2 || []).slice(
            0,
            showAll ? d.reasons2.length : 3
          );
          const remain = Math.max(
            0,
            (d.reasons2?.length || 0) - reasonsShown.length
          );

          // タグ4つに制限
          const shownTags = (d.tags || []).slice(0, 4);
          const remainTags = Math.max(
            0,
            (d.tags?.length || 0) - shownTags.length
          );

          return (
            <li
              key={d.name}
              className="border rounded bg-white p-3 flex flex-col gap-1.5"
            >
              {/* 1行目：名前＋短サマリ＋信頼度(n)＋総合スコア */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 border text-blue-700">
                  #{d.rank}
                </span>
                <span
                  className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${nBadgeClass(
                    Number(d.n || 0)
                  )}`}
                >
                  n={Number(d.n || 0)}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded border bg-gray-50">
                  総合 {d.score}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <b className="text-[15px]">{d.name}</b>
                <span className="text-xs text-gray-600 truncate">
                  — {d.short}
                </span>
              </div>

              {/* 2行目：推奨レシピ＆相性の例は折りたたみ */}
              <div className="flex items-center gap-2 text-[12px] text-gray-800">
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    className="px-2 py-1 rounded border bg-white hover:bg-gray-50 text-xs"
                    onClick={() => onPick(d.name)}
                  >
                    このドリッパーを選ぶ
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border bg-white hover:bg-gray-50 text-xs"
                    onClick={() => onApplySuggested(d.name)}
                  >
                    推奨レシピを適用
                  </button>
                </div>
              </div>

              {/* 理由（上位2つだけ）＋もっと見る */}
              {reasonsShown.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {reasonsShown.map((r, i) => (
                    <span
                      key={i}
                      className={
                        "text-[10px] px-1.5 py-0.5 rounded border " +
                        (r.sign === "+"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700")
                      }
                      title={`weight=${r.weight}`}
                    >
                      {r.sign}
                      {r.label}
                    </span>
                  ))}
                  {remain > 0 && (
                    <button
                      type="button"
                      className="text-[10px] px-1.5 py-0.5 rounded border bg-white text-gray-700 underline"
                      onClick={() => toggleReasons(d.name)}
                    >
                      ＋{remain} もっと見る
                    </button>
                  )}
                  {showAll && (
                    <button
                      type="button"
                      className="text-[10px] px-1.5 py-0.5 rounded border bg-white text-gray-500"
                      onClick={() => toggleReasons(d.name)}
                    >
                      閉じる
                    </button>
                  )}
                </div>
              )}

              {/* 実績タグ（表示ONのときだけ） */}
              {showEmpiricalReasons && empiricalTags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {empiricalTags.map((t, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* 基本タグ（開閉式） */}
              {d.tags?.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {(expandTags[d.name] ? d.tags : d.tags.slice(0, 4)).map(
                    (t, i) => {
                      const cls = tagClassFor(String(t));
                      return (
                        <span
                          key={i}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}
                        >
                          {t}
                        </span>
                      );
                    }
                  )}

                  {d.tags.length > 4 && !expandTags[d.name] && (
                    <button
                      type="button"
                      className="text-[10px] px-1.5 py-0.5 rounded border bg-white text-gray-700 underline"
                      onClick={() => toggleTags(d.name)}
                    >
                      ＋{d.tags.length - 4}
                    </button>
                  )}

                  {expandTags[d.name] && (
                    <button
                      type="button"
                      className="text-[10px] px-1.5 py-0.5 rounded border bg-white text-gray-500"
                      onClick={() => toggleTags(d.name)}
                    >
                      閉じる
                    </button>
                  )}
                </div>
              )}

              {/* 詳細（ℹ︎）を折りたたみ：長文説明・仕様・出典 */}
              <details className="mt-1">
                <summary className="text-[11px] text-gray-600 cursor-pointer select-none">
                  詳細（仕様/根拠/説明）
                </summary>
                <div className="pt-1.5 space-y-1.5">
                  <p className="text-[12px] leading-5 text-gray-800">
                    {d.desc}
                  </p>

                  {DRIPPER_EVIDENCE[d.name]?.qualitative?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {DRIPPER_EVIDENCE[d.name].qualitative.map((q, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded border bg-white text-gray-700"
                        >
                          根拠: {q}
                        </span>
                      ))}
                    </div>
                  )}

                  {DRIPPER_EVIDENCE[d.name]?.features?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {DRIPPER_EVIDENCE[d.name].features.map((f, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded border bg-gray-50 text-gray-700"
                        >
                          仕様: {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {DRIPPER_EVIDENCE[d.name]?.sources?.length > 0 && (
                    <div className="text-[10px] text-gray-500 space-y-0.5">
                      {DRIPPER_EVIDENCE[d.name].sources.map((s, i) => (
                        <div key={i} className="truncate">
                          出典:{" "}
                          <a
                            className="underline"
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.title}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
              <details className="flex-1">
                <summary className="cursor-pointer select-none text-[12px] text-gray-700">
                  推奨レシピ・相性の例
                </summary>
                <div className="pt-1.5">
                  <DripperExplainer name={d.name} bean={bean} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
export default DripForm;
