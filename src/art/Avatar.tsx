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

// ------------------------------------------------------------------ boutique : tenues, coiffures, accessoires
// Dessinés dans le même style que l'avatar (mêmes formes de corps et de tête) : rien d'autre ne change.
const BODY = 'M36 150 v-34 q0 -16 24 -16 q24 0 24 16 v34z'
const star = (x: number, y: number, r = 3) => `M${x} ${y - r} l${r * 0.3} ${r * 0.7} ${r * 0.7} ${r * 0.3} -${r * 0.7} ${r * 0.3} -${r * 0.3} ${r * 0.7} -${r * 0.3} -${r * 0.7} -${r * 0.7} -${r * 0.3} ${r * 0.7} -${r * 0.3}z`

function ShopOutfit({ id }: { id: string }) {
  const clip = (c: string, children: React.ReactNode) => <g><clipPath id={`av-${id}`}><path d={BODY} /></clipPath><path d={BODY} fill={c} /><g clipPath={`url(#av-${id})`}>{children}</g></g>
  switch (id) {
    case 'av-tshirt': return <g><path d={BODY} fill="#fbfbf8" stroke="#dfe4dc" strokeWidth="1" /><path d="M52 101 q8 7 16 0" stroke="#dfe4dc" strokeWidth="2" fill="none" /></g>
    case 'av-sport': return clip('#105666', <><rect x="36" y="100" width="6" height="50" fill="#839958" /><rect x="78" y="100" width="6" height="50" fill="#839958" /><path d="M52 101 q8 6 16 0" stroke="#fff" strokeWidth="2" fill="none" /></>)
    case 'av-pull-raye': return clip('#f6efe2', [0, 1, 2, 3, 4, 5, 6].map(i => <rect key={i} x="30" y={104 + i * 7} width="60" height="3.5" fill="#D3968C" />))
    case 'av-chemise-jean': return clip('#6f94b8', <><path d="M60 101 v49" stroke="#4f739a" strokeWidth="1.5" /><path d="M50 101 l10 9 l10 -9" fill="#5b80a6" />{[112, 122, 132, 142].map(y => <circle key={y} cx="62.5" cy={y} r="1.2" fill="#e8ddc6" />)}<rect x="42" y="114" width="10" height="7" rx="1.5" fill="none" stroke="#4f739a" /></>)
    case 'av-yoga': return clip('#839958', <><rect x="36" y="100" width="48" height="18" fill="#0A3323" /><path d="M48 100 q12 12 24 0" stroke="#E9EFD9" strokeWidth="2" fill="none" />{[[44, 132], [58, 140], [72, 128], [66, 146]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="2" fill="#E9EFD9" />)}</>)
    case 'av-robe-ete': return <g><path d="M38 150 l4 -36 q0 -14 18 -14 q18 0 18 14 l4 36z" fill="#f3d7a7" />{[[48, 118], [62, 112], [72, 124], [52, 136], [68, 142], [58, 128]].map(([cx, cy], i) => <g key={i}><circle cx={cx} cy={cy} r="3" fill="#D3968C" /><circle cx={cx} cy={cy} r="1.1" fill="#fff6d8" /></g>)}<path d="M50 101 q10 8 20 0" stroke="#e8c78c" strokeWidth="2" fill="none" /></g>
    case 'av-doudoune': return clip('#D3968C', <>{[108, 117, 126, 135, 144].map(y => <path key={y} d={`M30 ${y} h60`} stroke="#b97a70" strokeWidth="1.6" />)}<path d="M60 100 v50" stroke="#b97a70" strokeWidth="2" /><path d="M46 100 q14 -8 28 0 v5 h-28z" fill="#b97a70" /></>)
    case 'av-kimono': return clip('#f3d3d8', <><path d="M48 100 L60 124 L72 100" stroke="#0A3323" strokeWidth="5" fill="none" /><rect x="36" y="124" width="48" height="7" fill="#105666" />{[[44, 110], [76, 112], [46, 142], [72, 140]].map(([cx, cy], i) => <path key={i} d={star(cx, cy, 3)} fill="#D3968C" />)}</>)
    case 'av-abaya': return <g><path d="M34 150 l2 -34 q0 -16 24 -16 q24 0 24 16 l2 34z" fill="#2f2a3a" /><path d="M60 102 v48" stroke="#b88a3e" strokeWidth="1.5" /><path d="M42 146 h36" stroke="#b88a3e" strokeWidth="1.5" /><path d="M50 102 q10 6 20 0" stroke="#b88a3e" strokeWidth="1.5" fill="none" /></g>
    case 'av-robe-doree': return <g><path d="M34 152 l6 -38 q0 -14 20 -14 q20 0 20 14 l6 38z" fill="#c99a4a" /><path d="M40 114 q20 -6 40 0" stroke="#f4dc9a" strokeWidth="2" fill="none" />{[[46, 130], [70, 126], [58, 142], [76, 146], [44, 146]].map(([cx, cy], i) => <path key={i} d={star(cx, cy, 2.4)} fill="#fff3c4" />)}</g>
    case 'av-sport-premium': return clip('#0A3323', <><path d="M36 100 l24 50 M84 100 l-24 50" stroke="#D3968C" strokeWidth="4" /><path d="M54 101 q6 5 12 0" stroke="#fff" strokeWidth="2" fill="none" /><path d={star(60, 118, 4)} fill="#f4dc9a" /></>)
    case 'av-manteau-etoile': return clip('#105666', <><path d="M60 100 v50" stroke="#0A3323" strokeWidth="2" /><path d="M48 100 l12 12 l12 -12" fill="#0A3323" />{[[44, 116], [74, 112], [50, 136], [70, 132], [64, 146], [42, 146]].map(([cx, cy], i) => <path key={i} d={star(cx, cy, 2.8)} fill="#f6e3a1" />)}</>)
    default: return null
  }
}

