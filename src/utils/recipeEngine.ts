// utils/recipeEngine.ts
export type GrindGroup = '粗'|'中粗'|'中'|'中細'|'細'|'極細';
export type PourStyle = 'pulse'|'continuous'|'immersion'|'switch';
export type Evidence = { id:string; title:string; url?:string };

export type Recipe = {
  grindGroup: GrindGroup;
  tempC: number;
  timeSec: number;
  ratio: number;               // water/dose
  pour: { style: PourStyle; bloomSec?: number; pulses?: number; notes?: string[] };
  agitation: 'none'|'light'|'medium';
};

export type RuleTrace = {
  id: string;
  label: string;               // 何を根拠にどう動かしたか
  delta: Partial<Pick<Recipe,'tempC'|'timeSec'|'ratio'>> & { grindShift?: -2|-1|0|1|2; pourNote?: string };
  weight: number;              // 0..2（合成時に減衰）
  evidenceIds?: string[];
  confidence: 'high'|'mid'|'low';
};

export type Ctx = {
  dripper: string;
  roast: string;
  process: string;     // + addl_process を含めた生文字列でもOK
  origin: string;
  agingDays?: number|null;
  storage?: '🧊冷凍'|'常温'|string;
  base: Recipe;        // DRIPPER_KNOWHOW × recommendForDrip のマージ
};

// ---- ルール定義（例：必要に応じて増やす） ----
const RULES: RuleTrace[] & { applies?:(c:Ctx)=>boolean; apply?:(r:Recipe,c:Ctx)=>RuleTrace }[] = [
  {
    id: 'light-washed-aroma',
    label: '浅〜中浅 × ウォッシュト × 香り系産地 → クリア重視',
    delta: { tempC: +1.5, timeSec: -15, ratio: +0.2, grindShift: +1, pourNote: '細かめパルス/早止め' },
    weight: 1.4, confidence: 'mid', evidenceIds: ['sca-temp','v60-manual'],
    applies(c:Ctx){
      const light = /(ライト|シナモン|ミディアム|ハイ)/.test(c.roast);
      const washed= /(wash|ウォッシュ)/i.test(c.process);
      const aroma = /(エチオピア|ケニア|ルワンダ|ブルンジ|パナマ|グアテマラ)/.test(c.origin);
      return light && washed && aroma && /ハリオ|フラワー|カリタ|クリスタル|ブルーボトル/.test(c.dripper);
    },
    apply(r:Recipe,c:Ctx){
      return { ...this, delta: this.delta };
    }
  },
  {
    id: 'natural-ferment-body',
    label: 'ナチュラル/発酵系 → 甘み/ボディ寄せ・過抽出は回避',
    delta: { tempC: -1, timeSec: +20, ratio: -0.2, grindShift: -1, pourNote: '攪拌弱/いじり過ぎない' },
    weight: 1.6, confidence: 'mid', evidenceIds: ['clever-guide','immersion-general'],
    applies(c){ return /(natural|ナチュラル|発酵|carbonic|anaerobic|yeast)/i.test(c.process); },
    apply(r,c){ return { ...this, delta: this.delta }; }
  },
  {
    id: 'dark-roast-softer',
    label: '深煎り → 温度を下げてえぐみ抑制・厚みは維持',
    delta: { tempC: -3, timeSec: -10, ratio: +0.1, pourNote: '攪拌控えめ' },
    weight: 1.4, confidence: 'high', evidenceIds: ['sca-temp','flat-bottom-guides'],
    applies(c){ return /(フルシティ|フレンチ|イタリアン)/.test(c.roast); },
    apply(r,c){ return { ...this, delta: this.delta }; }
  },
  {
    id: 'aging-fresh',
    label: '焙煎後0–3日 → ブルーム延長＋やや高温',
    delta: { tempC: +1, timeSec: +10, pourNote: 'bloom長め（~45s）' },
    weight: 0.9, confidence: 'mid', evidenceIds: ['degassing-ref'],
    applies(c){ return (c.agingDays ?? 99) <= 3 && /透過|ハリオ|フラワー|カリタ|クリスタル|ブルーボトル|コーノ/.test(c.dripper); },
    apply(r,c){ return { ...this, delta: this.delta }; }
  },
  {
    id: 'aging-old',
    label: '焙煎後>25日 → わずかに細挽き/高温寄せ',
    delta: { tempC: +1, grindShift: +1 },
    weight: 0.8, confidence: 'low', evidenceIds: ['degassing-ref'],
    applies(c){ return (c.agingDays ?? 0) > 25; },
    apply(r,c){ return { ...this, delta: this.delta }; }
  },
  // ...必要に応じて追加
];

