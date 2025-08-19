// src/logic/recipeEngine.ts
import { DRIPPER_PROFILE } from '@/constants/drippers';
import { ORIGINS_META, type RoastBand, type Process } from '@/constants/origins';

type Conditions = { origin?: string; roast?: RoastBand; process?: Process; agingDays?: number };
type ScoreLine = { label: string; sign: '+'|'-' };
export function recommendTop5ByConditions(
  /* beanId */ _a: any,
  /* history */ _b: any,
  cond: Conditions,
  _policy: 'overall'|'clarity'|'body' = 'overall'
){
  // 超簡易: 産地メタと器具プロファイルの相性をざっくりスコア
  const origin = cond.origin && ORIGINS_META[cond.origin];
  const candidates = Object.entries(DRIPPER_PROFILE);
  const scored = candidates.map(([name, p])=>{
    let score = 50;

    // 焙煎×器具の相性（例: 浸漬は中深〜深で加点、クリア系は浅で加点）
    if (cond.roast === '浅' || cond.roast === '中浅') score += Math.round(p.clarity*20 - p.immersion*10);
    if (cond.roast === '中深' || cond.roast === '深') score += Math.round(p.immersion*25 + p.body*10);

    // 産地が高香り系なら clarity を少し重視
    if (origin?.baseline.aroma === '強') score += Math.round(p.clarity*10);

    // aging（焙煎後日数）が長いほど immersion 寄りを少し加点
    if (typeof cond.agingDays === 'number') score += Math.round(Math.min(cond.agingDays,14)/14 * p.immersion * 10);

    const reasons2: ScoreLine[] = [];
    if ((cond.roast==='浅'||cond.roast==='中浅') && p.clarity>0.7) reasons2.push({label:'浅煎り×透明感', sign:'+'});
    if ((cond.roast==='中深'||cond.roast==='深') && p.immersion>0.6) reasons2.push({label:'深煎り×浸漬/ボディ', sign:'+'});
    if (origin?.baseline.aroma==='強' && p.clarity<0.5) reasons2.push({label:'香り重視だがクリーン不足', sign:'-'});

    const short = `clarity:${p.clarity.toFixed(2)} / body:${p.body.toFixed(2)} / immersion:${p.immersion.toFixed(2)}`;
    const metaReasons = origin ? [`${cond.origin}は${origin.baseline.notes.slice(0,2).join('・')}が出やすい`] : [];

    return { name, score, short, reasons2, metaReasons };
  });

  return scored.sort((a,b)=>b.score-a.score).slice(0,5);
}

export type BeanLike = {
  origin?: string;           // "エチオピア, ケニア" など複数可
  roast_level?: string;      // ライト/シナモン/…/イタリアン
  process?: string;          // ウォッシュト/ナチュラル/ハニー/発酵系語彙などを含む自由文
  addl_process?: string;     // 追加処理（アナエロ/カーボニック/イースト など）
  roast_date?: string|null;  // yyyy-mm-dd（なくてもOK）
  purchase_date?: string|null;
  roasted_on?: string|null;
  purchased_on?: string|null;
  name?: string;
};

export type OptimizedRecipe = {
  dripper: string;
  grindGroup: '粗'|'中粗'|'中'|'中細'|'細'|'極細';
  tempC?: number;         // 推奨湯温
  timeSec?: number;       // 推奨時間（秒）
  ratioHint?: string;     // 例: "1:15"
  pour?: string;          // 注湯要点
  trace: string[];        // 根拠の箇条書き
  confidence: number;     // 0..1
};

// --- 基本テーブル（DripForm側と独立して持つ簡易版） ---
const ROAST_TEMP: Record<string, number> = {
  'ライト': 92.5, 'シナモン': 90.0, 'ミディアム': 87.5, 'ハイ': 85.0,
  'シティ': 82.5, 'フルシティ': 80.0, 'フレンチ': 77.5, 'イタリアン': 75.0
};
const GRIND_TIME: Record<OptimizedRecipe['grindGroup'], number> = {
  '粗': 210, '中粗': 180, '中': 120, '中細': 90, '細': 60, '極細': 40
};

