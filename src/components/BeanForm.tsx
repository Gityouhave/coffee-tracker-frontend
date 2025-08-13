import React, { useEffect, useState } from 'react'

export function BeanForm({API,onSaved}:{API:string;onSaved:()=>void}){
  const [form, setForm] = useState<any>({ roast_level: 'シティ', in_stock: true })
  const [theory,setTheory] = useState<any>({})

  const handle = (k:string,v:any)=> setForm((s:any)=> ({...s,[k]:v}))

  const submit = async (e:any)=>{
    e.preventDefault()
    const r = await fetch(`${API}/api/beans`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form)})
    if(r.ok){ setForm({ roast_level:'シティ', in_stock:true }); onSaved() }
  }

  useEffect(()=>{
    // update theory preview when origin/process/addl_process changes (server provides on detail, derive endpoint also exists)
    (async ()=>{
      if(!form.origin && !form.process && !form.addl_process){ setTheory({}); return; }
      // naive: post temp bean to get theory? Keep simple: rely on server after save.
    })()
  },[form.origin, form.process, form.addl_process])

  return (
    <form onSubmit={submit} className="space-y-2">
      <input className="w-full border rounded p-2" placeholder="豆の名前" value={form.name||''} onChange={e=>handle('name',e.target.value)} required />
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="産地 (例: ケニア)" value={form.origin||''} onChange={e=>handle('origin',e.target.value)} />
        <select className="border rounded p-2" value={form.roast_level} onChange={e=>handle('roast_level',e.target.value)}>
          {['ライト','シナモン','ミディアム','ハイ','シティ','フルシティ','フレンチ','イタリアン'].map(x=> <option key={x}>{x}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="精製 (例: ナチュラル/ウォッシュド/ハニー...)" value={form.process||''} onChange={e=>handle('process',e.target.value)} />
        <input className="border rounded p-2" placeholder="追加処理 (例: アナエロビック)" value={form.addl_process||''} onChange={e=>handle('addl_process',e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="品種 (例: SL28, カトゥーラ)" value={form.variety||''} onChange={e=>handle('variety',e.target.value)} />
        <input className="border rounded p-2" type="date" value={form.roast_date||''} onChange={e=>handle('roast_date',e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded p-2" placeholder="値段(円)" value={form.price_yen||''} onChange={e=>handle('price_yen',parseFloat(e.target.value)||0)} />
        <input className="border rounded p-2" placeholder="量(g)" value={form.weight_g||''} onChange={e=>handle('weight_g',parseFloat(e.target.value)||0)} />
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
