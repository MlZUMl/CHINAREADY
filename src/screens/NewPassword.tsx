import { useState } from 'react'
import { useApp } from '../app/state'
import { TopBar } from '../ui/components'
import { navigate } from '../lib/router'

/** Ouvert depuis le lien « mot de passe oublié » reçu par e-mail. */
export function NewPassword() {
  const { cloud, toast } = useApp()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const err = await cloud.updatePassword(password)
    setBusy(false)
    if (err) { setError(err); return }
    toast('🔑', 'Nouveau mot de passe enregistré')
    navigate('/', true)
  }
  return (
    <>
      <TopBar onBack title="Nouveau mot de passe" />
      <main className="content no-tabs">
        {!cloud.user ? (
          <section className="card"><p className="muted">Ce lien a expiré ou a déjà servi. Redemande un lien depuis « Compte et sauvegarde ».</p></section>
        ) : (
          <form className="card" onSubmit={submit}>
            <p className="muted">Choisis ton nouveau mot de passe pour {cloud.user.email}.</p>
            <label className="field">Nouveau mot de passe <span className="hint">6 caractères minimum</span>
              <input className="input" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            {error && <div className="banner">{error}</div>}
            <button className="btn primary block" disabled={busy}>Enregistrer</button>
          </form>
        )}
      </main>
    </>
  )
}
