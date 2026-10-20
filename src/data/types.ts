// Types des enregistrements. Les noms de champs sont ceux des colonnes Supabase,
// ce qui évite toute conversion entre l'appareil et le serveur.
import type { Day } from '../lib/dates'

export interface Row {
  id: string
  created_at: string
  updated_at: string
}

export interface Profile extends Row {
  display_name: string | null
  timezone: string
  onboarded: boolean
  /** ancien objectif en verres (conservé pour compatibilité) */
  water_goal_glasses: number
  /** objectif d'eau en millilitres (2 000 par défaut) */
  water_goal_ml?: number
  weigh_day: number
  portions: number
  halal: boolean
  analysis_consent: boolean
  settings: {
    companion_reactions?: boolean
    show_weight_on_home?: boolean
    /** jours (1 = lundi) où la version minimale est mise en avant d'office */
    minimum_weekdays?: number[]
    /** mettre la version douce en avant les jours de règles notés */
    gentle_on_period?: boolean
    equipment?: Equipment[]
    /** réglages du calcul de l'objectif calorique */
    nutrition?: NutritionSettings
    /** migrations locales déjà appliquées */
    upgrades?: string[]
  }
}

export type Equipment = 'tapis' | 'elastique' | 'halteres' | 'corde' | 'velo_appart' | 'ring_fit' | 'velo'

export interface NutritionSettings {
  sex?: 'F' | 'H'
  birthYear?: number
  heightCm?: number
  /** poids de référence si aucune pesée n'est enregistrée */
  weightKg?: number
  activity?: 'sedentaire' | 'leger' | 'modere' | 'actif'
  pace?: 'maintien' | 'doux' | 'modere'
  /** objectif saisi à la main (remplace le calcul) */
  manualGoal?: number | null
}

export interface EnergyPreferences extends Row {
  enabled: boolean
  rest_days: number[]
  quiet_when_low: boolean
}

export interface NotificationPreferences extends Row {
  enabled: boolean
  ritual: boolean
  hydration: boolean
  hydration_times: string[]
  capsules: boolean
  monthly_capsule: boolean
  weekly_review: boolean
  tone: 'auto' | 'direct' | 'doux'
  timezone: string
}

export type CommitmentKind = 'sport' | 'eau' | 'repas' | 'preparation' | 'perso'
export interface Commitment extends Row {
  kind: CommitmentKind
  title: string
  cue_time: string | null
  days: number[]
  place: string | null
  min_label: string
  min_minutes: number | null
  usual_label: string
  usual_minutes: number | null
  fallback: string | null
  active: boolean
  sort: number
}

export interface HabitCheck extends Row {
  commitment_id: string
  day: Day
  version: 'min' | 'usual'
}

export type Energy = 1 | 2 | 3 | 4 | 5
export type Need = 'bouger' | 'detente' | 'cuisine' | 'eau' | 'reprendre'
export interface DailyCheckin extends Row {
  day: Day
  energy: Energy | null
  minutes: 5 | 10 | 15 | 20 | 30 | 45 | null
  need: Need | null
}

export type WorkoutVersion = 'min' | 'usual' | 'plus' | 'libre'
export type WorkoutSource = 'rituel' | 'libre' | 'mission' | 'reprise'
export interface Workout extends Row {
  day: Day
  started_at: string
  ended_at: string | null
  kind: 'guidee' | 'externe'
  activity: string
  program: string | null
  planned_minutes: number | null
  actual_minutes: number
  version: WorkoutVersion
  completed: boolean
  source: WorkoutSource
  energy: number | null
  note: string | null
}

export type RitualAction = 'ouvert' | 'commence' | 'courte' | 'report' | 'repos'
export type RestReason = 'epuisee' | 'imprevu' | 'pas_envie'
export interface RitualEvent extends Row {
  day: Day
  action: RitualAction
  reason: RestReason | null
  at: string
}

