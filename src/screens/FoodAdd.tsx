// Ajouter au journal : recherche (Ciqual puis marques Open Food Facts), code-barres,
// mes aliments, recettes, ajout rapide. Tout aliment contenant du porc est refusé.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../app/state'
import { Segmented, TopBar } from '../ui/components'
import { IconChevron, IconPlus, IconSearch } from '../ui/icons'
import type { CustomFood, FoodEntry, MealSlot } from '../data/types'
import { customToItem, loadCiqual, searchFoods, searchOff, type FoodItem } from '../domain/foods'
import { allRecipes } from '../domain/recipes'
import { defaultMealSlot, MEALS, mealLabel } from '../domain/nutrition'
import { toDay, type Day } from '../lib/dates'
import { BarcodeScanner, CustomFoodSheet, entryToItem, lookupBarcode, MealChips, QuantitySheet, QuickAddForm, RecipeLogSheet, Thumb, smallPhoto } from './food-parts'

type Tab = 'chercher' | 'scanner' | 'mes' | 'recettes' | 'rapide'

export function FoodAdd({ query }: { query: URLSearchParams }) {
  const { today } = useApp()
  const day = (query.get('jour') as Day) || today
  const [meal, setMeal] = useState<MealSlot>((query.get('repas') as MealSlot) || defaultMealSlot())
  const [tab, setTab] = useState<Tab>((query.get('onglet') as Tab) || 'chercher')
  const [pick, setPick] = useState<{ item: FoodItem } | null>(null)
  return (
    <>
      <TopBar onBack title={`Ajouter · ${mealLabel(meal)}`} kicker={day === toDay() ? 'Aujourd\'hui' : day.split('-').reverse().join('/')} />
      <main className="content no-tabs">
        <MealChips value={meal} onChange={setMeal} />
        <Segmented label="Façons d'ajouter" value={tab} onChange={setTab} options={[
          { id: 'chercher', label: 'Rechercher' }, { id: 'scanner', label: 'Scanner' }, { id: 'mes', label: 'Mes aliments' },
          { id: 'recettes', label: 'Recettes' }, { id: 'rapide', label: 'Rapide' },
        ]} />
        {tab === 'chercher' && <SearchTab onPick={item => setPick({ item })} />}
        {tab === 'scanner' && <ScanTab onPick={item => setPick({ item })} />}
        {tab === 'mes' && <MineTab onPick={item => setPick({ item })} />}
        {tab === 'recettes' && <RecipesTab day={day} meal={meal} />}
        {tab === 'rapide' && <section className="card"><QuickAddForm day={day} meal={meal} onDone={() => history.back()} /></section>}
      </main>
      {pick && <QuantitySheet item={pick.item} day={day} meal={meal} onClose={() => setPick(null)} />}
    </>
  )
}

