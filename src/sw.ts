/// <reference lib="webworker" />
// Service worker : fonctionnement hors ligne + réception des notifications push.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('install', () => { self.skipWaiting() })

// Données (table Ciqual, catalogue de recettes) : réseau d'abord pour voir les mises à jour,
// copie locale en secours hors ligne. Photos des recettes : copie locale d'abord (60 au plus,
// seulement si le serveur d'images l'autorise ; sinon le cache du navigateur s'en charge).
const DATA_CACHE = 'elan-donnees-v1'
const PHOTO_CACHE = 'elan-photos-v1'
self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin === self.location.origin && /\/data\/[\w-]+\.json$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE)
      try {
        const res = await fetch(req, { cache: 'no-cache' })
        if (res.ok) await cache.put(url.pathname, res.clone())
        return res
      } catch {
        return (await cache.match(url.pathname)) ?? Response.error()
      }
    })())
    return
  }
  if (url.hostname === 'images.pexels.com') {
    event.respondWith((async () => {
      const cache = await caches.open(PHOTO_CACHE)
      const hit = await cache.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) {
        await cache.put(req, res.clone())
        const keys = await cache.keys()
        for (const k of keys.slice(0, Math.max(0, keys.length - 60))) await cache.delete(k)
      }
      return res
    })())
  }
})
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()) })

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
  /** Boutons de la notification : { action, title, url } */
  actions?: { action: string; title: string; url: string }[]
}

self.addEventListener('push', event => {
  let data: PushPayload = {}
  try { data = event.data?.json() ?? {} } catch { data = { body: event.data?.text() } }
  const title = data.title || 'Élan'
  const actions = (data.actions ?? []).slice(0, 2)
  const options: NotificationOptions & { actions?: { action: string; title: string }[] } = {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/badge-96.png',
    tag: data.tag || 'elan',
    data: { url: data.url || '#/', actions },
  }
  if (actions.length) options.actions = actions.map(a => ({ action: a.action, title: a.title }))
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const d = (event.notification.data ?? {}) as { url?: string; actions?: { action: string; url: string }[] }
  const fromAction = event.action ? d.actions?.find(a => a.action === event.action)?.url : undefined
  const hash = fromAction || d.url || '#/'
  const target = new URL(self.registration.scope)
  target.hash = hash.replace(/^#/, '')
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await (c as WindowClient).focus()
        await (c as WindowClient).navigate(target.href).catch(() => {})
        return
      }
    }
    await self.clients.openWindow(target.href)
  })())
})
