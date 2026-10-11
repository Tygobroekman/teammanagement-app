import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Layout() {
  const { session, signOut } = useAuth()
  return (
    <div className="shell">
      <header className="topbar">
        <strong>Opstelling</strong>
        <button className="link klein" onClick={signOut} title={session?.user.email ?? ''}>
          Uitloggen
        </button>
      </header>
      <div className="page">
        <Outlet />
      </div>
      <nav className="tabbar">
        <NavLink to="/spelers">Spelers</NavLink>
        <NavLink to="/wedstrijden">Wedstrijden</NavLink>
        <NavLink to="/seizoen">Seizoen</NavLink>
      </nav>
    </div>
  )
}