// ------------------------------------------------------------------ recherche
function SearchTab({ onPick }: { onPick: (item: FoodItem) => void }) {
  const { snap } = useApp()
  const [q, setQ] = useState('')
  const [ciqual, setCiqual] = useState<FoodItem[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [off, setOff] = useState<{ q: string; items: FoodItem[] } | null>(null)
  const [offState, setOffState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [offError, setOffError] = useState('')
  const abort = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { loadCiqual().then(setCiqual).catch(() => setLoadError(true)) }, [])
  useEffect(() => { input.current?.focus() }, [])

  const results = useMemo(() => {
    if (!ciqual || q.trim().length < 2) return []
    const mine = snap.custom_foods.map(customToItem)
    return [...searchFoods(mine, q, 5), ...searchFoods(ciqual, q, 40)]
  }, [ciqual, q, snap.custom_foods])

  const recents = useMemo(() => {
    const seen = new Set<string>()
    const out: { item: FoodItem; entry: FoodEntry }[] = []
    for (const e of [...snap.food_entries].sort((a, b) => b.at.localeCompare(a.at))) {
      const key = `${e.source}:${e.ref}:${e.name}`
      if (seen.has(key) || !e.per100) continue
      seen.add(key)
      const item = entryToItem(e)
      if (item) out.push({ item, entry: e })
      if (out.length >= 12) break
    }
    return out
  }, [snap.food_entries])

  const searchBrands = async () => {
    const term = q.trim()
    if (term.length < 2) return
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setOffState('loading')
    try {
      const items = await searchOff(term, ctrl.signal)
      setOff({ q: term, items })
      setOffState('idle')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setOffError((e as Error).message || 'Recherche impossible pour le moment.')
      setOffState('error')
    }
  }

  return (
    <>
      <div className="row" style={{ position: 'relative' }}>
        <IconSearch style={{ position: 'absolute', left: 14, width: 20, color: 'var(--texte-doux)' }} />
        <input ref={input} className="input" style={{ paddingLeft: 42 }} placeholder="Ex. : pomme, riz basmati, yaourt…" value={q}
          onChange={e => { setQ(e.target.value); setOff(null); setOffState('idle') }} aria-label="Rechercher un aliment" enterKeyHint="search" />
      </div>
      {loadError && <div className="warn">La table des aliments n'a pas pu être chargée. Vérifie ta connexion puis réessaie.</div>}
      {q.trim().length < 2 ? (
        recents.length === 0 ? <p className="muted small">Tape au moins deux lettres : les aliments courants (table Ciqual) s'affichent tout de suite, et tu peux aussi chercher parmi les marques ou scanner un code-barres.</p> : (
          <section className="card">
            <div className="kicker-nuit">Récemment ajoutés</div>
            <div className="list">{recents.map(({ item, entry }) => <FoodRow key={entry.id} item={item} sub={`${entry.portion_label ?? `${entry.quantity} ${entry.unit}`} · ${Math.round(entry.kcal)} kcal`} onClick={() => onPick(item)} />)}</div>
          </section>
        )
      ) : (
        <>
          <section className="card" aria-label="Résultats">
            <div className="kicker-nuit">Aliments courants · table Ciqual</div>
            {!ciqual && !loadError && <p className="muted small">Chargement…</p>}
            {ciqual && !results.length && <p className="empty">Aucun aliment courant ne correspond. Essaie un autre mot, ou cherche parmi les marques.</p>}
            <div className="list">{results.map(it => <FoodRow key={it.source + it.ref} item={it} onClick={() => onPick(it)} />)}</div>
          </section>
          <section className="card" aria-label="Produits de marque">
            <div className="kicker-nuit">Produits de marque · Open Food Facts</div>
            {!off && offState !== 'loading' && <button className="btn secondary" onClick={searchBrands}><IconSearch /> Chercher « {q.trim()} » parmi les marques</button>}
            {offState === 'loading' && <p className="muted small">Recherche en cours…</p>}
            {offState === 'error' && <><div className="warn">{offError}</div><button className="btn ghost sm" onClick={searchBrands}>Réessayer</button></>}
            {off && !off.items.length && <p className="empty">Aucun produit trouvé. Tu peux scanner son code-barres ou le créer dans « Mes aliments ».</p>}
            {off && off.items.length > 0 && <p className="muted small">Les produits contenant du porc sont retirés automatiquement.</p>}
            <div className="list">{off?.items.map(it => <FoodRow key={'off' + it.ref} item={it} onClick={() => onPick(it)} />)}</div>
          </section>
        </>
      )}
    </>
  )
}

export function FoodRow({ item, sub, onClick }: { item: FoodItem; sub?: string; onClick: () => void }) {
  return (
    <button className="entry" onClick={onClick}>
      {item.image ? <Thumb src={item.image} emoji="🛒" /> : null}
      <span className="grow">
        <span className="name">{item.name}</span>
        <span className="muted small">{sub ?? `${item.brand ? item.brand + ' · ' : ''}${Math.round(item.per100.kcal)} kcal / 100 ${item.liquid ? 'ml' : 'g'}${item.source === 'perso' ? ' · mon aliment' : ''}${item.pork === 'inconnu' ? ' · composition à vérifier' : ''}`}</span>
      </span>
      <IconPlus style={{ width: 20, color: 'var(--vert)' }} />
    </button>
  )
}

// ------------------------------------------------------------------ code-barres
function ScanTab({ onPick }: { onPick: (item: FoodItem) => void }) {
  const { snap } = useApp()
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'loading'; code: string } | { kind: 'unknown'; code: string } | { kind: 'porc'; item: FoodItem } | { kind: 'error'; code: string }>({ kind: 'idle' })
  const [create, setCreate] = useState<string | null>(null)
  const handle = async (code: string) => {
    setState({ kind: 'loading', code })
    try {
      const item = await lookupBarcode(code, snap.custom_foods)
      if (!item) setState({ kind: 'unknown', code })
      else if (item.pork === 'porc') setState({ kind: 'porc', item })
      else { setState({ kind: 'idle' }); onPick(item) }
    } catch { setState({ kind: 'error', code }) }
  }
  return (
    <section className="card">
      <p className="muted small">Scanne le code-barres d'un produit emballé : ses valeurs viennent d'Open Food Facts (ou de tes aliments).</p>
      <BarcodeScanner onCode={handle} />
      {state.kind === 'loading' && <p className="muted small">Recherche du produit {state.code}…</p>}
      {state.kind === 'porc' && <div className="warn" role="alert">⛔ « {state.item.name} » contient du porc : il ne peut pas être ajouté.</div>}
      {state.kind === 'unknown' && (
        <div className="stack">
          <div className="warn">Produit {state.code} inconnu. Tu peux le créer avec les valeurs de l'étiquette : il sera reconnu la prochaine fois.</div>
          <button className="btn secondary" onClick={() => setCreate(state.code)}><IconPlus /> Créer ce produit</button>
        </div>
      )}
      {state.kind === 'error' && <div className="warn">Open Food Facts ne répond pas (connexion ?). Réessaie, ou utilise l'ajout rapide.</div>}
      {create && <CustomFoodSheet barcode={create} onClose={() => setCreate(null)} onSaved={item => { setState({ kind: 'idle' }); onPick(item) }} />}
    </section>
  )
}

// ------------------------------------------------------------------ mes aliments
function MineTab({ onPick }: { onPick: (item: FoodItem) => void }) {
  const { snap, actions } = useApp()
  const [edit, setEdit] = useState<CustomFood | 'new' | null>(null)
  return (
    <>
      <section className="card">
        {!snap.custom_foods.length && <p className="empty">Crée ici les produits introuvables ou tes préparations maison.</p>}
        <div className="list">
          {[...snap.custom_foods].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
            <div key={c.id} className="row" style={{ gap: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}><FoodRow item={customToItem(c)} onClick={() => onPick(customToItem(c))} /></div>
              <button className="link-btn small" onClick={() => setEdit(c)}>Modifier</button>
            </div>
          ))}
        </div>
      </section>
      <button className="btn secondary" onClick={() => setEdit('new')}><IconPlus /> Créer un aliment</button>
      {edit && <CustomFoodSheet initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} onDelete={edit === 'new' ? undefined : async () => { await actions.deleteCustomFood(edit.id); setEdit(null) }} />}
    </>
  )
}

