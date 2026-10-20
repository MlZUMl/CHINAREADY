import { useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Confirm, Sheet, Stepper, TopBar } from '../ui/components'
import { recipeById, formatQty, formatEuros, helloFreshUrl, ALLERGEN_LABELS, TAG_LABELS } from '../domain/recipes'
import { addDays, weekStart, WEEKDAYS, type Day } from '../lib/dates'
import { navigate } from '../lib/router'
import { multiply } from '../domain/nutrition'
import { NutriGrid, RecipeLogSheet, Thumb } from './food-parts'
import { UserRecipeSheet } from './Food'
import { IconExternal } from '../ui/icons'

export function RecipeDetail({ id }: { id: string }) {
  const { snap, today, actions, toast } = useApp()
  const r = recipeById(id, snap.user_recipes)
  const [portions, setPortions] = useState(snap.profiles[0]?.portions ?? 1)
  const [plan, setPlan] = useState(false)
  const [log, setLog] = useState(false)
  const [del, setDel] = useState(false)
  const [edit, setEdit] = useState(false)
  if (!r) return <><TopBar onBack title="Recette introuvable" /><main className="content no-tabs"><p className="empty">Cette recette n'existe plus.</p></main></>
  const base = r.catalog ? 1 : r.servings
  const factor = portions / base
  const user = snap.user_recipes.find(u => u.id === r.id)
  return (
    <>
      <TopBar onBack title={r.title} kicker={r.minutes ? `${r.minutes} min` : undefined} />
      <main className="content no-tabs">
        <div className="recipe-photo">
          <Thumb className="" src={r.photo?.url} emoji={r.emoji} alt={r.photo ? `Photo d'illustration : ${r.title}` : ''} />
          {r.photo && r.catalog && <a className="credit" href={r.photo.page} target="_blank" rel="noopener noreferrer">Photo : {r.photo.credit}</a>}
        </div>
        <section className="card">
          <div className="chips">
            <span className="pill ok">✓ Sans porc</span>
            {r.nutrition && <span className="pill">{r.nutrition.kcal} kcal / portion</span>}
            {r.cost !== null && <span className="pill">≈ {formatEuros(r.cost)} / portion</span>}
            {r.tags.filter(t => t !== 'perso').slice(0, 3).map(t => <span key={t} className="pill">{TAG_LABELS[t] ?? t}</span>)}
          </div>
          {r.nutrition ? (
            <>
              <div className="row between"><strong>Pour {portions} portion{portions > 1 ? 's' : ''}</strong><Stepper label="Portions" value={portions} min={1} max={8} onChange={setPortions} format={v => v + ' pers.'} /></div>
              <NutriGrid n={multiply(r.nutrition, r.catalog ? portions : 1)} />
              {!r.catalog && <p className="muted small">Valeurs saisies pour une portion.</p>}
              {r.catalog && <p className="muted small">Calculé avec la table Ciqual (Anses) à partir des ingrédients crus.</p>}
            </>
          ) : <p className="muted small">Pas de valeurs nutritionnelles : tu peux les ajouter en modifiant ta recette.</p>}
          {r.allergens.length > 0 && <p className="small"><strong>Allergènes :</strong> {r.allergens.map(a => ALLERGEN_LABELS[a] ?? a).join(', ')} <span className="muted">(indicatif : vérifie les étiquettes)</span></p>}
        </section>
        <section className="card">
          <div className="row between"><h2>Ingrédients</h2>{!r.nutrition && <Stepper label="Portions" value={portions} min={1} max={8} onChange={setPortions} format={v => v + ' pers.'} />}</div>
          <div className="list">
            {r.ingredients.map(i => (
              <div className="list-item" key={i.name} style={{ minHeight: 44, padding: '8px 0' }}>
                <span className="grow">{i.name}{i.pantry ? <span className="muted small"> · placard</span> : null}</span>
                <span className="muted small">{formatQty({ qty: i.qty === null ? null : Math.round(i.qty * factor * 100) / 100, unit: i.unit })}{i.grams && i.unit !== 'g' ? ` (${Math.round(i.grams * factor)} g)` : ''}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Étapes</h2>
          <ol className="steps">{r.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
        </section>
        <button className="btn primary" onClick={() => setLog(true)}>Ajouter à mon journal</button>
        <div className="grid2">
          <button className="btn secondary" onClick={() => setPlan(true)}>Ajouter au menu</button>
          {r.catalog
            ? <a className="btn ghost" href={helloFreshUrl(r.title)} target="_blank" rel="noopener noreferrer">Voir sur HelloFresh <IconExternal /></a>
            : r.sourceUrl ? <a className="btn ghost" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">Recette d'origine <IconExternal /></a> : <span />}
        </div>
        {r.catalog && <p className="muted small">Le lien ouvre une recherche sur le site HelloFresh : les recettes d'Élan sont originales et ne sont pas liées à HelloFresh.</p>}
        {!r.catalog && user && (
          <div className="grid2">
            <button className="btn ghost" onClick={() => setEdit(true)}>Modifier</button>
            <button className="btn danger" onClick={() => setDel(true)}>Supprimer</button>
          </div>
        )}
      </main>
      {plan && <PlanSheet onClose={() => setPlan(false)} onSave={async (day, moment) => { await actions.setSlot({ day, moment, recipe_id: r.id, portions }); setPlan(false); toast('🗓️', 'Ajoutée au menu') }} today={today} />}
      {log && <RecipeLogSheet recipeId={r.id} onClose={() => setLog(false)} />}
      {edit && user && <UserRecipeSheet initial={user} onClose={() => setEdit(false)} />}
      {del && <Confirm danger title="Supprimer cette recette ?" confirmLabel="Supprimer" text="Les repas déjà notés restent dans ton journal." onClose={() => setDel(false)} onConfirm={async () => { await actions.deleteUserRecipe(r.id); navigate('/repas?onglet=recettes', true) }} />}
    </>
  )
}

function PlanSheet({ onClose, onSave, today }: { onClose: () => void; onSave: (day: Day, moment: 'midi' | 'soir') => void; today: Day }) {
  const [week, setWeek] = useState<'cette' | 'prochaine'>('cette')
  const ws = week === 'cette' ? weekStart(today) : addDays(weekStart(today), 7)
  const [day, setDay] = useState<Day>(today)
  const [moment, setMoment] = useState<'midi' | 'soir'>('soir')
  return (
    <Sheet title="Ajouter au menu" onClose={onClose}>
      <Chips label="Semaine" value={week} onChange={v => { if (v) { setWeek(v); setDay(v === 'cette' ? today : addDays(weekStart(today), 7)) } }} options={[{ id: 'cette', label: 'Cette semaine' }, { id: 'prochaine', label: 'Semaine prochaine' }]} />
      <Chips label="Jour" value={day} onChange={v => v && setDay(v)} options={Array.from({ length: 7 }, (_, i) => ({ id: addDays(ws, i), label: WEEKDAYS[i].slice(0, 3) + '.' }))} />
      <Chips label="Moment" value={moment} onChange={v => v && setMoment(v)} options={[{ id: 'midi', label: 'Midi' }, { id: 'soir', label: 'Soir' }]} />
      <button className="btn primary block" onClick={() => onSave(day, moment)}>Ajouter</button>
    </Sheet>
  )
}
