'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Tasks from '@/app/components/Tasks'
import Finance from '@/app/components/Finance'
import Health from '@/app/components/Health'
import Sport from '@/app/components/Sport'
import StatsPage from '@/app/components/Stats'
import { ListTodo, Wallet, HeartPlus, Dumbbell, Trophy } from 'lucide-react'

const tabs = [
  { id: 'tasks', label: 'Задачи', Icon: ListTodo, color: '#6366f1' },
  { id: 'finance', label: 'Финансы', Icon: Wallet, color: '#22c55e' },
  { id: 'health', label: 'Здоровье', Icon: HeartPlus, color: '#ef4444' },
  { id: 'sport', label: 'Спорт', Icon: Dumbbell, color: '#f97316' },
  { id: 'stats', label: 'Статы', Icon: Trophy, color: '#f59e0b' },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState('tasks')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      let user = session?.user
      if (!user) {
        const { data } = await supabase.auth.signInAnonymously()
        user = data.user ?? undefined
      }

      if (user) {
        // Создаём профиль если его ещё нет
        await supabase
          .from('profiles')
          .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })
        setUserId(user.id)
      }
    }
    init()
  }, [])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <header className="px-4 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          AI <span style={{ color: 'var(--accent)' }}>BRO</span>
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        {!userId ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Подключение...</p>
        ) : (
          <>
            {activeTab === 'tasks' && <Tasks userId={userId} />}
            {activeTab === 'finance' && <Finance userId={userId} />}
            {activeTab === 'health' && <Health userId={userId} />}
            {activeTab === 'sport' && <Sport userId={userId} />}
            {activeTab === 'stats' && <StatsPage userId={userId} />}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav
        className="flex"
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors"
            style={{
              color: activeTab === tab.id ? tab.color : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <tab.Icon size={22} strokeWidth={1.8} />
            <span style={{ color: activeTab === tab.id ? tab.color : 'var(--text-muted)' }}>{tab.label}</span>
          </button>
        ))}
      </nav>

    </div>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
        {title} — в разработке.
      </p>
    </div>
  )
}
