// Toutes les actions de l'utilisatrice passent par ici puis par store.commit() :
// une action = une écriture, et les récompenses qui en découlent sont calculées au même moment.
import type { DataStore, Op } from '../data/store'
import type {
  AvatarProfile, Commitment, CompanionProfile, DailyCheckin, Meal, MealPlan, PlanSlot, ProgressCapsule, Profile,
  EnergyPreferences, NotificationPreferences, Workout, RitualAction, RestReason, Obstacle, HabitInsight, Snapshot, UserRecipe, CycleDay,
  FoodEntry, CustomFood, MealSlot, Equipment, NutritionSettings,
} from '../data/types'
import { toDay, nowIso, weekStart, addDays, type Day } from '../lib/dates'
import { uid } from '../lib/ids'
import { defaultCommitments, defaultEnergyPrefs, defaultNotificationPrefs, defaultProfile, type RitualSetup } from '../domain/defaults'
import { chooseMission, missionId, isMysteryDay } from '../domain/missions'
import { buildCapsuleSnapshot } from '../domain/capsules'
import type { Insight } from '../domain/analysis'
import { RECIPES, recipeById } from '../domain/recipes'
import { multiply } from '../domain/nutrition'
import { HYDRATION_TIMES } from '../domain/defaults'
import { porkInText, recipeHasPork } from '../domain/pork'
import { balance, equipList, ownedItems, priceOf, shopItem } from '../domain/shop'
import { hash } from '../lib/ids'

const put = (table: Op['table'], row: any): Op => ({ type: 'put', table, row })

export const UPGRADES = ['lot1']

