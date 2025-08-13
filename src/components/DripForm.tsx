import React, { useEffect, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

export function DripForm({API, beans, onSaved}:{API:string; beans:any[]; onSaved:()=>void}){
  const [form,setForm] = useState<any>({ ratings:{} })
  const [derive, setDerive] = useState<any>(null)
  const [beanStats, setBeanStats] = useState<any>(null)

  const handle = (k:string,v:any)=> setForm((s:any)=> ({...s,[k]:v}))
  const handleRating = (k:string,v:any)=> setForm((s:any)=> ({...s, ratings:{...s.ratings, [k]:v}}))

  // ---- 導出（セオリー/推奨/挽き目表記）
  useEffect(()=>{
    const bean_id = form.bean_id
    if(!bean_id){ setDerive(null); return }
    const params = new URLSearchParams()
    params.set('bean_id', bean_id)
    if(form.grind) params.set('grind', form.grind)
    if(form.dose_g) params.set('dose_g', form.dose_g)
    if(form.water_g) params.set('water_g', form.water_g)
    if(form.water_temp_c) params.set('water_temp_c', form.water_temp_c)
    if(form.dripper) params.set('dripper', form.dripper)
    fetch(`${API}/api/derive?`+params.toString()).then(r=>r.json()).then(setDerive)
  },[form.bean_id, form.grind, form.dose_g, form.water_g, form.water_temp_c, form.dripper, API])

  // ---- 豆ごと統計（豆選択のたび）
  useEffect(()=>{
    if(!form.bean_id){ setBeanStats(null); return }
    fetch(`${API}/api/stats?scope=bean&bean_id=${form.bean_id}`).then(r=>r.json()).then(setBeanStats)
  },[form.bean_id, API])

  const [beanDrips, setBeanDrips] = useState<any[]>([])
  const [radarData, setRadarData] = useState<any[]>([])

  // ---- 豆ごとのドリップを取得してレーダー用に集計
  useEffect(()=>{
    if(!form.bean_id){ setBeanDrips([]); setRadarData([]); return }
    ;(async ()=>{
      const r = await fetch(`${API}/api/drips`)
      const all = await r.json()
      const mine = all.filter((d:any)=> String(d.bean_id)===String(form.bean_id))
      setBeanDrips(mine)

      const keys = [
        {key:'clean', label:'クリーンさ'},
        {key:'flavor', label:'風味'},
        {key:'acidity', label:'酸味'},
        {key:'bitterness', label:'苦味'},
        {key:'sweetness', label:'甘味'},
        {key:'body', label:'コク'},
        {key:'aftertaste', label:'後味'},
      ]
      const data = keys.map(k=>{
        const vals = mine.map((d:any)=> d.ratings?.[k.key]).filter((x:any)=> typeof x==='number')
        const avg = vals.length? (vals.reduce((a:number,b:number)=>a+b,0)/vals.length) : null
        return { subject: k.label, value: avg??0 }
      })
      setRadarData(data)
    })()
  },[form.bean_id, API])

  const submit = async (e:any)=>{
    e.preventDefault()
    const payload = {
      bean_id: parseInt(form.bean_id),
      brew_date: form.brew_date,
      grind: form.grind? parseFloat(form.grind): null,
      water_temp_c: form.water_temp_c? parseFloat(form.water_temp_c): null,
      dose_g: form.dose_g? parseFloat(form.dose_g): null,
      water_g: form.water_g? parseFloat(form.water_g): null,
      drawdown_g: form.drawdown_g? parseFloat(form.drawdown_g): null,
      time: form.time || null,
      dripper: form.dripper || null,
      storage: form.storage || null,
      method_memo: form.method_memo || null,
      note_memo: form.note_memo || null,
      clean: form.ratings?.clean? parseInt(form.ratings.clean): null,
      flavor: form.ratings?.flavor? parseInt(form.ratings.flavor): null,
      acidity: form.ratings?.acidity? parseInt(form.ratings.acidity): null,
      bitterness: form.ratings?.bitterness? parseInt(form.ratings.bitterness): null,
      sweetness: form.ratings?.sweetness? parseInt(form.ratings.sweetness): null,
      body: form.ratings?.body? parseInt(form.ratings.body): null,
      aftertaste: form.ratings?.aftertaste? parseInt(form.ratings.aftertaste): null,
      overall: form.ratings?.overall? parseInt(form.ratings.overall): null,
    }
    const r = await fetch(`${API}/api/drips`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
    if(r.ok){ setForm({ratings:{}}); onSaved() }
  }

  // ---- 表示ヘルパ
  const selBean = beans.find(b=> String(b.id)===String(form.bean_id))
  const showOrDash = (cond:any, val:any, dashWhenBean?:string)=> cond ? (val ?? '—') : (dashWhenBean ?? '--')
   // 5つ星表示（avg_overall: 0-10 を 0-5 に変換）
  const StarRow = ({avg}:{avg:number|undefined})=>{
    if (avg == null || isNaN(Number(avg))) return <span>--</span>
    const s = Math.round(Number(avg)/2) // 0-5
    return (
      <span aria-label={`rating ${s} of 5`}>
        {'★★★★★'.slice(0,s)}{'☆☆☆☆☆'.slice(0,5-s)} <span className="text-[11px] text-gray-500">({avg})</span>
      </span>
    )
  }

const optionLabel = (b:any)=>{
  const parts:string[] = []
  if (b.name) parts.push(b.name)
  if (b.origin) parts.push(b.origin)
  if (b.variety) parts.push(b.variety)
  if (b.process) parts.push(b.process)
  if (b.addl_process) parts.push(b.addl_process)
  const base = parts.join('・')
  return b.roast_level ? `${base}（${b.roast_level}）` : base
}

  const theoryWithValue = (label:string|undefined|null, value:string|undefined|null)=>{
    if(!selBean) return '--'
    if(value && label) return `${value}（${label}）`
    if(value && !label) return `${value}（—）`
    return '—'
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* 1列目：豆＆日付 */}
      <div className="grid grid-cols-2 gap-2">
        <select className="border rounded p-2" value={form.bean_id||''} onChange={e=>handle('bean_id', e.target.value)} required>
          <option value="">使用豆を選択</option>
          {beans.filter(b=>b.in_stock).map(b => (
            <option key={b.id} value={b.id}>{optionLabel(b)}</option>
          ))}
        </select>
        <input className="border rounded p-2" type="date" value={form.brew_date||''} onChange={e=>handle('brew_date',e.target.value)} required />
      </div>

      {/* セレクト直下：豆セオリー + 豆ごと統計（ドリップ前に参照） */}
      <div className="bg-gray-50 border rounded p-2 space-y-2 text-sm">
        <div className="font-semibold">選択豆：{selBean?.name ?? '--'}</div>
<div>産地セオリー：{ showOrDash(!!form.bean_id, theoryWithValue(derive?.theory?.origin, selBean?.origin)) }</div>
<div>精製セオリー：{ showOrDash(!!form.bean_id, theoryWithValue(derive?.theory?.process, selBean?.process)) }</div>
<div>追加処理セオリー：{ showOrDash(!!form.bean_id, theoryWithValue(derive?.theory?.addl_process, selBean?.addl_process)) }</div>
<div className="text-xs text-gray-500">※「選択値（セオリー）」の形式で表示</div>
                <div className="text-sm">平均評価（★）：<StarRow avg={beanStats?.avg_overall} /></div>
        {/* レーダーチャート（6項目平均） */}
<div className="h-48">
  <ResponsiveContainer>
    <RadarChart data={radarData}>
      <PolarGrid />
      <PolarAngleAxis dataKey="subject" />
      <PolarRadiusAxis angle={30} domain={[0, 10]} />
      <Radar name="avg" dataKey="value" stroke="" fill="" fillOpacity={0.3} />
      <Tooltip />
    </RadarChart>
  </ResponsiveContainer>
</div>


        {/* 豆ごと統計（棒グラフ＆サマリ） */}
        <div className="text-xs">記録数：{beanStats?.count ?? (form.bean_id ? '—' : '--')}　
          平均：{beanStats?.avg_overall ?? (form.bean_id ? '—' : '--')}　
          最高：{beanStats?.max_overall ?? (form.bean_id ? '—' : '--')}
        </div>
        <div className="h-40">
          <ResponsiveContainer>
            <BarChart data={beanStats?.by_method ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dripper" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avg_overall" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2列目：挽き目/湯温/ドリッパー（各入力の直後に推奨/差分） */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <input className="border rounded p-2 w-full" placeholder="挽き目 (1~17)" value={form.grind||''} onChange={e=>handle('grind',e.target.value)} />
          <div className="text-xs text-gray-600 mt-1">
            挽き目表記：<b>{(form.bean_id && form.grind) ? (derive?.grind?.label20 ?? '—') : '--'}</b>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            目安（焙煎度基準）：{ form.bean_id ? (
              <>
                粗 {derive?.grind?.markers_for_roast?.['粗'] ?? '—'} / 中粗 {derive?.grind?.markers_for_roast?.['中粗'] ?? '—'} / 中 {derive?.grind?.markers_for_roast?.['中'] ?? '—'} / 中細 {derive?.grind?.markers_for_roast?.['中細'] ?? '—'} / 細 {derive?.grind?.markers_for_roast?.['細'] ?? '—'} / 極細 {derive?.grind?.markers_for_roast?.['極細'] ?? '—'}
              </>
            ) : '--' }
          </div>
        </div>

        <div>
          <input className="border rounded p-2 w-full" placeholder="湯温 (℃)" value={form.water_temp_c||''} onChange={e=>handle('water_temp_c',e.target.value)} />
          <div className="text-xs text-gray-600 mt-1">
            推奨湯温：{showOrDash(!!form.bean_id, derive?.temp?.recommended_c)}℃（Δ { (form.bean_id && form.water_temp_c) ? (derive?.temp?.delta_from_input ?? '—') : '--' }）
          </div>
        </div>

        <div>
          <select className="border rounded p-2 w-full" value={form.dripper||''} onChange={e=>handle('dripper',e.target.value)}>
            <option value="">ドリッパー</option>
            {['水出し','エアロプレス','クレバー','ハリオスイッチ','ハリオ','フラワー','クリスタル','カリタウェーブ','ブルーボトル','コーノ','フィン','ネル','フレンチプレス','エスプレッソ','モカポット','サイフォン'].map(x=> <option key={x}>{x}</option>)}
          </select>
          <div className="text-xs text-gray-600 mt-1">
            ドリッパー理論：{ form.dripper ? (derive?.theory?.dripper ?? '—') : '--' }
          </div>
        </div>
      </div>

      {/* 3列目：豆/湯量/落ちきり量（レシオ推奨とΔを個別に） */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <input className="border rounded p-2 w-full" placeholder="豆 (g)" value={form.dose_g||''} onChange={e=>handle('dose_g',e.target.value)} />
          <div className="text-xs text-gray-600 mt-1">推奨レシオ：{showOrDash(!!form.bean_id, derive?.ratio?.recommended_ratio)}倍</div>
          <div className="text-[11px] text-gray-500">最大推奨量：{showOrDash(!!form.bean_id, derive?.dose?.max_recommended_g)}</div>
        </div>
        <div>
          <input className="border rounded p-2 w-full" placeholder="湯量 (g)" value={form.water_g||''} onChange={e=>handle('water_g',e.target.value)} />
          <div className="text-xs text-gray-600 mt-1">
            推奨湯量：{ (form.bean_id && form.dose_g) ? (derive?.ratio?.recommended_water_g ?? '—') : '--' }g（Δ { (form.bean_id && form.dose_g && form.water_g) ? (derive?.ratio?.delta_from_input ?? '—') : '--' }）
          </div>
        </div>
        <input className="border rounded p-2" placeholder="落ちきり量 (g)" value={form.drawdown_g||''} onChange={e=>handle('drawdown_g',e.target.value)} />
      </div>

      {/* 4列目：時間/保存 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input className="border rounded p-2 w-full" placeholder="抽出時間 (mm:ss)" value={form.time||''} onChange={e=>handle('time',e.target.value)} />
          <div className="text-xs text-gray-600 mt-1">推奨所要時間：{showOrDash(!!form.bean_id, derive?.time?.recommended_sec)}秒</div>
        </div>
        <select className="border rounded p-2" value={form.storage||''} onChange={e=>handle('storage',e.target.value)}>
          <option value="">保存状態</option>
          <option value="🧊冷凍">🧊冷凍</option>
          <option value="常温">常温</option>
        </select>
      </div>

      {/* メモ・評価 */}
      <textarea className="w-full border rounded p-2" placeholder="手法メモ" value={form.method_memo||''} onChange={e=>handle('method_memo',e.target.value)} />
      <textarea className="w-full border rounded p-2" placeholder="感想メモ" value={form.note_memo||''} onChange={e=>handle('note_memo',e.target.value)} />

      <div className="grid grid-cols-4 gap-2 text-sm">
        {['clean','flavor','acidity','bitterness','sweetness','body','aftertaste','overall'].map(k=> (
          <input key={k} className="border rounded p-2" placeholder={`${k} 1-10`} value={form.ratings?.[k]||''} onChange={e=>handleRating(k,e.target.value)} />
        ))}
      </div>

      {/* 価格見積（豆量入力時のみ） */}
      {(derive?.price && form.dose_g) ? (
        <div className="text-sm bg-gray-50 border rounded p-2">
          費用見積：{derive.price.estimated_cost_yen} 円（単価 {derive.price.price_per_g} 円/g）
        </div>
      ) : null}

      <button className="px-3 py-2 rounded bg-blue-600 text-white">ドリップを記録</button>
    </form>
  )
}
