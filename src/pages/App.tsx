import React, { useEffect, useMemo, useState } from 'react'
import { BeanForm } from '../components/BeanForm'
import { DripForm } from '../components/DripForm'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts'

const API = import.meta.env.VITE_BACKEND_URL || 'https://<your-username>.pythonanywhere.com'

type Bean = any
type Drip = any

export default function App(){
  const [beans, setBeans] = useState<Bean[]>([])
  const [drips, setDrips] = useState<Drip[]>([])
  const [selectedBeanId, setSelectedBeanId] = useState<number | null>(null)
  const [stats, setStats] = useState<any>(null)

  const fetchBeans = async () => {
    const r = await fetch(`${API}/api/beans`)
    setBeans(await r.json())
  }
  const fetchDrips = async () => {
    const r = await fetch(`${API}/api/drips`)
    setDrips(await r.json())
  }
  const fetchStats = async (scope: 'global'|'bean', beanId?: number) => {
    const q = scope==='bean' && beanId ? `?scope=bean&bean_id=${beanId}` : ''
    const r = await fetch(`${API}/api/stats${q}`)
    setStats(await r.json())
  }

  useEffect(()=>{ fetchBeans(); fetchDrips(); fetchStats('global'); }, [])

  const selectedBean = useMemo(()=> beans.find(b=>b.id===selectedBeanId), [beans, selectedBeanId])

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Coffee Tracker ☕</h1>
        <span className="text-sm text-gray-500">Backend: <code>{API}</code></span>
      </header>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">1) コーヒー豆</h2>
          <BeanForm API={API} onSaved={()=>{fetchBeans()}} />
          <div className="mt-4">
            <label className="text-sm">在庫豆を選択 → コーチング</label>
            <select className="w-full border rounded p-2" value={selectedBeanId ?? ''} onChange={e=>{
              const v = e.target.value ? parseInt(e.target.value) : null
              setSelectedBeanId(v); if(v) fetchStats('bean', v)
            }}>
              <option value="">選択しない</option>
              {beans.filter(b=>b.in_stock).map(b => <option key={b.id} value={b.id}>{b.name}（{b.origin ?? '産地不明'} / {b.roast_level}）</option>)}
            </select>
            {selectedBean && (
              <div className="text-sm mt-3 space-y-1">
                <p>産地セオリー：{selectedBean.theory?.origin ?? '—'}</p>
                <p>精製セオリー：{selectedBean.theory?.process ?? '—'}</p>
                <p>追加処理：{selectedBean.theory?.addl_process ?? '—'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">2) ドリップ記録</h2>
          <DripForm API={API} beans={beans} onSaved={()=>{fetchDrips(); fetchStats(selectedBeanId? 'bean':'global', selectedBeanId ?? undefined)}} />
          <div className="mt-4 text-sm text-gray-600">
            <p>記録数：{drips.length}</p>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded-2xl shadow">
          <h3 className="font-semibold mb-2">3) 統計（{selectedBean? '豆ごと':'全体'}）</h3>
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

        <div className="p-4 bg-white rounded-2xl shadow">
          <h3 className="font-semibold mb-2">最近のドリップ（評価 vs レシオ差）</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid />
                <XAxis dataKey="derived.deltas.ratio_delta" name="ratioΔ" />
                <YAxis dataKey="ratings.overall" name="overall" />
                <Tooltip />
                <Scatter name="drips" data={drips} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  )
}
