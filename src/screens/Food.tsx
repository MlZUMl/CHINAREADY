import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Segmented, Sheet, Stepper, Toggle, TopBar } from '../ui/components'
import { navigate } from '../lib/router'
import { addDays, formatDayLong, toDay, weekStart, WEEKDAYS, parseDay, type Day } from '../lib/dates'
import { WaterWidget } from './widgets'
import { allRecipes, recipeById, shoppingList, formatQty, claudeCartPrompt, formatEuros, type Recipe } from '../domain/recipes'
import { IconBack, IconCart, IconChevron, IconCopy, IconPlus, IconRefresh, IconStar, IconTrash, IconUser } from '../ui/icons'
import type { FoodEntry, MealSlot, PlanSlot } from '../data/types'
import { ALLERGENS, MOMENTS, SNACK_SHARE, buildWeekMenu, plannedKcal, swapFor, type Moment } from '../domain/menu'
import { copySources, favoriteKcal, favoritesFor, suggestFavoriteName } from '../domain/journal'
import { MEALS, entriesOn, mealTarget, calorieGoal, sumEntries, fmtKcal, toMeal, mealLabel } from '../domain/nutrition'
import { CalorieSummary, GoalSheet, QuantitySheet, QuickAddSheet, RecipeLogSheet, Thumb, entryToItem, smallPhoto } from './food-parts'
import { recipeHasPork } from '../domain/pork'

type Tab = 'journal' | 'recettes' | 'menu' | 'courses'

export function Food({ query }: { query: URLSearchParams }) {
  const tab = (query.get('onglet') as Tab) || 'journal'
  const set = (t: Tab) => navigate('/repas?onglet=' + t, true)
  return (
    <>
      <TopBar title="Repas" right={<button className="icon-btn" aria-label="Profil et réglages" onClick={() => navigate('/profil')}><IconUser /></button>} />
      <main className="content">
        <Segmented label="Sections repas" value={tab} onChange={set} options={[
          { id: 'journal', label: 'Journal' }, { id: 'recettes', label: 'Recettes' }, { id: 'menu', label: 'Menu' }, { id: 'courses', label: 'Courses' },
        ]} />
        {tab === 'journal' && <Journal query={query} />}
        {tab === 'menu' && <Menu />}
        {tab === 'recettes' && <Recipes />}
        {tab === 'courses' && <Shopping />}
      </main>
    </>
  )
}

