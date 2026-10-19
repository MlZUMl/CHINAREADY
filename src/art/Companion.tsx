// Illustrations vectorielles du compagnon : 5 espèces × 8 expressions × accessoires.
// Remplaçables par des images (config.js -> art["compagnon-<espece>"]).
import type { Species } from '../data/types'
import type { Expression } from '../domain/companion'
import { getConfig } from '../lib/config'

export const COMPANION_COLORS: Record<string, { fill: string; shade: string; label: string }> = {
  rose: { fill: '#f3c6cd', shade: '#e3a6b0', label: 'Rose poudré' },
  prune: { fill: '#c9a0bb', shade: '#a77a98', label: 'Prune' },
  creme: { fill: '#f4e7d4', shade: '#dfcaa9', label: 'Crème' },
  menthe: { fill: '#c7e3d3', shade: '#9fc8b1', label: 'Menthe' },
  ciel: { fill: '#cddff0', shade: '#a8c4de', label: 'Ciel' },
  lavande: { fill: '#dcd2f0', shade: '#bcaee0', label: 'Lavande' },
}

const INK = '#4a2340'

function Face({ e, cx = 60, cy = 64 }: { e: Expression; cx?: number; cy?: number }) {
  const lx = cx - 13, rx = cx + 13, ey = cy - 4, my = cy + 9
  const eyes = (() => {
    switch (e) {
      case 'endormi': return <><path d={`M${lx - 5} ${ey} q5 4 10 0`} stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" /><path d={`M${rx - 5} ${ey} q5 4 10 0`} stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" /></>
      case 'fier': return <><path d={`M${lx - 5} ${ey + 2} q5 -6 10 0`} stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" /><path d={`M${rx - 5} ${ey + 2} q5 -6 10 0`} stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" /></>
      case 'detendu': return <><path d={`M${lx - 5} ${ey} h10`} stroke={INK} strokeWidth="2.8" strokeLinecap="round" /><path d={`M${rx - 5} ${ey} h10`} stroke={INK} strokeWidth="2.8" strokeLinecap="round" /></>
      case 'enthousiaste': return <>{[lx, rx].map(x => <path key={x} d={`M${x} ${ey - 6} l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8z`} fill={INK} />)}</>
      case 'surpris': return <><circle cx={lx} cy={ey} r="5" fill={INK} /><circle cx={rx} cy={ey} r="5" fill={INK} /><circle cx={lx + 1.5} cy={ey - 1.5} r="1.6" fill="#fff" /><circle cx={rx + 1.5} cy={ey - 1.5} r="1.6" fill="#fff" /></>
      case 'pensif': return <><circle cx={lx + 2} cy={ey - 1} r="3.6" fill={INK} /><circle cx={rx + 2} cy={ey - 1} r="3.6" fill={INK} /></>
      case 'curieux': return <><circle cx={lx} cy={ey} r="4" fill={INK} /><circle cx={rx} cy={ey} r="4.4" fill={INK} /><circle cx={lx + 1.2} cy={ey - 1.2} r="1.3" fill="#fff" /><circle cx={rx + 1.2} cy={ey - 1.4} r="1.4" fill="#fff" /><path d={`M${rx - 5} ${ey - 9} q5 -3 10 0`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" /></>
      default: return <><circle cx={lx} cy={ey} r="4" fill={INK} /><circle cx={rx} cy={ey} r="4" fill={INK} /><circle cx={lx + 1.2} cy={ey - 1.2} r="1.3" fill="#fff" /><circle cx={rx + 1.2} cy={ey - 1.2} r="1.3" fill="#fff" /></>
    }
  })()
  const mouth = (() => {
    switch (e) {
      case 'surpris': return <ellipse cx={cx} cy={my + 1} rx="3.5" ry="4.5" fill={INK} />
      case 'curieux': return <circle cx={cx} cy={my} r="2.6" fill={INK} />
      case 'pensif': return <path d={`M${cx - 4} ${my} h8`} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      case 'endormi': return <path d={`M${cx - 3} ${my} q3 2 6 0`} stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      case 'enthousiaste':
      case 'fier': return <path d={`M${cx - 7} ${my - 2} q7 9 14 0 z`} fill={INK} />
      default: return <path d={`M${cx - 6} ${my - 1} q6 6 12 0`} stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    }
  })()
  return (
    <g>
      {eyes}
      <ellipse cx={lx - 6} cy={cy + 5} rx="5" ry="3.2" fill="#f19aa9" opacity=".55" />
      <ellipse cx={rx + 6} cy={cy + 5} rx="5" ry="3.2" fill="#f19aa9" opacity=".55" />
      {mouth}
      {e === 'endormi' && <text x={cx + 26} y={cy - 24} fontSize="14" fontWeight="800" fill={INK} opacity=".6">z</text>}
      {e === 'pensif' && <><circle cx={cx + 30} cy={cy - 26} r="2.5" fill={INK} opacity=".35" /><circle cx={cx + 36} cy={cy - 33} r="3.5" fill={INK} opacity=".35" /></>}
    </g>
  )
}

function Body({ species, fill, shade }: { species: Species; fill: string; shade: string }) {
  switch (species) {
    case 'chat': return <g>
      <path d="M86 98 q22 -6 18 -26" stroke={shade} strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="96" rx="28" ry="16" fill={shade} />
      <path d="M30 46 L34 18 L52 34 Z" fill={fill} /><path d="M90 46 L86 18 L68 34 Z" fill={fill} />
      <path d="M35 40 L37 26 L46 34 Z" fill="#f19aa9" opacity=".6" /><path d="M85 40 L83 26 L74 34 Z" fill="#f19aa9" opacity=".6" />
      <circle cx="60" cy="60" r="32" fill={fill} />
      <path d="M38 66 h-12 M38 70 l-11 4 M82 66 h12 M82 70 l11 4" stroke={shade} strokeWidth="1.6" strokeLinecap="round" />
    </g>
    case 'lapin': return <g>
      <ellipse cx="60" cy="98" rx="27" ry="15" fill={shade} />
      <ellipse cx="45" cy="22" rx="9" ry="24" fill={fill} transform="rotate(-10 45 22)" /><ellipse cx="75" cy="22" rx="9" ry="24" fill={fill} transform="rotate(10 75 22)" />
      <ellipse cx="45" cy="24" rx="4" ry="16" fill="#f19aa9" opacity=".5" transform="rotate(-10 45 24)" /><ellipse cx="75" cy="24" rx="4" ry="16" fill="#f19aa9" opacity=".5" transform="rotate(10 75 24)" />
      <ellipse cx="60" cy="64" rx="31" ry="29" fill={fill} />
    </g>
    case 'nuage': return <g>
      <path d="M26 86 q-16 0 -14 -18 q2 -14 18 -14 q2 -22 26 -22 q20 0 26 16 q20 -2 24 16 q4 22 -16 22 z" fill={fill} />
      <path d="M30 86 h56" stroke={shade} strokeWidth="3" strokeLinecap="round" opacity=".5" />
      <path d="M40 96 v8 M60 96 v10 M80 96 v8" stroke="#a8c4de" strokeWidth="3" strokeLinecap="round" opacity=".7" />
    </g>
    case 'creature': return <g>
      <path d="M28 70 q-18 -12 -14 -28 q12 6 18 18z" fill={shade} opacity=".7" /><path d="M92 70 q18 -12 14 -28 q-12 6 -18 18z" fill={shade} opacity=".7" />
      <path d="M44 32 q-6 -14 -2 -20" stroke={shade} strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M76 32 q6 -14 2 -20" stroke={shade} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M42 10 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6z" fill="#d6ac67" /><path d="M78 10 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6z" fill="#d6ac67" />
      <path d="M60 28 c26 0 34 22 34 42 c0 22 -14 34 -34 34 s-34 -12 -34 -34 c0 -20 8 -42 34 -42z" fill={fill} />
      <ellipse cx="60" cy="88" rx="16" ry="10" fill="#fff" opacity=".35" />
    </g>
    case 'pousse': return <g>
      <path d="M36 82 h48 l-6 30 h-36z" fill="#d99b7e" /><rect x="32" y="78" width="56" height="10" rx="4" fill="#c98466" />
      <path d="M60 30 q-4 -14 -20 -16 q2 16 20 18" fill="#9cc79f" /><path d="M60 30 q4 -16 22 -18 q-2 18 -22 20" fill="#86b98a" />
      <circle cx="60" cy="58" r="27" fill={fill} />
    </g>
  }
}

function Accessories({ species, list }: { species: Species; list: string[] }) {
  const headY = species === 'lapin' ? 36 : species === 'nuage' ? 34 : species === 'pousse' ? 32 : 30
  return (
    <g>
      {list.includes('cape') && <path d="M30 82 q-8 26 6 30 h48 q14 -4 6 -30 z" fill="#6e3a5b" opacity=".85" transform="translate(0 -6)" />}
      {list.includes('echarpe') && <g><path d="M34 84 q26 10 52 0 v8 q-26 10 -52 0z" fill="#c4878d" /><rect x="70" y="88" width="9" height="18" rx="3" fill="#a86a72" /></g>}
      {list.includes('lunettes') && <g stroke="#4a2340" strokeWidth="2.2" fill="rgba(255,255,255,.25)"><circle cx="47" cy="60" r="8" /><circle cx="73" cy="60" r="8" /><path d="M55 60 h10" /></g>}
      {list.includes('noeud') && !list.includes('chapeau') && !list.includes('couronne') && <g transform={`translate(${species === 'lapin' ? 60 : 78} ${headY})`}><path d="M0 0 l-12 -7 v14z M0 0 l12 -7 v14z" fill="#c4878d" /><circle r="3.6" fill="#a86a72" /></g>}
      {list.includes('chapeau') && <g transform={`translate(60 ${headY})`}><ellipse cx="0" cy="2" rx="34" ry="7" fill="#e8c88e" /><path d="M-18 2 q2 -20 18 -20 q16 0 18 20z" fill="#efd5a2" /><path d="M-18 -2 h36" stroke="#c4878d" strokeWidth="4" /></g>}
      {list.includes('couronne') && <g transform={`translate(60 ${headY - 2})`}>{[-24, -12, 0, 12, 24].map((x, i) => <circle key={x} cx={x} cy={Math.abs(x) / 6} r="5" fill={['#f19aa9', '#f6e3a1', '#c9a0bb', '#f6e3a1', '#f19aa9'][i]} />)}</g>}
    </g>
  )
}

export function CompanionArt({ species, expression = 'content', color = 'rose', accessories = [], size = 96, className }: {
  species: Species; expression?: Expression; color?: string; accessories?: string[]; size?: number; className?: string
}) {
  const override = getConfig().art?.[`compagnon-${species}`]
  if (override) return <img src={override} alt="" width={size} height={size} className={className} style={{ objectFit: 'contain' }} />
  const c = COMPANION_COLORS[color] ?? COMPANION_COLORS.rose
  const faceY = species === 'lapin' ? 66 : species === 'nuage' ? 62 : species === 'creature' ? 66 : species === 'pousse' ? 60 : 62
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={`Compagnon ${species}, ${expression}`}>
      <ellipse cx="60" cy="114" rx="30" ry="4" fill="#4a2340" opacity=".08" />
      {accessories.includes('cape') && <Accessories species={species} list={['cape']} />}
      <Body species={species} fill={c.fill} shade={c.shade} />
      <Face e={expression} cy={faceY} />
      <Accessories species={species} list={accessories.filter(a => a !== 'cape')} />
    </svg>
  )
}
