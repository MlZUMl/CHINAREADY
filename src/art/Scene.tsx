// Scène de l'univers : décor de la zone, objets posés dans des emplacements, avatar et compagnon.
// La scène est réellement interactive : chaque emplacement se touche pour poser ou changer un objet.
import type { ReactNode } from 'react'
import { itemDef } from '../domain/catalog'
import { getConfig } from '../lib/config'

export const SLOT_POS: Record<string, Record<string, [number, number]>> = {
  chambre: { mur: [96, 70], fenetre: [262, 74], etagere: [178, 64], sol: [150, 222], lit: [300, 178], table: [52, 168] },
  jardin: { massif: [60, 200], arbre: [300, 120], allee: [180, 226], banc: [240, 186], eau: [96, 150] },
  bibliotheque: { rayon: [100, 82], fauteuil: [260, 176], lampe: [324, 128], tapis: [170, 224] },
  atelier: { plan: [180, 150], mur: [84, 70], panier: [300, 214], plante: [44, 196] },
  balcon: { ciel: [220, 56], rambarde: [110, 170], coussin: [250, 214] },
}

function Backdrop({ zone }: { zone: string }) {
  switch (zone) {
    case 'jardin': return <g>
      <rect width="360" height="260" fill="#dff0f5" />
      <circle cx="320" cy="40" r="18" fill="#f8e4a8" />
      <path d="M0 150 q90 -30 180 0 t180 0 v110 h-360z" fill="#bfdcb6" />
      <path d="M0 190 q120 -20 360 10 v60 h-360z" fill="#a9cfa0" />
      <path d="M150 260 q20 -60 60 -100 h14 q-30 40 -40 100z" fill="#efe0c9" />
      {[20, 50, 80, 110].map(x => <rect key={x} x={x} y="128" width="6" height="34" rx="2" fill="#e9d2bf" />)}
      <rect x="14" y="136" width="108" height="5" rx="2" fill="#e9d2bf" />
    </g>
    case 'bibliotheque': return <g>
      <rect width="360" height="260" fill="#ecd3d1" />
      <rect y="196" width="360" height="64" fill="#cfa79d" />
      <rect x="20" y="20" width="160" height="150" rx="6" fill="#a8746d" />
      {[44, 90, 136].map(y => <rect key={y} x="26" y={y} width="148" height="6" fill="#8f5f59" />)}
      {Array.from({ length: 14 }, (_, i) => <rect key={i} x={30 + (i % 7) * 20} y={i < 7 ? 26 : 96} width="14" height={i % 3 ? 18 : 16} rx="2" fill={['#c4878d', '#6e3a5b', '#d6ac67', '#9cb59a', '#b9cfe0'][i % 5]} />)}
      <rect x="220" y="40" width="110" height="80" rx="40" fill="#fdf2ea" opacity=".75" />
    </g>
    case 'atelier': return <g>
      <rect width="360" height="260" fill="#f5ead9" />
      <rect y="200" width="360" height="60" fill="#dcc3a8" />
      <rect x="30" y="24" width="120" height="96" rx="6" fill="#e8d3b5" />
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={42 + (i % 6) * 20} cy={36 + Math.floor(i / 6) * 18} r="2" fill="#c9ad8c" />)}
      <rect x="110" y="150" width="150" height="14" rx="4" fill="#b98a66" />
      <rect x="122" y="164" width="10" height="44" fill="#a37654" /><rect x="238" y="164" width="10" height="44" fill="#a37654" />
      <rect x="230" y="30" width="100" height="70" rx="8" fill="#cfe3ee" stroke="#fff" strokeWidth="6" />
    </g>
    case 'balcon': return <g>
      <rect width="360" height="260" fill="#3e2a4f" />
      {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={(i * 53) % 360} cy={(i * 37) % 140} r={i % 4 ? 1.4 : 2.2} fill="#fff6d8" opacity=".85" />)}
      <circle cx="60" cy="50" r="20" fill="#f8e9c0" /><circle cx="68" cy="44" r="18" fill="#3e2a4f" />
      <rect y="180" width="360" height="80" fill="#7d5a6f" />
      <rect y="150" width="360" height="8" fill="#d8c3cf" />
      {Array.from({ length: 19 }, (_, i) => <rect key={i} x={i * 20} y="150" width="5" height="34" fill="#d8c3cf" />)}
    </g>
    default: return <g>
      <rect width="360" height="260" fill="#f8e6e3" />
      <rect y="190" width="360" height="70" fill="#e9cfc4" />
      <path d="M0 190 h360" stroke="#dfbcae" strokeWidth="3" />
      <rect x="222" y="30" width="80" height="80" rx="10" fill="#d9eaf3" stroke="#fff" strokeWidth="6" />
      <path d="M262 30 v80 M222 70 h80" stroke="#fff" strokeWidth="4" />
      <rect x="140" y="82" width="80" height="6" rx="3" fill="#d2a99f" />
      <rect x="250" y="160" width="100" height="40" rx="12" fill="#f3c6cd" />
      <rect x="250" y="148" width="40" height="20" rx="8" fill="#fff" />
      <rect x="22" y="160" width="62" height="10" rx="4" fill="#d2a99f" /><rect x="30" y="170" width="6" height="26" fill="#c79b90" /><rect x="70" y="170" width="6" height="26" fill="#c79b90" />
    </g>
  }
}

export interface SceneProps {
  zone: string
  equipped: Record<string, string>
  slots: string[]
  editable: boolean
  onSlot: (slot: string) => void
  avatar?: ReactNode
  companion?: ReactNode
}

export function SceneArt({ zone, equipped, slots, editable, onSlot, avatar, companion }: SceneProps) {
  const art = getConfig().art ?? {}
  const pos = SLOT_POS[zone] ?? {}
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label="Scène de ton univers">
      {art['zone-' + zone] ? <image href={art['zone-' + zone]} width="360" height="260" preserveAspectRatio="xMidYMid slice" /> : <Backdrop zone={zone} />}
      {avatar}
      {companion}
      {slots.map(slot => {
        const [x, y] = pos[slot] ?? [180, 130]
        const key = `${zone}:${slot}`
        const itemId = equipped[key]
        const item = itemId ? itemDef(itemId.split('~')[0]) : undefined
        const label = item ? `${item.name} (emplacement ${slot})` : `Emplacement libre : ${slot}`
        if (!item && !editable) return null
        return (
          <g key={slot} className="slot-btn" role="button" tabIndex={0} aria-label={label}
            onClick={() => onSlot(slot)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSlot(slot) }}>
            {item ? (
              art['objet-' + item.id]
                ? <image href={art['objet-' + item.id]} x={x - 24} y={y - 24} width="48" height="48" />
                : <>
                    <ellipse cx={x} cy={y + 20} rx="18" ry="4" fill="#4a2340" opacity=".1" />
                    <text x={x} y={y + 12} textAnchor="middle" fontSize="34">{item.emoji}</text>
                  </>
            ) : (
              <>
                <circle cx={x} cy={y} r="17" fill="rgba(255,255,255,.55)" stroke="#c4878d" strokeDasharray="4 4" strokeWidth="2" />
                <path d={`M${x - 6} ${y} h12 M${x} ${y - 6} v12`} stroke="#a86a72" strokeWidth="2.4" strokeLinecap="round" />
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
