// Graphiques de l'appli : courbe (poids, mensurations) et barres par jour (eau, activité).
// SVG simples, aux couleurs de l'appli, lisibles sur un écran de téléphone (axes, repères, valeur du dernier point).
import { useId } from 'react'
import { isoWeekday, parseDay, WEEKDAYS_SHORT, type Day } from '../lib/dates'
import { niceCeil, niceScale } from '../domain/series'

const W = 320
const fr = (n: number, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',')
const dm = (d: Day) => { const x = parseDay(d); return `${x.getDate()}/${x.getMonth() + 1}` }
const TEXT = { fontFamily: 'var(--corps)', fontWeight: 700 as const, fill: 'var(--texte-doux)' }

// ------------------------------------------------------------------ courbe
export function TrendLine({ days, line, dots, unit, decimals = 1, label, color = 'var(--btn)', dotColor = 'var(--mousse)' }: {
  days: Day[]
  /** courbe principale (ex. tendance lissée du poids) */
  line: number[]
  /** valeurs brutes, en petits points (facultatif) */
  dots?: number[]
  unit: string
  decimals?: number
  /** description pour les lecteurs d'écran */
  label: string
  color?: string
  dotColor?: string
}) {
  const gid = useId().replace(/:/g, '')
  const n = line.length
  if (!n) return null
  const H = 190, left = 40, right = 14, top = 36, bottom = 26
  const all = [...line, ...(dots ?? [])]
  const sc = niceScale(Math.min(...all), Math.max(...all), 4)
  const x = (i: number) => (n === 1 ? (left + W - right) / 2 : left + (i * (W - left - right)) / (n - 1))
  const y = (v: number) => top + (1 - (v - sc.min) / (sc.max - sc.min)) * (H - top - bottom)
  const base = H - bottom
  const path = line.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const lastV = line[n - 1]
  const txt = `${fr(lastV, decimals)} ${unit}`
  const bw = txt.length * 7.4 + 16
  const bx = Math.min(W - right - bw + 6, Math.max(left - 6, x(n - 1) - bw / 2))
  const above = y(lastV) - 34 >= 2
  const by = above ? y(lastV) - 34 : y(lastV) + 12
  const xl = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1])).filter(i => i < n)
  return (
    <div className="chart" role="img" aria-label={label} data-testid="graph-courbe">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {sc.ticks.map(t => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="var(--ligne)" strokeWidth="1" />
            <text x={left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" style={TEXT}>{fr(t, decimals)}</text>
          </g>
        ))}
        {n > 1 && <path d={`${path} L${x(n - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`} fill={`url(#${gid})`} />}
        {n > 1 && <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {dots?.map((v, i) => <circle key={days[i] + i} cx={x(i)} cy={y(v)} r="3" fill={dotColor} opacity=".9" />)}
        <circle cx={x(n - 1)} cy={y(lastV)} r="6" fill={color} stroke="#fff" strokeWidth="3" />
        <g>
          <rect x={bx} y={by} width={bw} height="24" rx="12" fill="var(--vert)" />
          <text x={bx + bw / 2} y={by + 16} textAnchor="middle" fontSize="12" style={{ fontFamily: 'var(--corps)', fontWeight: 800, fill: '#fff' }}>{txt}</text>
        </g>
        {xl.map(i => (
          <text key={i} x={x(i)} y={H - 7} textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'} fontSize="10.5" style={TEXT}>{dm(days[i])}</text>
        ))}
      </svg>
    </div>
  )
}

