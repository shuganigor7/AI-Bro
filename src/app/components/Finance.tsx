'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { UtensilsCrossed, Car, Gamepad2, Pill, Dumbbell, Zap, Shirt, BookOpen, Briefcase, Laptop, Gift, TrendingUp, Target, Package, ArrowDownLeft, Mic, MicOff, PiggyBank, CreditCard } from 'lucide-react'

type Goal = {
  id: string
  title: string
  target_amount: number
  created_at: string
  goal_contributions: { id: string; amount: number; date: string; note: string | null; created_at: string }[]
}

type Transaction = {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string | null
  description: string | null
  date: string
  created_at: string
}

const categoryIcon: Record<string, { Icon: React.FC<{ size?: number; color?: string }>; color: string }> = {
  food:          { Icon: UtensilsCrossed, color: '#f97316' },
  transport:     { Icon: Car,            color: '#6366f1' },
  entertainment: { Icon: Gamepad2,       color: '#8b5cf6' },
  health:        { Icon: Pill,           color: '#ef4444' },
  sport:         { Icon: Dumbbell,       color: '#f97316' },
  utilities:     { Icon: Zap,           color: '#f59e0b' },
  clothing:      { Icon: Shirt,          color: '#ec4899' },
  education:     { Icon: BookOpen,       color: '#3b82f6' },
  salary:        { Icon: Briefcase,      color: '#22c55e' },
  freelance:     { Icon: Laptop,         color: '#22c55e' },
  gift:          { Icon: Gift,           color: '#ec4899' },
  investment:    { Icon: TrendingUp,     color: '#22c55e' },
  savings:       { Icon: Target,         color: '#7c3aed' },
  other:         { Icon: Package,        color: '#6b7280' },
}

const categoryLabel: Record<string, string> = {
  food: 'Еда',
  transport: 'Транспорт',
  entertainment: 'Развлечения',
  health: 'Здоровье',
  sport: 'Спорт',
  utilities: 'Коммуналка',
  clothing: 'Одежда',
  education: 'Обучение',
  salary: 'Зарплата',
  freelance: 'Фриланс',
  gift: 'Подарок',
  investment: 'Инвестиции',
  savings: 'Накопления',
  other: 'Прочее',
}

function toLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function matchGoal(hint: string, goals: Goal[]): Goal | null {
  const h = hint.toLowerCase()
  return (
    goals.find((g) => g.title.toLowerCase().includes(h)) ??
    goals.find((g) => h.includes(g.title.toLowerCase().split(' ')[0])) ??
    null
  )
}

