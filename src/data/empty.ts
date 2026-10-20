import { TABLES, type Snapshot } from './types'

/** Instantané vide (aperçus de calcul avant l'enregistrement, tests). */
export function emptySnapshot(): Snapshot {
  const s = {} as Record<string, unknown[]>
  for (const t of TABLES) s[t] = []
  return s as Snapshot
}