// ------------------------------------------------------------------ barres par jour
export function DayBars({ items, goal, goalLabel, format, yFormat, step, color = 'var(--eau)', soft = 'var(--eau-clair)', label, today }: {
  items: { day: Day; value: number }[]
  /** repère pointillé : au-dessus, la barre prend la couleur pleine */
  goal?: number
  goalLabel?: string
  /** texte au-dessus d'une barre (7 jours seulement) */
  format: (v: number) => string
  yFormat?: (v: number) => string
  /** pas de l'échelle verticale (500 ml, 10 min…) */
  step: number
  color?: string
  soft?: string
  label: string
  today?: Day
}) {
  const n = items.length
  if (!n) return null
  const H = 176, left = 38, right = 8, top = 22, bottom = 28
  const max = niceCeil(Math.max(goal ?? 0, ...items.map(i => i.value)), step)
  const ticks = [0, max / 2, max]
  const slot = (W - left - right) / n
  const bw = Math.min(n <= 7 ? 30 : 12, slot * (n <= 7 ? 0.62 : 0.7))
  const base = H - bottom
  const h = (v: number) => (v / max) * (base - top)
  const every = n <= 7 ? 1 : Math.ceil(n / 6)
  const yf = yFormat ?? ((v: number) => String(Math.round(v)))
  return (
    <div className="chart" role="img" aria-label={label} data-testid="graph-barres">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={base - h(t)} y2={base - h(t)} stroke="var(--ligne)" strokeWidth="1" />
            <text x={left - 6} y={base - h(t) + 3.5} textAnchor="end" fontSize="10.5" style={TEXT}>{yf(t)}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const cx = left + slot * i + slot / 2
          const reached = goal === undefined ? true : it.value >= goal
          const isToday = it.day === today
          return (
            <g key={it.day}>
              {it.value > 0
                ? <rect x={cx - bw / 2} y={base - Math.max(3, h(it.value))} width={bw} height={Math.max(3, h(it.value))} rx={Math.min(6, bw / 2)} fill={reached ? color : soft} />
                : <circle cx={cx} cy={base - 2} r="2" fill="var(--poudre-2)" />}
              {n <= 7 && it.value > 0 && (
                <text x={cx} y={base - Math.max(3, h(it.value)) - 5} textAnchor="middle" fontSize="10.5" style={{ fontFamily: 'var(--corps)', fontWeight: 800, fill: 'var(--vert)' }}>{format(it.value)}</text>
              )}
              {(n <= 7 || (n - 1 - i) % every === 0) && (
                <text x={cx} y={H - 9} textAnchor="middle" fontSize="10.5" style={{ ...TEXT, fill: isToday ? 'var(--vert)' : 'var(--texte-doux)', fontWeight: isToday ? 900 : 700 }}>
                  {n <= 7 ? WEEKDAYS_SHORT[isoWeekday(it.day) - 1] : dm(it.day)}
                </text>
              )}
              {isToday && n <= 7 && <circle cx={cx} cy={H - 1.5} r="2" fill="var(--vert)" />}
            </g>
          )
        })}
        {goal !== undefined && (
          <g>
            <line x1={left} x2={W - right} y1={base - h(goal)} y2={base - h(goal)} stroke="var(--vert)" strokeWidth="1.5" strokeDasharray="5 4" opacity=".55" />
            {goalLabel && <text x={W - right} y={base - h(goal) - 4} textAnchor="end" fontSize="10" style={{ fontFamily: 'var(--corps)', fontWeight: 800, fill: 'var(--vert)' }}>{goalLabel}</text>}
          </g>
        )}
      </svg>
    </div>
  )
}

const signed = (n: number) => (n === 0 ? '0' : `${n < 0 ? '−' : '+'}${fr(Math.abs(n))}`)

// ------------------------------------------------------------------ variation semaine par semaine
/** Barres de variation du poids par semaine : vers le bas en rose = baisse, vers le haut en or = hausse. */
export function DeltaBars({ items, unit, label }: { items: { start: Day; delta: number | null }[]; unit: string; label: string }) {
  const n = items.length
  if (!n) return null
  const H = 190, left = 12, right = 12, top = 26, bottom = 34
  const vals = items.map(i => i.delta ?? 0)
  const m = Math.max(0.5, Math.ceil(Math.max(...vals.map(Math.abs)) * 2) / 2)
  const mid = top + (H - top - bottom) / 2
  const half = (H - top - bottom) / 2 - 8
  const hh = (v: number) => (Math.abs(v) / m) * half
  const slot = (W - left - right) / n
  const bw = Math.min(28, slot * 0.66)
  return (
    <div className="chart" role="img" aria-label={label} data-testid="graph-variation">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <line x1={left} x2={W - right} y1={mid} y2={mid} stroke="var(--or)" strokeWidth="1.5" />
        <text x={left} y={top - 12} fontSize="10" style={TEXT}>{`▲ hausse · ▼ baisse (${unit})`}</text>
        {items.map((it, i) => {
          const cx = left + slot * i + slot / 2
          const v = it.delta
          const down = v !== null && v < 0
          const h = v === null ? 0 : Math.max(v === 0 ? 0 : 4, hh(v))
          return (
            <g key={it.start}>
              {v === null
                ? <circle cx={cx} cy={mid} r="2.5" fill="var(--poudre-2)" />
                : v === 0
                  ? <rect x={cx - bw / 2} y={mid - 1.5} width={bw} height="3" rx="1.5" fill="var(--or)" />
                  : <rect x={cx - bw / 2} y={down ? mid : mid - h} width={bw} height={h} rx="7" fill={down ? 'var(--mousse)' : '#F0D18A'} stroke={down ? '#E884A0' : 'var(--or)'} strokeWidth="1" />}
              {v !== null && (
                <text x={cx} y={down ? mid + h + 13 : mid - h - 6} textAnchor="middle" fontSize="10.5" style={{ fontFamily: 'var(--corps)', fontWeight: 800, fill: 'var(--vert)' }}>{signed(v)}</text>
              )}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" style={{ ...TEXT, fontWeight: i === n - 1 ? 900 : 700, fill: i === n - 1 ? 'var(--vert)' : 'var(--texte-doux)' }}>{dm(it.start)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Légende simple sous un graphique : pastille de couleur + texte. */
export function Legend({ items }: { items: { color: string; text: string; dashed?: boolean }[] }) {
  return (
    <div className="legend" aria-hidden="true">
      {items.map(i => <span key={i.text}><i style={i.dashed ? { background: 'none', borderTop: `2px dashed ${i.color}`, height: 0, borderRadius: 0 } : { background: i.color }} />{i.text}</span>)}
    </div>
  )
}
