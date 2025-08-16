// src/utils/flags.ts
// ✅ APIは現状維持（既存呼び出しはそのまま動く）

// 1) 国・地域 → フラグ
const FLAG_MAP: Record<string, string> = {
  // 地域（擬似フラグ）
  'アフリカ':'🌍', '中米':'🌎', '南米':'🌎', 'アジア':'🌏',

  // アメリカ大陸
  'アメリカ':'🇺🇸', 'コロンビア':'🇨🇴', 'ブラジル':'🇧🇷', 'グアテマラ':'🇬🇹', 'コスタリカ':'🇨🇷',
  'ホンジュラス':'🇭🇳','エルサルバドル':'🇸🇻','ニカラグア':'🇳🇮','パナマ':'🇵🇦',
  'メキシコ':'🇲🇽','ペルー':'🇵🇪','ボリビア':'🇧🇴','エクアドル':'🇪🇨',
  'ジャマイカ':'🇯🇲','キューバ':'🇨🇺','ドミニカ共和国':'🇩🇴','ハイチ':'🇭🇹',

  // アフリカ
  'エチオピア':'🇪🇹','ケニア':'🇰🇪','ルワンダ':'🇷🇼','ブルンジ':'🇧🇮',
  'ウガンダ':'🇺🇬','タンザニア':'🇹🇿','コンゴ民主共和国':'🇨🇩',
  'コートジボワール':'🇨🇮','コートジヴォワール':'🇨🇮','南アフリカ':'🇿🇦',

  // アジア
  'イエメン':'🇾🇪','インドネシア':'🇮🇩','東ティモール':'🇹🇱','ベトナム':'🇻🇳',
  'インド':'🇮🇳','タイ':'🇹🇭','ラオス':'🇱🇦','ミャンマー':'🇲🇲',
  'フィリピン':'🇵🇭','中国':'🇨🇳','日本':'🇯🇵','ネパール':'🇳🇵',
  'パプアニューギニア':'🇵🇬','ソロモン諸島':'🇸🇧',
};

// 2) 表記ゆれ/別名 → 正式名
const ALIASES: Record<string, string> = {
  // アメリカ
  '米国':'アメリカ','アメリカ合衆国':'アメリカ','USA':'アメリカ','U.S.':'アメリカ','ハワイ':'アメリカ',
  'アメリカ（ハワイアン・コナ）':'アメリカ','ハワイアン・コナ':'アメリカ',

  // DRC
  'DRコンゴ':'コンゴ民主共和国','コンゴDRC':'コンゴ民主共和国','Congo (DRC)':'コンゴ民主共和国','DRC':'コンゴ民主共和国',

  // 東ティモール
  'Timor-Leste':'東ティモール','東ティモール民主共和国':'東ティモール',

  // タンザニア/ジャマイカ（括弧付き表記）
  'タンザニア（キリマンジャロ）':'タンザニア','ジャマイカ（ブルーマウンテン）':'ジャマイカ',
};

// 3) 区切り文字
const SPLITTER = /[,、／/]/g;

// 4) すでにフラグが付いているか判定（重複防止）
const startsWithFlag = (s: string) => /\p{RI}\p{RI}/u.test(s) || /^🌍|🌎|🌏/.test(s);

// 5) 正規化：括弧内除去 → 記号区切りの左側 → トリム → 別名解決
const normalize = (raw: string) => {
  let s = String(raw || '').trim();
  // 括弧（全角/半角）内を削除
  s = s.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim();
  // 連結記号の左側を優先
  s = s.split(/[・\/]/)[0].trim();
  // 別名解決（完全一致のみ）
  if (ALIASES[s]) s = ALIASES[s];
  return s;
};

/** 入力文字列中に含まれる国/地域に対応するフラグ（部分一致OK） */
export const flagFor = (s: string): string => {
  if (!s) return '';
  if (startsWithFlag(s)) return ''; // 既に旗がある表示は重ねない

  const base = normalize(s);

  // まずは完全一致
  if (FLAG_MAP[base]) return FLAG_MAP[base];

  // 完全一致で見つからない場合は「含む」マッチ（例：”タンザニア・キリマンジャロ”）
  const hit = Object.keys(FLAG_MAP).find(k => base.includes(k));
  return hit ? FLAG_MAP[hit] : '';
};

/** 表示用に「🇨🇴コロンビア」みたいな形へ（ヒットしなければそのまま） */
export const flagify = (name: string) => {
  if (!name) return '';
  if (startsWithFlag(name)) return name;
  const f = flagFor(name);
  return f ? `${f}${name}` : name; // ←従来仕様：スペースなしの連結を維持
};

/** "国, 国／地域" 等の複合文字列を国旗付きで整形 */
export const flagifyOriginList = (origins?: string | null) => {
  if (!origins) return '—';
  return String(origins)
    .split(SPLITTER)
    .map(s => s.trim())
    .filter(Boolean)
    .map(flagify)
    .join('、');
};

/** "コロンビア, ブラジル" → ["コロンビア","ブラジル"] */
export const splitOrigins = (origins?: string | null) => {
  if (!origins) return [];
  return String(origins)
    .split(SPLITTER)
    .map(s => s.trim())
    .filter(Boolean);
};

// --- 既存の追記APIもそのまま残す ---
/** "コロンビア, ブラジル" → "🇨🇴コロンビア, 🇧🇷ブラジル" */
export function flagifyOriginLine(line?: string | null): string {
  if (!line) return '';
  return String(line)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(flagify)
    .join(', ');
}

/** ["コロンビア","ブラジル"] → "🇨🇴コロンビア, 🇧🇷ブラジル" */
export function flagifyJoin(origins: string[]): string {
  return (origins || []).map(flagify).join(', ');
}
