// Avatar personnel : style « chibi » doux. Remplaçable via config.js -> art["avatar"].
import { getConfig } from '../lib/config'

export const CHARACTERS = [
  { id: 'aube', label: 'Aube', skin: '#f6d9c4', hair: '#7a4a32' },
  { id: 'miel', label: 'Miel', skin: '#e3b58f', hair: '#2f1d18' },
  { id: 'cannelle', label: 'Cannelle', skin: '#b97f5c', hair: '#24140f' },
  { id: 'perle', label: 'Perle', skin: '#fbe4d6', hair: '#b5582f' },
] as const

export const STYLES = [
  { id: 'longs', label: 'Cheveux longs' },
  { id: 'carre', label: 'Carré' },
  { id: 'chignon', label: 'Chignon' },
  { id: 'boucles', label: 'Boucles' },
  { id: 'voile', label: 'Voile' },
] as const

export const OUTFITS = [
  { id: 'jogging', label: 'Jogging prune', color: '#7d4668', accent: '#c4878d' },
  { id: 'robe', label: 'Robe poudrée', color: '#e3a9b4', accent: '#fff3f3' },
  { id: 'salopette', label: 'Salopette sauge', color: '#9cb59a', accent: '#f6efe2' },
  { id: 'sweat', label: 'Sweat ciel', color: '#a9c6df', accent: '#ffffff' },
] as const

export function AvatarArt({ character = 'aube', style = 'longs', outfit = 'jogging', size = 120, x, y }: {
  character?: string; style?: string; outfit?: string; size?: number; x?: number; y?: number
}) {
  const override = getConfig().art?.avatar
  const ch = CHARACTERS.find(c => c.id === character) ?? CHARACTERS[0]
  const of = OUTFITS.find(o => o.id === outfit) ?? OUTFITS[0]
  const hair = ch.hair
  const inner = override ? <image href={override} x="0" y="0" width="120" height="160" /> : (
    <g>
      <ellipse cx="60" cy="154" rx="30" ry="5" fill="#4a2340" opacity=".08" />
      {/* cheveux arrière */}
      {style === 'longs' && <path d="M28 56 q-4 48 10 62 h44 q14 -14 10 -62z" fill={hair} />}
      {style === 'boucles' && <g fill={hair}>{[[30, 50], [26, 70], [32, 88], [90, 50], [94, 70], [88, 88], [40, 34], [60, 26], [80, 34]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="14" />)}</g>}
      {style === 'voile' && <path d="M24 60 q0 -42 36 -42 q36 0 36 42 l6 60 q-42 18 -84 0z" fill="#c4878d" />}
      {/* corps */}
      <path d="M36 150 v-34 q0 -16 24 -16 q24 0 24 16 v34z" fill={of.color} />
      {of.id === 'salopette' && <rect x="44" y="112" width="32" height="20" rx="4" fill={of.accent} opacity=".9" />}
      {of.id === 'jogging' && <path d="M60 102 v46" stroke={of.accent} strokeWidth="3" />}
      {of.id === 'robe' && <path d="M36 128 h48" stroke={of.accent} strokeWidth="3" opacity=".8" />}
      {of.id === 'sweat' && <path d="M48 104 q12 10 24 0" stroke={of.accent} strokeWidth="3" fill="none" />}
      <circle cx="34" cy="132" r="7" fill={ch.skin} /><circle cx="86" cy="132" r="7" fill={ch.skin} />
      {/* tête */}
      <rect x="54" y="88" width="12" height="12" rx="4" fill={ch.skin} />
      <circle cx="60" cy="62" r="30" fill={ch.skin} />
      {/* cheveux avant */}
      {style === 'longs' && <path d="M30 60 q2 -32 30 -32 q28 0 30 32 q-10 -14 -30 -16 q-14 4 -30 16z" fill={hair} />}
      {style === 'carre' && <path d="M28 70 q-2 -42 32 -42 q34 0 32 42 l-6 2 q-2 -24 -26 -26 q-20 2 -26 26z" fill={hair} />}
      {style === 'chignon' && <g fill={hair}><circle cx="60" cy="26" r="13" /><path d="M30 60 q2 -32 30 -32 q28 0 30 32 q-12 -18 -30 -18 q-18 0 -30 18z" /></g>}
      {style === 'boucles' && <path d="M32 58 q4 -28 28 -28 q24 0 28 28 q-10 -12 -28 -12 q-18 0 -28 12z" fill={hair} />}
      {style === 'voile' && <path d="M30 66 q0 -36 30 -36 q30 0 30 36 q-4 -26 -30 -26 q-26 0 -30 26z" fill="#d79aa2" />}
      {/* visage */}
      <circle cx="49" cy="64" r="3.4" fill="#4a2340" /><circle cx="71" cy="64" r="3.4" fill="#4a2340" />
      <circle cx="50" cy="63" r="1.1" fill="#fff" /><circle cx="72" cy="63" r="1.1" fill="#fff" />
      <ellipse cx="43" cy="72" rx="5" ry="3" fill="#f19aa9" opacity=".5" /><ellipse cx="77" cy="72" rx="5" ry="3" fill="#f19aa9" opacity=".5" />
      <path d="M55 74 q5 5 10 0" stroke="#4a2340" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </g>
  )
  if (x !== undefined && y !== undefined) return <g transform={`translate(${x} ${y}) scale(${size / 160})`}>{inner}</g>
  return <svg viewBox="0 0 120 160" width={size * 0.75} height={size} role="img" aria-label="Ton avatar">{inner}</svg>
}
