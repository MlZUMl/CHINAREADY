import { useEffect, useRef, type ReactNode } from 'react'
import { IconBack, IconClose } from './icons'
import { back } from '../lib/router'
import { ENERGY_LABELS } from '../domain/recommend'

export function TopBar({ title, kicker, onBack, right }: { title: string; kicker?: string; onBack?: boolean | (() => void); right?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack && (
        <button className="icon-btn" aria-label="Retour" onClick={() => (typeof onBack === 'function' ? onBack() : back())}>
          <IconBack />
        </button>
      )}
      <div className="title">
        {kicker && <small>{kicker}</small>}
        <h1>{title}</h1>
      </div>
      {right}
    </header>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Fermer" onClick={onClose}><IconClose /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <div>
        <div style={{ fontWeight: 700 }}>{label}</div>
        {hint && <div className="muted">{hint}</div>}
      </div>
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label} />
        <span />
      </span>
    </label>
  )
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, format, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Moins" onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}>−</button>
      <output aria-live="polite">{format ? format(value) : value}</output>
      <button type="button" aria-label="Plus" onClick={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))}>+</button>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map(o => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Chips<T extends string | number>({ options, value, onChange, multi, soft, label }: {
  options: { id: T; label: string }[]; value: T | T[] | null; onChange: (v: any) => void; multi?: boolean; soft?: boolean; label: string
}) {
  const isOn = (id: T) => (Array.isArray(value) ? value.includes(id) : value === id)
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(o => (
        <button type="button" key={String(o.id)} aria-pressed={isOn(o.id)} className={`chip ${soft ? 'soft' : ''} ${isOn(o.id) ? 'on' : ''}`}
          onClick={() => {
            if (multi) {
              const arr = Array.isArray(value) ? value : []
              onChange(isOn(o.id) ? arr.filter(x => x !== o.id) : [...arr, o.id])
            } else onChange(isOn(o.id) ? null : o.id)
          }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const FACES = ['', '😮‍💨', '🥱', '🙂', '😊', '🤩']
export function EnergyScale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="energy-scale" role="radiogroup" aria-label="Niveau d'énergie">
      {[1, 2, 3, 4, 5].map(e => (
        <button key={e} type="button" role="radio" aria-checked={value === e} className={value === e ? 'on' : ''} onClick={() => onChange(e)}>
          <span className="face" aria-hidden="true">{FACES[e]}</span>
          {ENERGY_LABELS[e]}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return <div className="progress" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: pct + '%' }} /></div>
}

export function Ring({ value, size = 64, stroke = 8, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--poudre)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--prune)" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset .4s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size > 70 ? '1.1rem' : '.85rem', color: 'var(--prune)' }}>{children}</div>
    </div>
  )
}

export function Confirm({ title, text, confirmLabel, danger, onConfirm, onClose, children }: { title: string; text: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void; children?: ReactNode }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="muted" style={{ fontSize: '1rem' }}>{text}</div>
      {children}
      <div className="grid2">
        <button className="btn ghost" onClick={onClose}>Annuler</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Sheet>
  )
}
