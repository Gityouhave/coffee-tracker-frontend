// src/utils/flags.ts
export const COUNTRY_FLAGS: Record<string,string> = {
  'コロンビア':'🇨🇴','ブラジル':'🇧🇷','エチオピア':'🇪🇹','ケニア':'🇰🇪','グアテマラ':'🇬🇹',
  'コスタリカ':'🇨🇷','ホンジュラス':'🇭🇳','エルサルバドル':'🇸🇻','ニカラグア':'🇳🇮','パナマ':'🇵🇦',
  'ペルー':'🇵🇪','ボリビア':'🇧🇴','メキシコ':'🇲🇽','ルワンダ':'🇷🇼','ブルンジ':'🇧🇮','タンザニア':'🇹🇿',
  'インドネシア':'🇮🇩','東ティモール':'🇹🇱','イエメン':'🇾🇪','中国':'🇨🇳','日本':'🇯🇵','ベトナム':'🇻🇳',
  'インド':'🇮🇳','タイ':'🇹🇭','ラオス':'🇱🇦','ミャンマー':'🇲🇲','フィリピン':'🇵🇭','ネパール':'🇳🇵',
  'ウガンダ':'🇺🇬','コンゴ民主共和国':'🇨🇩','タンザニア':'🇹🇿','エクアドル':'🇪🇨','ボリビア':'🇧🇴',
} as const;

export const flagify = (name: string) =>
  (COUNTRY_FLAGS[name] || '') + name;

/** "国, 国, ... / 地域" などの文字列を国旗付きで表示用に整形 */
export const flagifyOriginList = (origins?: string | null) => {
  if (!origins) return '—';
  return String(origins)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(flagify)
    .join('、');
};
