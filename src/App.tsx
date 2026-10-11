import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import Spelers from './pages/Spelers'
import SpelerForm from './pages/SpelerForm'
import Wedstrijden from './pages/Wedstrijden'
import MatchForm from './pages/MatchForm'
import Wedstrijd from './pages/Wedstrijd'
import Wissels from './pages/Wissels'
import Seizoen from './pages/Seizoen'
import Generator from './pages/Generator'

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
    <Routes>
      <Route element={<Layout />}>
        <Route path="/spelers" element={<Spelers />} />
        <Route path="/spelers/nieuw" element={<SpelerForm />} />
        <Route path="/spelers/:id" element={<SpelerForm />} />
        <Route path="/wedstrijden" element={<Wedstrijden />} />
        <Route path="/wedstrijden/nieuw" element={<MatchForm />} />
        <Route path="/wedstrijden/:id" element={<Wedstrijd />} />
        <Route path="/wedstrijden/:id/voorstel" element={<Generator />} />
        <Route path="/wedstrijden/:id/wissels" element={<Wissels />} />
        <Route path="/wedstrijden/:id/bewerken" element={<MatchForm />} />
        <Route path="/seizoen" element={<Seizoen />} />
        <Route path="*" element={<Navigate to="/spelers" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Inhoud />
    </AuthProvider>
  )
}
