'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Tasks from '@/app/components/Tasks'
import Finance from '@/app/components/Finance'
import Health from '@/app/components/Health'
import Sport from '@/app/components/Sport'
import StatsPage from '@/app/components/Stats'
import { ListTodo, Wallet, HeartPlus, Dumbbell, Trophy, LogOut } from 'lucide-react'

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
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Сразу проверяем существующую сессию — не ждём onAuthStateChange
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        setUserEmail(session.user.email ?? null)
        // Upsert профиля в фоне, не блокируем UI
        supabase.from('profiles').upsert({ id: session.user.id }, { onConflict: 'id', ignoreDuplicates: true })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id)
        setUserEmail(session.user.email ?? null)
        supabase.from('profiles').upsert({ id: session.user.id }, { onConflict: 'id', ignoreDuplicates: true })
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, '', window.location.pathname)
        }
      }
      if (event === 'SIGNED_OUT') {
        setUserId(null)
        setUserEmail(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    setSigningIn(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Загрузка...</p>
      </div>
    )
  }

  if (!userId) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg)', padding: '32px',
      }}>
        <h1 style={{ fontSize: '36px', fontWeight: '900', color: 'var(--text)', marginBottom: '8px', letterSpacing: '-1px' }}>
          AI <span style={{ color: 'var(--accent)' }}>BRO</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '48px', textAlign: 'center' }}>
          Твой личный ассистент
        </p>

        <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={signInWithGoogle}
            disabled={signingIn}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              background: '#fff', border: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              fontSize: '15px', fontWeight: '600', color: '#111', cursor: 'pointer',
              opacity: signingIn ? 0.7 : 1,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {signingIn ? 'Подключение...' : 'Войти через Google'}
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '32px', textAlign: 'center', lineHeight: 1.6 }}>
          Данные привязаны к твоему аккаунту и<br />синхронизируются на всех устройствах
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <header className="px-4 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          AI <span style={{ color: 'var(--accent)' }}>BRO</span>
        </h1>
        <button
          onClick={signOut}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          title={userEmail ?? ''}
        >
          <LogOut size={18} color="var(--text-muted)" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <>
          {activeTab === 'tasks' && <Tasks userId={userId} />}
          {activeTab === 'finance' && <Finance userId={userId} />}
          {activeTab === 'health' && <Health userId={userId} />}
          {activeTab === 'sport' && <Sport userId={userId} />}
          {activeTab === 'stats' && <StatsPage userId={userId} />}
        </>
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