export default function Finance({ userId }: { userId: string }) {
  const [subTab, setSubTab] = useState<'transactions' | 'goals'>('transactions')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [goalNotice, setGoalNotice] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const supabase = createClient()

  useEffect(() => {
    loadTransactions()
    loadGoals()
  }, [])

  async function loadTransactions() {
    const now = new Date()
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const lastDay = toLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    const { data } = await supabase
      .from('finances')
      .select('*')
      .eq('user_id', userId)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (data) setTransactions(data)
  }

  async function loadGoals() {
    const { data } = await supabase
      .from('financial_goals')
      .select('*, goal_contributions(id, amount, date, note, created_at)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setGoals(data)
  }

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpense

  async function addTransaction() {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setInput('')

    const today = toLocalDate(new Date())

    try {
      const res = await fetch('https://www.nnnis.site/webhook/aibro-finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today }),
      })
      const classified: {
        type: string
        amount: number
        category: string
        description: string
        date: string | null
        goal_hint: string | null
      }[] = await res.json()

      const toInsert = classified.map((t) => ({
        user_id: userId,
        type: t.type === 'savings' ? 'expense' : t.type,
        amount: t.amount,
        category: t.goal_hint ? 'savings' : t.category,
        description: t.description,
        date: t.date ?? today,
      }))

      const { data } = await supabase.from('finances').insert(toInsert).select()
      if (data) {
        const now = new Date()
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const forThisMonth = data.filter((t) => t.date.startsWith(thisMonth))
        if (forThisMonth.length > 0) setTransactions((prev) => [...forThisMonth, ...prev])
      }

      // Матчим цели и записываем contributions
      const goalNotices: string[] = []
      for (const t of classified) {
        if (!t.goal_hint) continue
        const matched = matchGoal(t.goal_hint, goals)
        if (!matched) continue

        const txDate = t.date ?? today
        const { data: contrib } = await supabase
          .from('goal_contributions')
          .insert({ goal_id: matched.id, user_id: userId, amount: t.amount, date: txDate, note: t.description || null })
          .select()
          .single()

        if (contrib) {
          setGoals((prev) =>
            prev.map((g) =>
              g.id === matched.id
                ? { ...g, goal_contributions: [contrib, ...g.goal_contributions] }
                : g
            )
          )
          goalNotices.push(`€${t.amount} → "${matched.title}"`)
        }
      }

      if (goalNotices.length > 0) {
        setGoalNotice('Добавлено в цель: ' + goalNotices.join(', '))
        setTimeout(() => setGoalNotice(null), 4000)
      }
    } catch {
      const amountMatch = text.match(/\d+([.,]\d+)?/)
      const amount = amountMatch ? parseFloat(amountMatch[0].replace(',', '.')) : 0
      const type = /получил|заработал|доход|зарплата|фриланс/i.test(text) ? 'income' : 'expense'
      const { data } = await supabase
        .from('finances')
        .insert({ user_id: userId, type, amount, description: text, date: today })
        .select()
        .single()
      if (data) setTransactions((prev) => [data, ...prev])
    }

    setLoading(false)
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Голосовой ввод не поддерживается в этом браузере')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput((prev) => (prev ? prev + ' ' + transcript : transcript))
    }
    recognition.start()
    recognitionRef.current = recognition
  }

  const grouped = transactions.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = []
    acc[t.date].push(t)
    return acc
  }, {} as Record<string, Transaction[]>)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const monthLabel = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-4">

      {/* Суб-навигация */}
      <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {(['transactions', 'goals'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              flex: 1,
              padding: '7px 0',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              background: subTab === tab ? 'var(--accent)' : 'transparent',
              color: subTab === tab ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {tab === 'transactions' ? <><CreditCard size={14} /> Транзакции</> : <><Target size={14} /> Цели</>}
            </span>
          </button>
        ))}
      </div>

      {subTab === 'goals' && <Goals userId={userId} goals={goals} setGoals={setGoals} />}

      {subTab === 'transactions' && (
        <>
          {/* Уведомление о цели */}
          {goalNotice && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#22c55e22', border: '1px solid #22c55e', color: '#22c55e' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Target size={14} /> {goalNotice}</span>
            </div>
          )}

          {/* Баланс */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
              {monthLabel}
            </p>
            <p style={{ color: balance >= 0 ? '#22c55e' : '#ef4444', fontSize: '28px', fontWeight: '700', marginBottom: '10px' }}>
              {balance >= 0 ? '+' : ''}€{balance.toFixed(2)}
            </p>
            <div className="flex gap-6">
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Доходы</p>
                <p style={{ color: '#22c55e', fontSize: '14px', fontWeight: '600' }}>+€{totalIncome.toFixed(2)}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Расходы</p>
                <p style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600' }}>-€{totalExpense.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Ввод */}
          <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTransaction() } }}
              placeholder="Потратил 50€ на продукты, отложил 100€ на ноутбук..."
              rows={2}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '15px', resize: 'none', width: '100%' }}
            />
            <div className="flex gap-2 justify-between items-center">
              <button
                onClick={startVoice}
                style={{ background: listening ? 'var(--accent)' : 'var(--surface-2)', border: '1px solid var(--border)', color: listening ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {listening ? <><MicOff size={14} /> Слушаю...</> : <><Mic size={14} /> Голос</>}
              </button>
              <button
                onClick={addTransaction}
                disabled={!input.trim() || loading}
                style={{ background: input.trim() ? 'var(--accent)' : 'var(--surface-2)', border: 'none', color: input.trim() ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', cursor: input.trim() ? 'pointer' : 'default', fontWeight: '600' }}
              >
                {loading ? '...' : 'Добавить'}
              </button>
            </div>
          </div>

          {/* Транзакции */}
          {sortedDates.length > 0 ? (
            sortedDates.map((date) => (
              <div key={date} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </p>
                {grouped[date].map((t) => <TransactionCard key={t.id} transaction={t} />)}
              </div>
            ))
          ) : (
            <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Нет транзакций в этом месяце. Добавь первую, бро!</p>
            </div>
          )}
        </>
      )}

    </div>
  )
}

