// constants/origins.ts
import type { DripperId } from './drippers'; // ← 相対に変更
export type RoastBand = '浅'|'中浅'|'中'|'中深'|'深';
export type Process = 'ウォッシュト'|'ナチュラル'|'ハニー'|'ウェットハル'|'発酵系'|'ウェットハル';

export type OriginProfile = {
  region: 'アフリカ'|'中米'|'南米'|'アジア';
  baseline: {
    acidity: '弱'|'中'|'強';
    aroma: '弱'|'中'|'強';
    body: '軽'|'中'|'重';
    notes: string[]; // 代表テイスト
  };
  variants: Array<{
    roast: RoastBand;
    process: Process;
    notes: string[]; // その組み合わせの典型ノート
    tips?: string[]; // 焙煎/レシピの注意
  }>;
  recommended: Array<{
    dripper: DripperId;
    why: string;      // 理由（産地×焙煎×精製と結び付けた説明）
    bestFor: RoastBand[];     // この範囲で特に効く
    processFit?: Process[];   // 相性の良い精製
  }>;
  sources: Array<{title:string; url:string}>; // 根拠リンク
};

// 例：最初は 3〜5産地だけ seed して増やす
export const ORIGINS_META: Record<string, OriginProfile> = {
  エチオピア: {
    region: 'アフリカ',
    baseline: { acidity:'強', aroma:'強', body:'軽', notes:['ジャスミン','シトラス','白い花','紅茶様'] },
    variants: [
      { roast:'浅', process:'ウォッシュト', notes:['ライム','ベルガモット','白花'], tips:['湯温は高めでもOK','細め〜中細'] },
      { roast:'浅', process:'ナチュラル', notes:['ベリー','トロピカル'], tips:['香り優先で速めの流速'] },
      { roast:'中浅', process:'ハニー', notes:['明るい甘み','紅茶様'], tips:['過抽出で渋み出やすい']}],
    recommended: [
      { dripper:'フラワー', why:'通気性が高くガス抜け良好→アロマが立つ。浅〜中浅で華やかが生きる。', bestFor:['浅','中浅'], processFit:['ウォッシュト','ナチュラル'] },
      { dripper:'ハリオ',   why:'注湯制御で輪郭とクリーンさを作りやすい。', bestFor:['浅','中浅'], processFit:['ウォッシュト'] },
      { dripper:'クリスタル', why:'微粉干渉を抑え透明感を最大化。繊細系で有利。', bestFor:['浅'], processFit:['ウォッシュト'] },
      { dripper:'カリタウェーブ', why:'平底で均一抽出→丸く整える。酸が強い豆のバランス取りに。', bestFor:['中浅','中'] },
      { dripper:'サイフォン', why:'香り×透明感の両立。エチオピアのアロマが映える。', bestFor:['浅','中浅'] },
    ],
    sources: [
      { title:'SCA Flavor Wheel / WCR Lexicon', url:'https://sca.coffee' },
      { title:'Kurasu – Pour-over drippers compared', url:'https://www.kurasu.kyoto/...'}
    ]
  },

  ブラジル: {
    region:'南米',
    baseline:{ acidity:'弱', aroma:'中', body:'重', notes:['ナッツ','ミルクチョコ','キャラメル'] },
    variants:[
      { roast:'中', process:'ナチュラル', notes:['ナッツ','チョコ'], tips:['過度にクリアへ振ると薄く感じやすい'] },
      { roast:'中深', process:'ナチュラル', notes:['ダークチョコ','カカオ','カラメル'] }],
    recommended:[
      { dripper:'カリタウェーブ', why:'均一/丸み→土台が整う。', bestFor:['中','中深'] },
      { dripper:'クレバー',      why:'浸漬で甘みとボディが乗る。', bestFor:['中','中深'], processFit:['ナチュラル'] },
      { dripper:'ネル',          why:'オイル感/余韻で甘苦表現。', bestFor:['中深','深'] },
      { dripper:'フレンチプレス',why:'素材感を厚めに出せる。', bestFor:['中深','深'] },
      { dripper:'ハリオスイッチ',why:'甘み×クリアの両立。', bestFor:['中','中深'] },
    ],
    sources:[{title:'Brazil coffee profile overview', url:'https://...'}]
  },
};
// セレクトに出す“全産地”一覧（仕様＋あなたが挙げた国を全反映）
export const ORIGINS: string[] = [
  // ⭐️アフリカ
  'エチオピア','イエメン（モカ・マタリ）','ケニア','ブルンジ','タンザニア（キリマンジャロ）','ルワンダ',
  'ウガンダ','コンゴ民主共和国','カメルーン','コートジボワール','マラウイ','ジンバブエ','エスワティニ','南アフリカ',

  // ⭐️中米・カリブ
  'アメリカ（ハワイアン・コナ）','キューバ','ジャマイカ（ブルーマウンテン）','ドミニカ共和国',
  'ハイチ','プエルトリコ','メキシコ','グアテマラ','ホンジュラス','エルサルバドル','ニカラグア','コスタリカ','パナマ',

  // ⭐️南米
  'コロンビア','エクアドル','ブラジル','ボリビア','ペルー','ベネズエラ',

  // ⭐️アジア・オセアニア
  'インドネシア','ベトナム','インド','タイ','ラオス','ミャンマー',
  'パプアニューギニア','東ティモール','フィリピン','中国','ネパール','カンボジア','ソロモン諸島',

  // ブレンドなどに使う
  '不明',
];
