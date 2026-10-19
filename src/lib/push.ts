// Notifications système réelles :
// - push (Web Push) : envoyées par le serveur Supabase à l'heure prévue, même appli fermée ;
// - locales : affichées par le service worker quand l'appli est ouverte (report de 15 min sans compte).
import { supabase } from '../data/supabase'
import { getConfig } from './config'
import { hash } from './ids'

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(err => console.warn('Service worker', err))
}

export type PushSupport = 'ok' | 'non-supporte' | 'refuse' | 'non-installe'

export function pushSupport(): PushSupport {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'non-supporte'
  if (Notification.permission === 'denied') return 'refuse'
  return 'ok'
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Demande l'autorisation, abonne l'appareil et enregistre l'abonnement sur le compte. */
export async function enablePush(userId: string): Promise<string | null> {
  const key = getConfig().vapidPublicKey
  if (!key) return 'Les rappels ne sont pas encore configurés sur le serveur.'
  if (pushSupport() === 'non-supporte') return 'Ce navigateur ne gère pas les notifications. Utilise Chrome sur Android et installe l\'appli sur l\'écran d\'accueil.'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'Notifications refusées. Tu peux les autoriser dans les réglages du site (cadenas à côté de l\'adresse).'
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource })
  const json = sub.toJSON()
  const sb = supabase()
  if (!sb) return 'Sauvegarde en ligne non configurée.'
  const { error } = await sb.from('push_subscriptions').upsert({
    user_id: userId, id: 'sub-' + hash(json.endpoint!), endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth,
    user_agent: navigator.userAgent.slice(0, 200), updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,id' })
  return error ? 'Abonnement non enregistré : ' + error.message : null
}

export async function disablePush(userId: string) {
  const sub = await currentSubscription()
  if (!sub) return
  const sb = supabase()
  await sb?.from('push_subscriptions').delete().eq('user_id', userId).eq('id', 'sub-' + hash(sub.endpoint))
  await sub.unsubscribe()
}

/** Notification système locale (appli ouverte) : utilisée pour le report de 15 minutes. */
export async function localNotification(title: string, body: string, url = '#/') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker?.getRegistration()
  if (!reg) return false
  await reg.showNotification(title, { body, icon: './icons/icon-192.png', badge: './icons/badge-96.png', data: { url }, tag: 'elan-local' })
  return true
}
