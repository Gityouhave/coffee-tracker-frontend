import React, { useEffect, useState } from 'react'
import GlobalStats from '../components/GlobalStats'
import { BeanForm } from '../components/BeanForm'
import { DripForm } from '../components/DripForm'
import MissingOrigins from '../components/MissingOrigins'

const API = import.meta.env.VITE_BACKEND_URL || 'https://<your-username>.pythonanywhere.com'

type Bean = any
type Drip = any

export default function App(){
  const [beans, setBeans] = useState<Bean[]>([])
  const [drips, setDrips] = useState<Drip[]>([])

  const fetchBeans = async () => {
    const r = await fetch(`${API}/api/beans`)
    setBeans(await r.json())
  }
  const fetchDrips = async () => {
    const r = await fetch(`${API}/api/drips`)
    setDrips(await r.json())
  }

  useEffect(()=>{ fetchBeans(); fetchDrips(); }, [])

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
          <DripForm API={API} beans={beans} onSaved={()=>{fetchDrips()}} />
          <div className="mt-4 text-sm text-gray-600">
            <p>記録数：{drips.length}</p>
          </div>
        </div>
      </section>

      {/* 下段：全体統計（専用コンポーネント） */}
      <GlobalStats API={API} />
    </div>
  )
}
