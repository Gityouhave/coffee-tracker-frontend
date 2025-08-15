// src/pages/App.tsx
import React, { useEffect, useState } from 'react'
import { DripList } from '../components/DripList'
import { BeanForm } from '../components/BeanForm'
import { DripForm } from '../components/DripForm'
import MissingOrigins from '../components/MissingOrigins'

// API は一度だけ決定（VITE_BACKEND_URL → VITE_API → ローカルの優先順）
const API =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  (import.meta as any).env?.VITE_API ||
  'http://localhost:8000'

type Bean = any
type Drip = any

export default function App() {
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

  useEffect(() => {
    fetchBeans()
    fetchDrips()
    fetchStats()
  }, [])

  return (
    <main className="mx-auto max-w-5xl p-4 space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Coffee Tracker ☕</h1>
        <span className="text-sm text-gray-500">
          Backend: <code>{API}</code>
        </span>
      </header>

      {/* 1) 豆フォーム + 欠落産地 */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">1) コーヒー豆</h2>
          <BeanForm API={API} onSaved={fetchBeans} />
          <div className="mt-3">
            <MissingOrigins API={API} />
          </div>
        </div>

        {/* 2) ドリップ記録 */}
        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">2) ドリップ記録</h2>
          <DripForm
            API={API}
            beans={beans}
            onSaved={() => {
              fetchDrips()
              fetchStats()
            }}
          />
          <div className="mt-3 text-sm text-gray-600">記録数：{drips.length}</div>
        </div>
      </section>

      {/* 3) 簡易統計 */}
      <section className="p-4 bg-white rounded-2xl shadow">
        <h3 className="font-semibold mb-2">3) 統計（全体）</h3>
        {stats ? (
          <div className="text-sm">
            平均評価：{stats.avg_overall ?? '—'}（n={stats.count ?? 0}）
          </div>
        ) : (
          <div className="text-sm text-gray-400">データがありません</div>
        )}
      </section>

      {/* 4) 最近のドリップ履歴（編集・削除） */}
      <section className="p-4 bg-white rounded-2xl shadow">
        <h3 className="font-semibold mb-2">最近のドリップ履歴（編集・削除）</h3>
        <DripList
          API={API}
          onChanged={() => {
            fetchDrips()
            fetchStats()
          }}
        />
      </section>
    </main>
  )
}
