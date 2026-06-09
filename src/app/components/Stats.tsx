'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Dumbbell, Coins, Brain, Zap, Trophy, Flame, TrendingUp, Smile, Moon, RefreshCw } from 'lucide-react'

type StatKey = 'strength' | 'wealth' | 'intelligence' | 'energy'

type Stats = Record<StatKey, number>

function toLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(val)))
}

const statConfig: { key: StatKey; label: string; Icon: React.FC<{ size?: number; color?: string }>; color: string; desc: string }[] = [
  { key: 'strength', label: 'Сила', Icon: Dumbbell, color: '#ef4444', desc: 'Тренировки за неделю' },
  { key: 'wealth', label: 'Богатство', Icon: Coins, color: '#f59e0b', desc: 'Цели и баланс' },
  { key: 'intelligence', label: 'Интеллект', Icon: Brain, color: '#3b82f6', desc: 'Задачи и привычки' },
  { key: 'energy', label: 'Энергия', Icon: Zap, color: '#22c55e', desc: 'Вода, сон, шаги' },
]

function getAvatarIcon(level: number): React.FC<{ size?: number; color?: string; strokeWidth?: number }> {
  if (level >= 80) return Flame
  if (level >= 60) return Trophy
  if (level >= 40) return TrendingUp
  if (level >= 20) return Smile
  return Moon
}

function getAvatarColor(level: number): string {
  if (level >= 80) return '#ef4444'
  if (level >= 60) return '#f59e0b'
  if (level >= 40) return '#3b82f6'
  if (level >= 20) return '#6b7280'
  return '#6b7280'
}

function getLevelTitle(level: number): string {
  if (level >= 80) return 'Элита'
  if (level >= 60) return 'Продвинутый'
  if (level >= 40) return 'В процессе'
  if (level >= 20) return 'Новичок'
  return 'Спящий режим'
}

