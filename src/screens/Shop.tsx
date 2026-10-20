// Boutique : points gagnés chaque jour, objets cosmétiques pour le compagnon (tenues, coiffures, accessoires).
import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { Segmented, Sheet } from '../ui/components'
import { CompanionArt } from '../art/Companion'
import { IconCheck, IconLock } from '../ui/icons'
import { navigate } from '../lib/router'
import { weekStart } from '../lib/dates'
import {
  DAILY_POINTS, GOAL_HINTS, GOAL_LABELS, SHOP, SLOT_LABELS, TIER_LABELS, WEEKLY_BONUS, WEEKLY_BONUS_DAYS, balance, completeDays, etaText,
  equipList, featuredItem, goalsDone, ownedItems, pointsGrantId, priceOf, weeklyBonusId, type DailyGoal, type ShopItem, type Slot,
} from '../domain/shop'

export const fmtPts = (n: number) => `${n.toLocaleString('fr-FR')} pts`

/** Petit compteur de points, réutilisé sur l'accueil et dans l'univers. */
export function PointsPill({ onClick }: { onClick?: () => void }) {
  const { snap } = useApp()
  return (
    <button className="pill points-pill" onClick={onClick ?? (() => navigate('/univers?onglet=boutique'))} aria-label={`Mes points : ${balance(snap)}. Ouvrir la boutique`}>
      <span aria-hidden="true">💎</span><span data-testid="solde-points">{fmtPts(balance(snap))}</span>
    </button>
  )
}

