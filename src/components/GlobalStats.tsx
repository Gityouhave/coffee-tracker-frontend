import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend
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
const toSec = (mmss?: string|null) => {
  if (!mmss) return null
  const [m,s] = mmss.split(':')
  const mi = Number(m), se = Number(s)
  if (isNaN(mi)||isNaN(se)) return null
  return mi*60 + se
}
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

export default function GlobalStats({API}:{API:string}){
  const [drips, setDrips] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)

  // Y軸の評価指標（総合/クリーンさ/風味/コク）
  const [yMetric, setYMetric] = useState<'overall'|'clean'|'flavor'|'body'>('overall')
  const yKey = useMemo(()=> `ratings.${yMetric}`, [yMetric])
  const yLabel = useMemo(()=>(
    yMetric==='overall'?'総合':yMetric==='clean'?'クリーンさ':yMetric==='flavor'?'風味':'コク'
  ),[yMetric])

  // データ取得
  useEffect(()=>{
    (async ()=>{
      const r1 = await fetch(`${API}/api/drips`); setDrips(await r1.json())
      const r2 = await fetch(`${API}/api/stats`); setStats(await r2.json())
    })()
  },[API])

  // Δ付与
  const dripsWithDeltas = useMemo(()=>{
    return drips.map((d:any)=>{
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
  },[drips])

  // 相関値 r
  const pairsTemp = useMemo(()=> dripsWithDeltas
    .map((d:any)=> [d?._deltas?.temp_delta, d?.ratings?.[yMetric]] as [number,number])
    .filter(([x,y])=> Number.isFinite(x) && Number.isFinite(y))
  ,[dripsWithDeltas,yMetric])

  const pairsTime = useMemo(()=> dripsWithDeltas
    .map((d:any)=> [d?._deltas?.time_delta, d?.ratings?.[yMetric]] as [number,number])
    .filter(([x,y])=> Number.isFinite(x) && Number.isFinite(y))
  ,[dripsWithDeltas,yMetric])

  const rTemp = useMemo(()=>{ const v = corr(pairsTemp); return v==null? null : Math.round(v*100)/100 },[pairsTemp])
  const rTime = useMemo(()=>{ const v = corr(pairsTime); return v==null? null : Math.round(v*100)/100 },[pairsTime])

  return (
    <section className="grid lg:grid-cols-2 gap-6">
      {/* 左：抽出方法別平均（棒） */}
      <div className="p-4 bg-white rounded-2xl shadow">
        <h3 className="font-semibold mb-2">3) 統計（全体）</h3>
        {stats && <div className="text-sm mb-3">平均評価：{stats.avg_overall ?? '-'}（n={stats.count ?? 0}）</div>}
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={stats?.by_method ?? []}>
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

      {/* 右上：評価指標セレクタ */}
      <div className="p-4 bg-white rounded-2xl shadow">
        <h3 className="font-semibold mb-2">評価指標</h3>
        <select className="border rounded p-2 text-sm" value={yMetric} onChange={e=>setYMetric(e.target.value as any)}>
          <option value="overall">総合</option>
          <option value="clean">クリーンさ</option>
          <option value="flavor">風味</option>
          <option value="body">コク</option>
        </select>
        <div className="text-xs text-gray-500 mt-1">※下の散布図のY軸が切り替わります</div>
      </div>

      {/* 下：湯温差/時間差 × 指標（散布） */}
      <div className="p-4 bg-white rounded-2xl shadow">
        <h3 className="font-semibold mb-2">
          全体：湯温差（実測−推奨） vs {yLabel}
          <span className="ml-2 text-xs text-gray-500">r={rTemp ?? '—'}</span>
        </h3>
        <div className="h-64">
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid />
              <XAxis dataKey="_deltas.temp_delta" name="tempΔ(°C)" />
              <YAxis dataKey={yKey} name={yLabel} />
              <Tooltip />
              <Scatter name="drips" data={dripsWithDeltas} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-4 bg-white rounded-2xl shadow">
        <h3 className="font-semibold mb-2">
          全体：時間差（実測秒−推奨秒） vs {yLabel}
          <span className="ml-2 text-xs text-gray-500">r={rTime ?? '—'}</span>
        </h3>
        <div className="h-64">
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid />
              <XAxis dataKey="_deltas.time_delta" name="timeΔ(s)" />
              <YAxis dataKey={yKey} name={yLabel} />
              <Tooltip />
              <Scatter name="drips" data={dripsWithDeltas} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
