import React, { useEffect, useState } from 'react'

type Tab = {
  id: string
  label: string
  badge?: string | number
  content: React.ReactNode
}

export default function Tabs({
  tabs,
  storageKey = 'ct_last_tab',
  defaultId,
  onChange,                // ← 追加
}: {
  tabs: Tab[]
  storageKey?: string
  defaultId?: string
  onChange?: (id: string) => void   // ← 追加
}) {
  const first = defaultId || tabs[0]?.id
  const [active, setActive] = useState<string>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
    return saved && tabs.some(t => t.id === saved) ? saved : first
  })
  const mountedRef = React.useRef(false)

  useEffect(() => {
    localStorage.setItem(storageKey, active)
    // 切り替え時にトップ付近へ
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (mountedRef.current) {
  onChange?.(active)
} else {
  mountedRef.current = true
}
  }, [active, storageKey, onChange]))

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60">
        <div className="flex gap-2 p-2 overflow-x-auto">
          {tabs.map(t => {
            const is = t.id === active
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={
                  'whitespace-nowrap px-3 py-2 rounded-full text-sm border ' +
                  (is
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 hover:bg-gray-100')
                }
              >
                {t.label}
                {t.badge !== undefined && (
                  <span className={'ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs ' + (is ? 'bg-white/20' : 'bg-gray-100')}>
                    {t.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        {tabs.map(t => (
          <section key={t.id} hidden={t.id !== active}>
            {t.content}
          </section>
        ))}
      </div>
    </div>
  )
}