function Goals({
  userId,
  goals,
  setGoals,
}: {
  userId: string
  goals: Goal[]
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNewGoal, setShowNewGoal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [contribAmount, setContribAmount] = useState('')
  const [contribNote, setContribNote] = useState('')
  const [contribDate, setContribDate] = useState(toLocalDate(new Date()))
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function addGoal() {
    if (!newTitle.trim() || !newTarget || saving) return
    setSaving(true)
    const { data } = await supabase
      .from('financial_goals')
      .insert({ user_id: userId, title: newTitle.trim(), target_amount: parseFloat(newTarget) })
      .select('*, goal_contributions(id, amount, date, note, created_at)')
      .single()
    if (data) {
      setGoals((prev) => [data, ...prev])
      setNewTitle('')
      setNewTarget('')
      setShowNewGoal(false)
    }
    setSaving(false)
  }

  async function addContribution(goalId: string) {
    const amount = parseFloat(contribAmount)
    if (!amount || saving) return
    setSaving(true)
    const { data } = await supabase
      .from('goal_contributions')
      .insert({ goal_id: goalId, user_id: userId, amount, date: contribDate, note: contribNote.trim() || null })
      .select()
      .single()
    if (data) {
      setGoals((prev) =>
        prev.map((g) => g.id === goalId ? { ...g, goal_contributions: [data, ...g.goal_contributions] } : g)
      )
      setContribAmount('')
      setContribNote('')
      setContribDate(toLocalDate(new Date()))
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setShowNewGoal((v) => !v)}
        style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
      >
        {showNewGoal ? 'Отмена' : '+ Новая цель'}
      </button>

      {showNewGoal && (
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Название цели (напр. Новый ноутбук)"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none', width: '100%' }}
          />
          <div className="flex gap-2 items-center">
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>€</span>
            <input
              type="number"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="Сумма цели"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none', flex: 1 }}
            />
          </div>
          <button
            onClick={addGoal}
            disabled={!newTitle.trim() || !newTarget || saving}
            style={{ background: newTitle.trim() && newTarget ? 'var(--accent)' : 'var(--surface-2)', border: 'none', color: newTitle.trim() && newTarget ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '8px', fontSize: '14px', fontWeight: '600', cursor: newTitle.trim() && newTarget ? 'pointer' : 'default' }}
          >
            {saving ? '...' : 'Создать'}
          </button>
        </div>
      )}

      {goals.length === 0 && !showNewGoal && (
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Нет финансовых целей. Создай первую, бро!</p>
        </div>
      )}

      {goals.map((goal) => {
        const saved = goal.goal_contributions.reduce((s, c) => s + Number(c.amount), 0)
        const pct = Math.min(100, Math.round((saved / goal.target_amount) * 100))
        const isExpanded = expandedId === goal.id
        const sortedContribs = [...goal.goal_contributions].sort(
          (a, b) => new Date(b.date + 'T00:00:00').getTime() - new Date(a.date + 'T00:00:00').getTime()
        )

        return (
          <div key={goal.id} className="rounded-xl flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : goal.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px', textAlign: 'left' }}
            >
              <div className="flex justify-between items-center" style={{ marginBottom: '10px' }}>
                <div className="flex items-center gap-2">
                  <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: pct >= 100 ? '#22c55e22' : '#7c3aed22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PiggyBank size={18} color={pct >= 100 ? '#22c55e' : '#7c3aed'} />
                  </div>
                  <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600' }}>{goal.title}</p>
                </div>
                <p style={{ color: pct >= 100 ? '#22c55e' : 'var(--accent)', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>{pct}%</p>
              </div>
              <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px', marginBottom: '8px' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#22c55e' : 'var(--accent)', borderRadius: '3px', transition: 'width 0.3s' }} />
              </div>
              <div className="flex justify-between">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  Накоплено: <span style={{ color: 'var(--text)', fontWeight: '600' }}>€{saved.toFixed(2)}</span>
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  Цель: <span style={{ color: 'var(--text)', fontWeight: '600' }}>€{Number(goal.target_amount).toFixed(2)}</span>
                </p>
              </div>
            </button>

            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Отложить деньги</p>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1" style={{ flex: 1 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>€</span>
                      <input
                        type="number"
                        value={contribAmount}
                        onChange={(e) => setContribAmount(e.target.value)}
                        placeholder="Сумма"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text)', fontSize: '14px', outline: 'none', width: '100%' }}
                      />
                    </div>
                    <input
                      type="date"
                      value={contribDate}
                      onChange={(e) => setContribDate(e.target.value)}
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                  <input
                    value={contribNote}
                    onChange={(e) => setContribNote(e.target.value)}
                    placeholder="Заметка (необязательно)"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text)', fontSize: '14px', outline: 'none', width: '100%' }}
                  />
                  <button
                    onClick={() => addContribution(goal.id)}
                    disabled={!contribAmount || saving}
                    style={{ background: contribAmount ? 'var(--accent)' : 'var(--surface-2)', border: 'none', color: contribAmount ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: '600', cursor: contribAmount ? 'pointer' : 'default' }}
                  >
                    {saving ? '...' : 'Добавить'}
                  </button>
                </div>

                {sortedContribs.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>История</p>
                    {sortedContribs.map((c) => (
                      <div key={c.id} className="flex justify-between items-center">
                        <div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            {new Date(c.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          {c.note && <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{c.note}</p>}
                        </div>
                        <p style={{ color: '#22c55e', fontSize: '14px', fontWeight: '700' }}>+€{Number(c.amount).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TransactionCard({ transaction: t }: { transaction: Transaction }) {
  const cat = categoryIcon[t.category ?? 'other'] ?? categoryIcon.other
  const iconColor = t.type === 'income' ? '#22c55e' : cat.color
  const bgColor = iconColor + '22'
  const IconComponent = t.type === 'income' ? ArrowDownLeft : (t.category === 'savings' ? Target : cat.Icon)
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconComponent size={18} color={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ color: 'var(--text)', fontSize: '14px', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.description || categoryLabel[t.category ?? 'other'] || t.category}
        </p>
        {t.category && (
          <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{categoryLabel[t.category] ?? t.category}</p>
        )}
      </div>
      <p style={{ color: t.type === 'income' ? '#22c55e' : t.category === 'savings' ? 'var(--accent)' : '#ef4444', fontSize: '16px', fontWeight: '700', flexShrink: 0 }}>
        {t.type === 'income' ? '+' : '-'}€{Number(t.amount).toFixed(2)}
      </p>
    </div>
  )
}
