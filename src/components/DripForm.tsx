import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter
} from 'recharts'

/** 焙煎度→推奨湯温（℃） */
const ROAST_TEMP: Record<string, number> = {
  'ライト': 92.5, 'シナモン': 90.0, 'ミディアム': 87.5, 'ハイ': 85.0,
  'シティ': 82.5, 'フルシティ': 80.0, 'フレンチ': 77.5, 'イタリアン': 75.0
}

/** 粒度グループ→推奨時間（秒） */
const GRIND_TIME: Record<string, number> = {
  '粗': 210, '中粗': 180, '中': 120, '中細': 90, '細': 60, '極細': 40
}

/** 20段階ラベル → 6グループ */
const toGrindGroup = (label20?: string|null) => {
  if (!label20) return null
  if (label20.startsWith('粗')) return '粗'
  if (label20.startsWith('中粗')) return '中粗'
  if (['中++','中+','中','中-','中--'].includes(label20)) return '中'
  if (label20.startsWith('中細')) return '中細'
  if (label20.startsWith('細')) return '細'
  if (label20 === '極細') return '極細'
  return null
}

/** mm:ss → 秒 */
const toSec = (mmss?: string|null) => {
  if (!mmss) return null
  const m = mmss.split(':')
  if (m.length !== 2) return null
  const min = Number(m[0]), sec = Number(m[1])
  if (isNaN(min) || isNaN(sec)) return null
  return min*60 + sec
}

/** 日付差（日） "yyyy-mm-dd" 前提 */
const daysBetween = (from?: string|null, to?: string|null) => {
  if (!from || !to) return null
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  const ms = b.getTime() - a.getTime()
  return Math.floor(ms / (1000*60*60*24))
}

/** Pearson 相関係数 */
const corr = (pairs: Array<[number, number]>)=>{
  const xs = pairs.map(p=>p[0]).filter(v=>Number.isFinite(v))
  const ys = pairs.map(p=>p[1]).filter((_,i)=>Number.isFinite(pairs[i][0]) && Number.isFinite(pairs[i][1]))
  const n = Math.min(xs.length, ys.length)
  if(n===0) return null
  const mx = xs.reduce((a,b)=>a+b,0)/n
  const my = ys.reduce((a,b)=>a+b,0)/n
  let num=0, dx2=0, dy2=0
  for(let i=0;i<n;i++){
    const dx = xs[i]-mx, dy = ys[i]-my
    num += dx*dy; dx2 += dx*dx; dy2 += dy*dy
  }
  const den = Math.sqrt(dx2*dy2)
  return den===0 ? null : (num/den)
}

