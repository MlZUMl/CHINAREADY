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


// ------------------------------------------------------------------ boutique : tenues, coiffures, accessoires
// Simples calques dessinés par-dessus le compagnon : sa forme, son visage et ses couleurs ne changent pas.
interface Geo { top: number; hw: number; chest: number; bottom: number; rx: number }
const GEO: Record<Species, Geo> = {
  chat: { top: 28, hw: 31, chest: 82, bottom: 110, rx: 27 },
  lapin: { top: 36, hw: 30, chest: 86, bottom: 112, rx: 26 },
  nuage: { top: 34, hw: 30, chest: 72, bottom: 88, rx: 38 },
  creature: { top: 30, hw: 31, chest: 82, bottom: 104, rx: 30 },
  pousse: { top: 31, hw: 26, chest: 80, bottom: 112, rx: 26 },
}
const HAIR = '#7a4a2e'
const HAIR_DARK = '#5e3720'

function shirt(g: Geo, extra = 0) {
  const { chest, bottom, rx } = g
  return `M${60 - rx} ${chest} q${rx} -9 ${2 * rx} 0 L${60 + rx - 3 + extra} ${bottom - 3} q${-(rx - 3 + extra)} 8 ${-2 * (rx - 3 + extra)} 0 Z`
}
function cap(g: Geo, depth = 14) {
  const { top, hw } = g
  const x1 = 60 - hw * 0.92, x2 = 60 + hw * 0.92, y = top + depth
  return `M${x1} ${y} Q${x1} ${top - 4} 60 ${top - 4} Q${x2} ${top - 4} ${x2} ${y} q-6 -6 -11 0 q-5 -7 -10 0 q-5 -7 -10 0 q-5 -7 -10 0 q-5 -7 -10 0 q-5 -6 ${x1 - x2 + 51} 0 Z`
}

function Tenue({ id, g, sp }: { id: string; g: Geo; sp: string }) {
  const path = shirt(g)
  // identifiant propre à l'espèce : plusieurs compagnons peuvent être affichés sur la même page
  const clip = `clip-${id}-${sp}`
  switch (id) {
    case 't-shirt-sport': return <g><path d={path} fill="#839958" /><path d={`M52 ${g.chest - 3} q8 7 16 0`} stroke="#fff" strokeWidth="2" fill="none" /><text x="60" y={g.chest + 14} fontSize="10" fontWeight="800" fill="#fff" textAnchor="middle">17</text></g>
    case 'debardeur': return <g><clipPath id={clip}><path d={path} /></clipPath><path d={path} fill="#fff" /><g clipPath={`url(#${clip})`}>{[0, 1, 2, 3, 4].map(i => <rect key={i} x="20" y={g.chest + i * 6} width="80" height="3" fill="#D3968C" />)}</g><path d={path} fill="none" stroke="#D3968C" strokeWidth="1.5" /></g>
    case 'sweat': return <g><path d={`M46 ${g.chest - 6} q14 -8 28 0 v6 h-28z`} fill="#8f9c96" /><path d={shirt(g, 2)} fill="#a9b5af" /><rect x="50" y={g.chest + 8} width="20" height="8" rx="3" fill="#8f9c96" /><path d={`M56 ${g.chest} v8 M64 ${g.chest} v8`} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></g>
    case 'mariniere': return <g><clipPath id={clip}><path d={path} /></clipPath><path d={path} fill="#fff" /><g clipPath={`url(#${clip})`}>{[0, 1, 2, 3, 4].map(i => <rect key={i} x="20" y={g.chest + 2 + i * 6} width="80" height="2.6" fill="#105666" />)}</g><path d={path} fill="none" stroke="#105666" strokeWidth="1.2" /></g>
    case 'salopette': return <g><path d={`M${60 - g.rx + 6} ${g.chest + 6} h${2 * g.rx - 12} L${60 + g.rx - 4} ${g.bottom - 3} q${-(g.rx - 4)} 8 ${-2 * (g.rx - 4)} 0 Z`} fill="#4f7fa6" /><path d={`M${60 - 12} ${g.chest - 6} v12 M${60 + 12} ${g.chest - 6} v12`} stroke="#4f7fa6" strokeWidth="4" strokeLinecap="round" /><rect x="52" y={g.chest + 9} width="16" height="9" rx="2" fill="#3e6a8e" /><circle cx="48" cy={g.chest + 6} r="2" fill="#e8c88e" /><circle cx="72" cy={g.chest + 6} r="2" fill="#e8c88e" /></g>
    case 'kimono': return <g><path d={path} fill="#f3d3d8" /><path d={`M48 ${g.chest - 4} L60 ${g.chest + 10} L72 ${g.chest - 4}`} stroke="#0A3323" strokeWidth="3" fill="none" /><rect x={60 - g.rx + 4} y={g.chest + 12} width={2 * g.rx - 8} height="5" fill="#0A3323" />{[[44, 6], [74, 4], [52, 22], [70, 20]].map(([x, dy], i) => <circle key={i} cx={x} cy={g.chest + dy} r="2.4" fill="#D3968C" />)}</g>
    case 'robe-soiree': return <g><path d={`M${60 - g.rx + 4} ${g.chest} q${g.rx - 4} -9 ${2 * (g.rx - 4)} 0 L${60 + g.rx + 6} ${g.bottom + 2} q${-(g.rx + 6)} 6 ${-2 * (g.rx + 6)} 0 Z`} fill="#0A3323" /><path d={`M50 ${g.chest - 2} q10 6 20 0`} stroke="#d6ac67" strokeWidth="2" fill="none" /><circle cx="60" cy={g.chest + 2} r="2.4" fill="#d6ac67" /></g>
    case 'tenue-etoilee': return <g><path d={path} fill="#105666" />{[[46, 6], [70, 4], [56, 16], [74, 18], [44, 20]].map(([x, dy], i) => <path key={i} d={`M${x} ${g.chest + dy - 3} l1.2 2.6 2.8 .4 -2 2 .5 2.8 -2.5 -1.3 -2.5 1.3 .5 -2.8 -2 -2 2.8 -.4z`} fill="#f6e3a1" />)}</g>
    default: return null
  }
}

