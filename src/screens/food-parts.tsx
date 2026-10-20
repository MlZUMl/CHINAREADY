// Briques du journal alimentaire : résumé calorique, feuilles d'ajout (quantité, ajout rapide,
// aliment personnel, recette), objectif calorique, lecteur de code-barres, vignettes photo.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Ring, Sheet, Stepper, Toggle } from '../ui/components'
import { IconScan } from '../ui/icons'
import type { CustomFood, FoodEntry, MealSlot, Nutrients } from '../data/types'
import type { FoodItem } from '../domain/foods'
import { productByBarcode, customToItem, isBarcode } from '../domain/foods'
import {
  ACTIVITY, MEALS, PACE, calorieGoal, currentWeight, dayTotals, defaultMealSlot, fmtKcal, macroTargets, toMeal, multiply,
  remainingText, scale,
} from '../domain/nutrition'
import { recipeById, type Recipe } from '../domain/recipes'
import { toDay, addDays, formatDayLong, type Day } from '../lib/dates'
import { uid } from '../lib/ids'
import { porkInText } from '../domain/pork'

// ------------------------------------------------------------------ vignettes
export function Thumb({ src, emoji, alt = '', className = 'thumb' }: { src?: string | null; emoji: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={className} aria-hidden={alt ? undefined : true}>
      {src && !failed ? <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <span aria-hidden="true">{emoji}</span>}
    </span>
  )
}

/** Version réduite d'une photo Pexels (vignettes de liste). */
export const smallPhoto = (url: string, w = 360) => url.includes('images.pexels.com') ? url.replace(/w=\d+/, `w=${w}`) : url

// ------------------------------------------------------------------ résumé du jour
export function CalorieSummary({ day, compact = false, onGoal }: { day: Day; compact?: boolean; onGoal?: () => void }) {
  const { snap } = useApp()
  const goal = calorieGoal(snap, toDay()).goal
  const t = dayTotals(snap, day)
  const rem = remainingText(t.kcal, goal)
  const targets = goal ? macroTargets(goal) : null
  const ratio = goal ? Math.min(1, t.kcal / goal) : 0
  return (
    <section className="card" aria-label="Calories du jour">
      <div className="kcal-hero">
        <Ring value={goal ? ratio : 0} size={compact ? 96 : 116} stroke={compact ? 9 : 11} color={goal && t.kcal > goal ? 'var(--nuit)' : 'var(--mousse)'}>
          <span className="ring-label" data-testid="kcal-restantes"><b>{rem.big.replace(' kcal', '')}</b><small>{goal ? (t.kcal > goal ? 'kcal notées' : 'kcal restantes') : 'kcal'}</small></span>
        </Ring>
        <div className="nums">
          <div><strong data-testid="kcal-mangees">{fmtKcal(t.kcal)}</strong><span>mangées</span></div>
          <div><strong>{goal ? fmtKcal(goal) : '—'}</strong><span>objectif</span></div>
          {goal && t.kcal > goal && <div style={{ gridColumn: '1 / -1' }}><span>Au-delà de l'objectif : c'est noté, rien à compenser.</span></div>}
          {!goal && <div style={{ gridColumn: '1 / -1' }}>{onGoal ? <button className="link-btn" onClick={onGoal}>Définir mon objectif</button> : <span>Objectif à définir dans Repas</span>}</div>}
        </div>
      </div>
      {!compact && targets && (
        <div className="macros">
          <Macro cls="p" label="Protéines" value={t.protein} target={targets.protein} />
          <Macro cls="c" label="Glucides" value={t.carbs} target={targets.carbs} />
          <Macro cls="f" label="Lipides" value={t.fat} target={targets.fat} />
          <Macro cls="fi" label="Fibres" value={t.fiber} target={targets.fiber} />
        </div>
      )}
      {!compact && goal && onGoal && <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={onGoal}>Modifier mon objectif</button>}
    </section>
  )
}

function Macro({ label, value, target, cls }: { label: string; value: number; target: number; cls: string }) {
  return (
    <div className={`macro ${cls}`}>
      <span>{label}</span>
      <b>{Math.round(value)} / {target} g</b>
      <span className="track"><i style={{ width: Math.min(100, (value / target) * 100) + '%' }} /></span>
    </div>
  )
}

