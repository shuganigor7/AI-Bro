'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/lib/LanguageContext'
import { ChevronLeft, ChevronRight, Trash2, Pencil, Check, X, Mic, MicOff } from 'lucide-react'

type Task = {
  id: string
  title: string
  priority: string
  category: string | null
  status: string
  date: string
  time: string | null
  created_at: string
}

const priorityColor: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
}

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
  const dateShort = date.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
  if (dateStr === today) return `${labels.today}, ${dateShort}`
  if (dateStr === yesterday) return `${labels.yesterday}, ${dateShort}`
  if (dateStr === tomorrow) return `${labels.tomorrow}, ${dateShort}`
  return dateShort
}

export default function Tasks({ userId }: { userId: string }) {
  const { tr, lang } = useLang()
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedDate, setSelectedDate] = useState(toLocalDate(new Date()))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const supabase = createClient()

  const locale = lang === 'ru' ? 'ru-RU' : 'en-US'
  const dateLabels = { today: tr.todayLabel, yesterday: tr.yesterdayLabel, tomorrow: tr.tomorrowLabel }

  useEffect(() => {
    loadTasks(selectedDate)
  }, [selectedDate])

  async function loadTasks(date: string) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: false })
    if (data) setTasks(data)
  }

  function changeDate(direction: number) {
    const current = new Date(selectedDate + 'T00:00:00')
    current.setDate(current.getDate() + direction)
    setSelectedDate(toLocalDate(current))
  }

  async function addTask() {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setInput('')
    setErrorMsg(null)

    try {
      const res = await fetch('https://www.nnnis.site/webhook/aibro-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today: selectedDate, lang }),
      })
      const classified: { title: string; priority: string; category: string; date: string | null; time: string | null }[] = await res.json()

      const toInsert = classified.map((t) => ({
        user_id: userId,
        title: t.title,
        priority: t.priority,
        category: t.category,
        date: t.date ?? selectedDate,
        time: t.time ?? null,
      }))

      const { data, error } = await supabase.from('tasks').insert(toInsert).select()

      if (error) setErrorMsg(`Insert error: ${error.message}`)

      if (data) {
        const forToday = data.filter((t) => t.date === selectedDate)
        if (forToday.length > 0) setTasks((prev) => [...forToday, ...prev])

        const otherDates = [...new Set(data.filter((t) => t.date !== selectedDate).map((t) => t.date))]
        if (otherDates.length > 0) {
          const labels = otherDates.map((d) => formatDateLabel(d, dateLabels, locale)).join(', ')
          setNotice(`${tr.tasks.completedSection}: ${labels}`)
          setTimeout(() => setNotice(null), 4000)
        }
      }
    } catch (err) {
      setErrorMsg(`Fetch error: ${err instanceof Error ? err.message : String(err)}`)
      const { data, error } = await supabase
        .from('tasks')
        .insert({ user_id: userId, title: text, priority: 'medium', date: selectedDate })
        .select()
        .single()
      if (error) setErrorMsg((prev) => `${prev} | Insert error: ${error.message}`)
      if (data) setTasks((prev) => [data, ...prev])
    }

    setLoading(false)
  }

  async function toggleTask(task: Task) {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    )
  }

  async function deleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  async function editTask(taskId: string, newTitle: string) {
    if (!newTitle.trim()) return
    await supabase.from('tasks').update({ title: newTitle.trim() }).eq('id', taskId)
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, title: newTitle.trim() } : t))
    )
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert(tr.voiceUnsupported)
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = lang === 'ru' ? 'ru-RU' : 'en-US'
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

  const isToday = selectedDate === toLocalDate(new Date())
  const pending = tasks.filter((t) => t.status === 'pending')
  const completed = tasks.filter((t) => t.status === 'completed')

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
            {pending.length === 0
              ? completed.length > 0 ? tr.tasks.allDone : tr.tasks.noTasks
              : tr.tasks.activeCount(pending.length, completed.length)}
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

      {notice && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: '#7c3aed22', border: '1px solid var(--accent)', color: 'var(--accent)' }}
        >
          ✓ {notice}
        </div>
      )}

      {errorMsg && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: '#ef444422', border: '1px solid #ef4444', color: '#ef4444', wordBreak: 'break-word' }}
        >
          ⚠ {errorMsg}
        </div>
      )}

      {selectedDate >= toLocalDate(new Date()) && (
        <div
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                addTask()
              }
            }}
            placeholder={isToday ? tr.tasks.placeholderToday : tr.tasks.placeholderOther}
            rows={3}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: '15px', resize: 'none', width: '100%',
            }}
          />
          <div className="flex gap-2 justify-between items-center">
            <button
              onClick={startVoice}
              style={{
                background: listening ? 'var(--accent)' : 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: listening ? '#fff' : 'var(--text-muted)',
                borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {listening ? <><MicOff size={14} /> {tr.voiceListening}</> : <><Mic size={14} /> {tr.voiceOn}</>}
            </button>

            <button
              onClick={addTask}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() ? 'var(--accent)' : 'var(--surface-2)',
                border: 'none',
                color: input.trim() ? '#fff' : 'var(--text-muted)',
                borderRadius: '8px', padding: '6px 16px', fontSize: '13px',
                cursor: input.trim() ? 'pointer' : 'default', fontWeight: '600',
              }}
            >
              {loading ? '...' : tr.add}
            </button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          {pending.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {tr.tasks.completedSection}
          </p>
          {completed.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} done />
          ))}
        </div>
      )}

      {tasks.length === 0 && (
        <div
          className="rounded-xl p-4 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {selectedDate < toLocalDate(new Date()) ? tr.tasks.emptyPast : tr.tasks.emptyFuture}
          </p>
        </div>
      )}

    </div>
  )
}

