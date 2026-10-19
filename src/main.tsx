import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/nunito'
import './styles/app.css'
import { DataStore } from './data/store'
import { AppProvider } from './app/state'
import { App } from './App'
import { registerServiceWorker } from './lib/push'

async function start() {
  const root = createRoot(document.getElementById('root')!)
  try {
    const store = await DataStore.open()
    // Demande au navigateur de ne pas effacer les données de l'appli en cas de manque d'espace.
    navigator.storage?.persist?.().catch(() => {})
    root.render(<StrictMode><AppProvider store={store}><App /></AppProvider></StrictMode>)
    registerServiceWorker()
  } catch (err) {
    root.render(
      <div className="onboarding">
        <h1>Impossible d'ouvrir Élan</h1>
        <p className="muted">Le stockage de ce navigateur n'est pas accessible (navigation privée ?). Ouvre l'appli dans Chrome, hors navigation privée.</p>
        <p className="small muted">{String(err)}</p>
      </div>,
    )
  }
}
start()
