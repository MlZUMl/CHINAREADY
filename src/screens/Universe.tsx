import { useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Segmented, Sheet, TopBar, Progress } from '../ui/components'
import { navigate } from '../lib/router'
import { AvatarArt, CHARACTERS, STYLES, OUTFITS } from '../art/Avatar'
import { CompanionArt, COMPANION_COLORS } from '../art/Companion'
import { SceneArt } from '../art/Scene'
import { ACCESSORIES, ITEMS, UNIVERSE_STARTS, itemDef, badgeDef, zoneOrder, LEVEL_ITEMS } from '../domain/catalog'
import { levelFor, owned, totalXp } from '../domain/rewards'
import { activeWeeks } from '../domain/discipline'
import { SPECIES, memoryOf } from '../domain/companion'
import { missionDef } from '../domain/missions'
import { IconLock, IconUser } from '../ui/icons'
import type { Species } from '../data/types'
import { PointsPill, ShopPanel } from './Shop'
import { avatarLook } from '../domain/shop'

export function Universe({ query }: { query: URLSearchParams }) {
  const { snap } = useApp()
  const avatar = snap.avatar_profiles[0]
  const tab = (query.get('onglet') as 'univers' | 'compagnon' | 'boutique') || 'univers'
  return (
    <>
      <TopBar title="Mon univers" right={<><PointsPill onClick={() => navigate('/univers?onglet=boutique', true)} /><button className="icon-btn" aria-label="Profil et réglages" onClick={() => navigate('/profil')}><IconUser /></button></>} />
      <main className="content">
        <Segmented label="Sections univers" value={tab} onChange={t => navigate('/univers?onglet=' + t, true)} options={[{ id: 'univers', label: 'Univers' }, { id: 'compagnon', label: 'Compagnon' }, { id: 'boutique', label: 'Boutique' }]} />
        {tab === 'boutique' ? <ShopPanel /> : tab === 'compagnon' ? <CompanionPanel /> : avatar ? <World /> : <AvatarCreate />}
      </main>
    </>
  )
}

function AvatarCreate() {
  const { actions } = useApp()
  const [character, setCharacter] = useState<string>('aube')
  const [style, setStyle] = useState<string>('longs')
  const [outfit, setOutfit] = useState<string>('jogging')
  const [universe, setUniverse] = useState<string>('chambre')
  const [name, setName] = useState('')
  return (
    <>
      <section className="card tint">
        <h2>Crée ton personnage</h2>
        <p className="muted">Ton univers évoluera avec tes habitudes réelles : chaque séance, chaque verre d'eau, chaque reprise y laisse une trace.</p>
        <div style={{ display: 'grid', placeItems: 'center' }}><AvatarArt character={character} style={style} outfit={outfit} size={170} /></div>
      </section>
      <section className="card">
        <strong>Personnage</strong>
        <Chips label="Personnage" value={character} onChange={v => v && setCharacter(v)} options={CHARACTERS.map(c => ({ id: c.id, label: c.label }))} />
        <strong>Style</strong>
        <Chips label="Style" value={style} onChange={v => v && setStyle(v)} options={STYLES.map(s => ({ id: s.id, label: s.label }))} />
        <strong>Tenue de départ</strong>
        <Chips label="Tenue" value={outfit} onChange={v => v && setOutfit(v)} options={OUTFITS.map(o => ({ id: o.id, label: o.label }))} />
        <strong>Univers de départ</strong>
        <Chips label="Univers" value={universe} onChange={v => v && setUniverse(v)} options={UNIVERSE_STARTS.map(u => ({ id: u.id, label: u.label }))} />
        <label className="field">Prénom de ton personnage <span className="hint">Facultatif</span><input className="input" value={name} onChange={e => setName(e.target.value)} /></label>
      </section>
      <button className="btn primary block" onClick={() => actions.createAvatar({ character, style, outfit, universe, name: name.trim() || null })}>Entrer dans mon univers</button>
    </>
  )
}