const SHOP_HAIR = new Set(['av-queue', 'av-tresse', 'av-frange', 'av-afro', 'av-carre-plongeant', 'av-couettes', 'av-ondules', 'av-chignon-fleuri', 'av-turban', 'av-meches-roses'])
const fringe = (hair: string) => <path d="M30 60 q2 -32 30 -32 q28 0 30 32 q-10 -14 -30 -16 q-14 4 -30 16z" fill={hair} />

function ShopHairBack({ id, hair }: { id: string; hair: string }) {
  switch (id) {
    case 'av-queue': return <path d="M84 44 q22 6 14 44 q-4 -18 -16 -28z" fill={hair} />
    case 'av-tresse': return <g fill={hair}>{[0, 1, 2, 3, 4].map(i => <ellipse key={i} cx={86 + (i % 2 ? 2 : -2)} cy={74 + i * 11} rx="7" ry="7" />)}<circle cx="86" cy="130" r="3" fill="#D3968C" /></g>
    case 'av-afro': return <g fill={hair}><circle cx="60" cy="54" r="40" /></g>
    case 'av-ondules': return <path d="M28 56 q-8 20 2 34 q-8 14 4 30 h52 q12 -16 4 -30 q10 -14 2 -34z" fill={hair} />
    case 'av-couettes': return <g fill={hair}><ellipse cx="24" cy="70" rx="9" ry="16" /><ellipse cx="96" cy="70" rx="9" ry="16" /></g>
    case 'av-carre-plongeant': return <path d="M28 58 q-2 30 4 40 l22 -4 v-30z M92 58 q2 30 -4 40 l-22 -4 v-30z" fill={hair} />
    case 'av-meches-roses': return <path d="M28 56 q-4 48 10 62 h44 q14 -14 10 -62z" fill={hair} />
    case 'av-turban': return null
    default: return null
  }
}

function ShopHairFront({ id, hair }: { id: string; hair: string }) {
  switch (id) {
    case 'av-queue': return <g>{fringe(hair)}<circle cx="86" cy="44" r="4" fill="#D3968C" /></g>
    case 'av-tresse': return fringe(hair)
    case 'av-frange': return <path d="M28 66 q-2 -40 32 -40 q34 0 32 40 l-4 0 q0 -14 -6 -18 h-44 q-6 4 -6 18z" fill={hair} />
    case 'av-afro': return <path d="M32 52 q4 -22 28 -22 q24 0 28 22 q-12 -10 -28 -10 q-16 0 -28 10z" fill={hair} />
    case 'av-carre-plongeant': return <path d="M28 68 q-2 -40 32 -40 q34 0 32 40 l-6 2 q-4 -24 -26 -26 q-14 0 -22 10 q-6 8 -10 14z" fill={hair} />
    case 'av-couettes': return <g>{fringe(hair)}<circle cx="31" cy="58" r="3.5" fill="#D3968C" /><circle cx="89" cy="58" r="3.5" fill="#D3968C" /></g>
    case 'av-ondules': return <path d="M30 62 q0 -34 30 -34 q30 0 30 34 q-6 -10 -14 -12 q-4 6 -10 6 q-8 -10 -20 -6 q-8 2 -16 12z" fill={hair} />
    case 'av-chignon-fleuri': return <g><circle cx="60" cy="25" r="13" fill={hair} />{fringe(hair)}{[[50, 18], [60, 13], [70, 18]].map(([cx, cy], i) => <g key={i}><circle cx={cx} cy={cy} r="4" fill={['#D3968C', '#f4dc9a', '#E9EFD9'][i]} /><circle cx={cx} cy={cy} r="1.4" fill="#fff" /></g>)}</g>
    case 'av-turban': return <g><path d="M26 64 q-2 -42 34 -42 q36 0 34 42 q-8 -14 -34 -14 q-26 0 -34 14z" fill="#105666" /><path d="M34 40 q26 -14 52 4 M30 52 q30 -16 60 2" stroke="#2c7486" strokeWidth="3" fill="none" /><circle cx="60" cy="34" r="4" fill="#b88a3e" /></g>
    case 'av-meches-roses': return <g>{fringe(hair)}<path d="M44 34 q-10 8 -12 22 l4 -2 q2 -12 12 -18z M72 32 q12 6 16 22 l-4 -1 q-4 -12 -14 -18z" fill="#e7a3b4" /></g>
    default: return null
  }
}