export function DripForm({API, beans, onSaved}:{API:string; beans:any[]; onSaved:()=>void}){
  const [form,setForm] = useState<any>({ ratings:{} })
  const [derive, setDerive] = useState<any>(null)
  const [beanStats, setBeanStats] = useState<any>(null)
  const [beanDrips, setBeanDrips] = useState<any[]>([])
  const [radarData, setRadarData] = useState<any[]>([])
  const [yMetric, setYMetric] = useState<'overall'|'clean'|'flavor'|'body'>('overall')

  const handle = (k:string,v:any)=> setForm((s:any)=> ({...s,[k]:v}))
  const handleRating = (k:string,v:any)=> setForm((s:any)=> ({...s, ratings:{...s.ratings, [k]:v}}))

  // セオリー/推奨/挽き目表記（brew_date 変更でも aging を再計算させたいので依存に含める）
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
    if(form.brew_date) params.set('brew_date', form.brew_date) // aging_days を API 側で使う場合に備え
    fetch(`${API}/api/derive?`+params.toString()).then(r=>r.json()).then(setDerive)
  },[form.bean_id, form.grind, form.dose_g, form.water_g, form.water_temp_c, form.dripper, form.brew_date, API])

  // 豆ごと統計
  useEffect(()=>{
    if(!form.bean_id){ setBeanStats(null); return }
    fetch(`${API}/api/stats?scope=bean&bean_id=${form.bean_id}`).then(r=>r.json()).then(setBeanStats)
  },[form.bean_id, API])

  // 豆ごとのドリップ取得→レーダー＆相関用の差分を作る
  useEffect(()=>{
    if(!form.bean_id){ setBeanDrips([]); setRadarData([]); return }
    ;(async ()=>{
      const r = await fetch(`${API}/api/drips`)
      const all = await r.json()
      const mine = all.filter((d:any)=> String(d.bean_id)===String(form.bean_id))

      // レーダー（豆ごと平均）
      const keys = [
        {key:'clean', label:'クリーンさ'},
        {key:'flavor', label:'風味'},
        {key:'acidity', label:'酸味'},
        {key:'bitterness', label:'苦味'},
        {key:'sweetness', label:'甘味'},
        {key:'body', label:'コク'},
        {key:'aftertaste', label:'後味'},
      ]
      const rd = keys.map(k=>{
        const vals = mine.map((d:any)=> d.ratings?.[k.key]).filter((x:any)=> typeof x==='number')
        const avg = vals.length? (vals.reduce((a:number,b:number)=>a+b,0)/vals.length) : 0
        return { subject: k.label, value: avg }
      })
      setRadarData(rd)

      // 相関用差分付与
      const withDeltas = mine.map((d:any)=>{
        const roast = d.bean?.roast_level ?? d.roast_level ?? 'シティ'
        const recTemp = ROAST_TEMP[roast] ?? 82.5
        const tempDelta = (typeof d.water_temp_c === 'number') ? (d.water_temp_c - recTemp) : null

        const label20 = d.derive?.grind?.label20 || d.label20 || null
        const group = toGrindGroup(label20)
        const recTime = group ? GRIND_TIME[group] : null
        const actSec = toSec(d.time)
        const timeDelta = (actSec!=null && recTime!=null) ? (actSec - recTime) : null

        return { ...d, _deltas: { temp_delta: tempDelta, time_delta: timeDelta } }
      })
      setBeanDrips(withDeltas)
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

  // 表示ヘルパ
  const selBean = beans.find(b=> String(b.id)===String(form.bean_id))
  const showOrDash = (cond:any, val:any, dashWhenBean?:string)=> cond ? (val ?? '—') : (dashWhenBean ?? '--')
  const StarRow = ({avg}:{avg:number|undefined})=>{
    if (avg == null || isNaN(Number(avg))) return <span>--</span>
    const s = Math.round(Number(avg)/2)
    return (<span aria-label={`rating ${s} of 5`}>{'★★★★★'.slice(0,s)}{'☆☆☆☆☆'.slice(0,5-s)} <span className="text-[11px] text-gray-500">({avg})</span></span>)
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
  const theoryWithValue = (theory:string|undefined|null, value:string|undefined|null)=>{
    if(!selBean) return '--'
    if(value && theory) return `${value}（${theory}）`
    if(value && !theory) return `${value}（—）`
    return '—'
  }

  // 指標切替
  const yAccessor = useMemo(()=>({
    key: `ratings.${yMetric}`,
    label: yMetric === 'overall' ? '総合' : (yMetric==='clean'?'クリーンさ':(yMetric==='flavor'?'風味':'コク'))
  }),[yMetric])

  // 豆ごと相関ペア & r
  const beanPairsTemp = useMemo(()=>{
    return beanDrips
      .map((d:any)=> [d?._deltas?.temp_delta, d?.ratings?.[yMetric]] as [number,number])
      .filter(([x,y])=> Number.isFinite(x) && Number.isFinite(y))
  },[beanDrips, yMetric])
  const beanPairsTime = useMemo(()=>{
    return beanDrips
      .map((d:any)=> [d?._deltas?.time_delta, d?.ratings?.[yMetric]] as [number,number])
      .filter(([x,y])=> Number.isFinite(x) && Number.isFinite(y))
  },[beanDrips, yMetric])
  const rTempBean = useMemo(()=> {
    const v = corr(beanPairsTemp); return (v==null? null : Math.round(v*100)/100)
  },[beanPairsTemp])
  const rTimeBean = useMemo(()=> {
    const v = corr(beanPairsTime); return (v==null? null : Math.round(v*100)/100)
  },[beanPairsTime])

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

      {/* エイジング日数 */}
      <div className="text-xs text-gray-700">
        エイジング日数：
        {(() => {
          const roastDate =
            (selBean?.roast_date as string | undefined) ||
            (selBean?.roasted_on as string | undefined) ||
            (selBean?.purchase_date as string | undefined) ||
            (selBean?.purchased_on as string | undefined)
          const brewDate = form.brew_date as string | undefined
          const d = daysBetween(roastDate, brewDate)
          if (!form.bean_id || !brewDate) return '--'
          if (!roastDate) return '—（焙煎日未登録）'
          return `${d} 日`
        })()}
      </div>

      {/* セレクト直下：豆セオリー＋豆ごと統計 */}
      <div className="bg-gray-50 border rounded p-2 space-y-2 text-sm">
        <div className="font-semibold">選択豆：{selBean?.name ?? '--'}</div>
        <div>産地セオリー：{ showOrDash(!!form.bean_id, theoryWithValue(derive?.theory?.origin, selBean?.origin)) }</div>
        <div>精製セオリー：{ showOrDash(!!form.bean_id, theoryWithValue(derive?.theory?.process, selBean?.process)) }</div>
        <div>追加処理セオリー：{ showOrDash(!!form.bean_id, theoryWithValue(derive?.theory?.addl_process, selBean?.addl_process)) }</div>

        <div className="text-sm">平均評価（★）：<StarRow avg={beanStats?.avg_overall} /></div>

        {/* レーダー */}
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

        {/* 豆ごとバー（抽出方法別平均） */}
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

        {/* 豆ごと相関：湯温差 / 時間差 */}
        <div className="flex items-center gap-2 text-xs">
          <span>評価指標：</span>
          <select className="border rounded p-1" value={yMetric} onChange={e=>setYMetric(e.target.value as any)}>
            <option value="overall">総合</option>
            <option value="clean">クリーンさ</option>
            <option value="flavor">風味</option>
            <option value="body">コク</option>
          </select>
        </div>

        {/* 湯温差 vs 指標 */}
        <div>
          <div className="font-semibold mb-1">
            湯温差（実測−推奨） vs {yAccessor.label}
            <span className="ml-2 text-xs text-gray-500">r={rTempBean ?? '—'}</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid />
                <XAxis dataKey="_deltas.temp_delta" name="tempΔ(°C)" />
                <YAxis dataKey={yAccessor.key} name={yAccessor.label} />
                <Tooltip />
                <Scatter name="drips" data={beanDrips} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 時間差 vs 指標 */}
        <div>
          <div className="font-semibold mb-1">
            時間差（実測秒−推奨秒） vs {yAccessor.label}
            <span className="ml-2 text-xs text-gray-500">r={rTimeBean ?? '—'}</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid />
                <XAxis dataKey="_deltas.time_delta" name="timeΔ(s)" />
                <YAxis dataKey={yAccessor.key} name={yAccessor.label} />
                <Tooltip />
                <Scatter name="drips" data={beanDrips} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 入力群：各入力直下に推奨/差分 */}
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
          <div className="text-xs text-gray-600 mt-1">ドリッパー理論：{ form.dripper ? (derive?.theory?.dripper ?? '—') : '--' }</div>
        </div>
      </div>

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

      <textarea className="w-full border rounded p-2" placeholder="手法メモ" value={form.method_memo||''} onChange={e=>handle('method_memo',e.target.value)} />
      <textarea className="w-full border rounded p-2" placeholder="感想メモ" value={form.note_memo||''} onChange={e=>handle('note_memo',e.target.value)} />

      <div className="grid grid-cols-4 gap-2 text-sm">
        {['clean','flavor','acidity','bitterness','sweetness','body','aftertaste','overall'].map(k=> (
          <input key={k} className="border rounded p-2" placeholder={`${k} 1-10`} value={form.ratings?.[k]||''} onChange={e=>handleRating(k,e.target.value)} />
        ))}
      </div>

      {(derive?.price && form.dose_g) ? (
        <div className="text-sm bg-gray-50 border rounded p-2">
          費用見積：{derive.price.estimated_cost_yen} 円（単価 {derive.price.price_per_g} 円/g）
        </div>
      ) : null}

      <button className="px-3 py-2 rounded bg-blue-600 text-white">ドリップを記録</button>
    </form>
  )
}
