import React, { useMemo, useState } from 'react'

// 入力直下用の簡潔なセオリー辞書（保存前でも表示できる）
const ORIGIN_THEORY: Record<string,string> = {
  'エチオピア':'フローラル/シトラス、紅茶のような余韻。',
  'ケニア':'明るい酸、ベリー/柑橘、甘みが持続。',
  'ブラジル':'ナッツ/チョコ、低酸で飲みやすい。',
  'コロンビア':'キャラメル感と軽い柑橘、丸い口当たり。',
  'グアテマラ':'ナッツ/チョコのバランス、穏やかな酸。',
  'ルワンダ':'蜂蜜や紅茶感、甘いストーンフルーツ。'
};
const PROCESS_THEORY: Record<string,string> = {
  'ナチュラル':'華やかな香りと甘み、熟した果実味。',
  'ウォッシュド':'クリーンで明瞭、酸が立ちやすい。',
  'ハニー':'甘みとコクの中庸（残す粘質量で変化）。',
  'レッドハニー':'濃い甘みと果実味、厚みのある口当たり。',
  'イエローハニー':'明るい甘み、バランス良好。',
  'ホワイトハニー':'よりクリーンで軽やか。',
  'スマトラ':'アーシー/スパイシー、厚いボディ。'
};
const ADDL_THEORY: Record<string,string> = {
  'アナエロビック':'無酸素発酵由来の個性的・スパイシー。',
  'モンスーン':'穀物感、低酸、独特の熟成感。',
  'インフューズド':'外的フレーバー付与で個性を強化。',
  'バレルエイジド':'樽香と甘い余韻。',
  'エイジング':'角が取れて丸みが出やすい。'
};

export function BeanForm({API,onSaved}:{API:string;onSaved:()=>void}){
  const [form, setForm] = useState<any>({ roast_level: 'シティ', in_stock: true });
  const handle = (k:string,v:any)=> setForm((s:any)=> ({...s,[k]:v}));

  // 入力直下に出す文言
  const originTheory = useMemo(()=> form.origin ? (ORIGIN_THEORY[form.origin] ?? '—') : '--', [form.origin]);
  const processTheory = useMemo(()=> form.process ? (PROCESS_THEORY[form.process] ?? '—') : '--', [form.process]);
  const addlTheory   = useMemo(()=> form.addl_process ? (ADDL_THEORY[form.addl_process] ?? '—') : '--', [form.addl_process]);

  const submit = async (e:any)=>{
    e.preventDefault();
    const r = await fetch(`${API}/api/beans`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form)
    });
    if(r.ok){ setForm({ roast_level:'シティ', in_stock:true }); onSaved(); }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <input className="w-full border rounded p-2" placeholder="豆の名前" value={form.name||''} onChange={e=>handle('name',e.target.value)} required />

      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="産地 (例: ケニア)" value={form.origin||''} onChange={e=>handle('origin',e.target.value)} />
        <select className="border rounded p-2" value={form.roast_level} onChange={e=>handle('roast_level',e.target.value)}>
          {['ライト','シナモン','ミディアム','ハイ','シティ','フルシティ','フレンチ','イタリアン'].map(x=> <option key={x}>{x}</option>)}
        </select>
      </div>
      {/* 産地セオリー（入力直下） */}
      <div className="text-xs text-gray-600 -mt-1 mb-1">産地セオリー：{originTheory}</div>

      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="精製 (例: ナチュラル/ウォッシュド/ハニー...)" value={form.process||''} onChange={e=>handle('process',e.target.value)} />
        <input className="border rounded p-2" placeholder="追加処理 (例: アナエロビック)" value={form.addl_process||''} onChange={e=>handle('addl_process',e.target.value)} />
      </div>
      {/* 精製/追加処理セオリー（それぞれ直下） */}
      <div className="text-xs text-gray-600 -mt-1">精製セオリー：{processTheory}</div>
      <div className="text-xs text-gray-600">追加処理セオリー：{addlTheory}</div>

      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="品種 (例: SL28, カトゥーラ)" value={form.variety||''} onChange={e=>handle('variety',e.target.value)} />
        <input className="border rounded p-2" type="date" value={form.roast_date||''} onChange={e=>handle('roast_date',e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="値段(円)" value={form.price_yen||''} onChange={e=>handle('price_yen', e.target.value)} />
        <input className="border rounded p-2" placeholder="量(g)" value={form.weight_g||''} onChange={e=>handle('weight_g', e.target.value)} />
      </div>

      <textarea className="w-full border rounded p-2" placeholder="テイストメモ" value={form.taste_memo||''} onChange={e=>handle('taste_memo',e.target.value)} />
      <textarea className="w-full border rounded p-2" placeholder="ドリップ方針メモ" value={form.brew_policy||''} onChange={e=>handle('brew_policy',e.target.value)} />

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!form.in_stock} onChange={e=>handle('in_stock',e.target.checked)} /> 在庫あり
      </label>

      <button className="px-3 py-2 rounded bg-black text-white">豆を登録</button>
    </form>
  )
}