function ShopExtra({ id }: { id: string }) {
  switch (id) {
    case 'av-lunettes': return <g fill="none" stroke="#0A3323" strokeWidth="2"><circle cx="49" cy="64" r="7" /><circle cx="71" cy="64" r="7" /><path d="M56 64 h8" /></g>
    case 'av-boucles': return <g fill="#b88a3e"><circle cx="31" cy="74" r="2.6" /><circle cx="89" cy="74" r="2.6" /><circle cx="31" cy="80" r="1.8" /><circle cx="89" cy="80" r="1.8" /></g>
    case 'av-foulard': return <g><path d="M44 98 q16 10 32 0 l2 6 q-18 10 -36 0z" fill="#D3968C" /><path d="M66 104 l6 14 l-8 -2z" fill="#c07f75" /></g>
    case 'av-casque': return <g><path d="M28 66 Q28 26 60 26 Q92 26 92 66" stroke="#0A3323" strokeWidth="5" fill="none" /><rect x="22" y="58" width="12" height="18" rx="5" fill="#839958" /><rect x="86" y="58" width="12" height="18" rx="5" fill="#839958" /></g>
    case 'av-sac': return <g><path d="M90 126 q0 -10 8 -10 q8 0 8 10" stroke="#0A3323" strokeWidth="2.5" fill="none" /><rect x="86" y="124" width="24" height="20" rx="5" fill="#105666" /><rect x="92" y="130" width="12" height="3" rx="1.5" fill="#E9EFD9" /></g>
    case 'av-couronne': return <g>{[30, 40, 50, 60, 70, 80, 90].map((x, i) => <g key={x}><circle cx={x} cy={36 - Math.sin((i / 6) * Math.PI) * 8} r="5" fill={['#D3968C', '#f4dc9a', '#E9EFD9', '#D3968C', '#f4dc9a', '#E9EFD9', '#D3968C'][i]} /><circle cx={x} cy={36 - Math.sin((i / 6) * Math.PI) * 8} r="1.6" fill="#fff" /></g>)}</g>
    default: return null
  }
}

export function AvatarArt({ character = 'aube', style = 'longs', outfit = 'jogging', extras = [], size = 120, x, y }: {
  character?: string; style?: string; outfit?: string; extras?: string[]; size?: number; x?: number; y?: number
}) {
  const override = getConfig().art?.avatar
  const ch = CHARACTERS.find(c => c.id === character) ?? CHARACTERS[0]
  const shopOutfit = outfit.startsWith('av-')
  const of = OUTFITS.find(o => o.id === outfit) ?? OUTFITS[0]
  const shopHair = SHOP_HAIR.has(style)
  const hair = ch.hair
  const inner = override ? <image href={override} x="0" y="0" width="120" height="160" /> : (
    <g>
      <ellipse cx="60" cy="154" rx="30" ry="5" fill="#4a2340" opacity=".08" />
      {/* cheveux arrière */}
      {style === 'longs' && <path d="M28 56 q-4 48 10 62 h44 q14 -14 10 -62z" fill={hair} />}
      {style === 'boucles' && <g fill={hair}>{[[30, 50], [26, 70], [32, 88], [90, 50], [94, 70], [88, 88], [40, 34], [60, 26], [80, 34]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="14" />)}</g>}
      {style === 'voile' && <path d="M24 60 q0 -42 36 -42 q36 0 36 42 l6 60 q-42 18 -84 0z" fill="#c4878d" />}
      {shopHair && <ShopHairBack id={style} hair={hair} />}
      {/* corps */}
      {shopOutfit ? <ShopOutfit id={outfit} /> : <>
        <path d={BODY} fill={of.color} />
        {of.id === 'salopette' && <rect x="44" y="112" width="32" height="20" rx="4" fill={of.accent} opacity=".9" />}
        {of.id === 'jogging' && <path d="M60 102 v46" stroke={of.accent} strokeWidth="3" />}
        {of.id === 'robe' && <path d="M36 128 h48" stroke={of.accent} strokeWidth="3" opacity=".8" />}
        {of.id === 'sweat' && <path d="M48 104 q12 10 24 0" stroke={of.accent} strokeWidth="3" fill="none" />}
      </>}
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
      {shopHair && <ShopHairFront id={style} hair={hair} />}
      {extras.map(e => <ShopExtra key={e} id={e} />)}
    </g>
  )
  if (x !== undefined && y !== undefined) return <g transform={`translate(${x} ${y}) scale(${size / 160})`}>{inner}</g>
  return <svg viewBox="0 0 120 160" width={size * 0.75} height={size} role="img" aria-label="Ton avatar">{inner}</svg>
}
