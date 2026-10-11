import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import Login from './pages/Login'

function Inhoud() {
  const { loading, session, isCaptain, signOut } = useAuth()

  if (!isConfigured) {
    return (
      <main className="page">
        <h1>Opstelling</h1>
        <p>Supabase is nog niet ingesteld. Vul .env in (zie .env.example).</p>
      </main>
    )
  }
  if (loading) return <main className="page"><p>Laden...</p></main>
  if (!session) return <Login />

  if (!isCaptain) {
    return (
      <main className="page">
        <h1>Geen toegang</h1>
        <p>{session.user.email} staat niet op de lijst van captains.</p>
        <button onClick={signOut}>Uitloggen</button>
      </main>
    )
  }

  return (
    <main className="page">
      <h1>Opstelling</h1>
      <p>Ingelogd als {session.user.email}. Spelers en wedstrijden volgen in de volgende stappen.</p>
      <button onClick={signOut}>Uitloggen</button>
    </main>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Inhoud />
    </AuthProvider>
  )
}
