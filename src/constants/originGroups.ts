// src/constants/originGroups.ts
export const STAR_SECTIONS = ['⭐️アフリカ','⭐️中米','⭐️南米','⭐️アジア'] as const

export const STAR_GROUPS: Record<(typeof STAR_SECTIONS)[number], string[]> = {
  '⭐️アフリカ': [
    'エチオピア','イエメン（モカ・マタリ）','ケニア','ブルンジ','タンザニア（キリマンジャロ）','ルワンダ',
    'ウガンダ','コンゴ民主共和国','カメルーン','コートジボワール','マラウイ','ジンバブエ','エスワティニ','南アフリカ'
  ],
  '⭐️中米': [
    'アメリカ（ハワイアン・コナ）','キューバ','ジャマイカ（ブルーマウンテン）','ドミニカ共和国','ハイチ','プエルトリコ',
    'メキシコ','グアテマラ','ホンジュラス','エルサルバドル','ニカラグア','コスタリカ','パナマ'
  ],
  '⭐️南米': [
    'コロンビア','エクアドル','ブラジル','ボリビア','ペルー','ベネズエラ'
  ],
  '⭐️アジア': [
    'インドネシア','ベトナム','インド','タイ','ラオス','ミャンマー','パプアニューギニア','東ティモール',
    'フィリピン','中国','ネパール','カンボジア','ソロモン諸島'
  ],
}

export const ORIGIN_TO_STAR: Record<string, (typeof STAR_SECTIONS)[number]> = (() => {
  const map: Record<string, (typeof STAR_SECTIONS)[number]> = {}
  for (const star of STAR_SECTIONS) {
    for (const o of STAR_GROUPS[star]) map[o] = star
  }
  return map
})()