export type Obstacle = 'horaire' | 'fatigue' | 'preparation' | 'motivation' | 'autre'
export interface ObstacleReport extends Row {
  day: Day
  obstacle: Obstacle
  note: string | null
}

export interface WaterLog extends Row {
  day: Day
  at: string
  /** ancien champ (verres de 25 cl) ; toujours 1 pour les nouvelles entrées */
  glasses: number
  /** quantité bue en millilitres (absente sur les très anciennes entrées : glasses × 250) */
  ml?: number
}

export type MealSlot = 'petit-dejeuner' | 'dejeuner' | 'collation' | 'diner'
export interface Nutrients { kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar?: number }
export type FoodSource = 'ciqual' | 'off' | 'perso' | 'recette' | 'rapide'
export interface FoodPortion { label: string; grams: number }

/** Une ligne du journal alimentaire (valeurs figées au moment de l'ajout). */
export interface FoodEntry extends Row {
  day: Day
  meal: MealSlot
  source: FoodSource
  ref: string | null
  name: string
  brand: string | null
  quantity: number
  unit: 'g' | 'ml' | 'portion'
  grams: number
  portion_label: string | null
  per100: Nutrients | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  details: { portions?: number; recipe_title?: string; barcode?: string; pork_checked?: boolean; markers?: string[] }
  /** famille d'aliment : legumes, fruits, feculents, proteines, laitiers… */
  category: string | null
  at: string
}

export interface CustomFood extends Row {
  name: string
  brand: string | null
  per100: Nutrients
  unit: 'g' | 'ml'
  portions: FoodPortion[]
  barcode: string | null
}

export type MealMoment = 'matin' | 'midi' | 'gouter' | 'soir' | 'autre'
export type MealMarker = 'proteines' | 'legumes' | 'feculents' | 'fruit' | 'fait_maison' | 'plaisir'
export interface Meal extends Row {
  day: Day
  moment: MealMoment
  title: string
  recipe_id: string | null
  markers: MealMarker[]
  feeling: 'rassasiee' | 'agreable' | 'encore_faim' | 'trop' | null
  note: string | null
  at: string
}

export interface Ingredient { name: string; qty: number | null; unit: string; aisle: string }
export interface UserRecipe extends Row {
  title: string
  minutes: number | null
  servings: number
  ingredients: Ingredient[]
  steps: string[]
  tags: string[]
  source_url?: string | null
  photo_url?: string | null
  /** valeurs par portion, saisies par l'utilisatrice (facultatif) */
  nutrition?: Nutrients | null
}

export interface PlanSlot { day: Day; moment: 'midi' | 'soir'; recipe_id: string; portions: number }
export interface MealPlan extends Row {
  week_start: Day
  slots: PlanSlot[]
  checked: string[]
}

export interface Weight extends Row {
  day: Day
  kg: number
  note: string | null
}

export interface CycleDay extends Row {
  day: Day
  period: boolean
  flow: 'spotting' | 'leger' | 'moyen' | 'abondant' | null
  symptoms: string[]
  note: string | null
}

export interface JournalEntry extends Row {
  day: Day
  mood: string | null
  text: string
}

export interface DayPresence extends Row {
  day: Day
  first_at: string
}

export interface WeeklyReview extends Row {
  week_start: Day
  helped: string | null
  blocked: string | null
  intention: string | null
  reflection: string | null
}

export interface AvatarProfile extends Row {
  character: string
  style: string
  outfit: string
  universe: string
  name: string | null
  /** emplacement -> identifiant d'objet posé (ou absent) */
  equipped: Record<string, string>
  zones: Record<string, { visited?: boolean }>
}

export type Species = 'chat' | 'lapin' | 'nuage' | 'creature' | 'pousse'
export interface CompanionProfile extends Row {
  species: Species
  name: string
  color: string
  accessories: string[]
  frequency: 'normal' | 'discret'
}

