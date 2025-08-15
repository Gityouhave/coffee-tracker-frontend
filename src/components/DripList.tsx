// src/components/DripList.tsx
import React, { useEffect, useMemo, useState } from 'react'

type Drip = any

type EditState = {
  id: number|null
  bean_id?: number
  brew_date?: string
  grind?: string
  water_temp_c?: string
  dose_g?: string
  water_g?: string
  drawdown_g?: string
  time?: string
  dripper?: string
  storage?: string
  method_memo?: string
  note_memo?: string
  ratings?: Record<string,string>
}

const DRIPPERS = ['水出し','エアロプレス','クレバー','ハリオスイッチ','ハリオ','フラワー','クリスタル','カリタウェーブ','ブルーボトル','コーノ','フィン','ネル','フレンチプレス','エスプレッソ','モカポット','サイフォン']

export default function DripList({
  API,
  onChanged,
}:{
  API:string
  onChanged?: ()=>void
}){
  const [drips, setDrips] = useState<Drip[]>([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<EditState|null>(null)
  const [confirmDel, setConfirmDel] = useState<{id:number,name?:string}|null>(null)
  const [busyId, setBusyId] = useState<number|null>(null)

  const load = async ()=>{
    const r = await fetch(`${API}/api/drips`)
    const js = await r.json()
    // 新しい順に
    js.sort((a:any,b:any)=> (b.brew_date||'').localeCompare(a.brew_date||''))
    setDrips(js)
  }
  useEffect(()=>{ load() },[API])

  const filtered = useMemo(()=>{
    if(!q.trim()) return drips
    const s = q.trim()
    return drips.filter((d:any)=>{
      const hay = [
        d.bean_name, d.dripper, d.storage,
        d.brew_date, d.method_memo, d.note_memo,
        d.ratings?.overall, d.grind, d.water_temp_c, d.dose_g, d.water_g
      ].join(' ')
      return String(hay).includes(s)
    })
  },[drips,q])

  const openEdit = (d:any)=>{
    setEditing({
      id: d.id,
      bean_id: d.bean_id,
      brew_date: d.brew_date,
      grind: d.grind!=null? String(d.grind):'',
      water_temp_c: d.water_temp_c!=null? String(d.water_temp_c):'',
      dose_g: d.dose_g!=null? String(d.dose_g):'',
      water_g: d.water_g!=null? String(d.water_g):'',
      drawdown_g: d.drawdown_g!=null? String(d.drawdown_g):'',
      time: d.time_sec!=null ? toMMSS(d.time_sec): '',
      dripper: d.dripper || '',
      storage: d.storage || '',
      method_memo: d.method_memo || '',
      note_memo: d.note_memo || '',
      ratings: {
        clean: str(d.ratings?.clean),
        flavor: str(d.ratings?.flavor),
        acidity: str(d.ratings?.acidity),
        bitterness: str(d.ratings?.bitterness),
        sweetness: str(d.ratings?.sweetness),
        body: str(d.ratings?.body),
        aftertaste: str(d.ratings?.aftertaste),
        overall: str(d.ratings?.overall),
      }
    })
  }

  const saveEdit = async ()=>{
    if(!editing?.id) return
    setBusyId(editing.id)
    const payload:any = {
      bean_id: editing.bean_id,
      brew_date: editing.brew_date,
      grind: numOrNull(editing.grind),
      water_temp_c: numOrNull(editing.water_temp_c),
      dose_g: numOrNull(editing.dose_g),
      water_g: numOrNull(editing.water_g),
      drawdown_g: numOrNull(editing.drawdown_g),
      time: (editing.time||'').trim() || null,
      dripper: orNull(editing.dripper),
      storage: orNull(editing.storage),
      method_memo: orNull(editing.method_memo),
      note_memo: orNull(editing.note_memo),
    }
    // ratings
    if (editing.ratings){
      for (const k of Object.keys(editing.ratings)){
        const v = (editing.ratings as any)[k]
        payload[k] = v!=='' && v!=null ? Number(v) : null
      }
    }
    const r = await fetch(`${API}/api/drips/${editing.id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    setBusyId(null)
    if(!r.ok){
      const t = await r.text().catch(()=> '')
      alert(`更新に失敗: HTTP ${r.status}\n${t}`)
      return
    }
    setEditing(null)
    await load()
    onChanged?.()
  }

  const del = async (id:number)=>{
    setBusyId(id)
    const r = await fetch(`${API}/api/drips/${id}`, {method:'DELETE'})
    setBusyId(null)
    if(!r.ok){
      const t = await r.text().catch(()=> '')
      alert(`削除に失敗: HTTP ${r.status}\n${t}`)
      return
    }
    setConfirmDel(null)
    await load()
    onChanged?.()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input className="border rounded p-2 w-full" placeholder="検索（豆名・器具・メモなど）" value={q} onChange={e=>setQ(e.target.value)} />
        <span className="text-xs text-gray-500">件数：{filtered.length}</span>
      </div>

      {/* レコードが無いときは非表示（指示通り） */}
      {filtered.length===0 ? null : (
        <div className="border rounded divide-y">
          {filtered.map((d:any)=>(
            <div key={d.id} className="p-2 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {d.brew_date} ／ {d.bean_name ?? `#${d.bean_id}`} ／ {d.dripper ?? '—'}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  g:{d.grind ?? '—'}・T:{d.water_temp_c ?? '—'}℃・豆:{d.dose_g ?? '—'}g・湯:{d.water_g ?? '—'}g・t:{secsOrDash(d.time_sec)} ／ ★:{d.ratings?.overall ?? '—'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="px-2 py-1 border rounded" onClick={()=>openEdit(d)}>編集</button>
                <button className="px-2 py-1 border rounded text-red-600" onClick={()=>setConfirmDel({id:d.id, name:d.bean_name})} disabled={busyId===d.id}>
                  {busyId===d.id? '...' : '削除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 編集モーダル（シンプル版） */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-4 w-[680px] max-h-[90vh] overflow-auto space-y-2">
            <div className="font-semibold">ドリップ編集 #{editing.id}</div>

            <div className="grid grid-cols-3 gap-2">
              <input className="border rounded p-2" type="date" value={editing.brew_date||''} onChange={e=>setEditing({...editing, brew_date:e.target.value})} />
              <input className="border rounded p-2" placeholder="挽き目(1-17)" value={editing.grind||''} onChange={e=>setEditing({...editing, grind:e.target.value})} />
              <input className="border rounded p-2" placeholder="湯温(℃)" value={editing.water_temp_c||''} onChange={e=>setEditing({...editing, water_temp_c:e.target.value})} />
              <input className="border rounded p-2" placeholder="豆(g)" value={editing.dose_g||''} onChange={e=>setEditing({...editing, dose_g:e.target.value})} />
              <input className="border rounded p-2" placeholder="湯量(g)" value={editing.water_g||''} onChange={e=>setEditing({...editing, water_g:e.target.value})} />
              <input className="border rounded p-2" placeholder="落ちきり(g)" value={editing.drawdown_g||''} onChange={e=>setEditing({...editing, drawdown_g:e.target.value})} />
              <input className="border rounded p-2" placeholder="時間(mm:ss)" value={editing.time||''} onChange={e=>setEditing({...editing, time:e.target.value})} />
              <select className="border rounded p-2" value={editing.dripper||''} onChange={e=>setEditing({...editing, dripper:e.target.value})}>
                <option value="">ドリッパー</option>
                {DRIPPERS.map(x=> <option key={x}>{x}</option>)}
              </select>
              <select className="border rounded p-2" value={editing.storage||''} onChange={e=>setEditing({...editing, storage:e.target.value})}>
                <option value="">保存状態</option>
                <option value="🧊冷凍">🧊冷凍</option>
                <option value="常温">常温</option>
              </select>
            </div>

            <textarea className="w-full border rounded p-2" placeholder="手法メモ" value={editing.method_memo||''} onChange={e=>setEditing({...editing, method_memo:e.target.value})} />
            <textarea className="w-full border rounded p-2" placeholder="感想メモ" value={editing.note_memo||''} onChange={e=>setEditing({...editing, note_memo:e.target.value})} />

            <div className="grid grid-cols-4 gap-2 text-sm">
              {['clean','flavor','acidity','bitterness','sweetness','body','aftertaste','overall'].map(k=>(
                <input key={k} className="border rounded p-2" placeholder={`${k} 1-10`} value={editing.ratings?.[k]||''}
                       onChange={e=>setEditing({...editing, ratings:{...(editing.ratings||{}), [k]: e.target.value}})} />
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>setEditing(null)}>キャンセル</button>
              <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={saveEdit} disabled={busyId===editing.id}>
                {busyId===editing.id? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル（誤クリック防止の二段階） */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-4 w-[520px] space-y-3">
            <div className="text-lg font-semibold">このドリップを削除しますか？</div>
            <div className="text-sm text-gray-700">
              一度削除すると元に戻せません。<br/>
              <span className="text-gray-500">対象ID: #{confirmDel.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <input id="chk" type="checkbox" onChange={(e)=>{
                (document.getElementById('btnDanger') as HTMLButtonElement).disabled = !e.target.checked
              }}/>
              <label htmlFor="chk" className="text-sm">理解しました（取り消し不可）</label>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>setConfirmDel(null)}>やめる</button>
              <button id="btnDanger" className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50" disabled onClick={()=>del(confirmDel.id)}>
                {busyId===confirmDel.id? '削除中…' : '完全に削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function secsOrDash(s?:number|null){
  if (s==null) return '—'
  const m = Math.floor(s/60), ss = s%60
  return `${m}:${String(ss).padStart(2,'0')}`
}
function toMMSS(s:number){
  const m = Math.floor(s/60), ss = s%60
  return `${m}:${String(ss).padStart(2,'0')}`
}
function numOrNull(v?:string){ return (v!=null && v!=='') ? Number(v) : null }
function orNull(v?:string){ return (v!=null && v!=='') ? v : null }
function str(v:any){ return (v==null||v==='')? '' : String(v) }
