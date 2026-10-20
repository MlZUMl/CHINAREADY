import { useState } from 'react'
import { useApp } from '../app/state'
import { TopBar } from '../ui/components'
import { IconRefresh } from '../ui/icons'

export function AuthForm({ compact = false }: { compact?: boolean }) {
  const { cloud } = useApp()
  const [mode, setMode] = useState<'creer' | 'connexion' | 'oubli'>('creer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    if (mode === 'oubli') {
      const err = await cloud.resetPassword(email.trim())
      setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Si un compte existe, un e-mail de réinitialisation vient d\'être envoyé.' })
    } else {
      const err = mode === 'creer' ? await cloud.signUp(email.trim(), password) : await cloud.signIn(email.trim(), password)
      if (err === 'CONFIRM') setMsg({ ok: true, text: 'Compte créé ! Ouvre l\'e-mail de confirmation reçu, clique sur le lien, puis reviens te connecter ici.' })
      else if (err) setMsg({ ok: false, text: err })
    }
    setBusy(false)
  }
  return (
    <form className="stack" onSubmit={submit}>
      {!compact && <p className="muted small">Un compte gratuit sauvegarde tes données en ligne, les synchronise entre tes appareils et permet les rappels appli fermée.</p>}
      <div className="segmented" role="tablist">
        <button type="button" className={mode === 'creer' ? 'on' : ''} onClick={() => setMode('creer')}>Créer un compte</button>
        <button type="button" className={mode === 'connexion' ? 'on' : ''} onClick={() => setMode('connexion')}>Me connecter</button>
      </div>
      <label className="field">E-mail<input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      {mode !== 'oubli' && <label className="field">Mot de passe <span className="hint">6 caractères minimum</span>
        <input className="input" type="password" autoComplete={mode === 'creer' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /></label>}
      {msg && <div className="banner" style={msg.ok ? { background: 'var(--mousse-clair)', color: 'var(--vert)' } : undefined}>{msg.text}</div>}
      <button className="btn primary block" disabled={busy}>{mode === 'creer' ? 'Créer mon compte' : mode === 'connexion' ? 'Me connecter' : 'Envoyer le lien'}</button>
      {mode === 'connexion' && <button type="button" className="link-btn" onClick={() => setMode('oubli')}>Mot de passe oublié ?</button>}
      {mode === 'oubli' && <button type="button" className="link-btn" onClick={() => setMode('connexion')}>Retour à la connexion</button>}
    </form>
  )
}

export function Account() {
  const { cloud } = useApp()
  return (
    <>
      <TopBar onBack title="Compte et sauvegarde" />
      <main className="content no-tabs">
        {!cloud.configured ? (
          <section className="card"><p className="muted">La sauvegarde en ligne n'est pas configurée sur cette version de l'appli : tes données restent sur ce téléphone.</p></section>
        ) : cloud.user ? (
          <>
            <section className="card">
              <div className="kicker">Connectée</div>
              <h2 style={{ wordBreak: 'break-all' }}>{cloud.user.email}</h2>
              <p className="muted small">
                {cloud.status === 'pret' && `Tout est synchronisé${cloud.lastSyncAt ? ` (dernière fois à ${new Date(cloud.lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})` : ''}.`}
                {cloud.status === 'en-cours' && 'Synchronisation en cours…'}
                {cloud.status === 'hors-ligne' && 'Hors ligne : tes modifications sont gardées sur le téléphone et partiront dès le retour du réseau.'}
                {cloud.status === 'erreur' && `La dernière synchronisation a échoué : ${cloud.lastError}`}
              </p>
              {cloud.pending > 0 && <p className="small">{cloud.pending} modification{cloud.pending > 1 ? 's' : ''} en attente d'envoi.</p>}
              <button className="btn secondary" onClick={() => cloud.syncNow()}><IconRefresh /> Synchroniser maintenant</button>
            </section>
            <button className="btn ghost block" onClick={async () => { await cloud.syncNow(); await cloud.signOut() }}>Me déconnecter</button>
            <p className="muted small">Se déconnecter garde tes données sur ce téléphone. Si un autre compte se connecte ensuite, ce téléphone est vidé avant, pour ne jamais mélanger les données.</p>
          </>
        ) : (
          <section className="card"><AuthForm /></section>
        )}
      </main>
    </>
  )
}