function World() {
  const { snap, actions, today } = useApp()
  const avatar = snap.avatar_profiles[0]
  const comp = snap.companion_profiles[0]
  const zones = zoneOrder(avatar.universe)
  const ownedZones = owned(snap, 'zone')
  const ownedItems = owned(snap, 'item')
  const [zoneId, setZoneId] = useState(zones[0].id)
  const [slot, setSlot] = useState<string | null>(null)
  const [edit, setEdit] = useState(false)
  const [style, setStyle] = useState(false)
  const zone = zones.find(z => z.id === zoneId)!
  const unlocked = ownedZones.has(zone.id)
  const xp = totalXp(snap)
  const lvl = levelFor(xp)
  const weeks = activeWeeks(snap)
  const mission = snap.user_missions.find(m => m.day === today)
  const nextRewards = ITEMS.filter(i => !i.mystery && !ownedItems.has(i.id)).slice(0, 3)
  const nextLevelItem = LEVEL_ITEMS[lvl.level + 1] ? itemDef(LEVEL_ITEMS[lvl.level + 1]) : undefined

  const equip = (s: string, itemId: string | null) => {
    const key = `${zone.id}:${s}`
    const equipped = { ...avatar.equipped }
    if (itemId) {
      for (const k of Object.keys(equipped)) if (equipped[k] === itemId) delete equipped[k] // un objet à un seul endroit
      equipped[key] = itemId
    } else delete equipped[key]
    actions.updateAvatar({ equipped })
  }
  const candidates = (s: string) => ITEMS.filter(i => i.zone === zone.id && i.slot === s && ownedItems.has(i.id))
  const mysteryOwned = snap.reward_grants.filter(g => g.kind === 'item' && itemDef(g.ref.split('~')[0])?.mystery)

  return (
    <>
      <div className="segmented" role="tablist" aria-label="Zones">
        {zones.map(z => (
          <button key={z.id} role="tab" aria-selected={zoneId === z.id} className={zoneId === z.id ? 'on' : ''} onClick={() => setZoneId(z.id)}>
            {!ownedZones.has(z.id) && <IconLock style={{ width: 14, display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />}{z.name}
          </button>
        ))}
      </div>
      {unlocked ? (
        <div className="scene">
          <SceneArt zone={zone.id} equipped={avatar.equipped} slots={zone.slots} editable={edit} onSlot={s => setSlot(s)}
            avatar={<g>{(() => { const l = avatarLook(avatar); return <AvatarArt character={avatar.character} style={l.style} outfit={l.outfit} extras={l.extras} size={110} x={150} y={122} /> })()}</g>}
            companion={comp ? <foreignObject x="210" y="178" width="70" height="70"><CompanionArt species={comp.species} expression="content" color={comp.color} accessories={comp.accessories} size={70} /></foreignObject> : null} />
          <div className="row between" style={{ padding: '10px 14px' }}>
            <span className="small muted">{edit ? 'Touche un emplacement pour y poser un objet.' : `${zone.name} — ${zone.description}`}</span>
            <button className={`btn sm ${edit ? 'primary' : 'secondary'}`} onClick={() => setEdit(e => !e)}>{edit ? 'Terminé' : 'Décorer'}</button>
          </div>
        </div>
      ) : (
        <section className="card flat celebrate">
          <IconLock style={{ width: 32, color: 'var(--prune)' }} />
          <h3>{zone.name}</h3>
          <p className="muted">{zone.description} Elle s'ouvre après {zone.weeksNeeded} semaines actives (au moins 3 jours avec une action dans la semaine). Tu en es à {weeks}.</p>
          <Progress value={weeks / zone.weeksNeeded} label="Progression vers la zone" />
        </section>
      )}

      <section className="card tint">
        <div className="row between"><div><div className="kicker">Niveau {lvl.level}{avatar.name ? ` · ${avatar.name}` : ''}</div><strong>{xp - lvl.current} / {lvl.next - lvl.current} points vers le niveau {lvl.level + 1}</strong></div>
          <button className="btn ghost sm" onClick={() => setStyle(true)}>Tenue</button></div>
        <Progress value={lvl.progress} label="Progression de niveau" />
        {nextLevelItem && <p className="muted small">Au niveau {lvl.level + 1} : {nextLevelItem.emoji} {nextLevelItem.name}</p>}
        <p className="muted small">Les points viennent de la régularité, des reprises et de la découverte — jamais de la balance.</p>
      </section>

      {mission && mission.status !== 'terminee' && mission.status !== 'ignoree' && (
        <section className="card flat">
          <div className="kicker">Mission qui peut faire évoluer ton univers</div>
          <strong>{mission.mystery && mission.status === 'disponible' ? 'Mission mystère du jour' : missionDef(mission.mission_key)?.name}</strong>
          <button className="link-btn" onClick={() => navigate('/')}>Voir sur l'accueil</button>
        </section>
      )}

      <section className="card">
        <h2>Prochaines récompenses</h2>
        <div className="item-grid">
          {nextRewards.map(i => <div key={i.id} className="item-card locked"><span className="em" aria-hidden="true">{i.emoji}</span>{i.name}<span className="muted" style={{ fontSize: '.7rem' }}>{i.how}</span></div>)}
        </div>
      </section>

      <section className="card">
        <h2>Mes objets ({ownedItems.size})</h2>
        <div className="item-grid">
          {ITEMS.filter(i => ownedItems.has(i.id)).map(i => <div key={i.id} className="item-card"><span className="em" aria-hidden="true">{i.emoji}</span>{i.name}</div>)}
          {!ownedItems.size && <p className="muted small">Ta première séance t'offrira ton premier objet.</p>}
        </div>
        <p className="muted small">Objets exclusifs des missions mystères : {mysteryOwned.length} trouvé{mysteryOwned.length > 1 ? 's' : ''}. D'autres attendent d'être découverts.</p>
      </section>

      <section className="card">
        <h2>À découvrir</h2>
        <div className="item-grid">
          {ITEMS.filter(i => !ownedItems.has(i.id) && !i.mystery).map(i => <div key={i.id} className="item-card locked"><span className="em" aria-hidden="true">{i.emoji}</span>{i.name}<span className="muted" style={{ fontSize: '.7rem' }}>{i.how}</span></div>)}
          {ITEMS.some(i => i.mystery && !ownedItems.has(i.id)) && <div className="item-card locked"><span className="em" aria-hidden="true">❔</span>Objets mystères<span className="muted" style={{ fontSize: '.7rem' }}>Missions mystères</span></div>}
        </div>
      </section>

      {slot && (
        <Sheet title="Choisir un objet" onClose={() => setSlot(null)}>
          {candidates(slot).length ? (
            <div className="item-grid">
              {candidates(slot).map(i => {
                const on = avatar.equipped[`${zone.id}:${slot}`] === i.id
                return <button key={i.id} className={`item-card ${on ? 'on' : ''}`} onClick={() => { equip(slot, on ? null : i.id); setSlot(null) }}><span className="em" aria-hidden="true">{i.emoji}</span>{i.name}</button>
              })}
            </div>
          ) : <p className="muted">Aucun objet débloqué pour cet emplacement. Pistes : {ITEMS.filter(i => i.zone === zone.id && i.slot === slot && !i.mystery).map(i => `${i.name} (${i.how.toLowerCase()})`).join(', ') || 'missions mystères'}.</p>}
          {avatar.equipped[`${zone.id}:${slot}`] && <button className="btn ghost" onClick={() => { equip(slot, null); setSlot(null) }}>Libérer l'emplacement</button>}
        </Sheet>
      )}
      {style && <StyleSheet onClose={() => setStyle(false)} />}
    </>
  )
}

function StyleSheet({ onClose }: { onClose: () => void }) {
  const { snap, actions } = useApp()
  const a = snap.avatar_profiles[0]
  const look = avatarLook(a)
  const without = (k: string) => { const e = { ...a.equipped }; delete e[k]; return e }
  return (
    <Sheet title="Mon personnage" onClose={onClose}>
      <div style={{ display: 'grid', placeItems: 'center' }}><AvatarArt character={a.character} style={look.style} outfit={look.outfit} extras={look.extras} size={150} /></div>
      <Chips label="Personnage" value={a.character} onChange={v => v && actions.updateAvatar({ character: v })} options={CHARACTERS.map(c => ({ id: c.id, label: c.label }))} />
      <Chips label="Style" value={a.equipped['perso:coiffure'] ? null : a.style} onChange={v => v && actions.updateAvatar({ style: v, equipped: without('perso:coiffure') })} options={STYLES.map(s => ({ id: s.id, label: s.label }))} />
      <Chips label="Tenue" value={a.equipped['perso:tenue'] ? null : a.outfit} onChange={v => v && actions.updateAvatar({ outfit: v, equipped: without('perso:tenue') })} options={OUTFITS.map(o => ({ id: o.id, label: o.label }))} />
      {(a.equipped['perso:coiffure'] || a.equipped['perso:tenue']) && <p className="muted small">Un objet de la boutique est porté : choisir un style ou une tenue de départ le retire (il reste dans ta garde-robe).</p>}
      <button className="btn secondary" onClick={() => { onClose(); navigate('/univers?onglet=boutique', true) }}>👗 Plus de tenues et de coiffures : la boutique</button>
      <label className="field">Prénom<input className="input" defaultValue={a.name ?? ''} onBlur={e => actions.updateAvatar({ name: e.target.value.trim() || null })} /></label>
    </Sheet>
  )
}

function CompanionPanel() {
  const { snap, actions, today } = useApp()
  const comp = snap.companion_profiles[0]
  const accOwned = owned(snap, 'accessory')
  if (!comp) return null
  const memories = snap.reward_grants.filter(g => g.kind === 'badge' || g.kind === 'item').sort((a, b) => b.granted_at.localeCompare(a.granted_at)).slice(0, 6)
  return (
    <>
      <section className="card tint celebrate">
        <CompanionArt species={comp.species} expression="content" color={comp.color} accessories={comp.accessories} size={150} className="bob" />
        <h2>{comp.name}</h2>
        <p className="muted">{SPECIES.find(s => s.id === comp.species)?.trait}</p>
      </section>
      <section className="card">
        <label className="field">Prénom<input className="input" defaultValue={comp.name} onBlur={e => e.target.value.trim() && actions.updateCompanion({ name: e.target.value.trim() })} /></label>
        <strong>Espèce</strong>
        <Chips label="Espèce" value={comp.species} onChange={(v: Species | null) => v && actions.updateCompanion({ species: v })} options={SPECIES.map(s => ({ id: s.id, label: s.label }))} />
        <strong>Couleur</strong>
        <Chips label="Couleur" value={comp.color} onChange={v => v && actions.updateCompanion({ color: v })} options={Object.entries(COMPANION_COLORS).map(([id, c]) => ({ id, label: c.label }))} />
        <strong>Accessoires</strong>
        <div className="item-grid">
          {ACCESSORIES.map(a => {
            const has = accOwned.has(a.id)
            const on = comp.accessories.includes(a.id)
            return (
              <button key={a.id} className={`item-card ${has ? '' : 'locked'} ${on ? 'on' : ''}`} disabled={!has} aria-pressed={on}
                onClick={() => actions.updateCompanion({ accessories: on ? comp.accessories.filter(x => x !== a.id) : [...comp.accessories, a.id] })}>
                <CompanionArt species={comp.species} color={comp.color} accessories={[a.id]} size={48} />
                {a.name}{!has && <span className="muted" style={{ fontSize: '.68rem' }}>{a.how}</span>}
              </button>
            )
          })}
        </div>
        <button className="btn secondary" onClick={() => navigate('/univers?onglet=boutique', true)}>👕 Tenues et coiffures : la boutique</button>
        <strong>Messages</strong>
        <Chips label="Fréquence des messages" value={comp.frequency} onChange={v => v && actions.updateCompanion({ frequency: v })} options={[{ id: 'normal', label: 'Bavard' }, { id: 'discret', label: 'Discret' }]} />
      </section>
      <section className="card">
        <h2>Nos souvenirs</h2>
        {memories.length ? (
          <div className="list">{memories.map(g => {
            const label = g.kind === 'badge' ? '🏅 Badge' : '🎁 Objet'
            const name = g.kind === 'item' ? itemDef(g.ref.split('~')[0])?.name : g.ref
            return <div className="list-item" key={g.id}><div className="grow"><div className="title">{label} : {g.kind === 'badge' ? memoryLabel(g.ref) : name}</div><div className="muted small">{new Date(g.granted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · {g.reason}</div></div></div>
          })}</div>
        ) : <p className="muted">Nos premiers souvenirs arriveront avec ta première séance.</p>}
        {memories.length > 0 && <p className="muted small">{memoryOf(snap, today)}</p>}
      </section>
    </>
  )
}

function memoryLabel(id: string) { return badgeDef(id)?.name ?? id }
