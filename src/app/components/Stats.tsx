'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/lib/LanguageContext'
import { Dumbbell, Coins, Brain, Zap, Trophy, Flame, TrendingUp, Smile, Moon, RefreshCw } from 'lucide-react'

type StatKey = 'strength' | 'wealth' | 'intelligence' | 'energy'
type Stats = Record<StatKey, number>

type RawDetails = {
  workoutCount: number
  totalSets: number
  income: number
  goalProgress: number
  completedTasks: number
  completedHabits: number
  avgWater: number
  avgSleep: number
  avgSteps: number
}

function toLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(val)))
}

const statIconConfig: { key: StatKey; Icon: React.FC<{ size?: number; color?: string }>; color: string }[] = [
  { key: 'strength',     Icon: Dumbbell, color: '#ef4444' },
  { key: 'wealth',       Icon: Coins,    color: '#f59e0b' },
  { key: 'intelligence', Icon: Brain,    color: '#3b82f6' },
  { key: 'energy',       Icon: Zap,      color: '#22c55e' },
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
  return '#6b7280'
}

export default function StatsPage({ userId }: { userId: string }) {
  const { tr } = useLang()
  const [stats, setStats] = useState<Stats>({ strength: 0, wealth: 0, intelligence: 0, energy: 0 })
  const [raw, setRaw] = useState<RawDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    calcStats()
  }, [])

  function getLevelTitle(level: number): string {
    if (level >= 80) return tr.stats.titles.elite
    if (level >= 60) return tr.stats.titles.advanced
    if (level >= 40) return tr.stats.titles.inProgress
    if (level >= 20) return tr.stats.titles.beginner
    return tr.stats.titles.sleeping
  }

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

    // Strength
    const workouts = workoutsRes.data ?? []
    const workoutCount = workouts.length
    const totalSets = workouts.reduce((s: number, w: { workout_sets: { id: string }[] }) => s + (w.workout_sets?.length ?? 0), 0)
    const strength = clamp(workoutCount * 15 + Math.min(totalSets * 2, 40))

    // Wealth
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

    // Intelligence
    const tasks = tasksRes.data ?? []
    const completedTasks = tasks.filter((t: { status: string }) => t.status === 'completed').length
    const eduTasks = tasks.filter((t: { category: string | null }) => t.category === 'education' || t.category === 'work').length
    const habits = habitsRes.data ?? []
    const completedHabits = habits.filter((h: { completed: boolean }) => h.completed).length
    const intelligence = clamp(completedTasks * 8 + eduTasks * 5 + completedHabits * 3)

    // Energy
    const healthLogs = healthRes.data ?? []
    const avgWater = healthLogs.length > 0
      ? healthLogs.reduce((s: number, h: { water_ml: number }) => s + (h.water_ml ?? 0), 0) / healthLogs.length
      : 0
    const sleepLogs = healthLogs.filter((h: { sleep_hours: number | null }) => h.sleep_hours != null)
    const avgSleep = sleepLogs.length > 0
      ? sleepLogs.reduce((s: number, h: { sleep_hours: number | null }) => s + (h.sleep_hours ?? 0), 0) / sleepLogs.length
      : 0
    const stepsLogs = healthLogs.filter((h: { steps: number | null }) => h.steps != null)
    const avgSteps = stepsLogs.length > 0
      ? stepsLogs.reduce((s: number, h: { steps: number | null }) => s + (h.steps ?? 0), 0) / stepsLogs.length
      : 0
    const waterScore = clamp((avgWater / 2000) * 33)
    const sleepScore = clamp((avgSleep / 8) * 33)
    const stepsScore = clamp((avgSteps / 10000) * 34)
    const energy = clamp(waterScore + sleepScore + stepsScore)

    setStats({ strength, wealth, intelligence, energy })
    setRaw({ workoutCount, totalSets, income, goalProgress, completedTasks, completedHabits, avgWater, avgSleep, avgSteps })
    setLoading(false)
  }

  const level = Math.round(Object.values(stats).reduce((s, v) => s + v, 0) / 4)
  const AvatarIcon = getAvatarIcon(level)
  const avatarColor = getAvatarColor(level)
  const levelTitle = getLevelTitle(level)

  function getDetail(key: StatKey): string {
    if (!raw) return ''
    switch (key) {
      case 'strength':     return tr.stats.details.strength(raw.workoutCount, raw.totalSets)
      case 'wealth':       return tr.stats.details.wealth(raw.income, Math.round(raw.goalProgress * 100))
      case 'intelligence': return tr.stats.details.intelligence(raw.completedTasks, raw.completedHabits)
      case 'energy':       return tr.stats.details.energy(raw.avgWater, raw.avgSleep, raw.avgSteps)
    }
  }

  function getComment(val: number, label: string): string {
    if (val === 0) return tr.stats.commentZero(label.toLowerCase())
    if (val < 30)  return tr.stats.commentLow
    if (val < 60)  return tr.stats.commentMid
    if (val < 80)  return tr.stats.commentHigh
    return tr.stats.commentMax
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Avatar */}
      <div
        className="rounded-xl p-5 flex flex-col items-center gap-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: loading ? 'var(--surface-2)' : avatarColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <RefreshCw size={36} color="var(--text-muted)" /> : <AvatarIcon size={44} color={avatarColor} strokeWidth={1.5} />}
        </div>
        <div className="text-center">
          <p style={{ color: 'var(--text)', fontSize: '20px', fontWeight: '800' }}>
            {loading ? '...' : tr.stats.levelLabel(level)}
          </p>
          <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '600', marginTop: '2px' }}>
            {loading ? tr.stats.calculating : levelTitle}
          </p>
        </div>

        <div style={{ width: '100%', height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: loading ? '0%' : `${level}%`,
              borderRadius: '4px',
              background: 'linear-gradient(90deg, var(--accent), #22c55e)',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          {loading ? ' ' : tr.stats.progress(level)}
        </p>
      </div>

      {/* Four stats */}
      {loading ? (
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{tr.stats.calculating}...</p>
        </div>
      ) : (
        statIconConfig.map(({ key, Icon, color }) => {
          const val = stats[key]
          const label = tr.stats.statLabels[key]
          const desc = tr.stats.statDescs[key]
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
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{raw ? getDetail(key) : desc}</p>
                  </div>
                </div>
                <p style={{ color, fontSize: '22px', fontWeight: '800', flexShrink: 0 }}>{val}</p>
              </div>

              <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                {getComment(val, label)}
              </p>
            </div>
          )
        })
      )}

      <button
        onClick={calcStats}
        disabled={loading}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '10px', padding: '10px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
      >
        <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        {loading ? tr.stats.refreshing : tr.stats.refreshBtn}
      </button>

    </div>
  )
}