export default function StatsPage({ userId }: { userId: string }) {
  const [stats, setStats] = useState<Stats>({ strength: 0, wealth: 0, intelligence: 0, energy: 0 })
  const [details, setDetails] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    calcStats()
  }, [])

  async function calcStats() {
    setLoading(true)
    const today = toLocalDate(new Date())
    const weekAgo = toLocalDate(new Date(Date.now() - 7 * 86400000))
    const now = new Date()
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const [workoutsRes, tasksRes, habitsRes, healthRes, financesRes, goalsRes] = await Promise.all([
      supabase.from('workouts').select('id, workout_sets(id)').eq('user_id', userId).gte('date', weekAgo).lte('date', today),
      supabase.from('tasks').select('status, category').eq('user_id', userId).gte('date', weekAgo).lte('date', today),
      supabase.from('habit_logs').select('completed').eq('user_id', userId).gte('date', weekAgo).lte('date', today),
      supabase.from('health_logs').select('water_ml, sleep_hours, steps').eq('user_id', userId).gte('date', weekAgo).lte('date', today),
      supabase.from('finances').select('type, amount').eq('user_id', userId).gte('date', firstDay),
      supabase.from('financial_goals').select('target_amount, goal_contributions(amount)').eq('user_id', userId),
    ])

    // === СИЛА ===
    const workouts = workoutsRes.data ?? []
    const workoutCount = workouts.length
    const totalSets = workouts.reduce((s: number, w: { workout_sets: { id: string }[] }) => s + (w.workout_sets?.length ?? 0), 0)
    const strength = clamp(workoutCount * 15 + Math.min(totalSets * 2, 40))
    const strengthDetail = `${workoutCount} тренир. · ${totalSets} подходов за 7 дней`

    // === БОГАТСТВО ===
    const finances = financesRes.data ?? []
    const income = finances.filter((f: { type: string }) => f.type === 'income').reduce((s: number, f: { amount: number }) => s + f.amount, 0)
    const expense = finances.filter((f: { type: string }) => f.type === 'expense').reduce((s: number, f: { amount: number }) => s + f.amount, 0)
    const goals = goalsRes.data ?? []
    const goalProgress = goals.length > 0
      ? goals.reduce((s: number, g: { target_amount: number; goal_contributions: { amount: number }[] }) => {
          const saved = (g.goal_contributions ?? []).reduce((a: number, c: { amount: number }) => a + Number(c.amount), 0)
          return s + Math.min(1, saved / Number(g.target_amount))
        }, 0) / goals.length
      : 0
    const balanceScore = income > 0 ? clamp((income / Math.max(income, expense)) * 50) : 0
    const wealth = clamp(balanceScore + goalProgress * 50)
    const wealthDetail = `€${income.toFixed(0)} доход · ${Math.round(goalProgress * 100)}% по целям`

    // === ИНТЕЛЛЕКТ ===
    const tasks = tasksRes.data ?? []
    const completedTasks = tasks.filter((t: { status: string }) => t.status === 'completed').length
    const eduTasks = tasks.filter((t: { category: string | null }) => t.category === 'education' || t.category === 'work').length
    const habits = habitsRes.data ?? []
    const completedHabits = habits.filter((h: { completed: boolean }) => h.completed).length
    const intelligence = clamp(completedTasks * 8 + eduTasks * 5 + completedHabits * 3)
    const intelligenceDetail = `${completedTasks} задач · ${completedHabits} привычек за 7 дней`

    // === ЭНЕРГИЯ ===
    const healthLogs = healthRes.data ?? []
    const avgWater = healthLogs.length > 0
      ? healthLogs.reduce((s: number, h: { water_ml: number }) => s + (h.water_ml ?? 0), 0) / healthLogs.length
      : 0
    const avgSleep = healthLogs.length > 0
      ? healthLogs.filter((h: { sleep_hours: number | null }) => h.sleep_hours != null).reduce((s: number, h: { sleep_hours: number | null }) => s + (h.sleep_hours ?? 0), 0) / Math.max(1, healthLogs.filter((h: { sleep_hours: number | null }) => h.sleep_hours != null).length)
      : 0
    const avgSteps = healthLogs.length > 0
      ? healthLogs.filter((h: { steps: number | null }) => h.steps != null).reduce((s: number, h: { steps: number | null }) => s + (h.steps ?? 0), 0) / Math.max(1, healthLogs.filter((h: { steps: number | null }) => h.steps != null).length)
      : 0
    const waterScore = clamp((avgWater / 2000) * 33)
    const sleepScore = clamp((avgSleep / 8) * 33)
    const stepsScore = clamp((avgSteps / 10000) * 34)
    const energy = clamp(waterScore + sleepScore + stepsScore)
    const energyDetail = `${Math.round(avgWater)}мл воды · ${avgSleep.toFixed(1)}ч сна · ${Math.round(avgSteps).toLocaleString('ru')} шагов`

    setStats({ strength, wealth, intelligence, energy })
    setDetails({ strength: strengthDetail, wealth: wealthDetail, intelligence: intelligenceDetail, energy: energyDetail })
    setLoading(false)
  }

  const level = Math.round(Object.values(stats).reduce((s, v) => s + v, 0) / 4)
  const AvatarIcon = getAvatarIcon(level)
  const avatarColor = getAvatarColor(level)
  const levelTitle = getLevelTitle(level)

  return (
    <div className="flex flex-col gap-4">

      {/* Персонаж */}
      <div
        className="rounded-xl p-5 flex flex-col items-center gap-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: loading ? 'var(--surface-2)' : avatarColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <RefreshCw size={36} color="var(--text-muted)" /> : <AvatarIcon size={44} color={avatarColor} strokeWidth={1.5} />}
        </div>
        <div className="text-center">
          <p style={{ color: 'var(--text)', fontSize: '20px', fontWeight: '800' }}>Уровень {level}</p>
          <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '600', marginTop: '2px' }}>{levelTitle}</p>
        </div>

        {/* Общая шкала */}
        <div style={{ width: '100%', height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${level}%`,
              borderRadius: '4px',
              background: 'linear-gradient(90deg, var(--accent), #22c55e)',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Общий прогресс: {level}/100</p>
      </div>

      {/* Четыре стата */}
      {loading ? (
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Считаю статы...</p>
        </div>
      ) : (
        statConfig.map(({ key, label, Icon, color, desc }) => {
          const val = stats[key]
          return (
            <div
              key={key}
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color={color} />
                  </div>
                  <div>
                    <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '700' }}>{label}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{details[key]}</p>
                  </div>
                </div>
                <p style={{ color, fontSize: '22px', fontWeight: '800', flexShrink: 0 }}>{val}</p>
              </div>

              {/* Шкала */}
              <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{ height: '100%', width: `${val}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease' }}
                />
              </div>

              {/* Мини-комментарий */}
              <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                {val === 0 && `Начни ${desc.toLowerCase()} чтобы прокачать ${label.toLowerCase()}`}
                {val > 0 && val < 30 && `Слабовато, бро. Давай активнее!`}
                {val >= 30 && val < 60 && `Неплохо, продолжай в том же духе 💪`}
                {val >= 60 && val < 80 && `Красава, бро! Ты в ударе 🔥`}
                {val >= 80 && `Элита! Ты монстр 👑`}
              </p>
            </div>
          )
        })
      )}

      {/* Кнопка обновить */}
      <button
        onClick={calcStats}
        disabled={loading}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '10px', padding: '10px', fontSize: '13px', cursor: 'pointer' }}
      >
        {loading
          ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Обновляю...</>
          : <><RefreshCw size={14} /> Обновить статы</>}
      </button>

    </div>
  )
}