export function createActions(store: DataStore) {
  const s = () => store.snapshot()
  const profile = () => s().profiles[0]

  const api = {
    // ---------------------------------------------------------------- accueil
    async completeOnboarding(o: { name: string | null; ritual: RitualSetup; species: CompanionProfile['species']; companionName: string; waterMl: number; equipment: Equipment[] }) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'
      const p = defaultProfile(o.name, tz)
      p.water_goal_ml = o.waterMl
      p.water_goal_glasses = Math.max(1, Math.min(20, Math.round(o.waterMl / 250)))
      p.settings = { ...p.settings, equipment: o.equipment, upgrades: [...UPGRADES] }
      const ops: Op[] = [
        put('profiles', p),
        put('energy_preferences', defaultEnergyPrefs()),
        put('notification_preferences', defaultNotificationPrefs(tz)),
        ...defaultCommitments(o.ritual).map(c => put('commitments', c)),
        put('companion_profiles', { id: 'companion', species: o.species, name: o.companionName, color: 'rose', accessories: ['noeud'], frequency: 'normal' } satisfies Partial<CompanionProfile>),
      ]
      await store.commit(ops)
    },

    async markPresence(day: Day = toDay()) {
      if (s().day_presence.some(p => p.day === day)) return
      await store.commit([put('day_presence', { id: day, day, first_at: nowIso() })], { derive: false })
    },

    // ---------------------------------------------------------------- énergie
    async saveCheckin(day: Day, patch: Partial<Pick<DailyCheckin, 'energy' | 'minutes' | 'need'>>) {
      const prev = s().daily_checkins.find(c => c.day === day)
      const row = { id: day, day, energy: null, minutes: null, need: null, ...prev, ...patch }
      return store.commit([put('daily_checkins', row)])
    },

    // ---------------------------------------------------------------- rituel & séances
    async ritualEvent(action: RitualAction, reason: RestReason | null = null, day: Day = toDay()) {
      // « ouvert » et « commencé » sont uniques par jour ; reports et repos sont conservés un par un.
      const id = action === 'ouvert' || action === 'commence' ? `${day}:${action}` : `${day}:${action}:${uid().slice(0, 8)}`
      if ((action === 'ouvert' || action === 'commence') && s().ritual_events.some(e => e.id === id)) return []
      return store.commit([put('ritual_events', { id, day, action, reason, at: nowIso() })])
    },

    async cancelRest(day: Day = toDay()) {
      const ops: Op[] = s().ritual_events.filter(e => e.day === day && e.action === 'repos').map(e => ({ type: 'delete', table: 'ritual_events', id: e.id }))
      if (ops.length) await store.commit(ops)
    },

    async saveWorkout(w: Omit<Workout, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
      const row = { ...w, id: w.id ?? uid() }
      const grants = await store.commit([put('workouts', row)])
      return { id: row.id, grants }
    },

    async deleteWorkout(id: string) {
      return store.remove('workouts', id)
    },

    async snooze(minutes: number, cloud: boolean) {
      const day = toDay()
      await api.ritualEvent('report', null, day)
      if (!cloud) return
      const sendAt = new Date(Date.now() + minutes * 60_000).toISOString()
      const sport = s().commitments.find(c => c.kind === 'sport')
      await store.commit([put('scheduled_pushes', {
        id: 'report:' + uid(), send_at: sendAt, kind: 'report', title: 'C\'est reparti ?',
        body: `Ton rendez-vous t'attend : ${sport?.min_label.toLowerCase() ?? '10 minutes'} suffit.`, url: '#/rituel', sent_at: null,
      })], { derive: false })
    },

    async testPush() {
      await store.commit([put('scheduled_pushes', {
        id: 'test:' + uid(), send_at: nowIso(), kind: 'test', title: 'Élan',
        body: 'Les rappels fonctionnent. À 17 h 15, tu sauras quoi faire.', url: '#/', sent_at: null,
      })], { derive: false })
    },

    async reportObstacle(obstacle: Obstacle, note: string | null) {
      const day = toDay()
      return store.commit([put('obstacle_reports', { id: `${day}:${obstacle}:${uid().slice(0, 6)}`, day, obstacle, note })])
    },

    // ---------------------------------------------------------------- habitudes
    async checkHabit(commitmentId: string, day: Day, version: 'min' | 'usual' | null) {
      const id = `${commitmentId}:${day}`
      if (!version) return store.remove('habit_checks', id)
      return store.commit([put('habit_checks', { id, commitment_id: commitmentId, day, version })])
    },

    async saveCommitment(c: Omit<Commitment, 'created_at' | 'updated_at'>) {
      return store.commit([put('commitments', c)])
    },

    async deleteCommitment(id: string) {
      // Les coches liées partent avec l'engagement (même règle que la base de données).
      const ops: Op[] = s().habit_checks.filter(h => h.commitment_id === id).map(h => ({ type: 'delete', table: 'habit_checks', id: h.id }))
      ops.push({ type: 'delete', table: 'commitments', id })
      return store.commit(ops)
    },

    /**
     * Mises à niveau locales, appliquées une seule fois (et synchronisées) :
     * lot1 — objectif d'eau en litres (2 L) et 5 rappels d'eau par jour.
     */
    async ensureUpgrades() {
      const p = profile()
      if (!p) return
      const done = new Set(p.settings.upgrades ?? [])
      if (done.has('lot1')) return
      const ops: Op[] = [put('profiles', { ...p, water_goal_ml: p.water_goal_ml ?? 2000, settings: { ...p.settings, upgrades: [...done, 'lot1'] } })]
      const np = s().notification_preferences[0]
      if (np) ops.push(put('notification_preferences', { ...np, hydration: true, hydration_times: [...HYDRATION_TIMES] }))
      await store.commit(ops, { derive: false })
    },

    // ---------------------------------------------------------------- eau (millilitres)
    async addWater(day: Day = toDay(), ml = 250) {
      const amount = Math.round(Math.max(10, Math.min(3000, ml)))
      return store.commit([put('water_logs', { id: uid(), day, at: day === toDay() ? nowIso() : `${day}T12:00:00.000Z`, glasses: 1, ml: amount })])
    },

    async updateWater(id: string, ml: number) {
      const w = s().water_logs.find(x => x.id === id)
      if (!w) return []
      return store.commit([put('water_logs', { ...w, glasses: 1, ml: Math.round(Math.max(10, Math.min(3000, ml))) })])
    },

    async deleteWater(id: string) { return store.remove('water_logs', id) },

    async removeWater(day: Day = toDay()) {
      const last = s().water_logs.filter(w => w.day === day).sort((a, b) => b.at.localeCompare(a.at))[0]
      if (last) await store.remove('water_logs', last.id)
    },

    // ---------------------------------------------------------------- journal alimentaire
    /** Ajoute ou modifie une ligne du journal. Refusée si le nom contient du porc. */
    async saveFoodEntry(e: Omit<FoodEntry, 'id' | 'created_at' | 'updated_at' | 'at'> & { id?: string; at?: string }) {
      if (porkInText(e.name) || porkInText(e.brand)) throw new Error('PORC')
      const prev = e.id ? s().food_entries.find(f => f.id === e.id) : undefined
      const row = { ...e, id: e.id ?? uid(), at: e.at ?? prev?.at ?? (e.day === toDay() ? nowIso() : `${e.day}T12:00:00.000Z`) }
      await store.commit([put('food_entries', row)])
      return row.id
    },

    async deleteFoodEntry(id: string) { return store.remove('food_entries', id) },

    /**
     * Ajoute une recette au journal. Idempotent : une même recette, le même jour, dans le même repas,
     * ne crée qu'une seule ligne (un second appui met à jour le nombre de portions).
     */
    async logRecipe(recipeId: string, day: Day, meal: MealSlot, portions: number) {
      const r = recipeById(recipeId, s().user_recipes)
      if (!r) return null
      const id = `recette:${day}:${meal}:${recipeId}`
      const per = r.nutrition
      const n = per ? multiply(per, portions) : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      const grams = r.catalog ? Math.round(r.ingredients.reduce((g, i) => g + (i.grams ?? 0), 0) * portions) : 0
      const existed = s().food_entries.some(f => f.id === id)
      await api.saveFoodEntry({
        id, day, meal, source: 'recette', ref: r.id, name: r.title, brand: null, quantity: portions, unit: 'portion', grams,
        portion_label: portions > 1 ? `${portions} portions` : '1 portion', per100: null,
        kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fiber: n.fiber,
        details: { portions, recipe_title: r.title, markers: r.markers }, category: 'recette',
      })
      return { id, existed }
    },

    async saveCustomFood(c: Omit<CustomFood, 'created_at' | 'updated_at'>) {
      if (porkInText(c.name) || porkInText(c.brand)) throw new Error('PORC')
      return store.commit([put('custom_foods', c)])
    },
    async deleteCustomFood(id: string) { return store.remove('custom_foods', id) },

    async saveNutritionSettings(patch: Partial<NutritionSettings>) {
      const p = profile()
      return store.commit([put('profiles', { ...p, settings: { ...p.settings, nutrition: { ...(p.settings.nutrition ?? {}), ...patch } } })], { derive: false })
    },

    async saveMeal(m: Omit<Meal, 'id' | 'created_at' | 'updated_at' | 'at'> & { id?: string; at?: string }) {
      const row = { ...m, id: m.id ?? uid(), at: m.at ?? (m.day === toDay() ? nowIso() : `${m.day}T12:00:00.000Z`) }
      return store.commit([put('meals', row)])
    },

    async deleteMeal(id: string) { return store.remove('meals', id) },

    /** Recette personnelle : le contrôle « sans porc » bloque l'enregistrement. */
    async saveUserRecipe(r: Omit<UserRecipe, 'created_at' | 'updated_at'>) {
      if (recipeHasPork({ title: r.title, ingredients: r.ingredients, steps: r.steps })) throw new Error('PORC')
      return store.commit([put('user_recipes', r)])
    },
    async deleteUserRecipe(id: string) { return store.remove('user_recipes', id) },

    planFor(week: Day): MealPlan {
      return s().meal_plans.find(p => p.week_start === week) ?? { id: week, week_start: week, slots: [], checked: [], created_at: '', updated_at: '' }
    },

    async setSlot(slot: PlanSlot) {
      const week = weekStart(slot.day)
      const plan = api.planFor(week)
      const slots = plan.slots.filter(x => !(x.day === slot.day && x.moment === slot.moment)).concat(slot)
      return store.commit([put('meal_plans', { ...plan, slots })])
    },

    async removeSlot(day: Day, moment: 'midi' | 'soir') {
      const plan = api.planFor(weekStart(day))
      return store.commit([put('meal_plans', { ...plan, slots: plan.slots.filter(x => !(x.day === day && x.moment === moment)) })])
    },

    /** Complète les dîners vides de la semaine avec des recettes variées (sans hasard). */
    async autoFillWeek(week: Day, portions: number) {
      const plan = api.planFor(week)
      const used = new Set(plan.slots.map(x => x.recipe_id))
      const pool = RECIPES.filter(r => r.moment === 'midi-soir' && !used.has(r.id)).sort((a, b) => hash(week + a.id) - hash(week + b.id))
      const slots = [...plan.slots]
      let k = 0
      for (let i = 0; i < 7 && k < pool.length; i++) {
        const day = addDays(week, i)
        if (slots.some(x => x.day === day && x.moment === 'soir')) continue
        slots.push({ day, moment: 'soir', recipe_id: pool[k++].id, portions })
      }
      return store.commit([put('meal_plans', { ...plan, slots })])
    },

    async toggleShopping(week: Day, key: string) {
      const plan = api.planFor(week)
      const checked = plan.checked.includes(key) ? plan.checked.filter(k => k !== key) : [...plan.checked, key]
      return store.commit([put('meal_plans', { ...plan, checked })], { derive: false })
    },

    // ---------------------------------------------------------------- corps & calendrier
    async saveWeight(day: Day, kg: number, note: string | null = null) {
      return store.commit([put('weights', { id: day, day, kg, note })])
    },
    async deleteWeight(day: Day) { return store.remove('weights', day) },

    async saveCycleDay(day: Day, patch: Partial<Pick<CycleDay, 'period' | 'flow' | 'symptoms' | 'note'>>) {
      const prev = s().cycle_days.find(c => c.day === day)
      const row = { id: day, day, period: false, flow: null, symptoms: [], note: null, ...prev, ...patch }
      if (!row.period && !row.symptoms.length && !row.note && !row.flow) return prev ? store.remove('cycle_days', day) : []
      return store.commit([put('cycle_days', row)])
    },

    async saveJournal(day: Day, text: string, mood: string | null) {
      // Une entrée par jour : identifiant = le jour (deux enregistrements rapprochés ne créent pas de doublon).
      const existing = s().journal_entries.find(j => j.day === day)
      if (!existing && !text.trim()) return []
      return store.commit([put('journal_entries', { id: existing?.id ?? day, day, text, mood })])
    },

    // ---------------------------------------------------------------- réglages
    async updateProfile(patch: Partial<Profile>) { return store.commit([put('profiles', { ...profile(), ...patch })]) },
    async updateEnergyPrefs(patch: Partial<EnergyPreferences>) { return store.commit([put('energy_preferences', { ...s().energy_preferences[0], ...patch })]) },
    async updateNotifPrefs(patch: Partial<NotificationPreferences>) { return store.commit([put('notification_preferences', { ...s().notification_preferences[0], ...patch })], { derive: false }) },

    // ---------------------------------------------------------------- univers & compagnon
    async createAvatar(a: Pick<AvatarProfile, 'character' | 'style' | 'outfit' | 'universe' | 'name'>) {
      return store.commit([put('avatar_profiles', { id: 'avatar', ...a, equipped: {}, zones: {} })])
    },
    async updateAvatar(patch: Partial<AvatarProfile>) { return store.commit([put('avatar_profiles', { ...s().avatar_profiles[0], ...patch })], { derive: false }) },
    async updateCompanion(patch: Partial<CompanionProfile>) { return store.commit([put('companion_profiles', { ...s().companion_profiles[0], ...patch })], { derive: false }) },
    async recordInteraction(context: string, messageKey: string, expression: string) {
      return store.commit([put('companion_interactions', { id: uid(), at: nowIso(), context, message_key: messageKey, expression })], { derive: false })
    },

    // ---------------------------------------------------------------- boutique
    /**
     * Achète un objet : vérifie le solde au moment de l'achat, déduit le prix (ligne d'achat
     * enregistrée et synchronisée), puis l'équipe directement. Erreurs : INCONNU, DEJA, SOLDE.
     */
    async buyItem(itemId: string, equip = true) {
      const item = shopItem(itemId)
      if (!item) throw new Error('INCONNU')
      const snap = s()
      if (ownedItems(snap).has(itemId)) throw new Error('DEJA')
      const price = priceOf(item, toDay())
      if (balance(snap) < price) throw new Error('SOLDE')
      const ops: Op[] = [put('shop_purchases', { id: itemId, item_id: itemId, price, purchased_at: nowIso() })]
      const comp = snap.companion_profiles[0]
      if (equip && comp) ops.push(put('companion_profiles', { ...comp, accessories: equipList(comp.accessories.filter(id => id !== itemId), itemId) }))
      await store.commit(ops, { derive: false })
      return price
    },

    /** Met ou retire un objet de la boutique (un seul par emplacement). */
    async toggleCosmetic(itemId: string) {
      const comp = s().companion_profiles[0]
      if (!comp || !ownedItems(s()).has(itemId)) return []
      return store.commit([put('companion_profiles', { ...comp, accessories: equipList(comp.accessories, itemId) })], { derive: false })
    },

    // ---------------------------------------------------------------- missions
    async ensureMission(day: Day = toDay()) {
      if (s().user_missions.some(m => m.day === day)) return
      const def = chooseMission(s(), day)
      if (!def) return
      await store.commit([put('user_missions', {
        id: missionId(day, def.key), mission_key: def.key, day, status: 'disponible', mystery: isMysteryDay(day),
        accepted_at: null, completed_at: null, expires_on: day, reward_key: null,
      })])
    },
    async acceptMission(id: string) {
      const m = s().user_missions.find(x => x.id === id)
      if (m && m.status === 'disponible') await store.commit([put('user_missions', { ...m, status: 'active', accepted_at: nowIso() })])
    },
    async ignoreMission(id: string) {
      const m = s().user_missions.find(x => x.id === id)
      if (m && (m.status === 'disponible' || m.status === 'active')) await store.commit([put('user_missions', { ...m, status: 'ignoree' })])
    },

    // ---------------------------------------------------------------- capsules
    async createCapsule(c: Omit<ProgressCapsule, 'id' | 'created_at' | 'updated_at' | 'snapshot' | 'created_day' | 'opened_at' | 'reopen_note' | 'unlock_requested_at' | 'photo_path' | 'has_photo'>, photo: Blob | null) {
      const id = uid()
      const today = toDay()
      if (photo) await store.putBlob('capsule:' + id, photo)
      return store.commit([put('progress_capsules', {
        ...c, id, created_day: today, snapshot: buildCapsuleSnapshot(s(), today), has_photo: Boolean(photo), photo_path: null,
        opened_at: c.locked ? null : nowIso(), reopen_note: null, unlock_requested_at: null,
      })])
    },
    async updateCapsule(c: ProgressCapsule) { return store.commit([put('progress_capsules', c)]) },
    /** Retire la photo d'une capsule : ici, et dans l'espace en ligne à la prochaine synchronisation. */
    async removeCapsulePhoto(id: string) {
      const c = s().progress_capsules.find(x => x.id === id)
      if (!c) return []
      await store.deleteBlob('capsule:' + id)
      if (c.photo_path) await store.enqueueStorageDelete(c.photo_path)
      return store.commit([put('progress_capsules', { ...c, has_photo: false, photo_path: null })], { derive: false })
    },
    async replaceCapsulePhoto(id: string, photo: Blob) {
      const c = s().progress_capsules.find(x => x.id === id)
      if (!c) return []
      await store.putBlob('capsule:' + id, photo)
      // photo_path vidé : la synchronisation renverra la nouvelle photo au même emplacement privé.
      return store.commit([put('progress_capsules', { ...c, has_photo: true, photo_path: null })], { derive: false })
    },
    async requestEarlyUnlock(id: string) {
      const c = s().progress_capsules.find(x => x.id === id)
      if (c) await store.commit([put('progress_capsules', { ...c, unlock_requested_at: nowIso() })], { derive: false })
    },
    async openCapsule(id: string) {
      const c = s().progress_capsules.find(x => x.id === id)
      if (c && !c.opened_at) return store.commit([put('progress_capsules', { ...c, opened_at: nowIso() })])
      return []
    },
    async deleteCapsule(id: string) {
      const c = s().progress_capsules.find(x => x.id === id)
      await store.deleteBlob('capsule:' + id)
      if (c?.photo_path) await store.enqueueStorageDelete(c.photo_path)
      return store.remove('progress_capsules', id)
    },

    // ---------------------------------------------------------------- analyse & bilan
    async decideInsight(ins: Insight, status: HabitInsight['status']) {
      const row: Partial<HabitInsight> = { id: `${ins.key}:${ins.period}`, insight_key: ins.key, period: ins.period, status, observed: { observation: ins.observation }, decided_at: nowIso() }
      const ops: Op[] = [put('habit_insights', row)]
      if (status === 'acceptee') {
        const sport = s().commitments.find(c => c.kind === 'sport')
        const a = ins.action
        if (a.type === 'set-usual-minutes' && sport) ops.push(put('commitments', { ...sport, usual_minutes: a.minutes, usual_label: `Ma séance de ${a.minutes} minutes` }))
        if (a.type === 'set-cue-time' && sport) ops.push(put('commitments', { ...sport, cue_time: a.time }))
        if (a.type === 'enable-hydration-reminders') ops.push(put('notification_preferences', { ...s().notification_preferences[0], hydration: true }))
        if (a.type === 'plan-minimum-days') {
          const p = profile()
          const days = [...new Set([...(p.settings.minimum_weekdays ?? []), a.weekday])]
          ops.push(put('profiles', { ...p, settings: { ...p.settings, minimum_weekdays: days } }))
        }
        if (a.type === 'gentle-on-period') {
          const p = profile()
          ops.push(put('profiles', { ...p, settings: { ...p.settings, gentle_on_period: true } }))
        }
      }
      return store.commit(ops)
    },

    async saveWeeklyReview(week: Day, r: { helped: string | null; blocked: string | null; intention: string | null; reflection: string | null }) {
      return store.commit([put('weekly_reviews', { id: week, week_start: week, ...r })])
    },

    // ---------------------------------------------------------------- confidentialité
    exportData(): string {
      return JSON.stringify({ exported_at: nowIso(), app: 'Élan', data: s() }, null, 2)
    },
  }
  return api
}

export type Actions = ReturnType<typeof createActions>

/** Petite aide pour les écrans : l'état « du jour » le plus courant. */
export function todayOf(s: Snapshot, day: Day) {
  return {
    checkin: s.daily_checkins.find(c => c.day === day),
    mission: s.user_missions.find(m => m.day === day),
  }
}
