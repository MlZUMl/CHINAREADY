import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Segmented, Sheet, Stepper, TopBar } from '../ui/components'
import { navigate } from '../lib/router'
import { addDays, formatDayLong, toDay, weekStart, WEEKDAYS, parseDay, type Day } from '../lib/dates'
import { MealSheet, MOMENTS, MARKERS, WaterWidget } from './widgets'
import { RECIPES, recipeById, shoppingList, formatQty, claudeCartPrompt } from '../domain/recipes'
import { IconBack, IconChevron, IconCopy, IconPlus, IconTrash, IconUser } from '../ui/icons'
import type { Meal } from '../data/types'

type Tab = 'journal' | 'menu' | 'recettes' | 'courses'

export function Food({ query }: { query: URLSearchParams }) {
  const tab = (query.get('onglet') as Tab) || 'journal'
  const set = (t: Tab) => navigate('/repas?onglet=' + t, true)
  return (
    <>
      <TopBar title="Repas" right={<button className="icon-btn" aria-label="Profil et réglages" onClick={() => navigate('/profil')}><IconUser /></button>} />
      <main className="content">
        <Segmented label="Sections repas" value={tab} onChange={set} options={[
          { id: 'journal', label: 'Journal' }, { id: 'menu', label: 'Menu' }, { id: 'recettes', label: 'Recettes' }, { id: 'courses', label: 'Courses' },
        ]} />
        {tab === 'journal' && <Journal />}
        {tab === 'menu' && <Menu />}
        {tab === 'recettes' && <Recipes />}
        {tab === 'courses' && <Shopping />}
      </main>
    </>
  )
}