const DRIPPER_RUNTIME: Record<string, { timeFactor?: number; tempOffset?: number }> = {
  'カリタウェーブ': { timeFactor: 1.10, tempOffset: -1 },
  'クリスタル':     { timeFactor: 0.90, tempOffset: -1 },
  'フレンチプレス': { timeFactor: 1.20, tempOffset: -2 },
  'ネル':           { timeFactor: 1.15, tempOffset: -2 },
  'ハリオ':         { timeFactor: 1.00, tempOffset:  0 },
  'フラワー':       { timeFactor: 1.00, tempOffset:  0 },
  'コーノ':         { timeFactor: 1.05, tempOffset: -1 },
  'クレバー':       { timeFactor: 0.90, tempOffset: -1 },
  'エアロプレス':   { timeFactor: 0.75, tempOffset: -0.5 },
  '水出し':         { timeFactor: 8*60, tempOffset: -99 }, // 実質無視
};

const DRIPPER_DEFAULT: Record<string, { grindGroup: OptimizedRecipe['grindGroup']; ratioHint?: string; pour?: string }> = {
  'ハリオ':         { grindGroup: '中細', ratioHint: '1:15〜1:16', pour: 'センター主体→細かめパルス' },
  'フラワー':       { grindGroup: '中細', ratioHint: '1:15.5',     pour: '中心やや外→薄く広く' },
  'カリタウェーブ': { grindGroup: '中',   ratioHint: '1:15〜1:16', pour: '3投・湯面フラット維持' },
  'コーノ':         { grindGroup: '中',   ratioHint: '1:15',       pour: '序盤浸漬寄り→後半細口' },
  'クリスタル':     { grindGroup: '中細', ratioHint: '1:15.5',     pour: '薄く速く・湯止め早め' },
  'ブルーボトル':   { grindGroup: '中細', ratioHint: '1:15.5',     pour: '中心主体でスッと落とす' },
  'クレバー':       { grindGroup: '中粗', ratioHint: '1:15',       pour: '全量浸漬→ドロー' },
  'ハリオスイッチ': { grindGroup: '中',   ratioHint: '1:15',       pour: '浸漬1:00→開放' },
  'フレンチプレス': { grindGroup: '粗',   ratioHint: '1:14',       pour: '全量注湯・攪拌控えめ' },
  'ネル':           { grindGroup: '中粗', ratioHint: '1:14',       pour: '低速で面を作る' },
  'エアロプレス':   { grindGroup: '中',   ratioHint: '1:12〜1:15', pour: 'インバート推奨・軽く攪拌' },
  '水出し':         { grindGroup: '中粗', ratioHint: '1:10〜1:12', pour: '浸漬(冷蔵)' },
  'サイフォン':     { grindGroup: '中',   ratioHint: '1:15',       pour: '攪拌少なめ' },
  'フィン':         { grindGroup: '中',   ratioHint: '1:12〜1:14', pour: '滴下＝詰めすぎ注意' },
  'モカポット':     { grindGroup: '細',   ratioHint: '—',          pour: '弱火でゆっくり' },
  'エスプレッソ':   { grindGroup: '極細', ratioHint: '1:2',        pour: '約9bar' },
};

const aromaOrigin = /(エチオピア|ケニア|ルワンダ|ブルンジ|パナマ|コロンビア|グアテマラ|ボリビア|タンザニア|DRコンゴ)/;
const heavyOrigin = /(インドネシア|スマトラ|マンデリン|ブラジル|ウガンダ|インド|ベトナム|ラオス)/;

const clamp = (x:number, lo:number, hi:number)=> Math.max(lo, Math.min(hi, x));
const daysBetween = (from?: string|null, to?: string|null) => {
  if (!from || !to) return null;
  const a = new Date(from+'T00:00:00'), b = new Date(to+'T00:00:00');
  return Math.floor((b.getTime()-a.getTime())/(1000*60*60*24));
};

