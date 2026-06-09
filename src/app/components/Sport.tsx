'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Mic, MicOff, Dumbbell, Activity, PersonStanding, Bike, Waves, Gamepad2 } from 'lucide-react'

type WorkoutSet = {
  id: string
  exercise: string
  sets: number | null
  reps: number | null
  weight_kg: number | null
}

type Workout = {
  id: string
  type: string
  duration_min: number | null
  notes: string | null
  date: string
  created_at: string
  workout_sets: WorkoutSet[]
}

const workoutTypes: { id: string; label: string; Icon: React.FC<{ size?: number; color?: string }> ; color: string }[] = [
  { id: 'strength', label: 'Силовая', Icon: Dumbbell, color: '#ef4444' },
  { id: 'cardio', label: 'Кардио', Icon: Activity, color: '#f97316' },
  { id: 'yoga', label: 'Растяжка', Icon: PersonStanding, color: '#8b5cf6' },
  { id: 'cycling', label: 'Велосипед', Icon: Bike, color: '#3b82f6' },
  { id: 'swimming', label: 'Плавание', Icon: Waves, color: '#06b6d4' },
  { id: 'sport', label: 'Игровой', Icon: Gamepad2, color: '#22c55e' },
]

function toLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatSet(s: WorkoutSet): string {
  const parts: string[] = []
  if (s.sets && s.reps) parts.push(`${s.sets}×${s.reps}`)
  else if (s.sets) parts.push(`${s.sets} подх.`)
  else if (s.reps) parts.push(`${s.reps} повт.`)
  if (s.weight_kg) parts.push(`${s.weight_kg} кг`)
  return parts.join(' · ')
}

function formatDateLabel(dateStr: string): string {
  const today = toLocalDate(new Date())
  const yesterday = toLocalDate(new Date(Date.now() - 86400000))
  const tomorrow = toLocalDate(new Date(Date.now() + 86400000))
  const date = new Date(dateStr + 'T00:00:00')
  const short = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  if (dateStr === today) return `Сегодня, ${short}`
  if (dateStr === yesterday) return `Вчера, ${short}`
  if (dateStr === tomorrow) return `Завтра, ${short}`
  return short
}

