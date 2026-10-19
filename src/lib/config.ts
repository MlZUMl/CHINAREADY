// Configuration lue à l'exécution (public/config.js) : on peut changer de projet Supabase
// ou ajouter des illustrations sans reconstruire l'application.
export interface ElanConfig {
  supabaseUrl?: string
  supabaseKey?: string
  vapidPublicKey?: string
  /** Remplacement d'illustrations : { "compagnon-chat": "art/chat.png", ... } */
  art?: Record<string, string>
}

declare global {
  interface Window { ELAN_CONFIG?: ElanConfig }
}

export function getConfig(): ElanConfig {
  return (typeof window !== 'undefined' && window.ELAN_CONFIG) || {}
}

export function cloudConfigured(): boolean {
  const c = getConfig()
  return Boolean(c.supabaseUrl && c.supabaseKey)
}