function Coiffure({ id, g, sp }: { id: string; g: Geo; sp: string }) {
  const { top, hw } = g
  switch (id) {
    case 'frange': return <path d={cap(g, 13)} fill={HAIR} />
    case 'meche': return <g><path d={cap(g, 10)} fill={HAIR} /><path d={`M60 ${top - 3} q14 -12 22 -2 q-10 -4 -16 6z`} fill={HAIR_DARK} /></g>
    case 'couettes': return <g><path d={cap(g, 11)} fill={HAIR} />{[-1, 1].map(k => <g key={k}><ellipse cx={60 + k * (hw + 3)} cy={top + 18} rx="7" ry="10" fill={HAIR} /><circle cx={60 + k * (hw - 3)} cy={top + 12} r="3" fill="#D3968C" /></g>)}</g>
    case 'chignon': return <g><path d={cap(g, 10)} fill={HAIR} /><circle cx="60" cy={top - 8} r="10" fill={HAIR} /><path d={`M52 ${top - 8} q8 -6 16 0`} stroke={HAIR_DARK} strokeWidth="2" fill="none" /></g>
    case 'boucles': return <g fill={HAIR}>{Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.05 + 0.9 * i / 8); return <circle key={i} cx={60 - Math.cos(a) * hw * 0.95} cy={top + hw - Math.sin(a) * hw * 1.02} r="7" /> })}</g>
    case 'tresse': return <g><path d={cap(g, 12)} fill={HAIR} />{[0, 1, 2, 3, 4].map(i => <ellipse key={i} cx={60 + hw - 2 + (i % 2 ? 2 : -2)} cy={top + 18 + i * 9} rx="5" ry="5.5" fill={i % 2 ? HAIR_DARK : HAIR} />)}<circle cx={60 + hw - 2} cy={top + 64} r="3" fill="#D3968C" /></g>
    case 'carre': return <g fill={HAIR}><path d={cap(g, 12)} /><rect x={60 - hw - 4} y={top + 6} width="9" height={hw + 6} rx="4" /><rect x={60 + hw - 5} y={top + 6} width="9" height={hw + 6} rx="4" /></g>
    case 'meches-arc-en-ciel': return <g><clipPath id={`clip-arc-${sp}`}><path d={cap(g, 13)} /></clipPath><g clipPath={`url(#clip-arc-${sp})`}>{['#e88b8b', '#f3b46b', '#f2dc79', '#9cc79f', '#8ab7dd', '#b39ddb'].map((c, i) => <rect key={c} x={60 - hw + i * (hw / 3)} y={top - 8} width={hw / 3 + 0.5} height="26" fill={c} />)}</g></g>
    default: return null
  }
}