// ------------------------------------------------------------------ journal (façon Foodvisor)
function Journal({ query }: { query: URLSearchParams }) {
  const { snap, today, actions } = useApp()
  const [day, setDayState] = useState<Day>((query.get('jour') as Day) || today)
  const setDay = (d: Day) => { setDayState(d); history.replaceState(null, '', `#/repas?onglet=journal&jour=${d}`) }
  const [goalOpen, setGoalOpen] = useState(false)
  const [edit, setEdit] = useState<FoodEntry | null>(null)
  const [tools, setTools] = useState<MealSlot | null>(null)
  const goal = calorieGoal(snap, today).goal
  const entries = entriesOn(snap, day)
  const legacy = snap.meals.filter(m => m.day === day)
  const item = edit ? entryToItem(edit) : null
  return (
    <>
      <div className="row between">
        <button className="icon-btn" aria-label="Jour précédent" onClick={() => setDay(addDays(day, -1))}><IconBack /></button>
        <strong>{day === today ? 'Aujourd\'hui' : day === addDays(today, -1) ? 'Hier' : formatDayLong(day)}</strong>
        <button className="icon-btn" aria-label="Jour suivant" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}><IconChevron /></button>
      </div>
      <CalorieSummary day={day} onGoal={() => setGoalOpen(true)} />
      {MEALS.map(m => {
        const list = entries.filter(e => e.meal === m.id)
        const tot = sumEntries(list)
        return (
          <section className="card meal-card" key={m.id} aria-label={m.label}>
            <div className="meal-head">
              <span className="emoji-bubble" aria-hidden="true">{m.emoji}</span>
              <div><h3>{m.label}</h3><span className="muted small" data-testid={`total-${m.id}`}>{fmtKcal(tot.kcal)}{goal ? ` / ${fmtKcal(mealTarget(goal, m.id))}` : ''}</span></div>
              <button className="icon-btn" aria-label={`Ajouter ${toMeal(m.id)}`} style={{ background: 'var(--vert)', color: '#fff' }}
                onClick={() => navigate(`/repas/ajouter?repas=${m.id}&jour=${day}`)}><IconPlus /></button>
            </div>
            {!list.length && <QuickRepeat day={day} meal={m.id} onMore={() => setTools(m.id)} />}
            {list.map(e => (
              <button key={e.id} className="entry" onClick={() => setEdit(e)}>
                <span className="grow">
                  <span className="name">{e.name}</span>
                  <span className="muted small">{e.source === 'rapide' ? 'ajout rapide' : e.unit === 'portion' ? (e.portion_label ?? `${e.quantity} portion`) : `${String(e.quantity).replace('.', ',')} ${e.unit}`}{e.brand ? ' · ' + e.brand : ''}</span>
                </span>
                <span className="kcal">{Math.round(e.kcal)} kcal</span>
              </button>
            ))}
            {list.length > 0 && (
              <div className="meal-tools">
                <button className="link-btn small" onClick={() => setTools(m.id)} aria-label={`Favoris et reprise · ${m.label}`}><IconStar style={{ width: 16 }} /> Favori · reprendre</button>
              </div>
            )}
          </section>
        )
      })}
      {legacy.length > 0 && (
        <section className="card flat">
          <div className="kicker-nuit">Notés avant le journal des calories</div>
          {legacy.map(m => (
            <div key={m.id} className="entry" style={{ cursor: 'default' }}>
              <span className="grow"><span className="name">{m.title}</span><span className="muted small">sans calories</span></span>
              <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`Supprimer ${m.title}`} onClick={() => actions.deleteMeal(m.id)}><IconTrash style={{ width: 18 }} /></button>
            </div>
          ))}
        </section>
      )}
      <WaterWidget day={day} />
      {goalOpen && <GoalSheet onClose={() => setGoalOpen(false)} />}
      {tools && <MealToolsSheet day={day} meal={tools} onClose={() => setTools(null)} />}
      {edit && edit.source === 'rapide' && <QuickAddSheet day={day} meal={edit.meal} entry={edit} onClose={() => setEdit(null)} />}
      {edit && edit.source === 'recette' && edit.ref && <RecipeLogSheet recipeId={edit.ref} day={edit.day} meal={edit.meal} portions={edit.quantity} onClose={() => setEdit(null)} />}
      {edit && edit.source !== 'rapide' && edit.source !== 'recette' && item && <QuantitySheet item={item} entry={edit} day={edit.day} meal={edit.meal} onClose={() => setEdit(null)} />}
    </>
  )
}

const shortDay = (d: Day, today: Day) => d === addDays(today, -1) ? 'Hier' : d === addDays(today, -2) ? 'Avant-hier' : formatDayLong(d)

/** Repas vide : proposer en un geste le même repas de la veille (ou du dernier jour noté). */
function QuickRepeat({ day, meal, onMore }: { day: Day; meal: MealSlot; onMore: () => void }) {
  const { snap, today, actions, toast } = useApp()
  const src = copySources(snap, day, meal, 7, 1)[0]
  const favs = snap.favorite_meals.length
  if (!src && !favs) return null
  const repeat = async () => {
    try { const n = await actions.copyMeal(src.day, meal, day, meal); toast('↻', n > 1 ? `${n} aliments ajoutés` : 'Aliment ajouté') }
    catch { toast('⛔', 'Ce repas contient du porc : il ne peut pas être recopié.') }
  }
  return (
    <div className="meal-tools">
      {src && <button className="chip soft" onClick={repeat} aria-label={`Comme ${shortDay(src.day, day).toLowerCase()} · ${mealLabel(meal)}`}><IconRefresh style={{ width: 16 }} /> Comme {src.day === addDays(day, -1) ? 'hier' : shortDay(src.day, today).toLowerCase()} · {fmtKcal(src.kcal)}</button>}
      <button className="link-btn small" onClick={onMore} aria-label={`Favoris et reprise · ${mealLabel(meal)}`}><IconStar style={{ width: 16 }} /> {favs ? 'Favoris' : 'Autres jours'}</button>
    </div>
  )
}

