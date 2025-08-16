// utils/dripperRecommend.ts
export type DripperName =
  | 'ハリオ' | 'フラワー' | 'クリスタル' | 'コーノ'
  | 'カリタウェーブ' | 'ブルーボトル'
  | 'クレバー' | 'ハリオスイッチ'
  | 'フレンチプレス' | 'ネル'
  | 'エアロプレス'
  | 'サイフォン'
  | 'モカポット' | 'エスプレッソ'
  | 'フィン' | '水出し';

export type DripperClass =
  | 'conical_fast' | 'conical_restrict' | 'flat'
  | 'immersion_switch' | 'press' | 'aero'
  | 'siphon' | 'moka' | 'espresso' | 'other';

export const DRIPPER_CLASS: Record<DripperName, DripperClass> = {
  ハリオ: 'conical_fast',
  フラワー: 'conical_fast',
  クリスタル: 'conical_fast',
  コーノ: 'conical_restrict',
  カリタウェーブ: 'flat',
  ブルーボトル: 'flat',
  クレバー: 'immersion_switch',
  ハリオスイッチ: 'immersion_switch',
  フレンチプレス: 'press',
  ネル: 'press',
  エアロプレス: 'aero',
  サイフォン: 'siphon',
  モカポット: 'moka',
  エスプレッソ: 'espresso',
  フィン: 'other',
  水出し: 'other',
};

export type BestMetric = 'overall'|'clean'|'flavor'|'acidity'|'bitterness'|'sweetness'|'body'|'aftertaste';

type BeanStatsByMethod = Array<{ dripper: DripperName; avg_overall: number }>;

