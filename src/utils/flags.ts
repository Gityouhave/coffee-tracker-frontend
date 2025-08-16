// src/utils/flags.ts
// 1) よく出る国名と地域の擬似フラグ（地域は地球絵文字）
const FLAG_MAP: Record<string,string> = {
  // 地域
  'アフリカ':'🌍','中米':'🌎','南米':'🌎','アジア':'🌏',
  // アメリカ大陸
  'アメリカ':'🇺🇸','米国':'🇺🇸','ハワイ':'🇺🇸',
  'コロンビア':'🇨🇴','ブラジル':'🇧🇷','グアテマラ':'🇬🇹','コスタリカ':'🇨🇷',
  'ホンジュラス':'🇭🇳','エルサルバドル':'🇸🇻','ニカラグア':'🇳🇮','パナマ':'🇵🇦',
  'メキシコ':'🇲🇽','ペルー':'🇵🇪','ボリビア':'🇧🇴','エクアドル':'🇪🇨',
  // アフリカ
  'エチオピア':'🇪🇹','ケニア':'🇰🇪','ルワンダ':'🇷🇼','ブルンジ':'🇧🇮',
  'ウガンダ':'🇺🇬','タンザニア':'🇹🇿','コンゴ民主共和国':'🇨🇩','コンゴDRC':'🇨🇩',
  'コートジボワール':'🇨🇮','コートジヴォワール':'🇨🇮',
  // アジア
  'イエメン':'🇾🇪','インドネシア':'🇮🇩','東ティモール':'🇹🇱','ベトナム':'🇻🇳',
  'インド':'🇮🇳','タイ':'🇹🇭','ラオス':'🇱🇦','ミャンマー':'🇲🇲',
  'フィリピン':'🇵🇭','中国':'🇨🇳','日本':'🇯🇵','ネパール':'🇳🇵',
};

const SPLITTER = /[,、／/]/g;

/** 入力文字列中に含まれる国/地域に対応するフラグ（部分一致OK） */
export const flagFor = (s: string): string => {
  const key = Object.keys(FLAG_MAP).find(k => s.includes(k));
  return key ? FLAG_MAP[key] : '';
};

/** 表示用に「🇨🇴コロンビア」みたいな形へ（ヒットしなければそのまま） */
export const flagify = (name: string) => `${flagFor(name)}${name}`;

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