// ------------------------------------------------------------------ recettes
function RecipesTab({ day, meal }: { day: Day; meal: MealSlot }) {
  const { snap } = useApp()
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const list = useMemo(() => allRecipes(snap.user_recipes).filter(r => !q || r.title.toLowerCase().includes(q.toLowerCase())), [q, snap.user_recipes])
  return (
    <>
      <input className="input" placeholder="Rechercher une recette" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher une recette" />
      <section className="card">
        <div className="list">
          {list.map(r => (
            <button key={r.id} className="entry" onClick={() => setPick(r.id)}>
              <Thumb src={r.photo ? smallPhoto(r.photo.url, 200) : null} emoji={r.emoji} />
              <span className="grow"><span className="name">{r.title}</span><span className="muted small">{r.nutrition ? `${r.nutrition.kcal} kcal / portion` : 'valeurs non renseignées'}{r.minutes ? ` · ${r.minutes} min` : ''}</span></span>
              <IconChevron style={{ width: 18, color: 'var(--texte-doux)' }} />
            </button>
          ))}
        </div>
      </section>
      {pick && <RecipeLogSheet recipeId={pick} day={day} meal={meal} onClose={() => setPick(null)} />}
    </>
  )
}

export const MEAL_IDS = MEALS.map(m => m.id)
