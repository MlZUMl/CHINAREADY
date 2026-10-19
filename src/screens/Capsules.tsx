import { useEffect, useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Confirm, EnergyScale, Sheet, Stepper, Toggle, TopBar } from '../ui/components'
import { navigate } from '../lib/router'
import { addDays, formatDayLong, toDay, parseDay } from '../lib/dates'
import { canEdit, capsuleAccess, compareCapsule, EARLY_UNLOCK_HOURS, OPEN_DELAYS } from '../domain/capsules'
import { weightTrend } from '../domain/body'
import { IconCamera, IconEdit, IconLock, IconTrash } from '../ui/icons'
import { ENERGY_LABELS } from '../domain/recommend'
import type { ProgressCapsule } from '../data/types'

/** Réduit la photo (1280 px max) avant de la garder : moins de place, même souvenir. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('photo'))), 'image/jpeg', 0.85))
  } catch { return file }
}

export function CapsuleCreate() {
  const { snap, today, actions, toast } = useApp()
  const last30 = snap.workouts.filter(w => w.completed && w.day >= addDays(today, -29)).length
  const lastWeight = weightTrend(snap.weights).pop()
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [withWeight, setWithWeight] = useState(false)
  const [kg, setKg] = useState(lastWeight?.kg ?? 60)
  const [energy, setEnergy] = useState<number | null>(snap.daily_checkins.find(c => c.day === today)?.energy ?? null)
  const [habits, setHabits] = useState('')
  const [difficulties, setDifficulties] = useState('')
  const [workouts, setWorkouts] = useState(last30)
  const [success, setSuccess] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'ouverte' | 'verrouillee'>('verrouillee')
  const [delay, setDelay] = useState<number>(30)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const save = async () => {
    const locked = mode === 'verrouillee'
    await actions.createCapsule({
      open_on: locked ? addDays(today, delay) : null, locked, weight_kg: withWeight ? Math.round(kg * 10) / 10 : null, energy,
      habits: habits.trim() || null, difficulties: difficulties.trim() || null, workouts_count: workouts, success: success.trim() || null,
      note: note.trim() || null, future_message: message.trim() || null,
    }, photo)
    toast('⏳', locked ? `Capsule scellée jusqu'au ${formatDayLong(addDays(today, delay))}` : 'Capsule enregistrée')
    navigate('/progres?onglet=capsules', true)
  }

  return (
    <>
      <TopBar onBack title="Nouvelle capsule" kicker={formatDayLong(today)} />
      <main className="content no-tabs">
        <p className="muted">Tout est facultatif. Remplis seulement ce qui a du sens pour toi aujourd'hui.</p>
        <section className="card">
          <h3>Une photo</h3>
          {preview ? <img src={preview} alt="Aperçu de la photo" style={{ borderRadius: 14, maxHeight: 260, objectFit: 'cover', width: '100%' }} /> : null}
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            <IconCamera /> {preview ? 'Changer la photo' : 'Ajouter une photo'}
            <input type="file" accept="image/*" className="sr-only" onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return
              const b = await shrink(f); setPhoto(b); setPreview(URL.createObjectURL(b))
            }} />
          </label>
          {preview && <button className="link-btn" onClick={() => { setPhoto(null); setPreview(null) }}>Retirer la photo</button>}
          <p className="muted small">Privée : elle reste sur ton téléphone et, si tu as un compte, dans ton espace protégé. Tu peux la supprimer à tout moment.</p>
        </section>
        <section className="card">
          <Toggle label="Noter mon poids du moment" hint="Pour toi seule, et seulement si tu le souhaites" checked={withWeight} onChange={setWithWeight} />
          {withWeight && <Stepper label="Poids" value={kg} min={30} max={250} step={0.1} onChange={setKg} format={v => v.toFixed(1).replace('.', ',') + ' kg'} />}
          <strong className="small">Mon énergie en ce moment</strong>
          <EnergyScale value={energy} onChange={setEnergy} />
          <div className="row between"><strong className="small">Séances ces 30 derniers jours</strong><Stepper label="Séances" value={workouts} min={0} max={99} onChange={setWorkouts} /></div>
        </section>
        <section className="card">
          <label className="field">Les habitudes que j'ai prises<textarea className="input" value={habits} onChange={e => setHabits(e.target.value)} placeholder="Ex. : ma séance de 17 h 15, ma gourde au bureau…" /></label>
          <label className="field">Ce qui est difficile en ce moment<textarea className="input" value={difficulties} onChange={e => setDifficulties(e.target.value)} /></label>
          <label className="field">Une réussite dont je suis fière<textarea className="input" value={success} onChange={e => setSuccess(e.target.value)} /></label>
          <label className="field">Note libre<textarea className="input" value={note} onChange={e => setNote(e.target.value)} /></label>
        </section>
        <section className="card tint">
          <label className="field">Qu'aimerais-tu que ton toi du futur se rappelle de cette période ?
            <textarea className="input" value={message} onChange={e => setMessage(e.target.value)} style={{ minHeight: 120 }} /></label>
        </section>
        <section className="card">
          <h3>Quand l'ouvrir ?</h3>
          <Chips label="Mode" value={mode} onChange={v => v && setMode(v)} options={[{ id: 'verrouillee', label: 'La sceller jusqu\'à une date' }, { id: 'ouverte', label: 'La garder ouverte' }]} />
          {mode === 'verrouillee' && <>
            <Chips label="Délai" soft value={delay} onChange={v => v && setDelay(v)} options={OPEN_DELAYS.map(d => ({ id: d, label: `Dans ${d} jours` }))} />
            <p className="muted small">Elle restera fermée jusqu'au {formatDayLong(addDays(today, delay))}. Tu pourras toujours la supprimer, ou demander une ouverture anticipée (disponible {EARLY_UNLOCK_HOURS} h après la demande).</p>
          </>}
        </section>
        <button className="btn primary block" onClick={() => (mode === 'verrouillee' ? setConfirm(true) : save())}>{mode === 'verrouillee' ? 'Sceller ma capsule' : 'Enregistrer ma capsule'}</button>
      </main>
      {confirm && <Confirm title="Sceller la capsule ?" confirmLabel="Sceller" onClose={() => setConfirm(false)} onConfirm={save}
        text={<>Son contenu ne sera plus visible avant le <strong>{formatDayLong(addDays(today, delay))}</strong>. Rien n'est perdu : tu pourras la supprimer, ou demander à l'ouvrir plus tôt avec un délai de réflexion de {EARLY_UNLOCK_HOURS} h.</>} />}
    </>
  )
}

export function CapsuleScreen({ id }: { id: string }) {
  const { snap, today, actions, cloud, toast, store } = useApp()
  const c = snap.progress_capsules.find(x => x.id === id)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [del, setDel] = useState(false)
  const [showWeight, setShowWeight] = useState(false)
  const [reopen, setReopen] = useState(c?.reopen_note ?? '')
  const [editing, setEditing] = useState(false)
  const access = c ? capsuleAccess(c, today) : 'verrouillee'

  useEffect(() => {
    let url: string | null = null
    if (!c?.has_photo || access !== 'ouverte') return
    let alive = true
    ;(async () => {
      const blob = (await store.getBlob('capsule:' + c.id)) ?? (cloud.engine ? await cloud.engine.photoFor(c) : undefined)
      if (blob && alive) { url = URL.createObjectURL(blob); setPhotoUrl(url) }
    })().catch(() => {})
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [c?.id, c?.has_photo, c?.updated_at, access, cloud.engine]) // eslint-disable-line

  if (!c) return <><TopBar onBack title="Capsule" /><main className="content no-tabs"><p className="empty">Cette capsule n'existe plus.</p></main></>

  const remove = async () => { await actions.deleteCapsule(c.id); toast('🗑️', 'Capsule supprimée'); navigate('/progres?onglet=capsules', true) }

  if (access === 'verrouillee' || access === 'deblocage-en-cours') {
    const ready = c.unlock_requested_at ? new Date(Date.parse(c.unlock_requested_at) + EARLY_UNLOCK_HOURS * 3600_000) : null
    return (
      <>
        <TopBar onBack title="Capsule scellée" kicker={`Créée le ${formatDayLong(c.created_day)}`} />
        <main className="content no-tabs">
          <section className="card tint celebrate">
            <div className="recipe-hero"><IconLock style={{ width: 40, color: 'var(--prune)' }} /></div>
            <h2>Elle s'ouvrira le {formatDayLong(c.open_on!)}</h2>
            <p className="muted">Encore {Math.max(0, Math.round((parseDay(c.open_on!).getTime() - parseDay(today).getTime()) / 86400000))} jours. Ton toi d'aujourd'hui a hâte que tu la lises.</p>
          </section>
          {access === 'deblocage-en-cours'
            ? <div className="banner">Ouverture anticipée demandée : disponible le {ready!.toLocaleDateString('fr-FR')} à {ready!.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.</div>
            : <button className="btn ghost block" onClick={() => actions.requestEarlyUnlock(c.id)}>Demander une ouverture anticipée ({EARLY_UNLOCK_HOURS} h de réflexion)</button>}
          <button className="btn danger block" onClick={() => setDel(true)}><IconTrash /> Supprimer la capsule</button>
        </main>
        {del && <Confirm danger title="Supprimer la capsule ?" confirmLabel="Supprimer définitivement" text="La capsule, sa photo et son message seront effacés, ici et dans ta sauvegarde en ligne." onClose={() => setDel(false)} onConfirm={remove} />}
      </>
    )
  }

  if (access === 'prete') return (
    <>
      <TopBar onBack title="Une capsule t'attend" />
      <main className="content no-tabs">
        <section className="card prune celebrate">
          <span className="big" aria-hidden="true">🎁</span>
          <h2>Ton toi du {formatDayLong(c.created_day)} t'a laissé quelque chose.</h2>
          <button className="btn white" onClick={() => actions.openCapsule(c.id)}>Ouvrir ma capsule</button>
        </section>
      </main>
    </>
  )

  const comparisons = c.opened_at && c.locked ? compareCapsule(c, snap, today, showWeight) : []
  const editable = canEdit(c, today)
  return (
    <>
      <TopBar onBack title="Ma capsule" kicker={`Créée le ${formatDayLong(c.created_day)}`} />
      <main className="content no-tabs">
        {c.future_message && <section className="card tint"><div className="kicker">Message à ton toi du futur</div><p style={{ fontFamily: 'var(--titre)', fontSize: '1.2rem', color: 'var(--prune)' }}>« {c.future_message} »</p></section>}
        {photoUrl && <img src={photoUrl} alt="Photo de la capsule" style={{ borderRadius: 20, width: '100%', objectFit: 'cover', maxHeight: 360 }} />}
        <section className="card">
          <h3>Ce jour-là</h3>
          <div className="list">
            {c.energy && <Line k="Énergie" v={ENERGY_LABELS[c.energy]} />}
            {c.workouts_count !== null && <Line k="Séances sur 30 jours" v={String(c.workouts_count)} />}
            {c.habits && <Line k="Habitudes prises" v={c.habits} />}
            {c.difficulties && <Line k="Difficultés" v={c.difficulties} />}
            {c.success && <Line k="Réussite" v={c.success} />}
            {c.note && <Line k="Note" v={c.note} />}
            {c.weight_kg !== null && <Line k="Poids noté" v={`${c.weight_kg} kg`} />}
          </div>
        </section>
        {c.locked && (
          <section className="card">
            <h3>Avant / maintenant</h3>
            <p className="muted small">Uniquement ce qui a été réellement mesuré aux deux moments.</p>
            {comparisons.length ? (
              <div className="list">{comparisons.map(x => <div className="list-item" key={x.label}><div className="grow"><div className="title">{x.label}</div></div><span className="small">{x.then} → <strong>{x.now}</strong></span></div>)}</div>
            ) : <p className="empty">Pas assez de données comparables.</p>}
            <Toggle label="Afficher la comparaison du poids" hint="Masquée par défaut" checked={showWeight} onChange={setShowWeight} />
          </section>
        )}
        {c.opened_at && c.locked && (
          <section className="card">
            <label className="field">Ce que je me dis aujourd'hui, en la relisant<textarea className="input" value={reopen} onChange={e => setReopen(e.target.value)} /></label>
            <button className="btn secondary" onClick={async () => { await actions.updateCapsule({ ...c, reopen_note: reopen.trim() || null } as ProgressCapsule); toast('💌', 'Note ajoutée') }}>Enregistrer ma note</button>
          </section>
        )}
        {editable && <button className="btn secondary block" onClick={() => setEditing(true)}><IconEdit /> Modifier la capsule</button>}
        <button className="btn danger block" onClick={() => setDel(true)}><IconTrash /> Supprimer</button>
      </main>
      {del && <Confirm danger title="Supprimer la capsule ?" confirmLabel="Supprimer définitivement" text="La capsule et sa photo seront effacées, ici et dans ta sauvegarde en ligne." onClose={() => setDel(false)} onConfirm={remove} />}
      {editing && <CapsuleEditSheet capsule={c} hasPhoto={Boolean(c.has_photo)} onClose={() => setEditing(false)} onPhotoChanged={() => setPhotoUrl(null)} />}
    </>
  )
}

/** Modifier une capsule ouverte : textes, poids noté, photo (retirer ou remplacer). */
function CapsuleEditSheet({ capsule: c, hasPhoto, onClose, onPhotoChanged }: { capsule: ProgressCapsule; hasPhoto: boolean; onClose: () => void; onPhotoChanged: () => void }) {
  const { actions, toast } = useApp()
  const [habits, setHabits] = useState(c.habits ?? '')
  const [difficulties, setDifficulties] = useState(c.difficulties ?? '')
  const [success, setSuccess] = useState(c.success ?? '')
  const [note, setNote] = useState(c.note ?? '')
  const [message, setMessage] = useState(c.future_message ?? '')
  const [keepWeight, setKeepWeight] = useState(c.weight_kg !== null)
  const [confirmPhoto, setConfirmPhoto] = useState(false)
  const save = async () => {
    await actions.updateCapsule({
      ...c, habits: habits.trim() || null, difficulties: difficulties.trim() || null, success: success.trim() || null,
      note: note.trim() || null, future_message: message.trim() || null, weight_kg: keepWeight ? c.weight_kg : null,
    })
    toast('💌', 'Capsule mise à jour')
    onClose()
  }
  return (
    <Sheet title="Modifier ma capsule" onClose={onClose}>
      <label className="field">Message à mon toi du futur<textarea className="input" value={message} onChange={e => setMessage(e.target.value)} /></label>
      <label className="field">Habitudes prises<textarea className="input" value={habits} onChange={e => setHabits(e.target.value)} /></label>
      <label className="field">Difficultés<textarea className="input" value={difficulties} onChange={e => setDifficulties(e.target.value)} /></label>
      <label className="field">Réussite<textarea className="input" value={success} onChange={e => setSuccess(e.target.value)} /></label>
      <label className="field">Note<textarea className="input" value={note} onChange={e => setNote(e.target.value)} /></label>
      {c.weight_kg !== null && <Toggle label="Garder le poids noté" hint={`${c.weight_kg} kg`} checked={keepWeight} onChange={setKeepWeight} />}
      <div className="row wrap">
        <label className="btn secondary sm" style={{ cursor: 'pointer' }}>
          <IconCamera /> {hasPhoto ? 'Remplacer la photo' : 'Ajouter une photo'}
          <input type="file" accept="image/*" className="sr-only" onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return
            await actions.replaceCapsulePhoto(c.id, await shrink(f)); onPhotoChanged(); toast('📷', 'Photo enregistrée')
          }} />
        </label>
        {hasPhoto && <button className="btn danger sm" onClick={() => setConfirmPhoto(true)}>Retirer la photo</button>}
      </div>
      <button className="btn primary block" onClick={save}>Enregistrer</button>
      {confirmPhoto && <Confirm danger title="Retirer la photo ?" confirmLabel="Retirer" text="La photo sera effacée de ce téléphone et de ta sauvegarde en ligne."
        onClose={() => setConfirmPhoto(false)} onConfirm={async () => { await actions.removeCapsulePhoto(c.id); onPhotoChanged(); setConfirmPhoto(false); toast('🗑️', 'Photo retirée') }} />}
    </Sheet>
  )
}

function Line({ k, v }: { k: string; v: string }) {
  return <div className="list-item" style={{ alignItems: 'flex-start' }}><div className="grow"><div className="muted small">{k}</div><div>{v}</div></div></div>
}

export const _t = toDay
