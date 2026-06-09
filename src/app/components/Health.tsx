'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Habits from '@/app/components/Habits'
import { Droplets, Moon, Footprints, Star, Smile, Meh, Flame, Zap, PersonStanding, BarChart2 } from 'lucide-react'

type HealthLog = {
  id?: string
  water_ml: number
  sleep_hours: number | null
  steps: number | null
}

function toLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const WATER_GOAL = 2000
const SLEEP_GOAL = 8
const STEPS_GOAL = 10000

function ProgressRing({ pct, color, size = 72 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = Math.min(1, pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
    </svg>
  )
}

export default function Health({ userId }: { userId: string }) {
  const [subTab, setSubTab] = useState<'metrics' | 'habits'>('metrics')
  const [log, setLog] = useState<HealthLog>({ water_ml: 0, sleep_hours: null, steps: null })
  const [customWater, setCustomWater] = useState('')
  const [sleepInput, setSleepInput] = useState('')
  const [stepsInput, setStepsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const today = toLocalDate(new Date())
  const supabase = createClient()

  useEffect(() => {
    loadLog()
  }, [])

  async function loadLog() {
    const { data } = await supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    if (data) {
      setLog(data)
      if (data.sleep_hours != null) setSleepInput(String(data.sleep_hours))
      if (data.steps != null) setStepsInput(String(data.steps))
    }
  }

  async function upsertLog(updates: Partial<HealthLog>) {
    setSaving(true)
    const newLog = { ...log, ...updates }
    setLog(newLog)
    await supabase.from('health_logs').upsert(
      { user_id: userId, date: today, ...newLog },
      { onConflict: 'user_id,date' }
    )
    setSaving(false)
  }

  async function addWater(ml: number) {
    await upsertLog({ water_ml: (log.water_ml || 0) + ml })
  }

  async function saveSleep() {
    const h = parseFloat(sleepInput.replace(',', '.'))
    if (!isNaN(h) && h > 0 && h <= 24) await upsertLog({ sleep_hours: h })
  }

  async function saveSteps() {
    const s = parseInt(stepsInput)
    if (!isNaN(s) && s >= 0) await upsertLog({ steps: s })
  }

  const waterPct = Math.min(100, Math.round((log.water_ml / WATER_GOAL) * 100))
  const sleepPct = log.sleep_hours ? Math.min(100, Math.round((log.sleep_hours / SLEEP_GOAL) * 100)) : 0
  const stepsPct = log.steps ? Math.min(100, Math.round((log.steps / STEPS_GOAL) * 100)) : 0

  const dateLabel = new Date(today + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col gap-4">

      {/* Суб-навигация */}
      <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {(['metrics', 'habits'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{ flex: 1, padding: '7px 0', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: subTab === tab ? 'var(--accent)' : 'transparent', color: subTab === tab ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {tab === 'metrics' ? <><BarChart2 size={14} /> Метрики</> : <><Flame size={14} /> Привычки</>}
            </span>
          </button>
        ))}
      </div>

      {subTab === 'habits' && <Habits userId={userId} />}

      {subTab === 'metrics' && <>

      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <p style={{ color: 'var(--text)', fontSize: '16px', fontWeight: '600' }}>Сегодня, {dateLabel}</p>
        {saving && <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Сохранение...</p>}
      </div>

      {/* Сводка дня — три кольца */}
      <div
        className="rounded-xl p-4 flex justify-around items-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {[
          { label: 'Вода', pct: waterPct, color: '#3b82f6', value: `${log.water_ml}мл` },
          { label: 'Сон', pct: sleepPct, color: '#8b5cf6', value: log.sleep_hours ? `${log.sleep_hours}ч` : '—' },
          { label: 'Шаги', pct: stepsPct, color: '#22c55e', value: log.steps ? log.steps.toLocaleString('ru') : '—' },
        ].map(({ label, pct, color, value }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div style={{ position: 'relative' }}>
              <ProgressRing pct={pct} color={color} />
              <p style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: pct >= 100 ? color : 'var(--text)', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                {pct}%
              </p>
            </div>
            <p style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '600' }}>{value}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Вода */}
      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Droplets size={20} color="#3b82f6" />
            <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600' }}>Вода</p>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            <span style={{ color: '#3b82f6', fontWeight: '700' }}>{log.water_ml}</span> / {WATER_GOAL} мл
          </p>
        </div>

        {/* Прогресс бар */}
        <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px' }}>
          <div style={{ height: '100%', width: `${waterPct}%`, background: '#3b82f6', borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>

        {/* Быстрые кнопки */}
        <div className="flex gap-2">
          {[250, 500, 750].map((ml) => (
            <button
              key={ml}
              onClick={() => addWater(ml)}
              style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 0', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              +{ml}
            </button>
          ))}
        </div>

        {/* Своя сумма */}
        <div className="flex gap-2">
          <input
            type="number"
            value={customWater}
            onChange={(e) => setCustomWater(e.target.value)}
            placeholder="Своя сумма (мл)"
            style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
          />
          <button
            onClick={() => { const v = parseInt(customWater); if (!isNaN(v) && v > 0) { addWater(v); setCustomWater('') } }}
            disabled={!customWater}
            style={{ background: customWater ? '#3b82f6' : 'var(--surface-2)', border: 'none', color: customWater ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: customWater ? 'pointer' : 'default' }}
          >
            +
          </button>
          {log.water_ml > 0 && (
            <button
              onClick={() => upsertLog({ water_ml: 0 })}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', cursor: 'pointer' }}
            >
              Сброс
            </button>
          )}
        </div>
      </div>

      {/* Сон */}
      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Moon size={20} color="#8b5cf6" />
          <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600' }}>Сон</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: 'auto' }}>Цель: {SLEEP_GOAL}ч</p>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={sleepInput}
            onChange={(e) => setSleepInput(e.target.value)}
            onBlur={saveSleep}
            onKeyDown={(e) => e.key === 'Enter' && saveSleep()}
            placeholder="Сколько часов поспал?"
            min="0" max="24" step="0.5"
            style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '15px', outline: 'none' }}
          />
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            {sleepPct >= 100
              ? <Star size={20} color="#f59e0b" fill="#f59e0b" />
              : sleepPct >= 75
              ? <Smile size={20} color="#22c55e" />
              : sleepPct > 0
              ? <Meh size={20} color="#f59e0b" />
              : <Moon size={20} color="var(--text-muted)" />}
          </div>
        </div>
        {/* Быстрые варианты */}
        <div className="flex gap-2">
          {[6, 7, 8, 9].map((h) => (
            <button
              key={h}
              onClick={() => { setSleepInput(String(h)); upsertLog({ sleep_hours: h }) }}
              style={{ flex: 1, background: log.sleep_hours === h ? '#8b5cf6' : 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 0', color: log.sleep_hours === h ? '#fff' : 'var(--text-muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              {h}ч
            </button>
          ))}
        </div>
      </div>

      {/* Шаги */}
      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Footprints size={20} color="#22c55e" />
          <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600' }}>Шаги</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: 'auto' }}>Цель: {STEPS_GOAL.toLocaleString('ru')}</p>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            onBlur={saveSteps}
            onKeyDown={(e) => e.key === 'Enter' && saveSteps()}
            placeholder="Сколько шагов сегодня?"
            min="0"
            style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '15px', outline: 'none' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {stepsPct >= 100
              ? <Flame size={20} color="#ef4444" />
              : stepsPct >= 50
              ? <Zap size={20} color="#f59e0b" />
              : stepsPct > 0
              ? <PersonStanding size={20} color="#3b82f6" />
              : <Footprints size={20} color="var(--text-muted)" />}
          </div>
        </div>
        {/* Прогресс бар */}
        <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px' }}>
          <div style={{ height: '100%', width: `${stepsPct}%`, background: '#22c55e', borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          {log.steps ? `${log.steps.toLocaleString('ru')} из ${STEPS_GOAL.toLocaleString('ru')} шагов` : 'Введи количество шагов'}
        </p>
      </div>

      </>}

    </div>
  )
}