/** Favoris, reprise d'un autre jour, enregistrement du repas en favori. */
function MealToolsSheet({ day, meal, onClose }: { day: Day; meal: MealSlot; onClose: () => void }) {
  const { snap, today, actions, toast } = useApp()
  const current = snap.food_entries.filter(f => f.day === day && f.meal === meal).sort((a, b) => a.at.localeCompare(b.at))
  const [name, setName] = useState(suggestFavoriteName(current))
  const [manage, setManage] = useState(false)
  const sources = copySources(snap, day, meal)
  const favs = favoritesFor(snap, meal)
  const done = (n: number) => { toast('✅', n > 1 ? `${n} aliments ajoutés ${toMeal(meal)}` : `Ajouté ${toMeal(meal)}`); onClose() }
  const fail = () => toast('⛔', 'Contient du porc : impossible de l\'ajouter.')
  const save = async () => {
    try { await actions.saveFavorite(name, meal, current); toast('⭐', 'Repas enregistré dans tes favoris'); onClose() }
    catch (e) { if ((e as Error).message === 'PORC') fail() }
  }
  return (
    <Sheet title={mealLabel(meal)} onClose={onClose}>
      {current.length > 0 && (
        <section className="stack" aria-label="Enregistrer en favori">
          <strong>Enregistrer ce repas en favori</strong>
          <p className="muted small">{current.length} aliment{current.length > 1 ? 's' : ''} · {fmtKcal(sumEntries(current).kcal)}. Tu pourras le rajouter en un geste.</p>
          <label className="field">Nom du favori<input className="input" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Ex. : mon petit-déj habituel" /></label>
          <button className="btn secondary block" disabled={!name.trim()} onClick={save}><IconStar /> Enregistrer en favori</button>
        </section>
      )}
      <section className="stack" aria-label="Mes repas favoris">
        <div className="row between"><strong>Mes repas favoris</strong>{favs.length > 0 && <button className="link-btn small" onClick={() => setManage(!manage)}>{manage ? 'Terminé' : 'Gérer'}</button>}</div>
        {!favs.length && <p className="muted small">Aucun favori pour l'instant. Note un repas que tu manges souvent, puis enregistre-le ici.</p>}
        <div className="list">
          {favs.map(f => (
            <div className="row" key={f.id} style={{ gap: 4 }}>
              <button className="entry" style={{ flex: 1, minWidth: 0 }} disabled={manage} onClick={async () => { try { done(await actions.logFavorite(f.id, day, meal)) } catch { fail() } }}>
                <span className="grow"><span className="name">{f.name}</span><span className="muted small">{f.items.map(i => i.name.split(',')[0]).join(', ')}</span></span>
                <span className="kcal">{fmtKcal(favoriteKcal(f))}</span>
              </button>
              {manage && <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`Supprimer le favori ${f.name}`} onClick={() => actions.deleteFavorite(f.id)}><IconTrash style={{ width: 18 }} /></button>}
            </div>
          ))}
        </div>
      </section>
      <section className="stack" aria-label="Reprendre un autre jour">
        <strong>Reprendre le {mealLabel(meal).toLowerCase()} d'un autre jour</strong>
        {!sources.length && <p className="muted small">Rien de noté pour ce repas ces deux dernières semaines.</p>}
        <div className="list">
          {sources.map(src => (
            <button key={src.day} className="entry" onClick={async () => { try { done(await actions.copyMeal(src.day, meal, day, meal)) } catch { fail() } }}>
              <span className="grow"><span className="name">{shortDay(src.day, today)}</span><span className="muted small">{src.entries.map(e => e.name.split(',')[0]).join(', ')}</span></span>
              <span className="kcal">{fmtKcal(src.kcal)}</span>
            </button>
          ))}
        </div>
      </section>
    </Sheet>
  )
}

// ------------------------------------------------------------------ menu de la semaine
const weekLabel = (week: Day) => `Semaine du ${parseDay(week).getDate()} ${formatDayLong(week).split(' ').slice(2).join(' ')}`

