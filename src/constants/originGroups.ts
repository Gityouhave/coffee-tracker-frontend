// src/constants/originGroups.ts

/** UI表示順（要求仕様と同じ順序） */
export const STAR_SECTIONS = ['⭐️アフリカ','⭐️中米','⭐️南米','⭐️アジア'] as const

/** ⭐️大枠 → 小分類（UI表示用の並びも仕様準拠） */
export const STAR_GROUPS: Record<(typeof STAR_SECTIONS)[number], string[]> = {
  '⭐️アフリカ': [
    'エチオピア','イエメン（モカ・マタリ）','ケニア','ブルンジ','タンザニア（キリマンジャロ）','ルワンダ'
  ],
  '⭐️中米': [
    'アメリカ（ハワイアン・コナ）','キューバ','ジャマイカ（ブルーマウンテン）','ドミニカ共和国',
    'メキシコ','グアテマラ','ホンジュラス','エルサルバドル','ニカラグア','コスタリカ','パナマ'
  ],
  '⭐️南米': [
    'コロンビア','エクアドル','ブラジル','ボリビア','ペルー'
  ],
  '⭐️アジア': [
    'インドネシア','ベトナム','インド','パプアニューギニア','東ティモール','中国','ミャンマー','タイ'
  ]
}

/** 産地 → ⭐️大枠（欠落抽出用） */
export const ORIGIN_TO_STAR: Record<string, (typeof STAR_SECTIONS)[number]> = (() => {
  const map: Record<string, (typeof STAR_SECTIONS)[number]> = {}
  for (const star of STAR_SECTIONS) {
    for (const o of STAR_GROUPS[star]) map[o] = star
  }
  return map
})()