export function NutriGrid({ n }: { n: Nutrients }) {
  return (
    <div className="nutri-grid">
      <div><b>{Math.round(n.kcal)}</b><span>kcal</span></div>
      <div><b>{fmt1(n.protein)}</b><span>protéines</span></div>
      <div><b>{fmt1(n.carbs)}</b><span>glucides</span></div>
      <div><b>{fmt1(n.fat)}</b><span>lipides</span></div>
      <div><b>{fmt1(n.fiber)}</b><span>fibres</span></div>
    </div>
  )
}
const fmt1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString('fr-FR') + ' g'

// ------------------------------------------------------------------ choix du repas et du jour
export function MealChips({ value, onChange }: { value: MealSlot; onChange: (m: MealSlot) => void }) {
  return <Chips label="Repas" value={value} onChange={v => v && onChange(v)} options={MEALS.map(m => ({ id: m.id, label: m.label }))} />
}

// ------------------------------------------------------------------ quantité d'un aliment
type UnitChoice = 'g' | 'ml' | number

/** Feuille « quantité » : recalcul en direct, choix du repas, contrôle « sans porc ». */
export function QuantitySheet({ item, entry, day, meal: meal0, onClose, onSaved }: {
  item: FoodItem; entry?: FoodEntry; day: Day; meal: MealSlot; onClose: () => void; onSaved?: (id: string) => void
}) {
  const { actions, toast } = useApp()
  const initial = useMemo((): { unit: UnitChoice; qty: string } => {
    if (entry) {
      if (entry.unit === 'portion') {
        const k = item.portions.findIndex(p => p.label === entry.portion_label)
        return { unit: k >= 0 ? k : 'g', qty: k >= 0 ? String(entry.quantity) : String(Math.round(entry.grams)) }
      }
      return { unit: entry.unit, qty: String(entry.quantity) }
    }
    if (item.portions.length) return { unit: 0, qty: '1' }
    return { unit: item.liquid ? 'ml' : 'g', qty: '100' }
  }, [entry, item])
  const [unit, setUnit] = useState<UnitChoice>(initial.unit)
  const [qty, setQty] = useState(initial.qty)
  const [meal, setMeal] = useState<MealSlot>(entry?.meal ?? meal0)
  const [checked, setChecked] = useState(Boolean(entry?.details.pork_checked))
  const q = Number(qty.replace(',', '.'))
  const valid = Number.isFinite(q) && q > 0 && q <= 5000
  const grams = !valid ? 0 : unit === 'g' ? q : unit === 'ml' ? q * item.density : q * (item.portions[unit]?.grams ?? 0)
  const n = scale(item.per100, grams)
  const blocked = item.pork === 'porc' || porkInText(item.name) || porkInText(item.brand)
  const needCheck = item.pork === 'inconnu'

  const save = async () => {
    if (!valid || blocked || (needCheck && !checked)) return
    try {
      const id = await actions.saveFoodEntry({
        id: entry?.id, day, meal, source: item.source, ref: item.ref, name: item.name, brand: item.brand,
        quantity: q, unit: typeof unit === 'number' ? 'portion' : unit, grams: Math.round(grams * 10) / 10,
        portion_label: typeof unit === 'number' ? item.portions[unit].label : null, per100: item.per100,
        kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fiber: n.fiber,
        details: { ...(item.barcode ? { barcode: item.barcode } : {}), ...(needCheck ? { pork_checked: true } : {}) }, category: item.category,
      })
      toast('✅', entry ? 'Modifié' : `Ajouté ${toMeal(meal)}`)
      onSaved?.(id)
      onClose()
    } catch {
      toast('⛔', 'Cet aliment contient du porc : il ne peut pas être ajouté.')
    }
  }

  const unitOptions: { id: string; label: string }[] = [
    ...item.portions.map((p, i) => ({ id: String(i), label: `${p.label} (${Math.round(p.grams)} g)` })),
    { id: 'g', label: 'grammes' },
    ...(item.liquid ? [{ id: 'ml', label: 'ml' }] : []),
  ]
  return (
    <Sheet title={entry ? 'Modifier' : 'Quantité'} onClose={onClose}>
      <div>
        <strong style={{ fontSize: '1.05rem' }}>{item.name}</strong>
        {item.brand && <div className="muted small">{item.brand}</div>}
        <div className="muted small">{Math.round(item.per100.kcal)} kcal pour 100 {item.liquid ? 'ml' : 'g'} · {item.source === 'ciqual' ? 'table Ciqual (Anses)' : item.source === 'off' ? 'Open Food Facts' : 'mon aliment'}</div>
      </div>
      {blocked ? (
        <div className="warn" role="alert">⛔ Ce produit contient du porc : il ne peut pas être ajouté à ton journal.</div>
      ) : (
        <>
          <div className="row">
            <input className="input big-input" style={{ flex: 1 }} inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} aria-label="Quantité" />
            <span className="muted" style={{ minWidth: 70 }}>{typeof unit === 'number' ? '× portion' : unit}</span>
          </div>
          <Chips label="Unité" value={String(unit)} onChange={v => { if (v === null) return; const u: UnitChoice = v === 'g' || v === 'ml' ? v : Number(v); if (typeof u === 'number' && typeof unit !== 'number') setQty('1'); if (typeof u !== 'number' && typeof unit === 'number') setQty(String(Math.round(grams) || 100)); setUnit(u) }} options={unitOptions} />
          <div className="ok-note" aria-live="polite" data-testid="kcal-quantite">{valid ? `${Math.round(grams)} g · ${fmtKcal(n.kcal)}` : 'Indique une quantité'}</div>
          <NutriGrid n={n} />
          <strong className="small">Repas</strong>
          <MealChips value={meal} onChange={setMeal} />
          {needCheck && (
            <label className="warn" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ width: 22, height: 22, flex: 'none' }} />
              <span>La composition de ce produit n'est pas renseignée. J'ai vérifié l'étiquette : il ne contient pas de porc.</span>
            </label>
          )}
        </>
      )}
      <div className="grid2">
        {entry ? <button className="btn danger" onClick={async () => { await actions.deleteFoodEntry(entry.id); toast('🗑️', 'Supprimé du journal'); onClose() }}>Supprimer</button> : <button className="btn ghost" onClick={onClose}>Annuler</button>}
        <button className="btn primary" disabled={!valid || blocked || (needCheck && !checked)} onClick={save}>{entry ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </Sheet>
  )
}