function Journal() {
  const { snap, today } = useApp()
  const [day, setDay] = useState<Day>(today)
  const [edit, setEdit] = useState<Meal | 'new' | null>(null)
  const meals = snap.meals.filter(m => m.day === day).sort((a, b) => MOMENTS.findIndex(x => x.id === a.moment) - MOMENTS.findIndex(x => x.id === b.moment))
  return (
    <>
      <div className="row between">
        <button className="icon-btn" aria-label="Jour précédent" onClick={() => setDay(addDays(day, -1))}><IconBack /></button>
        <strong>{day === today ? 'Aujourd\'hui' : formatDayLong(day)}</strong>
        <button className="icon-btn" aria-label="Jour suivant" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}><IconChevron /></button>
      </div>
      <section className="card">
        <div className="card-head"><div><h2>Mes repas</h2><p className="muted small">Sans chiffres : juste garder le fil. La version minimale, c'est le nom du plat.</p></div></div>
        {!meals.length && <p className="empty">Rien de noté pour ce jour.</p>}
        <div className="list">
          {meals.map(m => (
            <button key={m.id} className="list-item" style={{ border: 0, borderBottom: '1px solid var(--ligne)', background: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }} onClick={() => setEdit(m)}>
              <span className="emoji-bubble" aria-hidden="true">{m.recipe_id ? recipeById(m.recipe_id, snap.user_recipes)?.emoji ?? '🍽️' : '🍽️'}</span>
              <span className="grow">
                <span className="title" style={{ display: 'block' }}>{m.title}</span>
                <span className="muted small">{MOMENTS.find(x => x.id === m.moment)?.label}{m.markers.length ? ' · ' + m.markers.map(k => MARKERS.find(x => x.id === k)?.label).join(', ') : ''}</span>
              </span>
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={() => setEdit('new')}><IconPlus /> Noter un repas</button>
      </section>
      <WaterWidget day={day} />
      {edit && <MealSheet day={day} meal={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function Menu() {
  const { snap, today, actions } = useApp()
  const [week, setWeek] = useState(weekStart(today))
  const [pick, setPick] = useState<{ day: Day; moment: 'midi' | 'soir' } | null>(null)
  const plan = actions.planFor(week)
  const portions = snap.profiles[0]?.portions ?? 1
  return (
    <>
      <div className="row between">
        <button className="icon-btn" aria-label="Semaine précédente" onClick={() => setWeek(addDays(week, -7))}><IconBack /></button>
        <strong>Semaine du {parseDay(week).getDate()} {formatDayLong(week).split(' ').slice(2).join(' ')}</strong>
        <button className="icon-btn" aria-label="Semaine suivante" onClick={() => setWeek(addDays(week, 7))}><IconChevron /></button>
      </div>
      <div className="row">
        <button className="btn secondary sm" onClick={() => actions.autoFillWeek(week, portions)}>Compléter les dîners</button>
        <button className="btn ghost sm" onClick={() => navigate('/repas?onglet=courses')}>Liste de courses</button>
      </div>
      {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d, i) => (
        <section className="card flat" key={d} style={d === today ? { borderColor: 'var(--vieux-rose)' } : undefined}>
          <strong>{WEEKDAYS[i][0].toUpperCase() + WEEKDAYS[i].slice(1)} {parseDay(d).getDate()}</strong>
          {(['midi', 'soir'] as const).map(moment => {
            const slot = plan.slots.find(s => s.day === d && s.moment === moment)
            const r = slot ? recipeById(slot.recipe_id, snap.user_recipes) : undefined
            return (
              <div className="row" key={moment}>
                <span className="muted small" style={{ width: 44 }}>{moment === 'midi' ? 'Midi' : 'Soir'}</span>
                {r ? (
                  <>
                    <button className="chip soft on" style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0 }} onClick={() => navigate('/repas/recette/' + r.id)}>
                      <span aria-hidden="true">{r.emoji}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                    </button>
                    <span className="small muted">×{slot!.portions}</span>
                    <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Retirer du menu" onClick={() => actions.removeSlot(d, moment)}><IconTrash style={{ width: 18 }} /></button>
                  </>
                ) : (
                  <button className="chip" style={{ flex: 1 }} onClick={() => setPick({ day: d, moment })}><IconPlus style={{ width: 16 }} /> Choisir une recette</button>
                )}
              </div>
            )
          })}
        </section>
      ))}
      {pick && <RecipePicker onClose={() => setPick(null)} onPick={(id, n) => { actions.setSlot({ ...pick, recipe_id: id, portions: n }); setPick(null) }} />}
    </>
  )
}

const FILTERS = [
  { id: 'rapide', label: 'Rapide' }, { id: 'vegetarien', label: 'Végétarien' }, { id: 'poulet', label: 'Poulet' }, { id: 'poisson', label: 'Poisson' },
  { id: 'boeuf', label: 'Bœuf' }, { id: 'batch', label: 'À préparer d\'avance' }, { id: 'reconfort', label: 'Réconfort' }, { id: 'plaisir', label: 'Plaisir' },
]

function useRecipeSearch() {
  const { snap } = useApp()
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<string[]>([])
  const list = useMemo(() => {
    const all = [...RECIPES, ...snap.user_recipes.map(u => ({ ...u, emoji: '📝', moment: 'midi-soir' as const, minutes: u.minutes ?? 0, markers: [] }))]
    return all.filter(r => (!q || r.title.toLowerCase().includes(q.toLowerCase())) && filters.every(f => r.tags.includes(f)))
  }, [q, filters, snap.user_recipes])
  return { q, setQ, filters, setFilters, list }
}

function RecipePicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string, portions: number) => void }) {
  const { snap } = useApp()
  const { q, setQ, filters, setFilters, list } = useRecipeSearch()
  const [n, setN] = useState(snap.profiles[0]?.portions ?? 1)
  return (
    <Sheet title="Choisir une recette" onClose={onClose}>
      <input className="input" placeholder="Rechercher" value={q} onChange={e => setQ(e.target.value)} />
      <Chips label="Filtres" multi soft value={filters} onChange={setFilters} options={FILTERS} />
      <div className="row between"><strong>Portions</strong><Stepper label="Portions" value={n} min={1} max={8} onChange={setN} /></div>
      <div className="list">
        {list.map(r => (
          <button key={r.id} className="list-item" style={{ border: 0, borderBottom: '1px solid var(--ligne)', background: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }} onClick={() => onPick(r.id, n)}>
            <span className="emoji-bubble" aria-hidden="true">{r.emoji}</span>
            <span className="grow"><span className="title" style={{ display: 'block' }}>{r.title}</span><span className="muted small">{r.minutes ? r.minutes + ' min' : ''}</span></span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function Recipes() {
  const { q, setQ, filters, setFilters, list } = useRecipeSearch()
  const [create, setCreate] = useState(false)
  return (
    <>
      <input className="input" placeholder="Rechercher une recette" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher une recette" />
      <Chips label="Filtres" multi soft value={filters} onChange={setFilters} options={FILTERS} />
      <p className="muted small">Toutes les recettes sont halal. Quantités pour une portion, ajustables.</p>
      <section className="card">
        <div className="list">
          {list.map(r => (
            <button key={r.id} className="list-item" style={{ border: 0, borderBottom: '1px solid var(--ligne)', background: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }} onClick={() => navigate('/repas/recette/' + r.id)}>
              <span className="emoji-bubble" aria-hidden="true">{r.emoji}</span>
              <span className="grow"><span className="title" style={{ display: 'block' }}>{r.title}</span>
                <span className="muted small">{r.minutes ? r.minutes + ' min · ' : ''}{r.tags.slice(0, 3).join(' · ')}</span></span>
              <IconChevron style={{ width: 18, color: 'var(--texte-doux)' }} />
            </button>
          ))}
          {!list.length && <p className="empty">Aucune recette avec ces filtres.</p>}
        </div>
      </section>
      <button className="btn secondary" onClick={() => setCreate(true)}><IconPlus /> Ajouter ma propre recette</button>
      {create && <UserRecipeSheet onClose={() => setCreate(false)} />}
    </>
  )
}

function UserRecipeSheet({ onClose }: { onClose: () => void }) {
  const { actions } = useApp()
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [servings, setServings] = useState(2)
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const save = async () => {
    if (!title.trim()) return
    await actions.saveUserRecipe({
      id: 'perso-' + Date.now().toString(36), title: title.trim(), minutes, servings,
      ingredients: ingredients.split('\n').map(l => l.trim()).filter(Boolean).map(name => ({ name, qty: null, unit: '', aisle: 'Mes ingrédients' })),
      steps: steps.split('\n').map(l => l.trim()).filter(Boolean), tags: ['perso'],
    })
    onClose()
  }
  return (
    <Sheet title="Ma recette" onClose={onClose}>
      <label className="field">Nom<input className="input" value={title} onChange={e => setTitle(e.target.value)} /></label>
      <div className="row between"><strong>Temps</strong><Stepper label="Temps" value={minutes} min={5} max={240} step={5} onChange={setMinutes} format={v => v + ' min'} /></div>
      <div className="row between"><strong>Pour</strong><Stepper label="Portions" value={servings} min={1} max={12} onChange={setServings} format={v => v + ' pers.'} /></div>
      <label className="field">Ingrédients <span className="hint">Un par ligne, ex. « 200 g de poulet halal »</span><textarea className="input" value={ingredients} onChange={e => setIngredients(e.target.value)} /></label>
      <label className="field">Étapes <span className="hint">Une par ligne</span><textarea className="input" value={steps} onChange={e => setSteps(e.target.value)} /></label>
      <button className="btn primary block" onClick={save} disabled={!title.trim()}>Enregistrer</button>
    </Sheet>
  )
}

function Shopping() {
  const { snap, today, actions, toast } = useApp()
  const [week, setWeek] = useState(weekStart(today))
  const plan = snap.meal_plans.find(p => p.week_start === week)
  const items = shoppingList(plan, snap.user_recipes)
  const byAisle = items.reduce<Record<string, typeof items>>((acc, i) => { (acc[i.aisle] ??= []).push(i); return acc }, {})
  const copy = async () => {
    const text = claudeCartPrompt(items.filter(i => !plan?.checked.includes(i.key)))
    try { await navigator.clipboard.writeText(text); toast('📋', 'Liste copiée : colle-la à Claude dans Chrome') }
    catch { toast('⚠️', 'Copie impossible : sélectionne le texte manuellement') }
  }
  return (
    <>
      <div className="row between">
        <button className="icon-btn" aria-label="Semaine précédente" onClick={() => setWeek(addDays(week, -7))}><IconBack /></button>
        <strong>Semaine du {parseDay(week).getDate()} {formatDayLong(week).split(' ').slice(2).join(' ')}</strong>
        <button className="icon-btn" aria-label="Semaine suivante" onClick={() => setWeek(addDays(week, 7))}><IconChevron /></button>
      </div>
      {!items.length ? (
        <section className="card"><p className="empty">Ajoute des recettes au menu de la semaine : la liste se remplit toute seule.</p>
          <button className="btn secondary" onClick={() => navigate('/repas?onglet=menu')}>Aller au menu</button></section>
      ) : (
        <>
          <section className="card prune">
            <h3>Faire remplir le panier par Claude</h3>
            <p className="muted">Copie la liste, puis colle-la à Claude dans Chrome, sur le site de ton drive. Il ajoute les produits (halal pour la viande) et te laisse valider toi-même la commande.</p>
            <button className="btn white" onClick={copy}><IconCopy /> Copier la liste pour Claude</button>
          </section>
          {Object.entries(byAisle).map(([aisle, list]) => (
            <section className="card" key={aisle}>
              <h3>{aisle}</h3>
              {list.map(i => {
                const done = plan?.checked.includes(i.key)
                return (
                  <label key={i.key} className={`check-row ${done ? 'done' : ''}`}>
                    <input type="checkbox" checked={Boolean(done)} onChange={() => actions.toggleShopping(week, i.key)} />
                    <span className="grow" style={{ flex: 1 }}><strong>{i.name}</strong> <span className="muted small">{formatQty(i)}</span></span>
                  </label>
                )
              })}
            </section>
          ))}
        </>
      )}
    </>
  )
}

export function todayStr() { return toDay() }
