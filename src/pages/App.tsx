import React, { useEffect, useMemo, useState } from 'react'
import { DripList } from '../components/DripList'
import GlobalStats from '../components/GlobalStats'
import { BeanForm } from '../components/BeanForm'
import { DripForm } from '../components/DripForm'
import MissingOrigins from '../components/MissingOrigins'

// ← API はここで一度だけ決める（優先順：VITE_BACKEND_URL → VITE_API → ローカル）
const API =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  (import.meta as any).env?.VITE_API ||
  'http://localhost:8000'

type Bean = any
type Drip = any

export default function App(){
  const [beans, setBeans] = useState<Bean[]>([])
  const [drips, setDrips] = useState<Drip[]>([])
  const [stats, setStats] = useState<any>(null)

  const fetchBeans = async ()=>{
    const r = await fetch(`${API}/api/beans`)
    setBeans(await r.json())
  }
  const fetchDrips = async ()=>{
    const r = await fetch(`${API}/api/drips`)
    setDrips(await r.json())
  }
  const fetchStats = async ()=>{
    const r = await fetch(`${API}/api/stats`)
    setStats(await r.json())
  }

  useEffect(()=>{ fetchBeans(); fetchDrips(); fetchStats() }, [])

  return (
    <main className="mx-auto max-w-5xl p-4 space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Coffee Tracker ☕</h1>
        <span className="text-sm text-gray-500">Backend: <code>{API}</code></span>
      </header>

      {/* 上段：左=豆フォーム（欠落産地つき）、右=ドリップ記録 */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">1) コーヒー豆</h2>
          <BeanForm API={API} onSaved={()=>{ fetchBeans() }} />
          <MissingOrigins API={API} />
        </div>

        <div className="p-4 bg-white rounded-2xl shadow">
          <h2 className="font-semibold mb-2">2) ドリップ記録</h2>
          <DripForm API={API} beans={beans} onSaved={()=>{ fetchDrips(); fetchStats(); }} />
          <div className="mt-4 text-sm text-gray-600">
            <p>記録数：{drips.length}</p>
          </div>
        </div>
      </section>

      {/* 全体統計（お好みで GlobalStats を使う or シンプル表示） */}
      <section className="p-4 bg-white rounded-2xl shadow">
        <h3 className="font-semibold mb-2">3) 統計（全体）</h3>
        {stats
          ? <div className="text-sm">平均評価：{stats.avg_overall ?? '-'}（n={stats.count ?? 0}）</div>
          : <div className="text-sm text-gray-400">データがありません</div>}
        {/* GlobalStats を使うならここで */}
        {/* <GlobalStats API={API} /> */}
      </section>

      {/* 最近のドリップ履歴（編集・削除） */}
      <section className="p-4 bg-white rounded-2xl shadow">
        <h3 className="font-semibold mb-2">最近のドリップ履歴（編集・削除）</h3>
        <DripList
          API={API}
          onChanged={()=>{
            // 子で更新（編集/削除）があったら最新化
            fetchDrips()
            fetchStats()
          }}
        />
      </section>
    </main>
  )
}