/** Reconstitue un aliment à partir d'une ligne du journal (pour la modifier ou la rajouter). */
export function entryToItem(e: FoodEntry): FoodItem | null {
  if (!e.per100) return null
  const portions = e.unit === 'portion' && e.portion_label && e.quantity > 0 ? [{ label: e.portion_label, grams: e.grams / e.quantity }] : []
  return {
    source: e.source === 'off' || e.source === 'perso' ? e.source : 'ciqual', ref: e.ref ?? e.id, name: e.name, brand: e.brand, per100: e.per100,
    liquid: e.unit === 'ml', density: e.unit === 'ml' && e.quantity ? e.grams / e.quantity || 1 : 1, portions, category: e.category,
    pork: e.details.pork_checked ? 'inconnu' : 'ok', barcode: e.details.barcode ?? null,
  }
}

// ------------------------------------------------------------------ ajout rapide (calories seules)
export function QuickAddSheet({ day, meal: meal0, entry, onClose }: { day: Day; meal: MealSlot; entry?: FoodEntry; onClose: () => void }) {
  return <Sheet title={entry ? 'Modifier l\'ajout rapide' : 'Ajout rapide'} onClose={onClose}><QuickAddForm day={day} meal={meal0} entry={entry} onDone={onClose} /></Sheet>
}

