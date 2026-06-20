'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/lib/LanguageContext'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Mic, MicOff, Dumbbell, Activity, PersonStanding, Bike, Waves, Gamepad2, Trash2, Pencil, Check, X, Plus } from 'lucide-react'

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

const workoutTypesMeta: { id: string; Icon: React.FC<{ size?: number; color?: string }>; color: string }[] = [
  { id: 'strength', Icon: Dumbbell,        color: '#ef4444' },
  { id: 'cardio',   Icon: Activity,        color: '#f97316' },
  { id: 'yoga',     Icon: PersonStanding,  color: '#8b5cf6' },
  { id: 'cycling',  Icon: Bike,            color: '#3b82f6' },
  { id: 'swimming', Icon: Waves,           color: '#06b6d4' },
  { id: 'sport',    Icon: Gamepad2,        color: '#22c55e' },
]

function toLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateLabel(
  dateStr: string,
  labels: { today: string; yesterday: string; tomorrow: string },
  locale: string
): string {
  const today = toLocalDate(new Date())
  const yesterday = toLocalDate(new Date(Date.now() - 86400000))
  const tomorrow = toLocalDate(new Date(Date.now() + 86400000))
  const date = new Date(dateStr + 'T00:00:00')
  const short = date.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
  if (dateStr === today) return `${labels.today}, ${short}`
  if (dateStr === yesterday) return `${labels.yesterday}, ${short}`
  if (dateStr === tomorrow) return `${labels.tomorrow}, ${short}`
  return short
}

