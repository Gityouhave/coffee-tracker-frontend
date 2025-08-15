// src/pages/App.tsx
import React, { useEffect, useState } from 'react'
import Tabs from '../components/Tabs'
import DripList from '../components/DripList'          // default export
import { BeanForm } from '../components/BeanForm'
import { DripForm } from '../components/DripForm'
import MissingOrigins from '../components/MissingOrigins'

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

  const dashHeader = (
    <header className="flex items-baseline justify-between">
      <h1 className="text-2xl font-bold">Coffee Tracker ☕</h1>
      <span className="text-xs text-gray-500">
        Backend: <code>{API}</code>
      </span>
    </header>
  )

  return (
    <main className="mx-auto max-w-6xl p-4 space-y-4">
      {dashHeader}

      <Tabs
        storageKey="ct_last_tab"
        tabs={[
          {
            id: 'beans',
            label: '豆 管理',
            content: (
              <div className="grid lg:grid-cols-2 gap-6">
                <section className="p-4 bg-white rounded-2xl shadow">
                  <h2 className="font-semibold mb-2">1) コーヒー豆を登録・編集</h2>
                  <BeanForm API={API} onSaved={fetchBeans} />
                </section>

                <section className="p-4 bg-white rounded-2xl shadow">
                  <h3 className="font-semibold mb-2">欠落産地（在庫基準）</h3>
                  <MissingOrigins API={API} />
                </section>
              </div>
            ),
          },
          {
            id: 'drip',
            label: 'ドリップ記録',
            content: (
              <section className="p-4 bg-white rounded-2xl shadow">
                <h2 className="font-semibold mb-2">2) ドリップを記録</h2>
                <DripForm
                  API={API}
                  beans={beans}
                  onSaved={() => {
                    fetchDrips()
                    fetchStats()
                  }}
                />
              </section>
            ),
          },
          {
            id: 'history',
            label: '履歴',
            badge: drips?.length ?? 0,
            content: (
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
            ),
          },
          {
            id: 'stats',
            label: '統計',
            content: (
              <section className="p-4 bg-white rounded-2xl shadow space-y-3">
                <h3 className="font-semibold">3) 統計（全体）</h3>
                {stats ? (
                  <div className="text-sm">
                    平均評価：{stats.avg_overall ?? '—'}（n={stats.count ?? 0}）
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">データがありません</div>
                )}
                {/* ここに既存の散布図・レーダー等のチャートを配置してOK */}
              </section>
            ),
          },
        ]}
      />
    </main>
  )
}