export interface CompanionInteraction extends Row {
  at: string
  context: string
  message_key: string
  expression: string
}

export type GrantKind = 'xp' | 'badge' | 'item' | 'zone' | 'accessory'
export interface RewardGrant extends Row {
  kind: GrantKind
  ref: string
  xp: number
  reason: string
  granted_at: string
}

export type MissionStatus = 'disponible' | 'active' | 'terminee' | 'expiree' | 'ignoree'
export interface UserMission extends Row {
  mission_key: string
  day: Day
  status: MissionStatus
  mystery: boolean
  accepted_at: string | null
  completed_at: string | null
  expires_on: Day | null
  reward_key: string | null
}

export interface ProgressCapsule extends Row {
  created_day: Day
  open_on: Day | null
  locked: boolean
  has_photo: boolean
  photo_path: string | null
  weight_kg: number | null
  energy: number | null
  habits: string | null
  difficulties: string | null
  workouts_count: number | null
  success: string | null
  note: string | null
  future_message: string | null
  snapshot: CapsuleSnapshot
  opened_at: string | null
  reopen_note: string | null
  unlock_requested_at: string | null
}

export interface CapsuleSnapshot {
  workouts_last_30?: number
  rendezvous_rate_30?: number | null
  water_goal_days_30?: number
  meals_logged_days_30?: number
  avg_energy_30?: number | null
  weight_trend?: number | null
  level?: number
  badges?: number
  reprises?: number
}

export interface HabitInsight extends Row {
  insight_key: string
  period: string
  status: 'nouvelle' | 'acceptee' | 'modifiee' | 'ignoree'
  observed: Record<string, unknown>
  decided_at: string | null
}

export interface ScheduledPush extends Row {
  send_at: string
  kind: 'report' | 'test'
  title: string
  body: string
  url: string
  sent_at: string | null
}

export interface Tables {
  profiles: Profile
  energy_preferences: EnergyPreferences
  notification_preferences: NotificationPreferences
  commitments: Commitment
  habit_checks: HabitCheck
  daily_checkins: DailyCheckin
  workouts: Workout
  ritual_events: RitualEvent
  obstacle_reports: ObstacleReport
  water_logs: WaterLog
  meals: Meal
  food_entries: FoodEntry
  custom_foods: CustomFood
  user_recipes: UserRecipe
  meal_plans: MealPlan
  weights: Weight
  cycle_days: CycleDay
  journal_entries: JournalEntry
  day_presence: DayPresence
  weekly_reviews: WeeklyReview
  avatar_profiles: AvatarProfile
  companion_profiles: CompanionProfile
  companion_interactions: CompanionInteraction
  reward_grants: RewardGrant
  user_missions: UserMission
  progress_capsules: ProgressCapsule
  habit_insights: HabitInsight
  scheduled_pushes: ScheduledPush
}

export type TableName = keyof Tables

/** Ordre de synchronisation : les tables référencées passent avant celles qui les référencent. */
export const TABLES: TableName[] = [
  'profiles', 'energy_preferences', 'notification_preferences', 'commitments', 'habit_checks',
  'daily_checkins', 'workouts', 'ritual_events', 'obstacle_reports', 'water_logs', 'meals',
  'food_entries', 'custom_foods', 'user_recipes', 'meal_plans', 'weights', 'cycle_days', 'journal_entries', 'day_presence',
  'weekly_reviews', 'avatar_profiles', 'companion_profiles', 'companion_interactions',
  'reward_grants', 'user_missions', 'progress_capsules', 'habit_insights', 'scheduled_pushes',
]

/** Vue en mémoire de toutes les données : c'est l'unique source de vérité côté écran. */
export type Snapshot = { [K in TableName]: Tables[K][] }

export type NewRow<T extends Row> = Omit<T, 'created_at' | 'updated_at'> & Partial<Pick<T, 'created_at' | 'updated_at'>>
