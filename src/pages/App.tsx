import React, { useEffect, useState } from 'react'
import { BeanForm } from '../components/BeanForm'
import { DripForm } from '../components/DripForm'
import MissingOrigins from '../components/MissingOrigins'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts'

const API = import.meta.env.VITE_BACKEND_URL || 'https://<your-username>.pythonanywhere.com'

type Bean = any
type Drip = any

export default function App(){
  const [beans, setBeans] = useState<Bean[]>([])
  const [drips, setDrips] = useState<Drip[]>([])
  const [stats, setStats] = useState<any>(null)

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

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Coffee Tracker ☕</h1>
        <span className="text-sm text-gray-500">Backend: <code>{API}</code></span>
      </header>

      {/* 上段：左=豆フォーム、右=ドリップ記録（ここにコーチングを集約） */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">1) コーヒー豆</h2>
          <BeanForm API={API} onSaved={()=>{fetchBeans()}} />
          <MissingOrigins API={API} />
        </div>

        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">2) ドリップ記録</h2>
          <DripForm
            API={API}
            beans={beans}
            onSaved={()=>{ fetchDrips(); fetchStats(); }}
          />
          <div className="mt-4 text-sm text-gray-600">
            <p>記録数：{drips.length}</p>
          </div>
        </div>
      </section>

           {/* 下段：全体統計（棒/散布） */}
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

        {/* レシオ差 vs 総合評価 */}
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

      {/* 追加：湯温差 / 時間差 の散布図 */}
      <section className="grid lg:grid-cols-2 gap-6">
        {/* 湯温差 vs 総合評価 */}
        <div className="p-4 bg-white rounded-2xl shadow">
          <h3 className="font-semibold mb-2">最近のドリップ（評価 vs 湯温差）</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid />
                <XAxis dataKey="derived.deltas.temp_delta" name="tempΔ(°C)" />
                <YAxis dataKey="ratings.overall" name="overall" />
                <Tooltip />
                <Scatter name="drips" data={drips} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 時間差 vs 総合評価 */}
        <div className="p-4 bg-white rounded-2xl shadow">
          <h3 className="font-semibold mb-2">最近のドリップ（評価 vs 時間差）</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid />
                <XAxis dataKey="derived.deltas.time_delta" name="timeΔ(s)" />
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
