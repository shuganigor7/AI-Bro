'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/')
      }
    })

    // На случай если сессия уже есть
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/')
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)', gap: '16px'
    }}>
      <div style={{ fontSize: '32px' }}>⏳</div>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Авторизация...</p>
    </div>
  )
}