export function getOptimizedRecipe(
  bean: BeanLike|undefined|null,
  dripper: string,
  opts?: { brewDate?: string }
): OptimizedRecipe {
  const trace: string[] = [];
  const base = DRIPPER_DEFAULT[dripper] || { grindGroup: '中' as const };

  // 1) 焙煎度ベース温度
  const roast = String(bean?.roast_level||'');
  let temp = ROAST_TEMP[roast] ?? 82.5;
  trace.push(`焙煎度ベース温度＝${temp}℃（表の既定）`);

  // 2) 器具ランタイム補正（温度・時間係数）
  const rt = DRIPPER_RUNTIME[dripper] || {};
  if (Number.isFinite(rt.tempOffset)) {
    temp += rt.tempOffset!;
    if (rt.tempOffset! !== 0) trace.push(`器具特性で温度 ${rt.tempOffset!>0?'+':''}${rt.tempOffset}℃`);
  }

  // 3) 初期時間＝粒度グループ既定秒 × 器具係数
  let grindGroup = base.grindGroup;
  let timeSec = Math.round((GRIND_TIME[grindGroup] ?? 120) * (rt.timeFactor ?? 1));
  trace.push(`器具×粒度の所要時間目安＝${timeSec}秒`);

  // 4) 精製/追加処理補正
  const procSrc = `${bean?.process||''} ${bean?.addl_process||''}`.toLowerCase();
  const isNatural  = /(natural|ナチュラル)/.test(procSrc);
  const isHoney    = /(honey|ハニー)/.test(procSrc);
  const isWashed   = /(wash|ウォッシュ)/.test(procSrc);
  const isFerment  = /(anaer|carbonic|酵|発酵|yeast|macera)/.test(procSrc);

  if (isNatural || isFerment) {
    temp -= 0.5;                    // 発酵・果実味を荒立てない
    timeSec = Math.round(timeSec * 1.05);
    trace.push('精製=ナチュラル/発酵系 → 温度-0.5℃・時間+5%（角を取る保守設定）');
    if (dripper==='クレバー' || dripper==='ハリオスイッチ' || dripper==='フレンチプレス' || dripper==='ネル') {
      timeSec = Math.round(timeSec * 1.05);
      trace.push(`浸漬寄り器具で甘み/ボディを伸ばす → さらに+5%`);
    }
  }
  if (isWashed || aromaOrigin.test(String(bean?.origin||''))) {
    temp += 0.5; // 透明感・立ち上がりを確保
    trace.push('ウォッシュト/高香り産地 → 温度+0.5℃（輪郭と香りを出す）');
  }
  if (isHoney) {
    timeSec = Math.round(timeSec * 1.05);
    trace.push('ハニー → 粘性を活かすため時間+5%');
  }

  // 5) 産地質量感の補正
  const ori = String(bean?.origin||'');
  if (heavyOrigin.test(ori)) {
    // クリア器具なら温度少し下げて時間を気持ち伸ばす
    if (/(ハリオ|フラワー|クリスタル|ブルーボトル)/.test(dripper)) {
      temp -= 0.5; timeSec = Math.round(timeSec * 1.05);
      trace.push('重厚産地×クリア系器具 → 温度-0.5℃・時間+5%（薄さ回避）');
    }
  }

  // 6) エイジング補正（焙煎日→抽出日）
  let agingDays: number|null = null;
  const roastDate = bean?.roast_date || bean?.roasted_on || bean?.purchase_date || bean?.purchased_on || null;
  if (roastDate && opts?.brewDate) {
    agingDays = daysBetween(roastDate, opts.brewDate);
    if (agingDays!=null) {
      if (agingDays <= 3) { temp -= 0.5; timeSec = Math.round(timeSec * 1.05); trace.push(`焙煎${agingDays}日 → ガス多め想定：温度-0.5℃・時間+5%`); }
      else if (agingDays >= 30) { temp += 1.0; timeSec = Math.round(timeSec * 0.95); trace.push(`焙煎${agingDays}日 → 抽出性低下：温度+1℃・時間-5%`); }
      else trace.push(`焙煎${agingDays}日 → 補正なし`);
    }
  }

  // 7) 器具の方向性を微調整
  if (/(クリスタル|ハリオ|フラワー|ブルーボトル)/.test(dripper) && isNatural) {
    // 明瞭さを損なわず丸める
    temp -= 0.3; trace.push('クリア系器具×ナチュラル → 温度-0.3℃（過剰な尖りを抑制）');
  }
  if (/(ネル|フレンチプレス)/.test(dripper) && (isWashed || aromaOrigin.test(ori))) {
    // クリーンさ重視ならわずかに温度↑/時間↓
    temp += 0.5; timeSec = Math.round(timeSec * 0.95);
    trace.push('厚み系器具×高香り豆 → 温度+0.5℃・時間-5%（もたつき回避）');
  }

  temp = Math.round(temp*10)/10;
  // timeSec は下限40秒（極端に短いのを回避）
  timeSec = clamp(timeSec, 40, 60*60*12);

  const out: OptimizedRecipe = {
    dripper,
    grindGroup,
    tempC: temp,
    timeSec,
    ratioHint: DRIPPER_DEFAULT[dripper]?.ratioHint,
    pour: DRIPPER_DEFAULT[dripper]?.pour,
    trace,
    confidence: 0.72 // 初期は保守的に
  };
  return out;
}