export function ShopPanel() {
  const { snap, today } = useApp()
  const comp = snap.companion_profiles[0]
  const [slot, setSlot] = useState<Slot | 'garde-robe'>('tenue')
  const [pick, setPick] = useState<ShopItem | null>(null)
  const owned = ownedItems(snap)
  const featured = featuredItem(weekStart(today))
  const list = useMemo(() => (slot === 'garde-robe' ? SHOP.filter(i => owned.has(i.id)) : SHOP.filter(i => i.slot === slot)), [slot, owned])
  if (!comp) return null
  const solde = balance(snap)
  return (
    <>
      <section className="card prune" aria-label="Mes points">
        <div className="row between">
          <div><div className="kicker" style={{ color: '#cfe7e3' }}>Mes points</div><div className="kbd-num" style={{ color: '#fff' }} data-testid="solde-boutique">{fmtPts(solde)}</div></div>
          <CompanionArt species={comp.species} expression="content" color={comp.color} accessories={comp.accessories} size={84} className="bob" />
        </div>
        <p className="muted small">Gagnés en prenant soin de toi, jamais perdus. Dépense-les pour habiller {comp.name}.</p>
      </section>

      <TodayPoints />

      <section className="card tint" aria-label="Sélection de la semaine">
        <div className="card-head">
          <span className="emoji-bubble" aria-hidden="true">✨</span>
          <div><div className="kicker">Sélection de la semaine · −20 %</div><strong>{featured.name}</strong></div>
          <button className="btn secondary sm" onClick={() => setPick(featured)}>Voir</button>
        </div>
      </section>

      <Segmented label="Rayons de la boutique" value={slot} onChange={setSlot} options={[
        { id: 'tenue', label: SLOT_LABELS.tenue }, { id: 'coiffure', label: SLOT_LABELS.coiffure }, { id: 'accessoire', label: SLOT_LABELS.accessoire }, { id: 'garde-robe', label: `Ma garde-robe (${owned.size})` },
      ]} />
      {slot === 'garde-robe' && !list.length && <p className="empty">Ta garde-robe est vide pour l'instant : ta première séance rapporte de quoi offrir un premier objet.</p>}
      <div className="item-grid shop-grid">
        {list.map(item => {
          const has = owned.has(item.id)
          const on = comp.accessories.includes(item.id)
          const price = priceOf(item, today)
          const preview = equipList(comp.accessories.filter(id => id !== item.id), item.id)
          return (
            <button key={item.id} className={`item-card shop-card ${on ? 'on' : ''}`} onClick={() => setPick(item)} aria-label={`${item.name}, ${TIER_LABELS[item.tier]}, ${has ? (on ? 'porté' : 'acheté') : fmtPts(price)}`}>
              <span className={`tier tier-${item.tier}`}>{TIER_LABELS[item.tier]}</span>
              <CompanionArt species={comp.species} color={comp.color} accessories={preview} size={64} />
              <span className="name">{item.name}</span>
              {has ? <span className="price owned">{on ? <><IconCheck style={{ width: 14 }} /> Porté</> : 'Acheté'}</span>
                : <span className={`price ${solde >= price ? '' : 'short'}`}>{solde < price && <IconLock style={{ width: 12 }} />}{fmtPts(price)}</span>}
            </button>
          )
        })}
      </div>
      <PriceGuide />
      {pick && <ItemSheet item={pick} onClose={() => setPick(null)} />}
    </>
  )
}

function TodayPoints() {
  const { snap, today } = useApp()
  const done = goalsDone(snap, today)
  const got = new Set(snap.reward_grants.filter(g => g.kind === 'points').map(g => g.id))
  const week = weekStart(today)
  const complete = completeDays(snap, week, today)
  const bonusGot = got.has(weeklyBonusId(week))
  return (
    <section className="card" aria-label="Points du jour">
      <div className="card-head"><div><div className="kicker">Aujourd'hui · jusqu'à 400 pts</div><h3>Mes objectifs du jour</h3></div></div>
      <div className="list">
        {(Object.keys(DAILY_POINTS) as DailyGoal[]).map(g => {
          const ok = got.has(pointsGrantId(g, today)) || done[g]
          return (
            <div className="list-item" key={g} style={{ minHeight: 48 }}>
              <span className={`goal-dot ${ok ? 'ok' : ''}`} aria-hidden="true">{ok ? <IconCheck style={{ width: 16 }} /> : null}</span>
              <div className="grow"><div className="title">{GOAL_LABELS[g]}</div><div className="muted small">{GOAL_HINTS[g]}</div></div>
              <strong className={ok ? '' : 'muted'} data-testid={`points-${g}`}>{ok ? '+' : ''}{DAILY_POINTS[g]}</strong>
            </div>
          )
        })}
      </div>
      <div className="equip-summary">
        <strong>Bonus de régularité : +{WEEKLY_BONUS} pts</strong> {bonusGot ? '— gagné cette semaine 🎉' : `— ${Math.min(complete, WEEKLY_BONUS_DAYS)} / ${WEEKLY_BONUS_DAYS} journées complètes cette semaine`}
        <div className="muted small">3 journées avec les trois objectifs suffisent, n'importe quels jours. Un jour manqué ne fait rien perdre.</div>
      </div>
    </section>
  )
}

function ItemSheet({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const { snap, actions, toast, today } = useApp()
  const comp = snap.companion_profiles[0]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!comp) return null
  const has = ownedItems(snap).has(item.id)
  const on = comp.accessories.includes(item.id)
  const price = priceOf(item, today)
  const solde = balance(snap)
  const missing = price - solde
  const preview = equipList(comp.accessories.filter(id => id !== item.id), item.id)
  const buy = async () => {
    setBusy(true); setError(null)
    try {
      await actions.buyItem(item.id)
      toast('🛍️', `${item.name} : acheté et porté par ${comp.name} (−${price} pts)`)
      onClose()
    } catch (e) {
      const code = (e as Error).message
      setError(code === 'SOLDE' ? 'Pas assez de points pour le moment.' : code === 'DEJA' ? 'Tu as déjà cet objet.' : 'L\'achat n\'a pas pu être enregistré. Réessaie.')
    } finally { setBusy(false) }
  }
  return (
    <Sheet title={item.name} onClose={onClose}>
      <div className="celebrate">
        <CompanionArt species={comp.species} expression="fier" color={comp.color} accessories={has && !on ? comp.accessories : preview} size={150} />
        <div className="chips" style={{ justifyContent: 'center' }}>
          <span className={`pill tier-${item.tier}`}>{TIER_LABELS[item.tier]}</span>
          <span className="pill">{SLOT_LABELS[item.slot].slice(0, -1)}</span>
          {!has && <span className="pill">{fmtPts(price)}{price < item.price ? ` au lieu de ${fmtPts(item.price)}` : ''}</span>}
        </div>
      </div>
      {has ? (
        <button className={`btn ${on ? 'ghost' : 'primary'} block`} onClick={async () => { await actions.toggleCosmetic(item.id); toast(on ? '👕' : '✨', on ? 'Retiré' : `${comp.name} porte ${item.name.toLowerCase()}`); onClose() }}>
          {on ? 'Retirer' : 'Porter'}
        </button>
      ) : missing > 0 ? (
        <>
          <div className="equip-summary" role="status">Il te manque <strong>{fmtPts(missing)}</strong> — {etaText(missing)}.</div>
          <button className="btn primary block" disabled>Acheter · {fmtPts(price)}</button>
        </>
      ) : (
        <>
          <p className="muted small" style={{ textAlign: 'center' }}>Solde après achat : {fmtPts(solde - price)}</p>
          <button className="btn primary block" onClick={buy} disabled={busy}>{busy ? 'Achat en cours…' : `Acheter · ${fmtPts(price)}`}</button>
        </>
      )}
      {error && <div className="warn" role="alert">{error}</div>}
    </Sheet>
  )
}

function PriceGuide() {
  return (
    <section className="card flat" aria-label="Repères de prix">
      <strong>Repères</strong>
      <p className="muted small">Commun (300 à 500 pts) : une journée réussie. Rare (1 200 à 1 800 pts) : environ une semaine régulière. Premium (3 500 à 8 000 pts) : un objectif sur plusieurs semaines. Les points n'expirent jamais.</p>
    </section>
  )
}