export default function Sport({ userId }: { userId: string }) {
  const [selectedDate, setSelectedDate] = useState(toLocalDate(new Date()))
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [showNew, setShowNew] = useState(false)
  const [selectedType, setSelectedType] = useState('strength')
  const [duration, setDuration] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [creating, setCreating] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const supabase = createClient()
  const today = toLocalDate(new Date())

  useEffect(() => {
    loadWorkouts(selectedDate)
    setShowNew(false)
    setExpandedId(null)
  }, [selectedDate])

  async function loadWorkouts(date: string) {
    const { data } = await supabase
      .from('workouts')
      .select('*, workout_sets(id, exercise, sets, reps, weight_kg)')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: false })
    if (data) setWorkouts(data)
  }

  function changeDate(dir: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + dir)
    setSelectedDate(toLocalDate(d))
  }

  async function createWorkout() {
    if (creating) return
    setCreating(true)
    const { data } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        date: selectedDate,
        type: selectedType,
        duration_min: duration ? parseInt(duration) : null,
      })
      .select('*, workout_sets(id, exercise, sets, reps, weight_kg)')
      .single()
    if (data) {
      setWorkouts((prev) => [data, ...prev])
      setExpandedId(data.id)
      setShowNew(false)
      setDuration('')
    }
    setCreating(false)
  }

  async function addExercises(workoutId: string) {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setInput('')

    try {
      const res = await fetch('https://www.nnnis.site/webhook/aibro-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const parsed: { exercise: string; sets: number | null; reps: number | null; weight_kg: number | null }[] = await res.json()

      const toInsert = parsed.map((s) => ({
        workout_id: workoutId,
        exercise: s.exercise,
        sets: s.sets,
        reps: s.reps,
        weight_kg: s.weight_kg,
      }))

      const { data } = await supabase.from('workout_sets').insert(toInsert).select()
      if (data) {
        setWorkouts((prev) =>
          prev.map((w) =>
            w.id === workoutId ? { ...w, workout_sets: [...w.workout_sets, ...data] } : w
          )
        )
      }
    } catch {
      // Фолбэк: сохраняем как текст без разбора
      const { data } = await supabase
        .from('workout_sets')
        .insert({ workout_id: workoutId, exercise: text, sets: null, reps: null, weight_kg: null })
        .select()
        .single()
      if (data) {
        setWorkouts((prev) =>
          prev.map((w) =>
            w.id === workoutId ? { ...w, workout_sets: [...w.workout_sets, data] } : w
          )
        )
      }
    }

    setLoading(false)
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Голосовой ввод не поддерживается'); return }
    const r = new SR()
    r.lang = 'ru-RU'
    r.continuous = false
    r.interimResults = false
    r.onstart = () => setListening(true)
    r.onend = () => setListening(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      setInput((prev) => (prev ? prev + ', ' + t : t))
    }
    r.start()
    recognitionRef.current = r
  }

  const isToday = selectedDate === today
  const totalSets = workouts.reduce((s, w) => s + w.workout_sets.length, 0)

  return (
    <div className="flex flex-col gap-4">

      {/* Навигатор по датам */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => changeDate(-1)}
          className="flex flex-col items-center gap-0.5 flex-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
        >
          <ChevronLeft size={18} color="var(--text-muted)" />
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            {formatDateLabel(toLocalDate(new Date(new Date(selectedDate + 'T00:00:00').getTime() - 86400000))).split(',')[0]}
          </span>
        </button>

        <div className="text-center flex-shrink-0">
          <p className="font-semibold" style={{ color: 'var(--text)', fontSize: '15px' }}>
            {formatDateLabel(selectedDate)}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {workouts.length === 0
              ? 'Нет тренировок'
              : `${workouts.length} тренир. · ${totalSets} подходов`}
          </p>
        </div>

        <button
          onClick={() => changeDate(1)}
          className="flex flex-col items-center gap-0.5 flex-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
        >
          <ChevronRight size={18} color="var(--text-muted)" />
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            {formatDateLabel(toLocalDate(new Date(new Date(selectedDate + 'T00:00:00').getTime() + 86400000))).split(',')[0]}
          </span>
        </button>
      </div>

      {/* Кнопка добавить — только для сегодня */}
      {isToday && (
        <button
          onClick={() => setShowNew((v) => !v)}
          style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
        >
          {showNew ? 'Отмена' : '+ Тренировка'}
        </button>
      )}

      {/* Форма новой тренировки */}
      {showNew && (
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Тип тренировки</p>
          <div className="flex flex-wrap gap-2">
            {workoutTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                style={{
                  background: selectedType === t.id ? 'var(--accent)' : 'var(--surface-2)',
                  border: `1px solid ${selectedType === t.id ? 'var(--accent)' : 'var(--border)'}`,
                  color: selectedType === t.id ? '#fff' : 'var(--text-muted)',
                  borderRadius: '8px', padding: '7px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                <t.Icon size={14} /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Длительность (мин)"
              style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
            />
          </div>
          <button
            onClick={createWorkout}
            disabled={creating}
            style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
          >
            {creating ? '...' : 'Начать тренировку 💪'}
          </button>
        </div>
      )}

      {/* Пустой день */}
      {workouts.length === 0 && !showNew && (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '40px', marginBottom: '8px' }}>🏋️</p>
          <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
            {isToday ? 'Сегодня не тренировался' : 'В этот день не тренировался'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {isToday ? 'Добавь тренировку, бро!' : ''}
          </p>
        </div>
      )}

      {/* Список тренировок */}
      {workouts.map((workout) => {
        const typeInfo = workoutTypes.find((t) => t.id === workout.type) ?? { Icon: Dumbbell, color: '#ef4444', label: workout.type }
        const isExpanded = expandedId === workout.id

        return (
          <div
            key={workout.id}
            className="rounded-xl flex flex-col"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}
          >
            {/* Шапка тренировки */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : workout.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: typeInfo.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <typeInfo.Icon size={22} color={typeInfo.color} />
              </div>
              <div className="flex-1">
                <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600' }}>{typeInfo.label}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  {workout.workout_sets.length} упражнений
                  {workout.duration_min ? ` · ${workout.duration_min} мин` : ''}
                </p>
              </div>
              {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
            </button>

            {/* Раскрытое содержимое */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border)' }}>

                {/* Список упражнений */}
                {workout.workout_sets.length > 0 && (
                  <div style={{ padding: '12px 16px' }} className="flex flex-col gap-2">
                    {workout.workout_sets.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '20px', flexShrink: 0 }}>{i + 1}.</span>
                        <div className="flex-1">
                          <p style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '600' }}>{s.exercise}</p>
                          {formatSet(s) && (
                            <p style={{ color: 'var(--accent)', fontSize: '12px' }}>{formatSet(s)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ввод упражнений — только для сегодня */}
                {isToday && <div style={{ padding: '12px 16px', borderTop: workout.workout_sets.length > 0 ? '1px solid var(--border)' : 'none' }} className="flex flex-col gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addExercises(workout.id) } }}
                    placeholder={'Жим лёжа 4х10 80кг, присед 3х8 100кг...'}
                    rows={2}
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none', resize: 'none', width: '100%' }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={startVoice}
                      style={{ background: listening ? 'var(--accent)' : 'var(--surface-2)', border: '1px solid var(--border)', color: listening ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      {listening ? <><MicOff size={14} /> Слушаю...</> : <><Mic size={14} /> Голос</>}
                    </button>
                    <button
                      onClick={() => addExercises(workout.id)}
                      disabled={!input.trim() || loading}
                      style={{ flex: 1, background: input.trim() ? 'var(--accent)' : 'var(--surface-2)', border: 'none', color: input.trim() ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', cursor: input.trim() ? 'pointer' : 'default' }}
                    >
                      {loading ? '...' : 'Добавить'}
                    </button>
                  </div>
                </div>}
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}