// ---- 出典レジストリ（既存 DRIPPER_EVIDENCE に併置/統合OK） ----
export const EVIDENCE: Record<string, Evidence> = {
  'sca-temp':       { id:'sca-temp', title:'SCA 抽出温度/比率レンジ' },
  'v60-manual':     { id:'v60-manual', title:'Hario V60 Brew Guide' },
  'clever-guide':   { id:'clever-guide', title:'Clever Dripper (浸漬+ドリップ) ガイド' },
  'immersion-general': { id:'immersion-general', title:'浸漬抽出の一般的傾向' },
  'flat-bottom-guides': { id:'flat-bottom-guides', title:'平底ドリッパー抽出の傾向' },
  'degassing-ref':  { id:'degassing-ref', title:'焙煎後の脱ガスと抽出への影響' },
};

// ---- 合成器 ----
const clamp = (x:number, lo:number, hi:number)=> Math.max(lo, Math.min(hi, x));

const DRIPPER_LIMITS: Record<string, { temp:[number,number]; time:[number,number]; ratio:[number,number] }> = {
  'ハリオ':        { temp:[78,93],   time:[100, 190], ratio:[14,17] },
  'フラワー':      { temp:[78,93],   time:[110, 200], ratio:[14,17] },
  'カリタウェーブ':{ temp:[76,91],   time:[130, 210], ratio:[14,17] },
  'クリスタル':    { temp:[78,92],   time:[90,  180], ratio:[14,17] },
  'コーノ':        { temp:[76,90],   time:[120, 210], ratio:[14,17] },
  'クレバー':      { temp:[78,90],   time:[150, 240], ratio:[14,16] },
  'ハリオスイッチ':{ temp:[78,90],   time:[120, 200], ratio:[14,16] },
  // ...その他
};

export function deriveOptimalRecipe(ctx: Ctx){
  const limits = DRIPPER_LIMITS[ctx.dripper] || { temp:[75,93], time:[80,240], ratio:[13,18] };
  const trace: RuleTrace[] = [];

  // 1) ベース
  const out: Recipe = JSON.parse(JSON.stringify(ctx.base));

  // 2) 適用
  const matched = RULES.filter((r:any)=> r.applies?.(ctx));
  // 減衰合成（重複カテゴリを想定→単純合成+clampでもOK）
  for(const r of matched){
    const t = (r as any).apply?.(out, ctx) as RuleTrace;
    if(!t) continue;
    // grind
    if(typeof t.delta.grindShift === 'number'){
      const order:GrindGroup[] = ['粗','中粗','中','中細','細','極細'];
      const i = Math.max(0, Math.min(order.length-1, order.indexOf(out.grindGroup) + t.delta.grindShift));
      out.grindGroup = order[i];
    }
    // temp/time/ratio
    if(typeof t.delta.tempC === 'number')   out.tempC  = clamp(out.tempC  + t.delta.tempC,  limits.temp[0],  limits.temp[1]);
    if(typeof t.delta.timeSec === 'number') out.timeSec= clamp(out.timeSec+ t.delta.timeSec,limits.time[0],  limits.time[1]);
    if(typeof t.delta.ratio === 'number')   out.ratio  = clamp(out.ratio  + t.delta.ratio,  limits.ratio[0], limits.ratio[1]);
    if(t.delta.pourNote) out.pour.notes = [...(out.pour.notes||[]), t.delta.pourNote];
    trace.push(t);
  }

  // 3) 仕上げ（pour/攪拌の整合）
  if(/クレバー|フレンチプレス|水出し/.test(ctx.dripper)){
    out.pour.style = 'immersion';
    out.agitation = 'none';
  } else if(/ハリオスイッチ/.test(ctx.dripper)){
    out.pour.style = 'switch';
  } else {
    out.pour.style = 'pulse';
  }

  // 4) 出力
  return { recipe: out, trace, evidence: trace.flatMap(t=> (t.evidenceIds||[])) };
}
