// src/components/DripForm.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter
} from 'recharts'

import { filterSortBeans, beanOptionLabel, ROASTS } from '../utils/beanFilters'
import { ORIGINS } from '../constants/origins'
import { ORIGIN_THEORIES } from '../constants/originTheories'

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

/** 秒 → mm:ss */
const secToMMSS = (s?: number | null) => {
  if (s == null || !Number.isFinite(s)) return undefined
  const m = Math.floor(s/60), ss = Math.abs(s%60)
  return `${m}:${String(ss).padStart(2,'0')}`
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

/** 近焙煎度セット（前後1つ＋同一） */
const nearRoastSet = (level?: string|null) => {
  if(!level) return new Set<string>()
  const idx = ROASTS.indexOf(level)
  if(idx<0) return new Set<string>([level])
  return new Set([ROASTS[idx-1], ROASTS[idx], ROASTS[idx+1]].filter(Boolean))
}

export function DripForm({API, beans, onSaved}:{API:string; beans:any[]; onSaved:()=>void}){
  const [form,setForm] = useState<any>({ ratings:{} })
  const [derive, setDerive] = useState<any>(null)
  const [beanStats, setBeanStats] = useState<any>(null)
  // 既存の他の useState 定義と並べる
const [dripDate, setDripDate] = useState<string>(
  new Date().toISOString().slice(0, 10) // 今日の日付を初期値に
)
  const [beanDrips, setBeanDrips] = useState<any[]>([])
  const [allDrips, setAllDrips] = useState<any[]>([])
  const [radarData, setRadarData] = useState<any[]>([])
  const [yMetric, setYMetric] = useState<'overall'|'clean'|'flavor'|'body'>('overall')
  const [editingDripId, setEditingDripId] = useState<number|null>(null)
  const [last, setLast] = useState<any|null>(null)

  // 暫定最適：2系統のベスト
  const [bestSameRoast, setBestSameRoast] = useState<any|null>(null)
  const [bestOriginNear, setBestOriginNear] = useState<any|null>(null)

  // セレクト＆適用ボタン用
  type BestPattern = {
    id: 'sameRoast'|'originNear'
    label: string
    fields: Partial<{
      grind:number
      water_temp_c:number
      dose_g:number
      water_g:number
      drawdown_g:number|null
      time:string // mm:ss
      dripper:string|null
      storage:string|null
    }>
  }
  const [bestPatterns, setBestPatterns] = useState<BestPattern[]>([])
  const [selectedPatternId, setSelectedPatternId] = useState<BestPattern['id']|''>('')

  // 前回値適用
  const applyLast = () => {
    if (!last) return
    const f = (v:any)=> (v===undefined || v===null || v==='' ? undefined : v)
    setForm((s:any)=> ({
      ...s,
      grind:        s.grind        ?? f(last.grind),
      water_temp_c: s.water_temp_c ?? f(last.water_temp_c),
      dose_g:       s.dose_g       ?? f(last.dose_g),
      water_g:      s.water_g      ?? f(last.water_g),
      drawdown_g:   s.drawdown_g   ?? f(last.drawdown_g),
      time:         s.time         ?? (last.time_sec!=null ? secToMMSS(last.time_sec) : undefined),
      dripper:      s.dripper      ?? f(last.dripper),
      storage:      s.storage      ?? f(last.storage),
    }))
  }

  // 暫定最適値適用
  const applyBest = () => {
    const pat = bestPatterns.find(p => p.id === selectedPatternId) || bestPatterns[0]
    if (!pat) return
    const f = (v:any)=> (v===undefined || v===null || v==='' ? undefined : v)
    setForm((s:any)=> ({
      ...s,
      grind:        s.grind        ?? f(pat.fields.grind),
      water_temp_c: s.water_temp_c ?? f(pat.fields.water_temp_c),
      dose_g:       s.dose_g       ?? f(pat.fields.dose_g),
      water_g:      s.water_g      ?? f(pat.fields.water_g),
      drawdown_g:   s.drawdown_g   ?? f(pat.fields.drawdown_g),
      time:         s.time         ?? f(pat.fields.time),
      dripper:      s.dripper      ?? f(pat.fields.dripper),
      storage:      s.storage      ?? f(pat.fields.storage),
    }))
  }

  const handle = (k:string,v:any)=> setForm((s:any)=> ({...s,[k]:v}))
  const handleRating = (k:string,v:any)=> setForm((s:any)=> ({...s, ratings:{...s.ratings, [k]:v}}))

  // 統一フィルタ＆ソート
  type SortKey = 'roast_date' | 'roast_level' | 'ppg' | 'name'
  type StockFilter = 'all' | 'in' | 'out'
  const LS = { q:'ct_beans_q', stock:'ct_beans_stock', origins:'ct_beans_origins', sort:'ct_beans_sort' }
  const [q, setQ] = useState<string>(() => localStorage.getItem(LS.q) || '')
  const [stock, setStock] = useState<StockFilter>(() => (localStorage.getItem(LS.stock) as StockFilter) || 'all')
  const [originFilter, setOriginFilter] = useState<string[]>(() => { try{ return JSON.parse(localStorage.getItem(LS.origins) || '[]') }catch{ return [] }})
  const [sort, setSort] = useState<SortKey>(() => (localStorage.getItem(LS.sort) as SortKey) || 'roast_date')
  useEffect(()=>{ localStorage.setItem(LS.q, q) },[q])
  useEffect(()=>{ localStorage.setItem(LS.stock, stock) },[stock])
  useEffect(()=>{ localStorage.setItem(LS.origins, JSON.stringify(originFilter)) },[originFilter])
  useEffect(()=>{ localStorage.setItem(LS.sort, sort) },[sort])
  const filteredSortedBeans = useMemo(()=> filterSortBeans(beans, { q, stock, origins: originFilter, sort }),[beans, q, stock, originFilter, sort])

  // セオリー/推奨/挽き目表記
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
    if(form.brew_date) params.set('brew_date', form.brew_date)
    fetch(`${API}/api/derive?`+params.toString()).then(r=>r.json()).then(setDerive)
  },[form.bean_id, form.grind, form.dose_g, form.water_g, form.water_temp_c, form.dripper, form.brew_date, API])

  // 豆ごと統計
  useEffect(()=>{
    if(!form.bean_id){ setBeanStats(null); return }
    fetch(`${API}/api/stats?scope=bean&bean_id=${form.bean_id}`).then(r=>r.json()).then(setBeanStats)
  },[form.bean_id, API])

  // 最新ドリップ
  useEffect(()=>{
    if(!form.bean_id){ setLast(null); return }
    fetch(`${API}/api/drips/last?bean_id=${form.bean_id}`)
      .then(r=>r.json())
      .then(setLast)
      .catch(()=> setLast(null))
  },[form.bean_id, API])

  // ドリップ取得＆“ベスト”抽出＆レーダーデータ作成
  useEffect(()=>{
    if(!form.bean_id){ setBeanDrips([]); setAllDrips([]); setBestPatterns([]); setSelectedPatternId(''); setBestSameRoast(null); setBestOriginNear(null); setRadarData([]); return }
    ;(async ()=>{
      const r = await fetch(`${API}/api/drips`)
      const all = await r.json()
      setAllDrips(all)

      const targetBean = beans.find(b=> String(b.id)===String(form.bean_id))
      const beansById: Record<string, any> = {}
      for (const b of beans) beansById[String(b.id)] = b

      const mine = all.filter((d:any)=> String(d.bean_id)===String(form.bean_id))
      // レーダー：この豆の平均
      const radarKeys = [
        {key:'clean', label:'クリーンさ'},
        {key:'flavor', label:'風味'},
        {key:'acidity', label:'酸味'},
        {key:'bitterness', label:'苦味'},
        {key:'sweetness', label:'甘味'},
        {key:'body', label:'コク'},
        {key:'aftertaste', label:'後味'},
      ]
      const beanAvgMap: Record<string, number> = {}
      for (const k of radarKeys){
        const vals = mine.map((d:any)=> d.ratings?.[k.key]).filter((x:any)=> typeof x==='number')
        beanAvgMap[k.key] = vals.length? (vals.reduce((a:number,b:number)=>a+b,0)/vals.length) : 0
      }

      // 相関用 Δ を付与
      const withDeltas = mine.map((d:any)=>{
        const roast = d.roast_level ?? 'シティ'
        const recTemp = (d.derived?.recommended?.temp_c as number | undefined) ?? (ROAST_TEMP[roast] ?? 82.5)
        const tempDelta = (typeof d.water_temp_c === 'number' && Number.isFinite(recTemp)) ? (d.water_temp_c - recTemp) : null
        const label20 = d.derive?.grind?.label20 || d.label20 || null
        const group = toGrindGroup(label20)
        const recTime = group ? GRIND_TIME[group] : null
        const actSec = (typeof d.time_sec === 'number') ? d.time_sec : null
        const timeDelta = (actSec!=null && recTime!=null) ? (actSec - recTime) : null
        return { ...d, _deltas: { temp_delta: tempDelta, time_delta: timeDelta } }
      })
      setBeanDrips(withDeltas)

      // ---- “ベスト”抽出 ----
      const shareOrigin = (b1:any, b2:any)=>{
        const a = String(b1?.origin||'').split(',').map((s:string)=>s.trim()).filter(Boolean)
        const b = String(b2?.origin||'').split(',').map((s:string)=>s.trim()).filter(Boolean)
        return a.some(x=> b.includes(x))
      }
      const nearSet = nearRoastSet(targetBean?.roast_level)

      const sortBest = (arr:any[]) =>
        arr.filter(d=> Number.isFinite(Number(d?.ratings?.overall)))
           .sort((a,b)=> Number(b.ratings.overall) - Number(a.ratings.overall) || (new Date(b.brew_date).getTime() - new Date(a.brew_date).getTime()))

      const sameRoastCandidates = all.filter((d:any)=>{
        const bb = beansById[String(d.bean_id)]
        return bb && targetBean && bb.roast_level === targetBean.roast_level
      })
      const originNearCandidates = all.filter((d:any)=>{
        const bb = beansById[String(d.bean_id)]
        return bb && targetBean && shareOrigin(targetBean, bb) && nearSet.has(bb.roast_level)
      })

      const bestSR = sortBest(sameRoastCandidates)[0] || null
      const bestON = sortBest(originNearCandidates)[0] || null
      setBestSameRoast(bestSR)
      setBestOriginNear(bestON)

      // パターン（適用用）
      const mkFields = (d:any)=> d ? ({
        grind: d.grind,
        water_temp_c: d.water_temp_c,
        dose_g: d.dose_g,
        water_g: d.water_g,
        drawdown_g: d.drawdown_g ?? null,
        time: secToMMSS(d.time_sec),
        dripper: d.dripper ?? null,
        storage: d.storage ?? null,
      }) : {}
      const pats: BestPattern[] = []
      if (bestSR) pats.push({ id:'sameRoast', label:`同焙煎度ベスト（★${bestSR.ratings?.overall ?? '-'} / ${bestSR.brew_date} / ${bestSR.dripper ?? '—'}）`, fields: mkFields(bestSR) })
      if (bestON) pats.push({ id:'originNear', label:`同産地×近焙煎度ベスト（★${bestON.ratings?.overall ?? '-'} / ${bestON.brew_date} / ${bestON.dripper ?? '—'}）`, fields: mkFields(bestON) })
      setBestPatterns(pats)
      setSelectedPatternId(pats[0]?.id || '')

      // レーダー：横並び比較（この豆平均 / 同焙煎度ベスト / 同産地×近焙煎度ベスト）
      const srRatings = bestSR?.ratings || {}
      const onRatings = bestON?.ratings || {}
      const rd = radarKeys.map(k=> ({
        subject: k.label,
        beanAvg: Number(beanAvgMap[k.key] ?? 0),
        sameRoastBest: Number(srRatings?.[k.key] ?? 0),
        originNearBest: Number(onRatings?.[k.key] ?? 0),
      }))
      setRadarData(rd)
    })()
  },[form.bean_id, API, beans])

  const validate = ()=>{
    if(!form.bean_id) return '使用豆'
    if(!form.brew_date) return 'ドリップ日'
    if(form.grind==='' || form.grind==null) return '挽き目'
    if(form.water_temp_c==='' || form.water_temp_c==null) return '湯温(℃)'
    if(form.dose_g==='' || form.dose_g==null) return '豆(g)'
    if(form.water_g==='' || form.water_g==null) return '湯量(g)'
    if(!form.time) return '抽出時間(mm:ss)'
    if(!form.dripper) return 'ドリッパー'
    if(!form.storage) return '保存状態'
    return null
  }

  const submit = async (e:any)=>{
    e.preventDefault()
    const miss = validate()
    // brew_date が空なら dripDate を入れる
if (!form.brew_date) {
  form.brew_date = dripDate || new Date().toISOString().slice(0, 10)
}
    if(miss){ alert(`必須項目が不足：${miss}`); return }
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
    const url = editingDripId ? `${API}/api/drips/${editingDripId}` : `${API}/api/drips`
    const method = editingDripId ? 'PUT' : 'POST'
    const r = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
    if(r.ok){ setForm({ratings:{}}); setEditingDripId(null); onSaved() }
  }

  // 表示ヘルパ
  const selBean = beans.find(b=> String(b.id)===String(form.bean_id))
  const showOrDash = (cond:any, val:any, dashWhenBean?:string)=> cond ? (val ?? '—') : (dashWhenBean ?? '--')
  const isUnknown = (v?: any) => {
    const s = String(v ?? '').trim()
    return !s || s === '—' || s === '-' || s === '不明' || s.startsWith('不明')
  }
  const theoryWithValue = (theory?: any, value?: any) => {
    const t = isUnknown(theory) ? '' : String(theory)
    const v = isUnknown(value) ? '' : String(value)
    if (v && t) return `${v}（${t}）`
    if (v) return v
    if (t) return t
    return ''
  }
  const TheoryRow = ({ label, theory, value, show = true }:{label:string; theory:any; value:any; show?:boolean}) => {
    if (!show) return null
    const txt = theoryWithValue(theory, value)
    return txt ? <div>{label}：{txt}</div> : null
  }
  const StarRow = ({avg}:{avg:number|undefined})=>{
    if (avg == null || isNaN(Number(avg))) return <span>--</span>
    const s = Math.round(Number(avg)/2)
    return (<span aria-label={`rating ${s} of 5`}>{'★★★★★'.slice(0,s)}{'☆☆☆☆☆'.slice(0,5-s)} <span className="text-[11px] text-gray-500">({avg})</span></span>)
  }
  const originTheoryText = ()=>{
    if(!selBean?.origin) return '—'
    const cs = String(selBean.origin).split(',').map(s=>s.trim()).filter(Boolean)
    const notes = cs.map(c => ORIGIN_THEORIES[c] ? `${c}：${ORIGIN_THEORIES[c]}` : '').filter(Boolean)
    return notes.length ? notes.join(' ／ ') : '—'
  }

  // 指標切替
  const yAccessor = useMemo(()=>({
    key: `ratings.${yMetric}`,
    label: yMetric === 'overall' ? '総合' : (yMetric==='clean'?'クリーンさ':(yMetric==='flavor'?'風味':'コク'))
  }),[yMetric])

  // 相関
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
  const rTempBean = useMemo(()=> { const v = corr(beanPairsTemp); return (v==null? null : Math.round(v*100)/100) },[beanPairsTemp])
  const rTimeBean = useMemo(()=> { const v = corr(beanPairsTime); return (v==null? null : Math.round(v*100)/100) },[beanPairsTime])

  // 表示条件
  const hasStats     = !!(beanStats && Number(beanStats.count) > 0)
  const hasAvg       = !!(hasStats && beanStats.avg_overall != null)
  const hasByMethod  = !!(hasStats && Array.isArray(beanStats.by_method) && beanStats.by_method.length > 0)
  const hasRadar     = !!(Array.isArray(radarData) && radarData.some(d => (d.beanAvg||d.sameRoastBest||d.originNearBest) > 0))
  const hasPairsTemp = (beanPairsTemp.length > 0)
  const hasPairsTime = (beanPairsTime.length > 0)

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* ソート・絞り込み */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-600">フリーワード検索</label>
          <input className="border rounded p-2 w-full text-sm" placeholder="名前・産地・品種・精製など"
                 value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600">在庫</label>
          <select className="border rounded p-2 text-sm" value={stock} onChange={e=>setStock(e.target.value as any)}>
            <option value="all">全部</option>
            <option value="in">あり</option>
            <option value="out">なし</option>
          </select>
        </div>
        <div className="min-w-[220px]">
          <label className="block text-xs text-gray-600">産地フィルタ（複数可）</label>
          <select multiple className="border rounded p-2 text-sm w-full h-24"
                  value={originFilter}
                  onChange={e=>{
                    const v = Array.from(e.target.selectedOptions).map(o=>o.value)
                    setOriginFilter(v)
                  }}>
            {ORIGINS.map(o=> <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">ソート（昇順）</label>
          <select className="border rounded p-2 text-sm" value={sort} onChange={e=>setSort(e.target.value as any)}>
            <option value="roast_date">焙煎日</option>
            <option value="roast_level">焙煎度</option>
            <option value="ppg">g単価</option>
            <option value="name">名前</option>
          </select>
        </div>
      </div>

      {/* 1列目：豆＆日付 */}
      <div className="grid grid-cols-2 gap-2">
        <select className="border rounded p-2" value={form.bean_id||''} onChange={e=>handle('bean_id', e.target.value)} required>
          <option value="">使用豆を選択</option>
          {filteredSortedBeans.map((b:any) => (
            <option key={b.id} value={b.id}>{beanOptionLabel(b)}</option>
          ))}
        </select>
        <input   className="border rounded p-2"   type="date"   value={form.brew_date || dripDate}   onChange={e=>{     setDripDate(e.target.value)     handle('brew_date', e.target.value)   }} />
      </div>

      {(last || bestPatterns.length>0) && (
        <div className="text-xs flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {last && (
            <>
              <span className="text-gray-600">
                前回（{last.brew_date} / {last.dripper ?? '—'}）：挽き{last.grind ?? '—'}・湯温{last.water_temp_c ?? '—'}℃
                ・豆{last.dose_g ?? '—'}g・湯量{last.water_g ?? '—'}g・時間{last.time_sec!=null ? `${Math.floor(last.time_sec/60)}:${String(last.time_sec%60).padStart(2,'0')}` : '—'}
              </span>
              <button type="button" onClick={applyLast} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">
                前回値を適用
              </button>
            </>
          )}

          {bestPatterns.length>0 && (
            <div className="flex items-center gap-2">
              <select className="border rounded p-1" value={selectedPatternId} onChange={e=>setSelectedPatternId(e.target.value as any)}>
                {bestPatterns.map(p=>(
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <button type="button" onClick={applyBest} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">
                暫定最適値を適用
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* セオリー & 統計 */}
      <div className="bg-gray-50 border rounded p-2 space-y-2 text-sm">
        <div className="font-semibold">選択豆：{selBean?.name ?? '--'}</div>

        <TheoryRow label="産地セオリー" theory={originTheoryText()} value={selBean?.origin} show={!!form.bean_id}/>
        <TheoryRow label="精製セオリー" theory={derive?.theory?.process} value={selBean?.process} show={!!form.bean_id}/>
        <TheoryRow label="追加処理セオリー" theory={derive?.theory?.addl_process} value={selBean?.addl_process} show={!!form.bean_id}/>

        {!isUnknown(selBean?.taste_memo) && (<div>テイストメモ：{selBean?.taste_memo}</div>)}
        {!isUnknown(selBean?.brew_policy) && (<div>ドリップ方針メモ：{selBean?.brew_policy}</div>)}

        {hasAvg && (<div className="text-sm">平均評価（★）：<StarRow avg={beanStats?.avg_overall} /></div>)}

        {/* レーダー：この豆の平均 / 同焙煎度ベスト / 同産地×近焙煎度ベスト */}
        {hasRadar && (
          <div className="h-56">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 10]} />
                <Radar name="この豆の平均" dataKey="beanAvg" fillOpacity={0.2} />
                {bestSameRoast && <Radar name="同焙煎度ベスト" dataKey="sameRoastBest" fillOpacity={0.2} />}
                {bestOriginNear && <Radar name="産地×近焙煎度ベスト" dataKey="originNearBest" fillOpacity={0.2} />}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 豆ごとバー（抽出方法別平均） */}
        {hasStats && (
          <div className="text-xs">
            記録数：{beanStats.count}　平均：{beanStats.avg_overall}　最高：{beanStats.max_overall}
          </div>
        )}
        {hasByMethod && (
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={beanStats.by_method}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dripper" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avg_overall" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 相関 */}
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
          {hasPairsTemp && (
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
          )}
        </div>

        {/* 時間差 vs 指標 */}
        <div>
          {hasPairsTime && (
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
          )}
        </div>
      </div>

      {/* 入力群 */}
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
          <div className="text-[11px] text-gray-600 mt-1">
            {(() => {
              const b = beans.find(b => String(b.id) === String(form.bean_id));
              const price = Number(b?.price_yen), weight = Number(b?.weight_g), dose = Number(form.dose_g);
              if (!b || !Number.isFinite(price) || !Number.isFinite(weight) || !Number.isFinite(dose) || weight <= 0) return '費用：--';
              const perG = Math.round((price / weight) * 100) / 100;
              const cost = Math.round(perG * dose * 100) / 100;
              return `費用：約 ${cost} 円（${perG} 円/g）`;
            })()}
          </div>
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

      {/* 価格見積（豆の単価 × 使用量） */}
      {(() => {
        const b = beans.find(b => String(b.id) === String(form.bean_id));
        const price = Number(b?.price_yen);
        const weight = Number(b?.weight_g);
        const dose = Number(form.dose_g);
        if (!b || !Number.isFinite(price) || !Number.isFinite(weight) || !Number.isFinite(dose) || weight <= 0) {
          return null;
        }
        const perG = Math.round((price / weight) * 100) / 100;
        const cost = Math.round(perG * dose * 100) / 100;
        return (
          <div className="text-sm bg-gray-50 border rounded p-2">
            費用見積：{cost} 円（単価 {perG} 円/g）
          </div>
        );
      })()}

      {/* ---- 単一ドリップ可視化：入力中プレビュー ---- */}
      <div className="bg-white border rounded p-3 space-y-2">
        <div className="font-semibold text-sm">プレビュー（今回の抽出）</div>

        <div className="text-sm">
          {(() => {
            const r = form.ratings || {}
            const nums = Object.entries(r)
              .map(([k,v]: any)=> (v!=='' && v!=null ? Number(v) : null))
              .filter((x:any)=> Number.isFinite(x)) as number[]
            const overall = Number(r.overall)
            const base = Number.isFinite(overall) ? overall :
                         (nums.length ? Math.round((nums.reduce((a,b)=>a+b,0)/nums.length)*10)/10 : null)
            return <>総合（★）：{
              base==null ? '--' :
              (<span aria-label={`rating ${Math.round(base/2)} of 5`}>
                {'★★★★★'.slice(0,Math.round(base/2))}{'☆☆☆☆☆'.slice(0,5-Math.round(base/2))}
                <span className="text-[11px] text-gray-500">（{base}）</span>
              </span>)
            }</>
          })()}
        </div>

        <div className="h-44">
          <ResponsiveContainer>
            <RadarChart data={[
              {subject:'クリーンさ', value: Number(form.ratings?.clean)||0},
              {subject:'風味',     value: Number(form.ratings?.flavor)||0},
              {subject:'酸味',     value: Number(form.ratings?.acidity)||0},
              {subject:'苦味',     value: Number(form.ratings?.bitterness)||0},
              {subject:'甘味',     value: Number(form.ratings?.sweetness)||0},
              {subject:'コク',     value: Number(form.ratings?.body)||0},
              {subject:'後味',     value: Number(form.ratings?.aftertaste)||0},
            ]}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={30} domain={[0,10]} />
              <Radar name="now" dataKey="value" fillOpacity={0.3} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          <div className="border rounded p-2">
            <div className="font-medium">湯温</div>
            <div>推奨：{showOrDash(!!form.bean_id, derive?.temp?.recommended_c)}℃</div>
            <div>Δ：{(form.bean_id && form.water_temp_c) ? (derive?.temp?.delta_from_input ?? '—') : '--'}</div>
          </div>
          <div className="border rounded p-2">
            <div className="font-medium">レシオ/湯量</div>
            <div>推奨比：{showOrDash(!!form.bean_id, derive?.ratio?.recommended_ratio)}倍</div>
            <div>推奨湯量：{(form.bean_id && form.dose_g) ? (derive?.ratio?.recommended_water_g ?? '—') : '--'}g</div>
            <div>Δ：{(form.bean_id && form.dose_g && form.water_g) ? (derive?.ratio?.delta_from_input ?? '—') : '--'}</div>
          </div>
          <div className="border rounded p-2">
            <div className="font-medium">時間</div>
            <div>推奨：{showOrDash(!!form.bean_id, derive?.time?.recommended_sec)}秒</div>
            {form.time ? (
              <div>Δ：{(() => {
                const rec = Number(derive?.time?.recommended_sec)
                const mmss = String(form.time||'')
                const m = mmss.split(':'); const sec = (m.length===2 ? (+m[0]*60 + +m[1]) : NaN)
                return (Number.isFinite(rec) && Number.isFinite(sec)) ? (sec-rec) : '—'
              })()}</div>
            ) : <div>Δ：--</div>}
          </div>
        </div>
      </div>
      {/* ---- /プレビュー ---- */}

      <button className="px-3 py-2 rounded bg-blue-600 text-white">ドリップを記録</button>
    </form>
  )
}

export default DripForm
