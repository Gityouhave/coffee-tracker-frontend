import React, { useState, useEffect } from 'react'
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts'

export function DripForm({ API, beans, onSaved }: { API: string; beans: any[]; onSaved: () => void }) {
  const [form, setForm] = useState<any>({})
  const [selectedBeanId, setSelectedBeanId] = useState<number | null>(null)
  const [beanStats, setBeanStats] = useState<any>(null)

  const handle = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }))

  // 選択された豆
  const selectedBean = beans.find(b => b.id === selectedBeanId)

  // 選択時に統計を取得
  useEffect(() => {
    if (!selectedBeanId) { setBeanStats(null); return }
    fetch(`${API}/api/stats?scope=bean&bean_id=${selectedBeanId}`)
      .then(r => r.json())
      .then(setBeanStats)
  }, [selectedBeanId])

  // 味セオリー生成（例）
  const getTheoryText = () => {
    if (!selectedBean) return null
    const parts: string[] = []
    if (selectedBean.origin) {
      parts.push(`産地セオリー：${selectedBean.origin}（明るい酸味や特徴的なフレーバー）`)
    }
    if (selectedBean.variety) {
      parts.push(`品種セオリー：${selectedBean.variety}（品種特有の風味傾向）`)
    }
    if (selectedBean.process) {
      parts.push(`精製セオリー：${selectedBean.process}（精製による風味傾向）`)
    }
    if (selectedBean.addl_process) {
      parts.push(`追加処理セオリー：${selectedBean.addl_process}（追加処理による特徴）`)
    }
    return parts
  }

  const submit = async (e: any) => {
    e.preventDefault()
    const r = await fetch(`${API}/api/drips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    if (r.ok) { setForm({}); onSaved() }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {/* 豆の選択 */}
      <label className="text-sm">豆を選択</label>
      <select
        className="w-full border rounded p-2"
        value={selectedBeanId ?? ''}
        onChange={e => {
          const id = e.target.value ? parseInt(e.target.value) : null
          setSelectedBeanId(id)
          handle('bean_id', id)
        }}
      >
        <option value="">--選択しない--</option>
        {beans.map(b => {
          const labelParts = [b.name, b.origin, b.variety, b.process, b.addl_process]
            .filter(Boolean)
            .join('・') + (b.roast_level ? `（${b.roast_level}）` : '')
          return <option key={b.id} value={b.id}>{labelParts}</option>
        })}
      </select>

      {/* 選択後のセオリー表示 */}
      {selectedBean && (
        <div className="bg-gray-50 p-2 rounded text-sm space-y-1">
          {getTheoryText()?.map((t, i) => <p key={i}>{t}</p>)}
        </div>
      )}

      {/* 選択後の棒グラフ統計 */}
      {beanStats && (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={beanStats.by_method ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dripper" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avg_overall" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 以下はドリップ入力欄（省略・既存の内容をここに） */}
      {/* ... */}
    </form>
  )
}