function Menu() {
  const { snap, today, actions, toast } = useApp()
  const [week, setWeek] = useState(weekStart(today))
  const [pick, setPick] = useState<{ day: Day; moment: Moment } | null>(null)
  const [gen, setGen] = useState(false)
  const [shown, setShown] = useState<Record<string, string[]>>({})
  const plan = actions.planFor(week)
  const goal = calorieGoal(snap, today).goal
  const avoid = snap.profiles[0]?.settings.menu_avoid ?? []
  const recipes = allRecipes(snap.user_recipes)
  const swap = async (slot: PlanSlot) => {
    const key = `${slot.day}:${slot.moment}`
    const seen = [...(shown[key] ?? []), slot.recipe_id]
    const next = swapFor(recipes, plan.slots, slot, goal, avoid, seen)
    if (!next) return toast('ℹ️', 'Pas d\'autre recette disponible pour ce moment.')
    setShown({ ...shown, [key]: seen })
    await actions.setSlot({ ...slot, recipe_id: next })
  }
  return (
    <>
      <div className="row between">
        <button className="icon-btn" aria-label="Semaine précédente" onClick={() => setWeek(addDays(week, -7))}><IconBack /></button>
        <strong>{weekLabel(week)}</strong>
        <button className="icon-btn" aria-label="Semaine suivante" onClick={() => setWeek(addDays(week, 7))}><IconChevron /></button>
      </div>
      <section className="card prune">
        <h3>Menu adapté à ton objectif</h3>
        <p className="muted">{goal ? `Petit-déjeuner, déjeuner et dîner choisis pour approcher ${fmtKcal(goal)} par jour, avec une collation libre. La liste de courses se remplit toute seule.` : 'Définis d\'abord ton objectif calorique : le menu sera calculé pour s\'en approcher.'}</p>
        <div className="row wrap">
          <button className="btn white" onClick={() => setGen(true)}><IconRefresh /> {plan.slots.length ? 'Recalculer le menu' : 'Créer mon menu'}</button>
          {plan.slots.length > 0 && <button className="btn ghost sm on-dark" onClick={() => navigate('/repas?onglet=courses')}><IconCart /> Liste de courses</button>}
        </div>
      </section>
      {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d, i) => {
        const tot = plannedKcal(recipes, plan.slots, d)
        const has = plan.slots.some(x => x.day === d)
        return (
          <section className="card flat" key={d} style={d === today ? { borderColor: 'var(--vert)' } : undefined} aria-label={`${WEEKDAYS[i]} ${parseDay(d).getDate()}`}>
            <div className="row between">
              <strong>{WEEKDAYS[i][0].toUpperCase() + WEEKDAYS[i].slice(1)} {parseDay(d).getDate()}</strong>
              {has && <span className="small muted" data-testid={`menu-kcal-${d}`}>≈ {fmtKcal(tot.kcal)}{goal ? ` · objectif ${fmtKcal(goal)}` : ''}</span>}
            </div>
            {goal && plan.slots.filter(x => x.day === d).length === 3 && tot.kcal < goal * (1 - SNACK_SHARE) * 0.85 && (
              <p className="muted small" style={{ margin: 0 }}>Il manque environ {fmtKcal(Math.round(goal * (1 - SNACK_SHARE) - tot.kcal))} : ajoute un féculent, un laitage ou une collation plus copieuse.</p>
            )}
            {MOMENTS.map(({ id: moment, label }) => {
              const slot = plan.slots.find(s => s.day === d && s.moment === moment)
              const r = slot ? recipeById(slot.recipe_id, snap.user_recipes) : undefined
              return (
                <div className="menu-row" key={moment}>
                  <span className="muted small">{label}{r?.nutrition ? ` · ${r.nutrition.kcal} kcal` : ''}</span>
                  {r ? (
                    <div className="row" style={{ gap: 6 }}>
                      <button className="chip soft on menu-recipe" onClick={() => navigate('/repas/recette/' + r.id)}>
                        <span aria-hidden="true">{r.emoji}</span><span>{r.title}</span>
                      </button>
                      <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`Autre idée · ${label} ${parseDay(d).getDate()}`} onClick={() => swap(slot!)}><IconRefresh style={{ width: 18 }} /></button>
                      <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Retirer du menu" onClick={() => actions.removeSlot(d, moment)}><IconTrash style={{ width: 18 }} /></button>
                    </div>
                  ) : (
                    <button className="chip" onClick={() => setPick({ day: d, moment })}><IconPlus style={{ width: 16 }} /> Choisir une recette</button>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}
      {plan.slots.length > 0 && <button className="btn ghost sm" onClick={() => actions.clearWeek(week)}>Vider le menu de la semaine</button>}
      <p className="muted small">Calories pour une portion (la tienne). Les quantités de la liste de courses suivent le nombre de portions choisi.</p>
      {pick && <RecipePicker moment={pick.moment} onClose={() => setPick(null)} onPick={(id, n) => { actions.setSlot({ ...pick, recipe_id: id, portions: n }); setPick(null) }} />}
      {gen && <MenuSheet week={week} onClose={() => setGen(false)} />}
    </>
  )
}

function MenuSheet({ week, onClose }: { week: Day; onClose: () => void }) {
  const { snap, today, actions, toast } = useApp()
  const p = snap.profiles[0]
  const goal = calorieGoal(snap, today).goal
  const plan = actions.planFor(week)
  const [moments, setMoments] = useState<Moment[]>(['matin', 'midi', 'soir'])
  const [avoid, setAvoid] = useState<string[]>(p?.settings.menu_avoid ?? [])
  const [keep, setKeep] = useState(true)
  const [portions, setPortions] = useState(p?.portions ?? 1)
  const [goalOpen, setGoalOpen] = useState(false)
  if (!goal) return (
    <Sheet title="Menu de la semaine" onClose={onClose}>
      <p>Pour composer un menu adapté, Élan a besoin de ton objectif calorique (âge, taille, poids, activité).</p>
      <button className="btn primary block" onClick={() => setGoalOpen(true)}>Définir mon objectif</button>
      {goalOpen && <GoalSheet onClose={() => setGoalOpen(false)} />}
    </Sheet>
  )
  const make = async () => {
    const slots = buildWeekMenu(allRecipes(snap.user_recipes), { goal, week, portions, moments, avoid, keep: keep ? plan.slots : [] })
    await actions.applyMenu(week, slots)
    if (p && (JSON.stringify(avoid) !== JSON.stringify(p.settings.menu_avoid ?? []))) await actions.updateProfile({ settings: { ...p.settings, menu_avoid: avoid } })
    toast('🍽️', 'Menu de la semaine prêt : la liste de courses est à jour')
    onClose()
  }
  return (
    <Sheet title="Menu de la semaine" onClose={onClose}>
      <p className="muted small">Objectif : <strong>{fmtKcal(goal)}</strong> par jour · petit-déjeuner {fmtKcal(mealTarget(goal, 'petit-dejeuner'))}, déjeuner {fmtKcal(mealTarget(goal, 'dejeuner'))}, dîner ≈ {fmtKcal(mealTarget(goal, 'diner'))}, collation libre ≈ {fmtKcal(mealTarget(goal, 'collation'))}.</p>
      <strong className="small">Repas à prévoir</strong>
      <Chips label="Repas à prévoir" multi value={moments} onChange={(v: Moment[]) => v.length && setMoments(v)} options={MOMENTS.map(m => ({ id: m.id, label: m.label === 'Matin' ? 'Petit-déjeuner' : m.label === 'Midi' ? 'Déjeuner' : 'Dîner' }))} />
      <strong className="small">À éviter <span className="muted">(allergies, intolérances)</span></strong>
      <Chips label="Allergènes à éviter" multi soft value={avoid} onChange={setAvoid} options={ALLERGENS.map(a => ({ id: a, label: a[0].toUpperCase() + a.slice(1) }))} />
      <div className="row between"><strong>Portions à cuisiner</strong><Stepper label="Portions à cuisiner" value={portions} min={1} max={8} onChange={setPortions} /></div>
      {plan.slots.length > 0 && <Toggle label="Garder les recettes déjà choisies" checked={keep} onChange={setKeep} />}
      <p className="muted small">Toutes les recettes sont sans porc. Le menu reste modifiable : touche ↻ pour une autre idée.</p>
      <button className="btn primary block" onClick={make}>Composer le menu</button>
    </Sheet>
  )
}

const FILTERS = [
  { id: 'rapide', label: 'Rapide' }, { id: 'leger', label: 'Moins de 450 kcal' }, { id: 'vegetarien', label: 'Végétarien' }, { id: 'poulet', label: 'Poulet' },
  { id: 'poisson', label: 'Poisson' }, { id: 'boeuf', label: 'Bœuf' }, { id: 'batch', label: 'À préparer d\'avance' }, { id: 'matin', label: 'Petit-déjeuner' },
  { id: 'dessert', label: 'Douceurs' }, { id: 'perso', label: 'Mes recettes' },
]

function matchesFilter(r: Recipe, f: string) {
  if (f === 'leger') return Boolean(r.nutrition && r.nutrition.kcal < 450 && r.moment === 'midi-soir')
  if (f === 'matin') return r.moment === 'matin'
  if (f === 'dessert') return r.moment === 'gouter'
  if (f === 'perso') return !r.catalog
  return r.tags.includes(f)
}

function useRecipeSearch(initial: string[] = []) {
  const { snap } = useApp()
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<string[]>(initial)
  const list = useMemo(() => {
    const words = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(Boolean)
    return allRecipes(snap.user_recipes).filter(r => {
      const hay = (r.title + ' ' + r.ingredients.map(i => i.name).join(' ')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      return words.every(w => hay.includes(w)) && filters.every(f => matchesFilter(r, f))
    })
  }, [q, filters, snap.user_recipes])
  return { q, setQ, filters, setFilters, list }
}

function RecipePicker({ moment, onClose, onPick }: { moment?: Moment; onClose: () => void; onPick: (id: string, portions: number) => void }) {
  const { snap } = useApp()
  const { q, setQ, filters, setFilters, list } = useRecipeSearch(moment === 'matin' ? ['matin'] : [])
  const [n, setN] = useState(snap.profiles[0]?.portions ?? 1)
  return (
    <Sheet title="Choisir une recette" onClose={onClose}>
      <input className="input" placeholder="Rechercher" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher" />
      <Chips label="Filtres" multi soft value={filters} onChange={setFilters} options={FILTERS} />
      <div className="row between"><strong>Portions</strong><Stepper label="Portions" value={n} min={1} max={8} onChange={setN} /></div>
      <div className="list">
        {list.map(r => (
          <button key={r.id} className="entry" onClick={() => onPick(r.id, n)}>
            <Thumb src={r.photo ? smallPhoto(r.photo.url, 200) : null} emoji={r.emoji} />
            <span className="grow"><span className="name">{r.title}</span><span className="muted small">{r.nutrition ? `${r.nutrition.kcal} kcal` : ''}{r.minutes ? ` · ${r.minutes} min` : ''}</span></span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function Recipes() {
  const { q, setQ, filters, setFilters, list } = useRecipeSearch()
  const [create, setCreate] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  return (
    <>
      <input className="input" placeholder="Rechercher une recette ou un ingrédient" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher une recette" />
      <Chips label="Filtres" multi soft value={filters} onChange={setFilters} options={FILTERS} />
      <p className="muted small">Toutes les recettes sont sans porc. Valeurs pour une portion (table Ciqual), coût estimé.</p>
      {!list.length && <p className="empty">Aucune recette avec ces filtres.</p>}
      <div className="recipe-grid">
        {list.map(r => (
          <div key={r.id} className="recipe-card" role="group" aria-label={r.title}>
            <button style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onClick={() => navigate('/repas/recette/' + r.id)}>
              <span className="ph"><Thumb className="" src={r.photo ? smallPhoto(r.photo.url, 420) : null} emoji={r.emoji} /></span>
              <span className="body">
                <span className="t">{r.title}</span>
                <span className="m">{r.nutrition ? `${r.nutrition.kcal} kcal` : 'perso'}{r.minutes ? ` · ${r.minutes} min` : ''}{r.cost ? ` · ${formatEuros(r.cost)}` : ''}</span>
              </span>
            </button>
            <button className="link-btn small" style={{ margin: '0 10px 8px', alignSelf: 'flex-start' }} onClick={() => setLog(r.id)} aria-label={`Ajouter ${r.title} au journal`}>+ Journal</button>
          </div>
        ))}
      </div>
      <button className="btn secondary" onClick={() => setCreate(true)}><IconPlus /> Ajouter ma propre recette</button>
      {create && <UserRecipeSheet onClose={() => setCreate(false)} />}
      {log && <RecipeLogSheet recipeId={log} onClose={() => setLog(null)} />}
    </>
  )
}

export function UserRecipeSheet({ onClose, initial }: { onClose: () => void; initial?: import('../data/types').UserRecipe }) {
  const { actions, toast } = useApp()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [minutes, setMinutes] = useState(initial?.minutes ?? 30)
  const [servings, setServings] = useState(initial?.servings ?? 2)
  const [ingredients, setIngredients] = useState(initial?.ingredients.map(i => i.name).join('\n') ?? '')
  const [steps, setSteps] = useState(initial?.steps.join('\n') ?? '')
  const [source, setSource] = useState(initial?.source_url ?? '')
  const [photo, setPhoto] = useState(initial?.photo_url ?? '')
  const [kcal, setKcal] = useState(initial?.nutrition ? String(initial.nutrition.kcal) : '')
  const [p, setP] = useState(initial?.nutrition ? String(initial.nutrition.protein) : '')
  const [c, setC] = useState(initial?.nutrition ? String(initial.nutrition.carbs) : '')
  const [f, setF] = useState(initial?.nutrition ? String(initial.nutrition.fat) : '')
  const draft = {
    title: title.trim(), ingredients: ingredients.split('\n').map(l => l.trim()).filter(Boolean).map(name => ({ name, qty: null, unit: '', aisle: 'Mes ingrédients' })),
    steps: steps.split('\n').map(l => l.trim()).filter(Boolean),
  }
  const pork = recipeHasPork(draft)
  const url = (u: string) => !u.trim() || /^https:\/\/\S+$/.test(u.trim())
  const num = (x: string) => { const n = Number(x.replace(',', '.')); return x.trim() && Number.isFinite(n) && n >= 0 ? n : null }
  const save = async () => {
    if (!draft.title || pork || !url(source) || !url(photo)) return
    try {
      await actions.saveUserRecipe({
        id: initial?.id ?? 'perso-' + Date.now().toString(36), ...draft, minutes, servings, tags: ['perso'],
        source_url: source.trim() || null, photo_url: photo.trim() || null,
        nutrition: num(kcal) !== null ? { kcal: num(kcal)!, protein: num(p) ?? 0, carbs: num(c) ?? 0, fat: num(f) ?? 0, fiber: 0 } : null,
      })
      toast('📝', 'Recette enregistrée')
      onClose()
    } catch { toast('⛔', 'Cette recette contient du porc : elle ne peut pas être enregistrée.') }
  }
  return (
    <Sheet title={initial ? 'Modifier ma recette' : 'Ma recette'} onClose={onClose}>
      <label className="field">Nom<input className="input" value={title} onChange={e => setTitle(e.target.value)} /></label>
      <div className="row between"><strong>Temps</strong><Stepper label="Temps" value={minutes} min={5} max={240} step={5} onChange={setMinutes} format={v => v + ' min'} /></div>
      <div className="row between"><strong>Pour</strong><Stepper label="Portions" value={servings} min={1} max={12} onChange={setServings} format={v => v + ' pers.'} /></div>
      <label className="field">Ingrédients <span className="hint">Un par ligne, ex. « 200 g de blanc de poulet »</span><textarea className="input" value={ingredients} onChange={e => setIngredients(e.target.value)} /></label>
      <label className="field">Étapes <span className="hint">Une par ligne</span><textarea className="input" value={steps} onChange={e => setSteps(e.target.value)} /></label>
      {pork && <div className="warn" role="alert">⛔ Cette recette mentionne du porc (ou un dérivé) : elle ne peut pas être enregistrée.</div>}
      <label className="field">Lien de la recette <span className="hint">Facultatif — site, vidéo…</span><input className="input" inputMode="url" value={source} onChange={e => setSource(e.target.value)} placeholder="https://…" /></label>
      <label className="field">Lien d'une photo <span className="hint">Facultatif</span><input className="input" inputMode="url" value={photo} onChange={e => setPhoto(e.target.value)} placeholder="https://…" /></label>
      {(!url(source) || !url(photo)) && <p className="muted small">Les liens doivent commencer par https://</p>}
      <strong className="small">Valeurs pour une portion <span className="muted">(facultatif, pour compter les calories)</span></strong>
      <div className="grid2">
        <label className="field small">Calories (kcal)<input className="input" inputMode="numeric" value={kcal} onChange={e => setKcal(e.target.value)} /></label>
        <label className="field small">Protéines (g)<input className="input" inputMode="decimal" value={p} onChange={e => setP(e.target.value)} /></label>
        <label className="field small">Glucides (g)<input className="input" inputMode="decimal" value={c} onChange={e => setC(e.target.value)} /></label>
        <label className="field small">Lipides (g)<input className="input" inputMode="decimal" value={f} onChange={e => setF(e.target.value)} /></label>
      </div>
      <button className="btn primary block" onClick={save} disabled={!draft.title || pork || !url(source) || !url(photo)}>Enregistrer</button>
    </Sheet>
  )
}

// ------------------------------------------------------------------ courses
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
            <p className="muted">Copie la liste, puis colle-la à Claude dans Chrome, sur le site de ton drive. Il ajoute les produits (sans porc) et te laisse valider toi-même la commande.</p>
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
