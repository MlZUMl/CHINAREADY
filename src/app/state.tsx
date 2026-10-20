import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { DataStore } from '../data/store'
import type { RewardGrant, Snapshot } from '../data/types'
import { SyncEngine, type SyncStatus } from '../data/sync'
import { supabase, SupabaseRemote } from '../data/supabase'
import { cloudConfigured } from '../lib/config'
import { toDay, type Day } from '../lib/dates'
import { createActions, type Actions } from './actions'
import { navigate } from '../lib/router'
import { deriveOps } from '../domain/rewards'
import { badgeDef, itemDef, ZONES, ACCESSORIES } from '../domain/catalog'
import { loadRemoteCatalog } from '../domain/recipes'

export interface Toast { id: number; emoji: string; text: string }

export interface Cloud {
  configured: boolean
  user: { id: string; email: string | null } | null
  status: SyncStatus | 'deconnecte'
  lastSyncAt: string | null
  lastError: string | null
  pending: number
  syncNow: () => Promise<void>
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
  signOut: () => Promise<void>
  updatePassword: (password: string) => Promise<string | null>
  engine: SyncEngine | null
}

interface AppState {
  store: DataStore
  snap: Snapshot
  today: Day
  actions: Actions
  cloud: Cloud
  toasts: Toast[]
  toast: (emoji: string, text: string) => void
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp hors du fournisseur')
  return v
}

let toastSeq = 0

function grantToast(g: RewardGrant): { emoji: string; text: string } | null {
  if (g.kind === 'badge') { const b = badgeDef(g.ref); return b ? { emoji: b.emoji, text: `${b.secret ? 'Badge secret découvert' : 'Badge débloqué'} : ${b.name}` } : null }
  if (g.kind === 'item') { const it = itemDef(g.ref.split('~')[0]); return it ? { emoji: it.emoji, text: `Nouvel objet pour ton univers : ${it.name}` } : null }
  if (g.kind === 'zone') { const z = ZONES.find(z => z.id === g.ref); return z && g.reason !== 'Ton univers de départ' ? { emoji: '🗝️', text: `Nouvelle zone ouverte : ${z.name}` } : null }
  if (g.kind === 'points') return { emoji: '💎', text: `+${g.points ?? 0} points : ${g.reason.toLowerCase()}` }
  if (g.kind === 'accessory') { const a = ACCESSORIES.find(a => a.id === g.ref); return a && a.id !== 'noeud' ? { emoji: '🎀', text: `Nouvel accessoire : ${a.name}` } : null }
  return null
}

