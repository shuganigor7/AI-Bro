'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type HabitLog = { id: string; date: string; completed: boolean; motivation: string | null }

type Habit = {
  id: string
  title: string
  type: 'quit' | 'build'
  emoji: string | null
  created_at: string
  habit_logs: HabitLog[]
}

function toLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function calculateStreak(logs: HabitLog[]): number {
  const today = toLocalDate(new Date())
  const done = new Set(logs.filter((l) => l.completed).map((l) => l.date))
  let streak = 0
  const d = new Date()
  if (!done.has(today)) d.setDate(d.getDate() - 1)
  while (done.has(toLocalDate(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

const DEFAULT_EMOJI: Record<string, string> = {
  quit: '🚫',
  build: '✅',
}

export default function Habits({ userId }: { userId: string }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<'quit' | 'build'>('build')
  const [newEmoji, setNewEmoji] = useState('')
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const supabase = createClient()
  const today = toLocalDate(new Date())

  useEffect(() => {
    loadHabits()
  }, [])

  async function loadHabits() {
    const { data } = await supabase
      .from('habits')
      .select('*, habit_logs(id, date, completed, motivation)')
      .eq('user_id', userId)
      .order('created_at')
    if (data) setHabits(data)
  }

  async function addHabit() {
    if (!newTitle.trim() || creating) return
    setCreating(true)
    const { data } = await supabase
      .from('habits')
      .insert({ user_id: userId, title: newTitle.trim(), type: newType, emoji: newEmoji.trim() || null })
      .select('*, habit_logs(id, date, completed, motivation)')
      .single()
    if (data) {
      setHabits((prev) => [...prev, data])
      setNewTitle('')
      setNewEmoji('')
      setNewType('build')
      setShowNew(false)
    }
    setCreating(false)
  }

  async function checkIn(habit: Habit) {
    if (checkingIn) return
    setCheckingIn(habit.id)

    const streak = calculateStreak(habit.habit_logs)

    let motivation: string | null = null
    try {
      const res = await fetch('https://www.nnnis.site/webhook/aibro-habit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habit_title: habit.title,
          habit_type: habit.type,
          streak_days: streak + 1,
        }),
      })
      const json = await res.json()
      motivation = json.phrase || null
    } catch { /* используем без фразы */ }

    const { data: log } = await supabase
      .from('habit_logs')
      .upsert(
        { habit_id: habit.id, user_id: userId, date: today, completed: true, motivation },
        { onConflict: 'habit_id,date' }
      )
      .select()
      .single()

    if (log) {
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id
            ? { ...h, habit_logs: [log, ...h.habit_logs.filter((l) => l.date !== today)] }
            : h
        )
      )
    }

    setCheckingIn(null)
  }

  async function deleteHabit(habitId: string) {
    await supabase.from('habits').delete().eq('id', habitId)
    setHabits((prev) => prev.filter((h) => h.id !== habitId))
  }

  return (
    <div className="flex flex-col gap-4">

      <button
        onClick={() => setShowNew((v) => !v)}
        style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
      >
        {showNew ? 'Отмена' : '+ Новая привычка'}
      </button>

      {showNew && (
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {/* Тип привычки */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['build', 'quit'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                style={{
                  flex: 1, padding: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                  background: newType === t ? 'var(--accent)' : 'var(--surface-2)',
                  color: newType === t ? '#fff' : 'var(--text-muted)',
                }}
              >
                {t === 'build' ? '✅ Внедрить' : '🚫 Бросить'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="😴"
              maxLength={2}
              style={{ width: '52px', textAlign: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', color: 'var(--text)', fontSize: '20px', outline: 'none' }}
            />
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              placeholder={newType === 'build' ? 'Читать 30 минут каждый день' : 'Бросить курить'}
              style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
            />
          </div>

          <button
            onClick={addHabit}
            disabled={!newTitle.trim() || creating}
            style={{ background: newTitle.trim() ? 'var(--accent)' : 'var(--surface-2)', border: 'none', color: newTitle.trim() ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: newTitle.trim() ? 'pointer' : 'default' }}
          >
            {creating ? '...' : 'Создать привычку'}
          </button>
        </div>
      )}

      {habits.length === 0 && !showNew && (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>🔥</p>
          <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>Нет привычек</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Добавь привычку которую хочешь внедрить или бросить</p>
        </div>
      )}

      {habits.map((habit) => {
        const todayLog = habit.habit_logs.find((l) => l.date === today)
        const isDone = !!todayLog?.completed
        const streak = calculateStreak(habit.habit_logs)
        const emoji = habit.emoji || DEFAULT_EMOJI[habit.type]
        const isLoading = checkingIn === habit.id

        return (
          <div
            key={habit.id}
            className="rounded-xl flex flex-col"
            style={{ background: 'var(--surface)', border: `1px solid ${isDone ? '#22c55e44' : 'var(--border)'}`, overflow: 'hidden' }}
          >
            {/* Шапка */}
            <div className="flex items-center gap-3 p-4">
              <span style={{ fontSize: '28px', lineHeight: 1 }}>{emoji}</span>
              <div className="flex-1 min-w-0">
                <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600', lineHeight: 1.3 }}>{habit.title}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  {habit.type === 'quit' ? '🚫 Избавляюсь' : '✅ Формирую'}
                </p>
              </div>

              {/* Стрик */}
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <p style={{ color: streak > 0 ? '#f59e0b' : 'var(--text-muted)', fontSize: '20px', fontWeight: '800', lineHeight: 1 }}>
                  {streak > 0 ? '🔥' : '—'}
                </p>
                {streak > 0 && (
                  <p style={{ color: '#f59e0b', fontSize: '11px', fontWeight: '700' }}>{streak} дн.</p>
                )}
              </div>
            </div>

            {/* Мотивационная фраза */}
            {isDone && todayLog?.motivation && (
              <div style={{ background: '#22c55e11', borderTop: '1px solid #22c55e33', padding: '10px 16px' }}>
                <p style={{ color: '#22c55e', fontSize: '13px', lineHeight: 1.5 }}>{todayLog.motivation}</p>
              </div>
            )}

            {/* Кнопка отметки */}
            <div style={{ padding: '0 16px 14px', marginTop: isDone && todayLog?.motivation ? 0 : '-4px' }}>
              {isDone ? (
                <div style={{ background: '#22c55e22', border: '1px solid #22c55e44', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                  <p style={{ color: '#22c55e', fontSize: '13px', fontWeight: '600' }}>
                    ✓ {habit.type === 'quit' ? 'Держишься сегодня!' : 'Выполнено сегодня!'}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => checkIn(habit)}
                  disabled={!!isLoading}
                  style={{
                    width: '100%', background: 'var(--accent)', border: 'none', color: '#fff',
                    borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: '600',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  {isLoading
                    ? '⏳ Получаю мотивацию...'
                    : habit.type === 'quit'
                    ? '💪 Держусь!'
                    : '✅ Выполнил!'}
                </button>
              )}
            </div>

            {/* Последние 7 дней */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date()
                d.setDate(d.getDate() - (6 - i))
                const ds = toLocalDate(d)
                const log = habit.habit_logs.find((l) => l.date === ds)
                const done = !!log?.completed
                const isToday = ds === today
                return (
                  <div key={ds} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: done ? '#22c55e' : 'var(--surface-2)', border: isToday ? '2px solid var(--accent)' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                      {done ? '✓' : ''}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                      {d.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2)}
                    </p>
                  </div>
                )
              })}
            </div>

          </div>
        )
      })}
    </div>
  )
}