export function QuickAddForm({ day, meal: meal0, entry, onDone }: { day: Day; meal: MealSlot; entry?: FoodEntry; onDone: () => void }) {
  const { actions, toast } = useApp()
  const [name, setName] = useState(entry?.name ?? '')
  const [kcal, setKcal] = useState(entry ? String(entry.kcal) : '')
  const [p, setP] = useState(entry?.protein ? String(entry.protein) : '')
  const [c, setC] = useState(entry?.carbs ? String(entry.carbs) : '')
  const [f, setF] = useState(entry?.fat ? String(entry.fat) : '')
  const [meal, setMeal] = useState<MealSlot>(entry?.meal ?? meal0)
  const k = toNum(kcal)
  const save = async () => {
    if (k === null || k <= 0) return
    try {
      await actions.saveFoodEntry({
        id: entry?.id, day, meal, source: 'rapide', ref: null, name: name.trim() || 'Ajout rapide', brand: null, quantity: 1, unit: 'portion', grams: 0,
        portion_label: null, per100: null, kcal: Math.round(k), protein: toNum(p) ?? 0, carbs: toNum(c) ?? 0, fat: toNum(f) ?? 0, fiber: 0, details: {}, category: null,
      })
      toast('✅', entry ? 'Modifié' : `${Math.round(k)} kcal ajoutées ${toMeal(meal)}`)
      onDone()
    } catch { toast('⛔', 'Ce nom évoque du porc : ajout refusé.') }
  }
  return (
    <div className="stack">
      <label className="field">Nom <span className="hint">Facultatif, ex. « Part de gâteau chez Léa »</span><input className="input" value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="field">Calories (kcal)<input className="input big-input" inputMode="numeric" value={kcal} onChange={e => setKcal(e.target.value)} aria-label="Calories" /></label>
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <label className="field small">Protéines (g)<input className="input" inputMode="decimal" value={p} onChange={e => setP(e.target.value)} /></label>
        <label className="field small">Glucides (g)<input className="input" inputMode="decimal" value={c} onChange={e => setC(e.target.value)} /></label>
        <label className="field small">Lipides (g)<input className="input" inputMode="decimal" value={f} onChange={e => setF(e.target.value)} /></label>
      </div>
      <strong className="small">Repas</strong>
      <MealChips value={meal} onChange={setMeal} />
      <div className="grid2">
        {entry ? <button className="btn danger" onClick={async () => { await actions.deleteFoodEntry(entry.id); onDone() }}>Supprimer</button> : <span />}
        <button className="btn primary" disabled={k === null || k <= 0} onClick={save}>{entry ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </div>
  )
}

const toNum = (s: string): number | null => { const n = Number(s.replace(',', '.')); return s.trim() && Number.isFinite(n) && n >= 0 ? n : null }

// ------------------------------------------------------------------ aliment personnel
export function CustomFoodSheet({ initial, barcode, onClose, onSaved, onDelete }: { initial?: CustomFood; barcode?: string | null; onClose: () => void; onSaved?: (item: FoodItem) => void; onDelete?: () => void }) {
  const { actions, toast } = useApp()
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [unit, setUnit] = useState<'g' | 'ml'>(initial?.unit ?? 'g')
  const [v, setV] = useState({ kcal: s(initial?.per100.kcal), protein: s(initial?.per100.protein), carbs: s(initial?.per100.carbs), fat: s(initial?.per100.fat), fiber: s(initial?.per100.fiber) })
  const [pLabel, setPLabel] = useState(initial?.portions[0]?.label ?? '')
  const [pGrams, setPGrams] = useState(s(initial?.portions[0]?.grams))
  const [code, setCode] = useState(initial?.barcode ?? barcode ?? '')
  const kcal = toNum(v.kcal)
  const pork = porkInText(name) || porkInText(brand)
  const ok = name.trim().length > 0 && kcal !== null && !pork && (!code || isBarcode(code))
  const save = async () => {
    if (!ok) return
    const food: Omit<CustomFood, 'created_at' | 'updated_at'> = {
      id: initial?.id ?? 'perso-' + uid(), name: name.trim(), brand: brand.trim() || null, unit,
      per100: { kcal: kcal!, protein: toNum(v.protein) ?? 0, carbs: toNum(v.carbs) ?? 0, fat: toNum(v.fat) ?? 0, fiber: toNum(v.fiber) ?? 0 },
      portions: pLabel.trim() && toNum(pGrams) ? [{ label: pLabel.trim(), grams: toNum(pGrams)! }] : [], barcode: code.trim() || null,
    }
    try {
      await actions.saveCustomFood(food)
      toast('✅', 'Aliment enregistré dans « Mes aliments »')
      onSaved?.(customToItem({ ...food, created_at: '', updated_at: '' }))
      onClose()
    } catch { toast('⛔', 'Ce produit contient du porc : il ne peut pas être enregistré.') }
  }
  const field = (k: keyof typeof v, label: string) => <label className="field small">{label}<input className="input" inputMode="decimal" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} aria-label={label} /></label>
  return (
    <Sheet title={initial ? 'Modifier mon aliment' : 'Créer un aliment'} onClose={onClose}>
      <label className="field">Nom<input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex. : galette de riz au chocolat" /></label>
      {pork && <div className="warn" role="alert">⛔ Ce nom évoque un produit à base de porc : il ne peut pas être enregistré.</div>}
      <label className="field">Marque <span className="hint">Facultatif</span><input className="input" value={brand} onChange={e => setBrand(e.target.value)} /></label>
      <Chips label="Unité" value={unit} onChange={u => u && setUnit(u)} options={[{ id: 'g', label: 'Solide (g)' }, { id: 'ml', label: 'Liquide (ml)' }]} />
      <strong className="small">Valeurs pour 100 {unit} <span className="muted">(voir l'étiquette)</span></strong>
      {field('kcal', 'Calories (kcal)')}
      <div className="grid2">{field('protein', 'Protéines (g)')}{field('carbs', 'Glucides (g)')}{field('fat', 'Lipides (g)')}{field('fiber', 'Fibres (g)')}</div>
      <div className="grid2">
        <label className="field small">Portion <span className="hint">ex. « 1 galette »</span><input className="input" value={pLabel} onChange={e => setPLabel(e.target.value)} /></label>
        <label className="field small">Poids de la portion (g)<input className="input" inputMode="decimal" value={pGrams} onChange={e => setPGrams(e.target.value)} /></label>
      </div>
      <label className="field">Code-barres <span className="hint">Facultatif</span><input className="input" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
      <button className="btn primary block" disabled={!ok} onClick={save}>Enregistrer</button>
      {onDelete && <button className="btn danger" onClick={onDelete}>Supprimer cet aliment</button>}
    </Sheet>
  )
}
const s = (x: number | undefined | null) => (x === undefined || x === null ? '' : String(x))

// ------------------------------------------------------------------ recette → journal
export function recipeMealDefault(r: Recipe): MealSlot {
  return r.moment === 'matin' ? 'petit-dejeuner' : r.moment === 'gouter' ? 'collation' : (() => { const m = defaultMealSlot(); return m === 'petit-dejeuner' || m === 'collation' ? 'dejeuner' : m })()
}

/** Ajoute une recette au journal (idempotent : même jour + même repas = même ligne). */
export function RecipeLogSheet({ recipeId, day: day0, meal: meal0, portions: p0, onClose }: { recipeId: string; day?: Day; meal?: MealSlot; portions?: number; onClose: () => void }) {
  const { snap, actions, toast, today } = useApp()
  const r = recipeById(recipeId, snap.user_recipes)
  const [day, setDay] = useState<Day>(day0 ?? today)
  const [meal, setMeal] = useState<MealSlot>(meal0 ?? (r ? recipeMealDefault(r) : 'dejeuner'))
  const [portions, setPortions] = useState(p0 ?? 1)
  if (!r) return null
  const existing = snap.food_entries.find(f => f.id === `recette:${day}:${meal}:${r.id}`)
  const n = r.nutrition ? multiply(r.nutrition, portions) : null
  const save = async () => {
    const res = await actions.logRecipe(r.id, day, meal, portions)
    toast('🍽️', res?.existed ? 'Déjà dans ton journal : portions mises à jour' : `Ajoutée ${toMeal(meal)}`)
    onClose()
  }
  return (
    <Sheet title="Ajouter au journal" onClose={onClose}>
      <strong>{r.title}</strong>
      <Chips label="Jour" value={day} onChange={v => v && setDay(v)} options={[{ id: today, label: 'Aujourd\'hui' }, { id: addDays(today, -1), label: 'Hier' }, ...(day !== today && day !== addDays(today, -1) ? [{ id: day, label: formatDayLong(day) }] : [])]} />
      <MealChips value={meal} onChange={setMeal} />
      <div className="row between"><strong>Portions mangées</strong><Stepper label="Portions" value={portions} min={0.5} max={6} step={0.5} onChange={setPortions} format={v => String(v).replace('.', ',')} /></div>
      {n ? <NutriGrid n={n} /> : <p className="muted small">Pas de valeurs nutritionnelles pour cette recette : elle sera notée sans calories. Tu peux les ajouter en modifiant ta recette.</p>}
      {existing && <div className="ok-note">Déjà notée pour ce repas : enregistrer mettra simplement à jour les portions.</div>}
      <button className="btn primary block" onClick={save}>{existing ? 'Mettre à jour' : 'Ajouter'}{n ? ` · ${fmtKcal(n.kcal)}` : ''}</button>
      {existing && <button className="btn danger" onClick={async () => { await actions.deleteFoodEntry(existing.id); toast('🗑️', 'Retirée du journal'); onClose() }}>Retirer du journal</button>}
    </Sheet>
  )
}

// ------------------------------------------------------------------ objectif calorique
export function GoalSheet({ onClose }: { onClose: () => void }) {
  const { snap, actions, today, toast } = useApp()
  const cur = snap.profiles[0]?.settings.nutrition ?? {}
  const lastWeight = [...snap.weights].sort((a, b) => b.day.localeCompare(a.day))[0]
  const [sex, setSex] = useState<'F' | 'H'>(cur.sex ?? 'F')
  const [birth, setBirth] = useState(s(cur.birthYear))
  const [height, setHeight] = useState(s(cur.heightCm))
  const [weight, setWeight] = useState(s(cur.weightKg ?? currentWeight(snap) ?? undefined))
  const [activity, setActivity] = useState(cur.activity ?? 'sedentaire')
  const [pace, setPace] = useState(cur.pace ?? 'modere')
  const [manualOn, setManualOn] = useState(Boolean(cur.manualGoal))
  const [manual, setManual] = useState(s(cur.manualGoal ?? undefined))
  const draft = {
    sex, birthYear: toNum(birth) ?? undefined, heightCm: toNum(height) ?? undefined, weightKg: lastWeight ? cur.weightKg : toNum(weight) ?? undefined,
    activity, pace, manualGoal: manualOn ? toNum(manual) : null,
  }
  // Aperçu calculé avec les valeurs en cours de saisie
  const preview = calorieGoal({ ...snap, profiles: [{ ...snap.profiles[0], settings: { ...snap.profiles[0].settings, nutrition: draft } }] }, today)
  const year = Number(today.slice(0, 4))
  const birthOk = !birth || ((toNum(birth) ?? 0) >= year - 100 && (toNum(birth) ?? 0) <= year - 16)
  const save = async () => {
    await actions.saveNutritionSettings(draft)
    toast('🎯', 'Objectif enregistré')
    onClose()
  }
  return (
    <Sheet title="Mon objectif calorique" onClose={onClose}>
      <p className="muted small">Calcul de Mifflin-St Jeor. L'objectif ne baisse jamais les jours de fatigue, et les calories du sport ne sont pas déduites : bouger reste un bonus, pas une monnaie d'échange.</p>
      <Chips label="Sexe" value={sex} onChange={v => v && setSex(v)} options={[{ id: 'F', label: 'Femme' }, { id: 'H', label: 'Homme' }]} />
      <div className="grid2">
        <label className="field">Année de naissance<input className="input" inputMode="numeric" value={birth} onChange={e => setBirth(e.target.value)} aria-label="Année de naissance" /></label>
        <label className="field">Taille (cm)<input className="input" inputMode="numeric" value={height} onChange={e => setHeight(e.target.value)} aria-label="Taille en centimètres" /></label>
      </div>
      {!birthOk && <p className="muted small">Vérifie l'année de naissance.</p>}
      {lastWeight ? <p className="small">Poids utilisé : <strong>{String(lastWeight.kg).replace('.', ',')} kg</strong> <span className="muted">(dernière pesée, mise à jour automatique)</span></p>
        : <label className="field">Poids actuel (kg) <span className="hint">Remplacé automatiquement par tes pesées</span><input className="input" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} aria-label="Poids en kilos" /></label>}
      <strong className="small">Activité au quotidien</strong>
      <div className="stack" style={{ gap: 6 }}>
        {Object.entries(ACTIVITY).map(([id, a]) => (
          <button key={id} type="button" className={`chip ${activity === id ? 'on' : ''}`} aria-pressed={activity === id} style={{ justifyContent: 'flex-start', textAlign: 'left', borderRadius: 14 }} onClick={() => setActivity(id as typeof activity)}>
            <span><strong>{a.label}</strong><br /><span style={{ fontWeight: 600, fontSize: '.8rem' }}>{a.hint}</span></span>
          </button>
        ))}
      </div>
      <strong className="small">Rythme</strong>
      <Chips label="Rythme" value={pace} onChange={v => v && setPace(v)} options={Object.entries(PACE).map(([id, p]) => ({ id: id as typeof pace, label: p.label }))} />
      <p className="muted small">{PACE[pace].hint}</p>
      <div className="equip-summary" aria-live="polite">
        {preview.source === 'incomplet' && !manualOn ? <>Il manque : {preview.missing.join(', ')}.</> : (
          <>
            <strong style={{ fontSize: '1.1rem' }}>{preview.goal ? fmtKcal(preview.goal) : '—'} par jour</strong>
            {preview.bmr && <div className="small muted">Métabolisme de base ≈ {fmtKcal(preview.bmr)} · dépense estimée ≈ {fmtKcal(preview.tdee!)}</div>}
            {preview.floored && !manualOn && <div className="small">L'objectif est relevé au plancher de sécurité ({fmtKcal(preview.floor!)}).</div>}
          </>
        )}
      </div>
      <Toggle label="Fixer mon objectif à la main" checked={manualOn} onChange={setManualOn} />
      {manualOn && <label className="field">Objectif (kcal par jour)<input className="input" inputMode="numeric" value={manual} onChange={e => setManual(e.target.value)} aria-label="Objectif manuel" /></label>}
      {manualOn && (toNum(manual) ?? 0) > 0 && (toNum(manual) ?? 0) < 1200 && <div className="warn">Un objectif sous 1 200 kcal n'est pas recommandé sans suivi médical.</div>}
      <button className="btn primary block" disabled={!birthOk || (manualOn && (toNum(manual) ?? 0) < 800)} onClick={save}>Enregistrer</button>
    </Sheet>
  )
}

// ------------------------------------------------------------------ code-barres
interface Detector { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

/** Lecteur de code-barres (API BarcodeDetector de Chrome Android) avec saisie manuelle en secours. */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'idle' | 'running' | 'unsupported' | 'denied'>('idle')
  const [manual, setManual] = useState('')
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window
  const stopRef = useRef<() => void>(() => {})

  useEffect(() => () => stopRef.current(), [])

  const start = async () => {
    if (!supported || !navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return }
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }) }
    catch { setState('denied'); return }
    const v = video.current!
    v.srcObject = stream
    await v.play().catch(() => {})
    setState('running')
    const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector
    const det = new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
    let alive = true
    stopRef.current = () => { alive = false; stream.getTracks().forEach(t => t.stop()) }
    const tick = async () => {
      if (!alive) return
      try {
        const found = await det.detect(v)
        const code = found.map(f => f.rawValue).find(isBarcode)
        if (code) { stopRef.current(); setState('idle'); onCode(code); return }
      } catch { /* image pas encore prête */ }
      window.setTimeout(tick, 250)
    }
    tick()
  }

  return (
    <div className="stack">
      {state === 'running' ? (
        <div className="scan-box"><video ref={video} playsInline muted /><div className="aim" /></div>
      ) : (
        <>
          <video ref={video} playsInline muted style={{ display: 'none' }} />
          {supported && <button className="btn primary" onClick={start}><IconScan /> Scanner avec l'appareil photo</button>}
          {(state === 'unsupported' || !supported) && <p className="muted small">Le scan par caméra n'est pas disponible sur ce navigateur : saisis les chiffres sous le code-barres.</p>}
          {state === 'denied' && <p className="muted small">Accès à la caméra refusé. Tu peux l'autoriser dans les réglages du navigateur, ou saisir le code à la main.</p>}
        </>
      )}
      {state === 'running' && <button className="btn ghost" onClick={() => { stopRef.current(); setState('idle') }}>Arrêter</button>}
      <div className="row">
        <input className="input" style={{ flex: 1 }} inputMode="numeric" placeholder="Code-barres (8 à 14 chiffres)" value={manual} onChange={e => setManual(e.target.value.replace(/\D/g, ''))} aria-label="Code-barres" />
        <button className="btn secondary" disabled={!isBarcode(manual)} onClick={() => onCode(manual)}>OK</button>
      </div>
    </div>
  )
}

/** Recherche d'un code-barres : mes aliments d'abord, puis Open Food Facts. */
export async function lookupBarcode(code: string, custom: CustomFood[]): Promise<FoodItem | null> {
  const mine = custom.find(c => c.barcode === code)
  if (mine) return customToItem(mine)
  return productByBarcode(code)
}