function TaskCard({
  task,
  onToggle,
  onDelete,
  onEdit,
  done = false,
}: {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  onEdit: (id: string, title: string) => void
  done?: boolean
}) {
  const { tr } = useLang()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.title)

  function saveEdit() {
    if (editValue.trim() && editValue.trim() !== task.title) {
      onEdit(task.id, editValue.trim())
    }
    setEditing(false)
  }

  const priorityLabel = tr.tasks.priority

  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: done ? 0.5 : 1 }}
    >
      <button
        onClick={() => onToggle(task)}
        style={{
          width: '22px', height: '22px', borderRadius: '50%',
          border: done ? 'none' : '2px solid var(--border)',
          background: done ? '#22c55e' : 'transparent',
          cursor: 'pointer', flexShrink: 0, marginTop: '2px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: '12px',
        }}
      >
        {done && '✓'}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {editing ? (
          <div className="flex gap-2 items-center">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              style={{
                flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)',
                borderRadius: '8px', padding: '4px 8px', color: 'var(--text)',
                fontSize: '15px', outline: 'none',
              }}
            />
            <button onClick={saveEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
              <Check size={16} color="#22c55e" />
            </button>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
              <X size={16} color="var(--text-muted)" />
            </button>
          </div>
        ) : (
          <p style={{
            color: done ? 'var(--text-muted)' : 'var(--text)',
            fontSize: '15px', lineHeight: '1.4',
            textDecoration: done ? 'line-through' : 'none',
          }}>
            {task.title}
          </p>
        )}

        {!done && !editing && (
          <div className="flex gap-2 flex-wrap">
            {task.time && (
              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#7c3aed22', color: 'var(--accent)', fontWeight: '600' }}>
                🕐 {task.time}
              </span>
            )}
            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: (priorityColor[task.priority] ?? '#6b7280') + '22', color: priorityColor[task.priority] ?? '#6b7280', fontWeight: '600' }}>
              {priorityLabel[task.priority as keyof typeof priorityLabel] ?? task.priority}
            </span>
            {task.category && (
              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                {task.category}
              </span>
            )}
          </div>
        )}
      </div>

      {!editing && (
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => { setEditValue(task.title); setEditing(true) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px' }}
          >
            <Pencil size={14} color="var(--text-muted)" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px' }}
          >
            <Trash2 size={14} color="#ef444477" />
          </button>
        </div>
      )}
    </div>
  )
}