export function AppProvider({ store, children }: { store: DataStore; children: ReactNode }) {
  const snap = useSyncExternalStore(cb => store.subscribe(cb), () => store.snapshot())
  const actions = useMemo(() => createActions(store), [store])
  const [today, setToday] = useState(toDay())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [engine, setEngine] = useState<SyncEngine | null>(null)
  const [, force] = useState(0)
  const [pending, setPending] = useState(0)
  const syncTimer = useRef<number | null>(null)

  const toast = useCallback((emoji: string, text: string) => {
    const id = ++toastSeq
    setToasts(t => [...t.slice(-2), { id, emoji, text }])
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200)
  }, [])

  // Récompenses : calculées à chaque écriture, annoncées une fois
  useEffect(() => {
    store.setDeriver(s => deriveOps(s))
    const off = store.onGrants(grants => {
      const xp = grants.reduce((n, g) => n + g.xp, 0)
      const shown = grants.map(grantToast).filter(Boolean) as { emoji: string; text: string }[]
      shown.slice(0, 3).forEach(t => toast(t.emoji, t.text))
      if (xp && !shown.length) toast('✨', `+${xp} points d'expérience`)
    })
    return () => { off(); store.setDeriver(null) }
  }, [store, toast])

  // Catalogue de recettes : la version en ligne (modifiable sans reconstruire) remplace la copie embarquée.
  useEffect(() => { loadRemoteCatalog().then(changed => { if (changed) force(x => x + 1) }) }, [])

  // Rappels du cycle : recalés au démarrage et chaque jour (une date prévue passée, un retard…).
  const cycleSig = hasProfileSig(snap)
  useEffect(() => { if (cycleSig) actions.syncCyclePushes() }, [cycleSig, today, actions])

  // Mises à niveau locales (eau en litres, 5 rappels d'eau) — une seule fois par profil.
  const upgraded = snap.profiles[0]?.settings.upgrades?.includes('lot1')
  const hasProfile = Boolean(snap.profiles[0])
  useEffect(() => { if (hasProfile && !upgraded) actions.ensureUpgrades() }, [hasProfile, upgraded, actions])

  // Changement de jour (minuit) et retour sur l'appli
  useEffect(() => {
    const tick = () => setToday(toDay())
    const t = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', tick) }
  }, [])

  // Session Supabase
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((event, sess) => {
      setSession(sess)
      // Lien « mot de passe oublié » : on propose directement d'en choisir un nouveau.
      if (event === 'PASSWORD_RECOVERY') navigate('/profil/nouveau-mot-de-passe', true)
      // Lien de confirmation d'e-mail : on nettoie l'adresse (jetons) et on revient à l'accueil.
      else if (event === 'SIGNED_IN' && /access_token|type=/.test(location.hash)) navigate('/', true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Moteur de synchronisation lié à la session
  useEffect(() => {
    const sb = supabase()
    if (!sb || !session?.user) { setEngine(null); return }
    const e = new SyncEngine(store, new SupabaseRemote(sb), session.user.id)
    let alive = true
    const off = e.onChange(() => force(x => x + 1))
    e.attach().then(() => { if (alive) return e.sync() })
    setEngine(e)
    const every = window.setInterval(() => e.sync(), 180_000)
    const onOnline = () => e.sync()
    const onVisible = () => { if (document.visibilityState === 'visible') e.sync() }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; off(); window.clearInterval(every); window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible) }
  }, [session?.user?.id, store])

  // Après chaque écriture faite sur ce téléphone : envoi groupé quelques secondes plus tard.
  // (Les données reçues du serveur ne déclenchent pas de nouvel envoi.)
  useEffect(() => {
    store.outboxCount().then(setPending).catch(() => {})
    const off = store.onLocalWrite(() => {
      store.outboxCount().then(setPending).catch(() => {})
      if (!engine) return
      if (syncTimer.current) window.clearTimeout(syncTimer.current)
      syncTimer.current = window.setTimeout(() => engine.sync().then(() => store.outboxCount().then(setPending)), 2500)
    })
    return () => { off(); if (syncTimer.current) window.clearTimeout(syncTimer.current) }
  }, [store, engine])

  const cloud: Cloud = {
    configured: cloudConfigured(),
    user: session?.user ? { id: session.user.id, email: session.user.email ?? null } : null,
    status: engine ? engine.status : 'deconnecte',
    lastSyncAt: engine?.lastSyncAt ?? null,
    lastError: engine?.lastError ?? null,
    pending,
    engine,
    syncNow: async () => { if (engine) { await engine.sync(); setPending(await store.outboxCount()) } },
    signIn: async (email, password) => {
      const sb = supabase(); if (!sb) return 'Sauvegarde en ligne non configurée.'
      const { error } = await sb.auth.signInWithPassword({ email, password })
      return error ? translateAuthError(error.message) : null
    },
    signUp: async (email, password) => {
      const sb = supabase(); if (!sb) return 'Sauvegarde en ligne non configurée.'
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
      if (error) return translateAuthError(error.message)
      return data.session ? null : 'CONFIRM'
    },
    resetPassword: async email => {
      const sb = supabase(); if (!sb) return 'Sauvegarde en ligne non configurée.'
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
      return error ? translateAuthError(error.message) : null
    },
    signOut: async () => { await supabase()?.auth.signOut() },
    updatePassword: async password => {
      const sb = supabase(); if (!sb) return 'Sauvegarde en ligne non configurée.'
      const { error } = await sb.auth.updateUser({ password })
      return error ? translateAuthError(error.message) : null
    },
  }

  return <Ctx.Provider value={{ store, snap, today, actions, cloud, toasts, toast }}>{children}</Ctx.Provider>
}

function hasProfileSig(s: Snapshot): string | null {
  if (!s.profiles[0]) return null
  return `${s.cycle_days.length}:${s.notification_preferences[0]?.cycle !== false}`
}

function translateAuthError(msg: string): string {
  if (/invalid login/i.test(msg)) return 'E-mail ou mot de passe incorrect.'
  if (/email not confirmed/i.test(msg)) return 'Ton adresse n\'est pas encore confirmée : ouvre l\'e-mail reçu et clique sur le lien.'
  if (/already registered|already exists/i.test(msg)) return 'Un compte existe déjà avec cette adresse : connecte-toi.'
  if (/password.*(6|characters|short)/i.test(msg)) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (/rate limit|too many/i.test(msg)) return 'Trop de tentatives d\'un coup. Réessaie dans quelques minutes.'
  if (/fetch|network/i.test(msg)) return 'Pas de connexion internet pour le moment.'
  return msg
}
