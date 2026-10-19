import { useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Confirm, Sheet, Stepper, TopBar } from '../ui/components'
import { recipeById, formatQty, RECIPES } from '../domain/recipes'
import { addDays, weekStart, WEEKDAYS, type Day } from '../lib/dates'
import { MealSheet } from './widgets'
import { navigate } from '../lib/router'

export function RecipeDetail({ id }: { id: string }) {
  const { snap, today, actions, toast } = useApp()
  const r = recipeById(id, snap.user_recipes)
  const [portions, setPortions] = useState(snap.profiles[0]?.portions ?? 1)
  const [plan, setPlan] = useState(false)
  const [cooked, setCooked] = useState(false)
  const [del, setDel] = useState(false)
  if (!r) return <><TopBar onBack title="Recette introuvable" /><main className="content no-tabs"><p className="empty">Cette recette n'existe plus.</p></main></>
  const isCatalog = RECIPES.some(x => x.id === r.id)
  const base = isCatalog ? 1 : Math.max(1, (r as any).servings ?? 1)
  return (
    <>
      <TopBar onBack title={r.title} kicker={r.minutes ? `${r.minutes} min` : undefined} />
      <main className="content no-tabs">
        <section className="card tint">
          <div className="row"><div className="recipe-hero" aria-hidden="true">{r.emoji}</div>
            <div className="stack" style={{ gap: 6 }}><div className="chips">{r.tags.map(t => <span key={t} className="pill">{t}</span>)}</div>
              {isCatalog && <span className="muted small">Halal · sans porc ni alcool</span>}</div></div>
        </section>
        <section className="card">
          <div className="row between"><h2>Ingrédients</h2><Stepper label="Portions" value={portions} min={1} max={8} onChange={setPortions} format={v => v + ' pers.'} /></div>
          <div className="list">
            {r.ingredients.map(i => (
              <div className="list-item" key={i.name} style={{ minHeight: 44, padding: '8px 0' }}>
                <span className="grow">{i.name}</span>
                <span className="muted small">{formatQty({ qty: i.qty === null ? null : Math.round((i.qty * portions / base) * 100) / 100, unit: i.unit })}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Étapes</h2>
          <ol className="steps">{r.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
        </section>
        <div className="grid2">
          <button className="btn secondary" onClick={() => setPlan(true)}>Ajouter au menu</button>
          <button className="btn primary" onClick={() => setCooked(true)}>Je l'ai cuisinée</button>
        </div>
        {!isCatalog && <button className="btn danger" onClick={() => setDel(true)}>Supprimer ma recette</button>}
      </main>
      {plan && <PlanSheet onClose={() => setPlan(false)} onSave={async (day, moment) => { await actions.setSlot({ day, moment, recipe_id: r.id, portions }); setPlan(false); toast('🗓️', 'Ajoutée au menu') }} today={today} />}
      {cooked && <MealSheet day={today} onClose={() => setCooked(false)} preset={{ title: r.title, recipe_id: r.id, markers: (r as any).markers ?? ['fait_maison'] }} />}
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
