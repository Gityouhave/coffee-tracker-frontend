// src/components/MissingOrigins.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { STAR_SECTIONS, STAR_GROUPS, ORIGIN_TO_STAR } from '../constants/originGroups'

type Bean = {
  id: number
  name: string
  origin?: string | null  // カンマ区切りの可能性あり
  in_stock?: boolean
}

export default function MissingOrigins({API}:{API:string}){
  const [beans, setBeans] = useState<Bean[]>([])

  useEffect(()=>{
    (async ()=>{
      const r = await fetch(`${API}/api/beans`)
      const data = await r.json()
      setBeans(Array.isArray(data) ? data : [])
    })()
  },[API])

  // 在庫ありの豆だけを対象に、origin をカンマ分割→trim→空要素除去
  const ownedOrigins = useMemo(()=>{
    const set = new Set<string>()
    beans.filter(b=> b.in_stock).forEach(b=>{
      const s = (b.origin ?? '').split(',').map(x=>x.trim()).filter(Boolean)
      s.forEach(o => set.add(o))
    })
    return set
  },[beans])

  // セクションごとの欠落一覧
  const missingBySection = useMemo(()=>{
    const res: Record<string, string[]> = {}
    for(const star of STAR_SECTIONS){
      const targets = STAR_GROUPS[star]
      res[star] = targets.filter(o => !ownedOrigins.has(o))
    }
    return res
  },[ownedOrigins])

  // 全体欠落数（バッジ用）
  const totalMissing = useMemo(()=>{
    return STAR_SECTIONS.reduce((acc, star)=> acc + (missingBySection[star]?.length ?? 0), 0)
  },[missingBySection])

  return (
    <div className="mt-4 border rounded-2xl p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">欠落産地（在庫基準）</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white border">欠落合計：{totalMissing}</span>
      </div>

      <div className="space-y-3">
        {STAR_SECTIONS.map(star => {
          const miss = missingBySection[star] || []
          return (
            <div key={star}>
              <div className="text-sm font-semibold mb-1">{star}</div>
              {miss.length === 0 ? (
                <div className="text-xs text-green-700 bg-white border rounded p-2">この大枠は揃っています 🎉</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {miss.map(o=>(
                    <span key={o} className="text-xs px-2 py-1 bg-white border rounded">{o}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 参考：現在の在庫内産地（確認用。不要なら削除OK） */}
      <details className="mt-3">
        <summary className="text-xs text-gray-600 cursor-pointer">在庫にある産地を確認</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {[...ownedOrigins].map(o=>(
            <span key={o} className="text-[11px] px-2 py-1 bg-white border rounded">
              {o} <span className="text-gray-500">/ {ORIGIN_TO_STAR[o] ?? '（分類外）'}</span>
            </span>
          ))}
        </div>
      </details>
    </div>
  )
}
