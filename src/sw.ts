/// <reference lib="webworker" />
// Service worker : fonctionnement hors ligne + réception des notifications push.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('install', () => { self.skipWaiting() })
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