export type RecommendInput = {
  roast_level?: string | null;
  process?: string | null;
  deriveTheoryDripper?: string | null; // 任意の文字列。含まれる名前やクラス判定で加点
  bestMetric: BestMetric;
  bestDrippersFromScopes: DripperName[]; // thisBean/sameRoast/originNearで使われたdripper
  byMethod?: BeanStatsByMethod; // beanStats.by_method
  allowNonDrip?: boolean; // trueならespresso等も対象。未指定はfalse
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const add = (m: Record<string, number>, k: string, v: number) => { m[k] = (m[k]||0) + v; };

/** 文字列がどのクラス/名前を示すかゆるく判定（例: "Hario" "V60" "ハリオ" -> conical_fast） */
const fuzzyTheoryTargets = (s?: string | null): {classes: DripperClass[], names: DripperName[]} => {
  if (!s) return { classes: [], names: [] };
  const txt = String(s).toLowerCase();

  const names: DripperName[] = [];
  const classes: DripperClass[] = [];

  const match = (kw: string) => txt.includes(kw);

  if (['v60','hario','ハリオ'].some(match)) { names.push('ハリオ'); classes.push('conical_fast'); }
  if (['flower','フラワー'].some(match)) { names.push('フラワー'); classes.push('conical_fast'); }
  if (['crystal','クリスタル'].some(match)) { names.push('クリスタル'); classes.push('conical_fast'); }
  if (['kono','コーノ'].some(match)) { names.push('コーノ'); classes.push('conical_restrict'); }
  if (['kalita','ウェーブ','カリタ'].some(match)) { names.push('カリタウェーブ'); classes.push('flat'); }
  if (['bluebottle','ブルーボトル'].some(match)) { names.push('ブルーボトル'); classes.push('flat'); }
  if (['clever','クレバー'].some(match)) { names.push('クレバー'); classes.push('immersion_switch'); }
  if (['switch','スイッチ','ハリオスイッチ'].some(match)) { names.push('ハリオスイッチ'); classes.push('immersion_switch'); }

  return { classes: Array.from(new Set(classes)), names: Array.from(new Set(names)) };
};

export type RecommendResult = {
  primary: DripperName;
  ranked: Array<{ name: DripperName; score: number }>;
  explain: string; // スコア内訳
};

export function recommendDripper(input: RecommendInput): RecommendResult {
  const {
    roast_level, process, deriveTheoryDripper,
    bestMetric, bestDrippersFromScopes,
    byMethod, allowNonDrip=false
  } = input;

  // スコアテーブル（名前ベースで集計）
  const score: Record<DripperName, number> = {} as any;

  // 0) 候補の制約（通常はドリップ系のみ）
  const allNames = Object.keys(DRIPPER_CLASS) as DripperName[];
  const candidates = allNames.filter(n => {
    const cls = DRIPPER_CLASS[n];
    if (allowNonDrip) return true;
    return !['espresso','moka','other'].includes(cls); // 通常は除外
  });

  // 1) 経験：by_method（0.50）
  const W_EMP = 0.50;
  if (byMethod && byMethod.length) {
    for (const row of byMethod) {
      if (!candidates.includes(row.dripper)) continue;
      const emp = clamp01((Number(row.avg_overall)||0)/10);
      add(score, row.dripper, W_EMP * emp);
    }
  }

  // 2) 派生理論（0.20）
  const W_THEORY = 0.20;
  if (deriveTheoryDripper) {
    const { names, classes } = fuzzyTheoryTargets(deriveTheoryDripper);
    // 名前一致は強め、クラス一致は弱めに配点
    for (const nm of names) if (candidates.includes(nm)) add(score, nm, W_THEORY * 0.8);
    for (const nm of candidates) {
      if (classes.includes(DRIPPER_CLASS[nm])) add(score, nm, W_THEORY * 0.2);
    }
  }

  // 3) 焙煎度ルール（0.10）
  const W_ROAST = 0.10;
  const roast = String(roast_level||'').trim();
  const addByClass = (cls: DripperClass, w: number) => {
    for (const nm of candidates) if (DRIPPER_CLASS[nm]===cls) add(score, nm, w);
  };
  if (roast) {
    if (/ライト|ハイ|ライトロースト|high|light/i.test(roast)) {
      addByClass('conical_fast', W_ROAST);
      addByClass('flat', W_ROAST*0.5);
    } else if (/シティ|フルシティ|city/i.test(roast)) {
      addByClass('flat', W_ROAST);
      addByClass('conical_restrict', W_ROAST*0.5);
    } else if (/フレンチ|イタリアン|dark|french|italian/i.test(roast)) {
      addByClass('press', W_ROAST);
      addByClass('immersion_switch', W_ROAST*0.5);
    }
  }

  // 4) 精製ルール（0.10）
  const W_PROC = 0.10;
  const proc = String(process||'').toLowerCase();
  if (proc) {
    if (/(wash|ウォッシュ|水洗)/.test(proc)) {
      addByClass('conical_fast', W_PROC);
    } else if (/(natural|ナチュ|honey|ハニー)/.test(proc)) {
      addByClass('flat', W_PROC*0.5);
      addByClass('conical_restrict', W_PROC*0.5);
    } else if (/(anaerobic|アナエロ|発酵)/.test(proc)) {
      addByClass('flat', W_PROC*0.7);
      addByClass('immersion_switch', W_PROC*0.3);
    }
  }

  // 5) 指標重み（0.05）
  const W_METRIC = 0.05;
  switch (bestMetric) {
    case 'clean':
      addByClass('conical_fast', W_METRIC);
      break;
    case 'flavor':
      addByClass('conical_restrict', W_METRIC*0.6);
      addByClass('flat', W_METRIC*0.4);
      break;
    case 'body':
      addByClass('press', W_METRIC);
      break;
    default:
      // overall/その他は経験重視で配点なし
      break;
  }

  // 6) ベスト実績（最大0.05）
  const W_BEST_MAX = 0.05;
  if (bestDrippersFromScopes?.length) {
    const uniq = Array.from(new Set(bestDrippersFromScopes.filter(n=>candidates.includes(n))));
    const per = Math.min(uniq.length, 3) ? (W_BEST_MAX/Math.min(uniq.length,3)) : 0;
    for (const nm of uniq.slice(0,3)) add(score, nm, per);
  }

  // ランキング
  const ranked = candidates
    .map(nm => ({ name: nm, score: Number(score[nm]||0) }))
    .sort((a,b)=> b.score - a.score);

  const primary = ranked[0]?.name || (candidates[0] as DripperName);

  // 簡易の説明を文字化
  const explain =
    `経験:${W_EMP} 理論:${W_THEORY} 焙煎:${W_ROAST} 精製:${W_PROC} 指標:${W_METRIC} ベスト:${W_BEST_MAX}\n` +
    ranked.slice(0,5).map(r=>`- ${r.name}: ${r.score.toFixed(3)}`).join('\n');

  return { primary, ranked, explain };
}
