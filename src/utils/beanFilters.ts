// src/utils/beanFilters.ts
export type StockFilter = 'all' | 'in' | 'out'
export type SortKey = 'roast_date' | 'roast_level' | 'ppg' | 'name'

export const ROASTS = ['ライト','シナモン','ミディアム','ハイ','シティ','フルシティ','フレンチ','イタリアン'] as const
export const ROAST_SYMBOLS: Record<string, string> = {
  'ライト':'①','シナモン':'②','ミディアム':'③','ハイ':'④',
  'シティ':'⑤','フルシティ':'⑥','フレンチ':'⑦','イタリアン':'⑧'
}

export const roastIndex = (lvl?: string) => {
  const i = lvl ? ROASTS.indexOf(lvl as any) : -1
  return i >= 0 ? i : ROASTS.indexOf('シティ')
}

export const pricePerG = (b: any): number => {
  const p = Number(b?.price_yen), w = Number(b?.weight_g)
  if (!Number.isFinite(p) || !Number.isFinite(w) || w <= 0) return Number.POSITIVE_INFINITY // 昇順で最後尾へ
  return p / w
}

export function filterSortBeans(
  beans: any[],
  opts: { q: string; stock: StockFilter; origins: string[]; sort: SortKey }
){
  const q = (opts.q || '').trim().toLowerCase()
  let list = beans.slice()

  // 在庫フィルタ
  if (opts.stock === 'in')   list = list.filter(b=> !!b.in_stock)
  if (opts.stock === 'out')  list = list.filter(b=> !b.in_stock)

  // 産地フィルタ（複数選択）
  if (opts.origins?.length){
    const set = new Set(opts.origins)
    list = list.filter(b=>{
      const parts = String(b.origin||'').split(',').map((s:string)=>s.trim()).filter(Boolean)
      return parts.some(p=> set.has(p))
    })
  }

  // フリーワード
  if (q){
    list = list.filter(b=>{
      const hay = [
        b.name, b.origin, b.variety, b.process, b.addl_process
      ].map((s:string)=> String(s||'').toLowerCase()).join('\n')
      return hay.includes(q)
    })
  }

  // ソート（昇順統一）
  const byName = (a:any,b:any)=> String(a.name||'').localeCompare(String(b.name||''), 'ja')
  const byRoastLvl = (a:any,b:any)=> roastIndex(a.roast_level) - roastIndex(b.roast_level)
  const byRoastDate = (a:any,b:any)=> {
    const ta = Date.parse(a.roast_date || '9999-12-31'), tb = Date.parse(b.roast_date || '9999-12-31')
    return ta - tb
  }
  const byPPG = (a:any,b:any)=> pricePerG(a) - pricePerG(b)

  const cmp =
    opts.sort === 'name' ? byName :
    opts.sort === 'roast_level' ? byRoastLvl :
    opts.sort === 'ppg' ? byPPG :
    byRoastDate

  return list.sort(cmp)
}

// 「番号付き焙煎度／豆名（産地｜品種｜精製｜追加）／焙煎日」
export function beanOptionLabel(b:any){
  const head = `${ROAST_SYMBOLS[b.roast_level] || ''}${b.roast_level || ''}／${b.name || ''}`
  const parts:string[] = []
  const add = (v?: string|null) => {
    const s = String(v||'').trim()
    if (!s || s==='不明') return
    parts.push(s)
  }
  add(b.origin)
  add(b.variety)
  add(b.process)
  add(b.addl_process)
  const mid = parts.length ? `（${parts.join('｜')}）` : ''
  const tail = b.roast_date ? `／${b.roast_date}` : ''
  return `${head}${mid}${tail}`
}
