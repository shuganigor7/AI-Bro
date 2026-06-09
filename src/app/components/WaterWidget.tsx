'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Droplets } from 'lucide-react'

const WATER_GOAL = 2000

function toLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function WaterWidget({ userId }: { userId: string }) {
  const [waterMl, setWaterMl] = useState(0)
  const [adding, setAdding] = useState(false)
  const today = toLocalDate(new Date())
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('health_logs')
      .select('water_ml')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
      .then(({ data }) => {
        if (data?.water_ml) setWaterMl(data.water_ml)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addWater(amount: number) {
    if (adding) return
    setAdding(true)
    const newAmount = waterMl + amount
    setWaterMl(newAmount)
    await supabase.from('health_logs').upsert(
      { user_id: userId, date: today, water_ml: newAmount },
      { onConflict: 'user_id,date' }
    )
    setAdding(false)
  }

  const pct = Math.min(100, Math.round((waterMl / WATER_GOAL) * 100))
  const done = waterMl >= WATER_GOAL

  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets size={15} color={done ? '#22c55e' : '#3b82f6'} />
          <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '600' }}>
            {waterMl}
            <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}> / {WATER_GOAL} мл</span>
          </span>
          {done && (
            <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: '700', background: '#22c55e18', padding: '1px 6px', borderRadius: '4px' }}>
              Цель ✓
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => addWater(250)}
            disabled={adding}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              borderRadius: '7px',
              padding: '3px 10px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            +250
          </button>
          <button
            onClick={() => addWater(500)}
            disabled={adding}
            style={{
              background: done ? '#22c55e22' : '#3b82f6',
              border: 'none',
              color: done ? '#22c55e' : '#fff',
              borderRadius: '7px',
              padding: '3px 10px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            +500
          </button>
        </div>
      </div>
      <div style={{ height: '3px', background: 'var(--surface-2)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: done ? '#22c55e' : '#3b82f6',
            borderRadius: '2px',
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  )
}
