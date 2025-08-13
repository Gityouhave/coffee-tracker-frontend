import React, { useEffect, useMemo, useState } from 'react'
import { BeanForm } from '../components/BeanForm'
import { DripForm } from '../components/DripForm'
import MissingOrigins from '../components/MissingOrigins'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts'

const API = import.meta.env.VITE_BACKEND_URL || 'https://<your-username>.pythonanywhere.com'

type Bean = any
type Drip = any

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
/** 20段階ラベル→6グループ */
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

export default function App(){
  const [beans, setBeans] = useState<Bean[]>([])
  const [drips, setDrips] = useState<Drip[]>([])
  const [stats, setStats] = useState<any>(null)

  // 全体相関の Y 指標（overall/clean/flavor/body）
  const [yMetric, setYMetric] = useState<'overall'|'clean'|'flavor'|'body'>('overall')
  const yKey = useMemo(()=> `ratings.${yMetric}`, [yMetric])
  const yLabel = useMemo(()=>(
    yMetric==='overall'?'総合':yMetric==='clean'?'クリーンさ':yMetric==='flavor'?'風味':'コク'
  ),[yMetric])

  const fetchBeans = async () => {
    const r = await fetch(`${API}/api/beans`)
    setBeans(await r.json())
  }
  const fetchDrips = async () => {
    const r = await fetch(`${API}/api/drips`)
    setDrips(await r.json())
  }
  const fetchStats = async () => {
    const r = await fetch(`${API}/api/stats`)
    setStats(await r.json())
  }

  useEffect(()=>{ fetchBeans(); fetchDrips(); fetchStats(); }, [])

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


  // 全体相関用：各ドリップに temp_delta/time_delta を付与
  const dripsWithDeltas = useMemo(()=>{
    return drips.map((d:any)=>{
      const roast = d.bean?.roast_level ?? d.roast_level ?? 'シティ'
      const recTemp = ROAST_TEMP[roast] ?? 82.5
      const tempDelta = (typeof d.water_temp_c === 'number') ? (d.water_temp_c - recTemp) : null

      // 20段階挽き目ラベルは保存時に d.derive?.grind?.label20 を持たせている想定。無い場合は null。
      const label20 = d.derive?.grind?.label20 || d.label20 || null
      const group = toGrindGroup(label20)
      const recTime = group ? GRIND_TIME[group] : null
      const actSec = toSec(d.time)
      const timeDelta = (actSec!=null && recTime!=null) ? (actSec - recTime) : null

      return { ...d, _deltas: { temp_delta: tempDelta, time_delta: timeDelta } }
    })
  }, [drips])
    const pairsTempAll = React.useMemo(()=>{
    return dripsWithDeltas
      .map((d:any)=> [d?._deltas?.temp_delta, d?.ratings?.[yMetric]] as [number,number])
      .filter(([x,y])=> Number.isFinite(x) && Number.isFinite(y))
  },[dripsWithDeltas, yMetric])

  const pairsTimeAll = React.useMemo(()=>{
    return dripsWithDeltas
      .map((d:any)=> [d?._deltas?.time_delta, d?.ratings?.[yMetric]] as [number,number])
      .filter(([x,y])=> Number.isFinite(x) && Number.isFinite(y))
  },[dripsWithDeltas, yMetric])

  const rTempAll = React.useMemo(()=> {
    const v = corr(pairsTempAll); return (v==null? null : Math.round(v*100)/100)
  },[pairsTempAll])

  const rTimeAll = React.useMemo(()=> {
    const v = corr(pairsTimeAll); return (v==null? null : Math.round(v*100)/100)
  },[pairsTimeAll])


  return (
    <div className="mx-auto max-w-5xl p-4 space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Coffee Tracker ☕</h1>
        <span className="text-sm text-gray-500">Backend: <code>{API}</code></span>
      </header>

      {/* 上段：左=豆フォーム（欠落産地つき）、右=ドリップ記録 */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">1) コーヒー豆</h2>
          <BeanForm API={API} onSaved={()=>{fetchBeans()}} />
          <MissingOrigins API={API} />
        </div>

        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">2) ドリップ記録</h2>
          <DripForm API={API} beans={beans} onSaved={()=>{fetchDrips(); fetchStats();}} />
          <div className="mt-4 text-sm text-gray-600">
            <p>記録数：{drips.length}</p>
          </div>
        </div>
      </section>

      {/* 下段：全体統計（棒） */}
      <section className="grid lg:grid-cols-2 gap-6">
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

        {/* レシオ差 vs 総合（既存）←必要なら残す。ここでは相関系を優先するため一旦削除してOK */}
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
      </section>

      {/* 追加：湯温差 / 時間差 の散布図（全体） */}
      <section className="grid lg:grid-cols-2 gap-6">
        {/* 湯温差 vs 評価（全体） */}
        <div className="p-4 bg-white rounded-2xl shadow">
          <h3 className="font-semibold mb-2">
  全体：湯温差（実測−推奨） vs {yLabel}
  <span className="ml-2 text-xs text-gray-500">r={rTempAll ?? '—'}</span>
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

        {/* 時間差 vs 評価（全体） */}
        <div className="p-4 bg-white rounded-2xl shadow">
          <h3 className="font-semibold mb-2">
  全体：時間差（実測秒−推奨秒） vs {yLabel}
  <span className="ml-2 text-xs text-gray-500">r={rTimeAll ?? '—'}</span>
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
    </div>
  )
}
