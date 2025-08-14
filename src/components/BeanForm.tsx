// src/components/BeanForm.tsx
import React, { useEffect, useState } from 'react'
import { ORIGINS } from '../constants/origins'
import { ORIGIN_THEORIES } from '../constants/originTheories'

const PROCESS_OPTIONS = [
  '不明','ナチュラル','ウォッシュド','ハニー','レッドハニー','イエローハニー','ホワイトハニー','スマトラ'
] as const

const ADDL_PROCESS_OPTIONS = [
  '','不明','アナエロビック','モンスーン','インフューズド','バレルエイジド','エイジング'
] as const

const ROASTS = ['ライト','シナモン','ミディアム','ハイ','シティ','フルシティ','フレンチ','イタリアン'] as const

type Bean = any

export function BeanForm({API, onSaved}:{API:string; onSaved:()=>void}){
  const [form, setForm] = useState<any>({
    name:'', roast_level:'シティ', in_stock:true,
    origins: [] as string[], // 複数産地（ブレンド対応）
    process:'不明', addl_process:'', variety:'', roast_date:'', price_yen:'', weight_g:'',
    taste_memo:'', brew_policy:''
  })
  const [beans, setBeans] = useState<Bean[]>([])
  const [editingId, setEditingId] = useState<number|null>(null)
  const [dangerOpenId, setDangerOpenId] = useState<number|null>(null) // 危険操作の開閉（行ごと）

  const handle = (k:string,v:any)=> setForm((s:any)=> ({...s,[k]:v}))

  const loadBeans = async ()=>{
    const r = await fetch(`${API}/api/beans`)
    setBeans(await r.json())
  }
  useEffect(()=>{ loadBeans() }, [API])

  const startEdit = (b:Bean)=>{
    setEditingId(b.id)
    setForm({
      name: b.name || '',
      roast_level: b.roast_level || 'シティ',
      in_stock: !!b.in_stock,
      // 既存は文字列保存を想定 → 配列化
      origins: (b.origin ? String(b.origin).split(',').map((s:string)=>s.trim()).filter(Boolean) : []),
      process: b.process || '不明',
      addl_process: b.addl_process || '',
      variety: b.variety || '',
      roast_date: b.roast_date || '',
      price_yen: b.price_yen ?? '',
      weight_g: b.weight_g ?? '',
      taste_memo: b.taste_memo || '',
      brew_policy: b.brew_policy || ''
    })
  }
  const clearForm = ()=>{
    setEditingId(null)
    setForm({
      name:'', roast_level:'シティ', in_stock:true,
      origins: [], process:'不明', addl_process:'', variety:'', roast_date:'', price_yen:'', weight_g:'',
      taste_memo:'', brew_policy:''
    })
  }

  // 必須チェック（追加処理・品種・テイスト・方針 以外は必須）
  const validate = ()=>{
    if (!form.name) return '豆の名前'
    if (!form.roast_level) return '焙煎度'
    if (!form.origins?.length) return '産地'
    if (!form.process) return '精製'
    if (!form.roast_date) return '焙煎日（購入日）'
    if (form.price_yen === '' || isNaN(Number(form.price_yen))) return '値段(円)'
    if (form.weight_g === '' || isNaN(Number(form.weight_g))) return '量(g)'
    return null
  }

  const submit = async (e:any)=>{
    e.preventDefault()
    const miss = validate()
    if (miss){ alert(`必須項目が不足：${miss}`); return }

    const payload = {
      name: form.name,
      roast_level: form.roast_level,
      in_stock: !!form.in_stock,
      origin: form.origins.join(','), // ← 複数産地を文字列で保存（ブレンド対応）
      process: form.process,
      addl_process: form.addl_process || null,
      variety: form.variety || null,
      roast_date: form.roast_date,
      price_yen: Number(form.price_yen),
      weight_g: Number(form.weight_g),
      taste_memo: form.taste_memo || null,
      brew_policy: form.brew_policy || null,
    }

    const url = editingId ? `${API}/api/beans/${editingId}` : `${API}/api/beans`
    const method = editingId ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    if(!r.ok){
      const txt = await r.text().catch(()=> '')
      alert(`保存に失敗: HTTP ${r.status}\n${txt}`)
      return
    }
    await loadBeans()
    onSaved()
    clearForm()
  }

  // --- 削除系 ---
  const deleteBean = async (id:number, name:string)=>{
    if (!confirm(`「${name}」を削除しますか？\n（関連ドリップがある場合は削除不可です）`)) return
    const r = await fetch(`${API}/api/beans/${id}`, { method:'DELETE' })
    if (r.ok){
      await loadBeans(); onSaved(); return
    }
    const body = await r.text().catch(()=> '')
    // 紐づきあり等で弾かれた場合は危険操作を案内
    alert(`通常削除に失敗しました。\n${body || ''}\n必要なら行の「危険操作 ▶︎」を開いて全削除をご利用ください。`)
    setDangerOpenId(id)
  }

  // 危険：豆＋関連ドリップも全削除（force=1）
  const forceDeleteBean = async (id:number, name:string)=>{
    // 1段階目確認
    if (!confirm(`⚠️ 本当に「${name}」と関連ドリップを全て削除します。元に戻せません。進めますか？`)) return
    // 2段階目：名前入力での確認
    const typed = prompt(`確認のため、豆の名前を正確に入力してください：\n${name}`)
    if (typed !== name){
      alert('名前が一致しません。中止しました。'); return
    }
    // 実行（バックエンドは DELETE /api/beans/:id?force=1 を実装しておく）
    const r = await fetch(`${API}/api/beans/${id}?force=1`, { method:'DELETE' })
    if (!r.ok){
      const txt = await r.text().catch(()=> '')
      alert(`全削除に失敗: HTTP ${r.status}\n${txt}`)
      return
    }
    await loadBeans(); onSaved()
    alert('削除しました。')
  }

  // --- UI ---
  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded p-2" placeholder="豆の名前" value={form.name} onChange={e=>handle('name',e.target.value)} required />
          <select className="border rounded p-2" value={form.roast_level} onChange={e=>handle('roast_level',e.target.value)} required>
            {ROASTS.map(x=> <option key={x}>{x}</option>)}
          </select>
        </div>

        {/* 産地：複数選択（ブレンド対応） */}
        <div>
          <label className="text-sm text-gray-600">産地（複数可・必須）</label>
          <select
            multiple
            className="border rounded p-2 w-full h-28"
            value={form.origins}
            onChange={e=>{
              const opts = Array.from(e.target.selectedOptions).map(o=>o.value)
              handle('origins', opts)
            }}
            required
          >
            {ORIGINS.filter(o=>o!=='不明').map(o=> <option key={o} value={o}>{o}</option>)}
            <option value="不明">不明</option>
          </select>

          {/* 選択した産地のセオリー（情報があるものだけ表示） */}
          {form.origins?.length>0 && (
            <div className="mt-1 text-xs text-gray-600 space-y-1">
              {form.origins.map((o:string)=> ORIGIN_THEORIES[o] ? (
                <div key={o}>産地セオリー：{o}（{ORIGIN_THEORIES[o]}）</div>
              ) : null)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* 精製（必須） */}
          <select className="border rounded p-2" value={form.process} onChange={e=>handle('process',e.target.value)} required>
            {PROCESS_OPTIONS.map(x=> <option key={x} value={x}>{x}</option>)}
          </select>
          {/* 追加処理（任意） */}
          <select className="border rounded p-2" value={form.addl_process} onChange={e=>handle('addl_process',e.target.value)}>
            {ADDL_PROCESS_OPTIONS.map(x=> <option key={x} value={x}>{x||'追加処理なし'}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded p-2" placeholder="品種 (例: SL28, カトゥーラ)" value={form.variety} onChange={e=>handle('variety',e.target.value)} />
          <input className="border rounded p-2" type="date" value={form.roast_date} onChange={e=>handle('roast_date',e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded p-2" placeholder="値段(円)" value={form.price_yen} onChange={e=>handle('price_yen',e.target.value)} required />
          <input className="border rounded p-2" placeholder="量(g)" value={form.weight_g} onChange={e=>handle('weight_g',e.target.value)} required />
        </div>

        <textarea className="w-full border rounded p-2" placeholder="テイストメモ（任意）" value={form.taste_memo} onChange={e=>handle('taste_memo',e.target.value)} />
        <textarea className="w-full border rounded p-2" placeholder="ドリップ方針メモ（任意）" value={form.brew_policy} onChange={e=>handle('brew_policy',e.target.value)} />

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.in_stock} onChange={e=>handle('in_stock',e.target.checked)} /> 在庫あり
        </label>

        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-black text-white">{editingId? '豆を更新' : '豆を登録'}</button>
          {editingId && <button type="button" className="px-3 py-2 rounded bg-gray-200" onClick={clearForm}>編集キャンセル</button>}
        </div>
      </form>

      {/* 一覧（編集/削除/危険操作） */}
      {beans.length>0 && (
        <div className="text-sm">
          <div className="font-semibold mb-1">登録済みの豆</div>
          <ul className="space-y-2">
            {beans.map(b=>(
              <li key={b.id} className="border rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{b.name} / {b.origin} / {b.roast_level} / 在庫:{b.in_stock?'あり':'なし'}</span>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 border rounded" onClick={()=>startEdit(b)}>編集</button>
                    <button className="px-2 py-1 border rounded text-red-600" onClick={()=>deleteBean(b.id, b.name)}>削除</button>
                    <button
                      className="px-2 py-1 border rounded text-xs"
                      onClick={()=> setDangerOpenId(d=> d===b.id ? null : b.id)}
                      title="危険操作（豆＋関連ドリップの全削除）"
                    >
                      {dangerOpenId===b.id ? '危険操作 ▲' : '危険操作 ▶︎'}
                    </button>
                  </div>
                </div>

                {dangerOpenId===b.id && (
                  <div className="mt-2 p-2 rounded border border-red-300 bg-red-50 text-red-800">
                    <div className="font-semibold text-[13px]">⚠️ この豆に紐づく全ドリップも同時に削除します（取り消し不可）</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        className="px-3 py-1 rounded bg-red-600 text-white"
                        onClick={()=>forceDeleteBean(b.id, b.name)}
                      >
                        完全に削除（豆＋ドリップ）
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-white border"
                        onClick={()=>setDangerOpenId(null)}
                      >
                        やめる
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