export default function Sport({ userId }: { userId: string }) {
  const { tr, lang } = useLang()
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
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editExercise, setEditExercise] = useState('')
  const [editSets, setEditSets] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editWeight, setEditWeight] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const supabase = createClient()
  const today = toLocalDate(new Date())

  const locale = lang === 'ru' ? 'ru-RU' : 'en-US'
  const dateLabels = { today: tr.todayLabel, yesterday: tr.yesterdayLabel, tomorrow: tr.tomorrowLabel }

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

  async function deleteWorkout(workoutId: string) {
    await supabase.from('workout_sets').delete().eq('workout_id', workoutId)
    await supabase.from('workouts').delete().eq('id', workoutId)
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutId))
    if (expandedId === workoutId) setExpandedId(null)
  }

  async function deleteSet(setId: string, workoutId: string) {
    await supabase.from('workout_sets').delete().eq('id', setId)
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId ? { ...w, workout_sets: w.workout_sets.filter((s) => s.id !== setId) } : w
      )
    )
  }

  function startEditSet(s: WorkoutSet) {
    setEditingSetId(s.id)
    setEditExercise(s.exercise)
    setEditSets(s.sets != null ? String(s.sets) : '')
    setEditReps(s.reps != null ? String(s.reps) : '')
    setEditWeight(s.weight_kg != null ? String(s.weight_kg) : '')
  }

  async function saveEditSet(setId: string, workoutId: string) {
    if (!editExercise.trim()) return
    const updates = {
      exercise: editExercise.trim(),
      sets: editSets ? parseInt(editSets) : null,
      reps: editReps ? parseInt(editReps) : null,
      weight_kg: editWeight ? parseFloat(editWeight) : null,
    }
    await supabase.from('workout_sets').update(updates).eq('id', setId)
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? { ...w, workout_sets: w.workout_sets.map((s) => (s.id === setId ? { ...s, ...updates } : s)) }
          : w
      )
    )
    setEditingSetId(null)
  }

  async function addSet(workoutId: string, exercise: string, weightKg: number | null) {
    const { data } = await supabase
      .from('workout_sets')
      .insert({ workout_id: workoutId, exercise, sets: 1, reps: null, weight_kg: weightKg })
      .select()
      .single()
    if (data) {
      setWorkouts((prev) =>
        prev.map((w) =>
          w.id === workoutId ? { ...w, workout_sets: [...w.workout_sets, data] } : w
        )
      )
      setEditingSetId(data.id)
      setEditExercise(exercise)
      setEditSets('1')
      setEditReps('')
      setEditWeight(weightKg != null ? String(weightKg) : '')
    }
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
    if (!SR) { alert(tr.voiceUnsupported); return }
    const r = new SR()
    r.lang = lang === 'ru' ? 'ru-RU' : 'en-US'
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

  function formatSet(s: WorkoutSet): string {
    const parts: string[] = []
    if (s.sets && s.reps) parts.push(`${s.sets}×${s.reps}`)
    else if (s.sets) parts.push(`${s.sets} ${tr.sport.setsAbbr}`)
    else if (s.reps) parts.push(`${s.reps} ${tr.sport.repsAbbr}`)
    if (s.weight_kg) parts.push(`${s.weight_kg} ${tr.sport.weightUnit}`)
    return parts.join(' · ')
  }

  const isToday = selectedDate === today
  const totalSets = workouts.reduce((s, w) => s + w.workout_sets.length, 0)

  return (
    <div className="flex flex-col gap-4">

      {/* Date navigator */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => changeDate(-1)}
          className="flex flex-col items-center gap-0.5 flex-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
        >
          <ChevronLeft size={18} color="var(--text-muted)" />
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            {formatDateLabel(toLocalDate(new Date(new Date(selectedDate + 'T00:00:00').getTime() - 86400000)), dateLabels, locale).split(',')[0]}
          </span>
        </button>

        <div className="text-center flex-shrink-0">
          <p className="font-semibold" style={{ color: 'var(--text)', fontSize: '15px' }}>
            {formatDateLabel(selectedDate, dateLabels, locale)}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {workouts.length === 0
              ? tr.sport.noWorkouts
              : tr.sport.workoutCount(workouts.length, totalSets)}
          </p>
        </div>

        <button
          onClick={() => changeDate(1)}
          className="flex flex-col items-center gap-0.5 flex-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
        >
          <ChevronRight size={18} color="var(--text-muted)" />
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            {formatDateLabel(toLocalDate(new Date(new Date(selectedDate + 'T00:00:00').getTime() + 86400000)), dateLabels, locale).split(',')[0]}
          </span>
        </button>
      </div>

      <button
        onClick={() => setShowNew((v) => !v)}
        style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
      >
        {showNew ? tr.cancel : tr.sport.newWorkout}
      </button>

      {showNew && (
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>{tr.sport.workoutTypeLabel}</p>
          <div className="flex flex-wrap gap-2">
            {workoutTypesMeta.map((t) => (
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
                <t.Icon size={14} /> {tr.sport.workoutTypes[t.id] ?? t.id}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder={tr.sport.durationPlaceholder}
              style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
            />
          </div>
          <button
            onClick={createWorkout}
            disabled={creating}
            style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
          >
            {creating ? '...' : tr.sport.startWorkout}
          </button>
        </div>
      )}

      {workouts.length === 0 && !showNew && (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '40px', marginBottom: '8px' }}>🏋️</p>
          <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
            {isToday ? tr.sport.emptyToday : tr.sport.emptyPast}
          </p>
          {isToday && <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tr.sport.addToday}</p>}
        </div>
      )}

      {workouts.map((workout) => {
        const typeMeta = workoutTypesMeta.find((t) => t.id === workout.type) ?? { Icon: Dumbbell, color: '#ef4444' }
        const typeLabel = tr.sport.workoutTypes[workout.type] ?? workout.type
        const isExpanded = expandedId === workout.id

        return (
          <div
            key={workout.id}
            className="rounded-xl flex flex-col"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : workout.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: typeMeta.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <typeMeta.Icon size={22} color={typeMeta.color} />
                </div>
                <div className="flex-1">
                  <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600' }}>{typeLabel}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                    {workout.workout_sets.length > 0
                      ? tr.sport.workoutSummary(new Set(workout.workout_sets.map((s) => s.exercise)).size, workout.workout_sets.length)
                      : tr.sport.exerciseCount(0)}
                    {workout.duration_min ? ` · ${tr.sport.minLabel(workout.duration_min)}` : ''}
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
              </button>
              <button
                onClick={() => deleteWorkout(workout.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '14px 12px', flexShrink: 0 }}
              >
                <Trash2 size={16} color="#ef444466" />
              </button>
            </div>

            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {workout.workout_sets.length > 0 && (() => {
                  const groups: { name: string; sets: WorkoutSet[] }[] = []
                  for (const s of workout.workout_sets) {
                    const g = groups.find((g) => g.name === s.exercise)
                    if (g) g.sets.push(s)
                    else groups.push({ name: s.exercise, sets: [s] })
                  }
                  return (
                    <div style={{ padding: '12px 16px' }} className="flex flex-col gap-3">
                      {groups.map((group, gi) => (
                        <div key={group.name + gi}>
                          <p style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>
                            {gi + 1}. {group.name}
                          </p>
                          <div className="flex flex-col gap-1" style={{ paddingLeft: '12px' }}>
                            {group.sets.map((s, si) => (
                              <div key={s.id}>
                                {editingSetId === s.id ? (
                                  <div className="flex flex-col gap-2" style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '10px' }}>
                                    <div className="flex gap-2">
                                      <input
                                        autoFocus
                                        type="number"
                                        value={editReps}
                                        onChange={(e) => setEditReps(e.target.value)}
                                        placeholder={tr.sport.repsAbbr}
                                        style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '6px 8px', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
                                      />
                                      <input
                                        type="number"
                                        value={editWeight}
                                        onChange={(e) => setEditWeight(e.target.value)}
                                        placeholder={tr.sport.weightUnit}
                                        style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => saveEditSet(s.id, workout.id)}
                                        style={{ flex: 1, background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '8px', padding: '7px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                      >
                                        <Check size={14} /> {tr.add}
                                      </button>
                                      <button
                                        onClick={() => { setEditingSetId(null); deleteSet(s.id, workout.id) }}
                                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer' }}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '56px' }}>
                                      {lang === 'ru' ? `Подход ${si + 1}` : `Set ${si + 1}`}
                                    </span>
                                    <span style={{ color: 'var(--accent)', fontSize: '13px', flex: 1 }}>
                                      {s.sets === 1
                                        ? [s.reps ? `${s.reps} ${tr.sport.repsAbbr}` : '', s.weight_kg ? `${s.weight_kg} ${tr.sport.weightUnit}` : ''].filter(Boolean).join(' · ') || '—'
                                        : formatSet(s) || '—'}
                                    </span>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <button onClick={() => startEditSet(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px' }}>
                                        <Pencil size={12} color="var(--text-muted)" />
                                      </button>
                                      <button onClick={() => deleteSet(s.id, workout.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px' }}>
                                        <Trash2 size={12} color="#ef444477" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={() => addSet(workout.id, group.name, group.sets[group.sets.length - 1]?.weight_kg ?? null)}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px 0', marginTop: '2px' }}
                            >
                              <Plus size={12} /> {lang === 'ru' ? 'подход' : 'add set'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <div style={{ padding: '12px 16px', borderTop: workout.workout_sets.length > 0 ? '1px solid var(--border)' : 'none' }} className="flex flex-col gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addExercises(workout.id) } }}
                      placeholder={tr.sport.exercisePlaceholder}
                      rows={2}
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none', resize: 'none', width: '100%' }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={startVoice}
                        style={{ background: listening ? 'var(--accent)' : 'var(--surface-2)', border: '1px solid var(--border)', color: listening ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        {listening ? <><MicOff size={14} /> {tr.voiceListening}</> : <><Mic size={14} /> {tr.voiceOn}</>}
                      </button>
                      <button
                        onClick={() => addExercises(workout.id)}
                        disabled={!input.trim() || loading}
                        style={{ flex: 1, background: input.trim() ? 'var(--accent)' : 'var(--surface-2)', border: 'none', color: input.trim() ? '#fff' : 'var(--text-muted)', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', cursor: input.trim() ? 'pointer' : 'default' }}
                      >
                        {loading ? '...' : tr.add}
                      </button>
                    </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}
