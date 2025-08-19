// src/components/OriginAccordion.tsx
import React from 'react';
import { flagify } from '@/utils/flags';
import { ORIGINS_META } from '@/constants/origins';
import { recommendTop5ByConditions } from '@/logic/recipeEngine';

export const OriginAccordion: React.FC<{
  origin: string;
  onApply?: (dripperName:string)=>void; // そのままドリップフォームに適用したい時用
}> = ({ origin, onApply }) => {
  const meta = ORIGINS_META[origin];
  const [roast, setRoast] = React.useState<'浅'|'中浅'|'中'|'中深'|'深'>('中');
  const [process, setProcess] = React.useState<'ウォッシュト'|'ナチュラル'|'ハニー'|'ウェットハル'|'発酵系'>('ウォッシュト');
  const [aging, setAging] = React.useState<number|''>('');

  const top5 = React.useMemo(()=>{
    return recommendTop5ByConditions(null, null,
      { origin, roast, process, agingDays: aging===''? undefined : Number(aging) },
      'overall'
    );
  },[origin, roast, process, aging]);

  if (!meta) {
    return (
      <details className="border rounded p-2">
        <summary className="cursor-pointer">{flagify(origin)}（データ未登録）</summary>
        <div className="text-xs text-gray-500 mt-1">この産地のメタは未登録です。</div>
      </details>
    );
  }

  return (
    <details className="border rounded p-2 bg-white">
      <summary className="cursor-pointer flex items-center justify-between">
        <span className="font-medium">{flagify(origin)}</span>
        <span className="text-xs text-gray-500">クリックで開く</span>
      </summary>

      {/* 基本プロファイル */}
      <div className="mt-2 text-sm">
        <div className="text-gray-700">
          代表傾向：酸 {meta.baseline.acidity}／香り {meta.baseline.aroma}／ボディ {meta.baseline.body}
        </div>
        <div className="text-xs text-gray-600 flex flex-wrap gap-1 mt-1">
          {meta.baseline.notes.map((n,i)=>(<span key={i} className="px-1.5 py-0.5 border rounded">{n}</span>))}
        </div>
      </div>

      {/* バリエーション（焙煎×精製） */}
      <div className="mt-3">
        <div className="text-xs text-gray-500 mb-1">焙煎×精製の例</div>
        <div className="flex flex-wrap gap-1">
          {meta.variants.map((v,i)=>(
            <span key={i} className="text-[11px] px-1.5 py-0.5 border rounded">
              {v.roast}・{v.process}：{v.notes.join('／')}
            </span>
          ))}
        </div>
      </div>

      {/* 条件指定 → 推奨TOP5 */}
      <div className="mt-3 grid grid-cols-3 gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600">焙煎</label>
          <select className="border rounded p-1 w-full" value={roast} onChange={e=>setRoast(e.target.value as any)}>
            <option>浅</option><option>中浅</option><option>中</option><option>中深</option><option>深</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">精製</label>
          <select className="border rounded p-1 w-full" value={process} onChange={e=>setProcess(e.target.value as any)}>
            <option>ウォッシュト</option><option>ナチュラル</option><option>ハニー</option><option>ウェットハル</option><option>発酵系</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">エイジング日数</label>
          <input className="border rounded p-1 w-full" placeholder="例: 7" value={aging} onChange={e=>setAging(e.target.value as any)} />
        </div>
      </div>

      {/* 推奨TOP5（折りたたみ式の理由付き） */}
      <div className="mt-2 grid gap-2">
        {top5.map((r,idx)=>(
          <div key={r.name} className="border rounded p-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 border rounded">#{idx+1}</span>
              <b>{r.name}</b>
              <span className="ml-auto text-[11px] px-1.5 py-0.5 border rounded bg-gray-50">総合 {r.score}</span>
              {onApply && (
                <button className="ml-2 text-xs px-2 py-1 border rounded" onClick={()=>onApply(r.name)}>
                  この器具で試す
                </button>
              )}
            </div>

            {/* 1行サマリ */}
            <div className="text-xs text-gray-700 mt-1">{r.short}</div>

            {/* 理由（アルゴリズム + 産地メタ） */}
            <details className="mt-1">
              <summary className="text-[11px] text-gray-600 cursor-pointer">根拠（導出理由）</summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {(r.reasons2||[]).slice(0,4).map((q:any,i:number)=>(
                  <span key={i} className={"text-[10px] px-1.5 py-0.5 border rounded " + (q.sign==='+'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700')}>
                    {q.sign}{q.label}
                  </span>
                ))}
                {(r.metaReasons||[]).map((m:string,i:number)=>(
                  <span key={'m'+i} className="text-[10px] px-1.5 py-0.5 border rounded bg-white text-gray-700">
                    {m}
                  </span>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>

      {/* 出典 */}
      {meta.sources?.length>0 && (
        <div className="mt-3 text-[11px] text-gray-500">
          {meta.sources.map((s,i)=>(
            <div key={i} className="truncate">出典: <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></div>
          ))}
        </div>
      )}
    </details>
  );
};
