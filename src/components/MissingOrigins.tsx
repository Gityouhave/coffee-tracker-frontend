import React, { useEffect, useState } from 'react'

export default function MissingOrigins({API}:{API:string}) {
  const [gaps, setGaps] = useState<any|null>(null)
  const [loading, setLoading] = useState(false)
  const load = async ()=>{
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/gaps`)
      const j = await r.json()
      setGaps(j)
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, [API])

  const Badge = ({children}:{children:any}) => (
    <span className="px-2 py-0.5 text-xs border rounded-full bg-white">{children}</span>
  )

  return (
    <div className="mt-4 border rounded-2xl p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">欠落産地（⭐️大枠）</h3>
        <button onClick={load} className="text-xs px-2 py-1 border rounded">{loading?'更新中…':'更新'}</button>
      </div>
      {!gaps && <div className="text-sm text-gray-500">読み込み中…</div>}
      {gaps && (
        <div className="space-y-2 text-sm">
          {Object.entries(gaps).map(([bucket, countries]: any)=>(
            <div key={bucket}>
              <div className="text-xs text-gray-600 mb-1">⭐️{bucket}</div>
              {countries.length === 0 ? (
                <Badge>なし（全て在庫あり）</Badge>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {countries.map((c:string)=> <Badge key={c}>{c}</Badge>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="text-[11px] text-gray-500 mt-2">※在庫ありの豆に基づいて不足国を表示（在庫フラグが「無」は対象外）</div>
    </div>
  )
}
