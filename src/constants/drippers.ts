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
