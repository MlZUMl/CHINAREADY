import { useEffect } from 'react'
import { useApp } from './app/state'
import { usePath, parsePath, match } from './lib/router'
import { IconActivity, IconFood, IconHome, IconProgress, IconUniverse } from './ui/icons'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Ritual } from './screens/Ritual'
import { SessionPlayer, SessionDone } from './screens/SessionPlayer'
import { Programs } from './screens/Programs'
import { Activity } from './screens/Activity'
import { Food } from './screens/Food'
import { RecipeDetail } from './screens/RecipeDetail'
import { FoodAdd } from './screens/FoodAdd'
import { Progress } from './screens/Progress'
import { CapsuleScreen, CapsuleCreate } from './screens/Capsules'
import { WeeklyReviewScreen } from './screens/WeeklyReview'
import { Universe } from './screens/Universe'
import { Profile } from './screens/Profile'
import { Account } from './screens/Account'
import { CommitmentsScreen } from './screens/Commitments'
import { Resume } from './screens/Resume'
import { NewPassword } from './screens/NewPassword'

const TABS = [
  { path: '/', label: 'Accueil', Icon: IconHome, match: (r: string) => r === '/' },
  { path: '/activite', label: 'Activité', Icon: IconActivity, match: (r: string) => r.startsWith('/activite') },
  { path: '/repas', label: 'Repas', Icon: IconFood, match: (r: string) => r.startsWith('/repas') },
  { path: '/progres', label: 'Progrès', Icon: IconProgress, match: (r: string) => r.startsWith('/progres') },
  { path: '/univers', label: 'Univers', Icon: IconUniverse, match: (r: string) => r.startsWith('/univers') },
]

export function App() {
  const { snap, toasts, actions, today } = useApp()
  const path = usePath()
  const { route, query } = parsePath(path)
  const onboarded = snap.profiles[0]?.onboarded

  useEffect(() => { if (onboarded) actions.markPresence(today) }, [onboarded, today, actions])

  // Lien « mot de passe oublié » : accessible même avant la fin de l'accueil.
  if (route === '/profil/nouveau-mot-de-passe') return <div className="app"><NewPassword />{toastZone()}</div>
  if (!onboarded) return <><Onboarding />{toastZone()}</>

  let screen: React.ReactNode
  let tabs = true
  let p: Record<string, string> | null
  if (route === '/') screen = <Home query={query} />
  else if (route === '/rituel') { screen = <Ritual query={query} />; tabs = false }
  else if (route === '/seance') { screen = <SessionPlayer query={query} />; tabs = false }
  else if (route === '/seance/termine') { screen = <SessionDone query={query} />; tabs = false }
  else if (route === '/reprise') { screen = <Resume />; tabs = false }
  else if (route === '/activite/programmes') { screen = <Programs />; tabs = false }
  else if (route.startsWith('/activite')) screen = <Activity />
  else if ((p = match('/repas/recette/:id', route))) { screen = <RecipeDetail id={p.id} />; tabs = false }
  else if (route === '/repas/ajouter') { screen = <FoodAdd query={query} />; tabs = false }
  else if (route.startsWith('/repas')) screen = <Food query={query} />
  else if (route === '/progres/capsule/nouvelle') { screen = <CapsuleCreate />; tabs = false }
  else if ((p = match('/progres/capsule/:id', route))) { screen = <CapsuleScreen id={p.id} />; tabs = false }
  else if (route === '/progres/bilan') { screen = <WeeklyReviewScreen />; tabs = false }
  else if (route.startsWith('/progres')) screen = <Progress query={query} />
  else if (route.startsWith('/univers')) screen = <Universe query={query} />
  else if (route === '/profil/compte') { screen = <Account />; tabs = false }
  else if (route === '/profil/engagements') { screen = <CommitmentsScreen />; tabs = false }
  else if (route.startsWith('/profil')) { screen = <Profile />; tabs = false }
  else screen = <Home query={query} />

  return (
    <div className="app">
      {screen}
      {tabs && (
        <nav className="tabbar" aria-label="Navigation principale">
          {TABS.map(t => (
            <a key={t.path} href={'#' + t.path} className={t.match(route) ? 'active' : ''} aria-current={t.match(route) ? 'page' : undefined}>
              <t.Icon />{t.label}
            </a>
          ))}
        </nav>
      )}
      {toastZone()}
    </div>
  )

  function toastZone() {
    return (
      <div className="toast-zone" aria-live="polite">
        {toasts.map(t => <div className="toast" key={t.id} role="status"><span className="em" aria-hidden="true">{t.emoji}</span><span>{t.text}</span></div>)}
      </div>
    )
  }
}
