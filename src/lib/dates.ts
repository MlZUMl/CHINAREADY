// Toutes les dates « jour » sont des chaînes locales AAAA-MM-JJ (fuseau de l'appareil).
export type Day = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toDay(d: Date = new Date()): Day {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0) // midi : évite les pièges du changement d'heure
}

export function addDays(day: Day, n: number): Day {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return toDay(d)
}

/** Lundi = 1 … dimanche = 7 */
export function isoWeekday(day: Day): number {
  const wd = parseDay(day).getDay()
  return wd === 0 ? 7 : wd
}

export function weekStart(day: Day): Day {
  return addDays(day, 1 - isoWeekday(day))
}

export function daysBetween(a: Day, b: Day): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)
}

export function rangeDays(from: Day, to: Day): Day[] {
  const out: Day[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function monthGrid(year: number, month0: number): Day[] {
  const first = toDay(new Date(year, month0, 1, 12))
  const start = weekStart(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
export const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function formatDayLong(day: Day): string {
  const d = parseDay(day)
  return `${WEEKDAYS[isoWeekday(day) - 1]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function formatDayShort(day: Day): string {
  const d = parseDay(day)
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4).replace(/\.$/, '')}.`
}

export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function dayOfIso(iso: string): Day {
  return toDay(new Date(iso))
}