function AccessoireBoutique({ id, g, behind }: { id: string; g: Geo; behind: boolean }) {
  const { top, hw, chest } = g
  if (behind) {
    if (id === 'ailes') return <g fill="#fff" stroke="#cfe3e8" strokeWidth="2">{[-1, 1].map(k => <path key={k} d={`M${60 + k * 22} ${chest - 4} q${k * 30} -26 ${k * 40} -4 q${-k * 6} 10 ${-k * 16} 8 q${k * 4} 10 ${-k * 8} 10 q${-k * 10} -4 ${-k * 16} -14z`} />)}</g>
    return null
  }
  switch (id) {
    case 'bandeau': return <g><rect x={60 - hw} y={top + 9} width={2 * hw} height="6" rx="3" fill="#D3968C" /><path d={`M${60 + hw - 2} ${top + 12} l8 -5 v10z`} fill="#D3968C" /></g>
    case 'noeud-papillon': return <g transform={`translate(60 ${chest - 1})`}><path d="M0 0 l-10 -6 v12z M0 0 l10 -6 v12z" fill="#0A3323" /><circle r="2.6" fill="#105666" /></g>
    case 'casquette': return <g><path d={`M${60 - hw * 0.9} ${top + 12} Q60 ${top - 14} ${60 + hw * 0.9} ${top + 12} Z`} fill="#105666" /><path d={`M${60 + hw * 0.6} ${top + 10} q16 -2 22 6 q-12 2 -22 0z`} fill="#0A3323" /><circle cx="60" cy={top - 1} r="2" fill="#0A3323" /></g>
    case 'casque-audio': return <g><path d={`M${60 - hw - 2} ${top + hw * 0.9} Q${60 - hw - 2} ${top - 8} 60 ${top - 8} Q${60 + hw + 2} ${top - 8} ${60 + hw + 2} ${top + hw * 0.9}`} stroke="#0A3323" strokeWidth="4" fill="none" />{[-1, 1].map(k => <rect key={k} x={60 + k * (hw + 2) - 6} y={top + hw * 0.7} width="12" height="16" rx="5" fill="#839958" />)}</g>
    case 'halo': return <g><ellipse cx="60" cy={top - 10} rx="20" ry="5" fill="none" stroke="#d6ac67" strokeWidth="3" />{[-26, 26].map(x => <path key={x} d={`M${60 + x} ${top - 16} l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4z`} fill="#d6ac67" />)}</g>
    default: return null
  }
}

/** Calques des objets de la boutique équipés (ordre : derrière, tenue, puis coiffure et accessoire). */
export function Cosmetics({ species, list, layer }: { species: Species; list: string[]; layer: 'derriere' | 'tenue' | 'tete' }) {
  const g = GEO[species]
  if (layer === 'derriere') return <g>{list.map(id => <AccessoireBoutique key={id} id={id} g={g} behind />)}</g>
  if (layer === 'tenue') return <g>{list.map(id => <Tenue key={id} id={id} g={g} sp={species} />)}</g>
  return <g>{list.map(id => <Coiffure key={id} id={id} g={g} sp={species} />)}{list.map(id => <AccessoireBoutique key={'a' + id} id={id} g={g} behind={false} />)}</g>
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
      <Cosmetics species={species} list={accessories} layer="derriere" />
      <Body species={species} fill={c.fill} shade={c.shade} />
      <Cosmetics species={species} list={accessories} layer="tenue" />
      <Face e={expression} cy={faceY} />
      <Cosmetics species={species} list={accessories} layer="tete" />
      <Accessories species={species} list={accessories.filter(a => a !== 'cape')} />
    </svg>
  )
}
