import type { Commitment, EnergyPreferences, NotificationPreferences, Profile } from '../data/types'

const T0 = ''

/** 5 rappels d'eau répartis dans la journée */
export const HYDRATION_TIMES = ['09:30', '11:30', '13:30', '15:30', '18:30'] as const

export function defaultProfile(name: string | null, timezone: string): Profile {
  return {
    id: 'profile', display_name: name, timezone, onboarded: true, water_goal_glasses: 8, water_goal_ml: 2000, weigh_day: 1,
    portions: 1, halal: true, analysis_consent: true, settings: { companion_reactions: true, equipment: ['tapis'] },
    created_at: T0, updated_at: T0,
  }
}

export function defaultEnergyPrefs(): EnergyPreferences {
  return { id: 'energy', enabled: true, rest_days: [6, 7], quiet_when_low: true, created_at: T0, updated_at: T0 }
}

export function defaultNotificationPrefs(timezone: string): NotificationPreferences {
  return {
    id: 'notif', enabled: false, ritual: true, hydration: true, hydration_times: [...HYDRATION_TIMES],
    capsules: true, monthly_capsule: false, weekly_review: true, tone: 'auto', timezone, created_at: T0, updated_at: T0,
    cycle: true, meal_reminders: true, lunch_time: '13:30', dinner_time: '20:30',
  }
}

export interface RitualSetup { days: number[]; time: string; usualMinutes: number; minMinutes: number; place: string }

export function defaultCommitments(r: RitualSetup = { days: [1, 2, 3, 4, 5], time: '17:15', usualMinutes: 20, minMinutes: 10, place: 'Salon' }): Commitment[] {
  const base = { created_at: T0, updated_at: T0, active: true }
  return [
    {
      ...base, id: 'sport', kind: 'sport', sort: 0,
      title: 'Mon rendez-vous sport',
      cue_time: r.time, days: r.days, place: r.place,
      min_label: `${r.minMinutes} minutes de marche ou de mouvement doux`, min_minutes: r.minMinutes,
      usual_label: `Ma séance de ${r.usualMinutes} minutes`, usual_minutes: r.usualMinutes,
      fallback: 'Ring Fit, une danse ou une marche de 10 minutes',
    },
    {
      ...base, id: 'eau', kind: 'eau', sort: 1,
      title: 'Boire de l\'eau', cue_time: null, days: [1, 2, 3, 4, 5, 6, 7], place: null,
      min_label: 'Un verre d\'eau maintenant', min_minutes: null,
      usual_label: 'Atteindre mon objectif en litres', usual_minutes: null,
      fallback: 'Garder une gourde à portée de main',
    },
    {
      ...base, id: 'repas', kind: 'repas', sort: 2,
      title: 'Noter mes repas', cue_time: null, days: [1, 2, 3, 4, 5, 6, 7], place: null,
      min_label: 'Noter un repas, même un seul aliment', min_minutes: null,
      usual_label: 'Noter mes repas principaux', usual_minutes: null,
      fallback: 'Un ajout rapide en calories suffit',
    },
    {
      ...base, id: 'tenue', kind: 'preparation', sort: 3,
      title: 'Préparer ma tenue pour demain', cue_time: '21:00', days: [7, 1, 2, 3, 4], place: 'Chambre',
      min_label: 'Poser ma tenue sur la chaise', min_minutes: null,
      usual_label: 'Tenue et gourde prêtes', usual_minutes: null,
      fallback: 'Mettre mes baskets près de la porte',
    },
  ]
}
