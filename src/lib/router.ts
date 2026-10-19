// Routeur minimal par ancre (#/…) : fonctionne sur GitHub Pages et hors ligne.
import { useEffect, useState } from 'react'

export function currentPath(): string {
  const h = typeof location !== 'undefined' ? location.hash.replace(/^#/, '') : ''
  // Une ancre qui n'est pas un chemin (ex. jetons d'un lien de connexion) mène à l'accueil.
  return h.startsWith('/') ? h : '/'
}

export function navigate(path: string, replace = false) {
  const url = '#' + path
  if (replace) history.replaceState(null, '', url)
  else history.pushState(null, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  window.scrollTo(0, 0)
}

export function back(fallback = '/') {
  if (history.length > 1) history.back()
  else navigate(fallback, true)
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath())
  useEffect(() => {
    const on = () => setPath(currentPath())
    window.addEventListener('hashchange', on)
    window.addEventListener('popstate', on)
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('popstate', on) }
  }, [])
  return path
}

/** Sépare le chemin et les paramètres : « /seance?min=10&focus=mobilite » */
export function parsePath(path: string): { route: string; query: URLSearchParams } {
  const [route, q] = path.split('?')
  return { route, query: new URLSearchParams(q ?? '') }
}

export function match(pattern: string, route: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const r = route.split('/').filter(Boolean)
  if (p.length !== r.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(r[i])
    else if (p[i] !== r[i]) return null
  }
  return params
}
