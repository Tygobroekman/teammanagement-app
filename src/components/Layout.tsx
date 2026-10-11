import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Logo from './Logo'

function Icoon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export default function Layout() {
  const { session, signOut } = useAuth()
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <span className="merk"><Logo />Opstelling</span>
          <button className="link klein" onClick={signOut} title={session?.user.email ?? ''}>
            Uitloggen
          </button>
        </div>
      </header>
      <div className="page">
        <Outlet />
      </div>
      <nav className="tabbar">
        <div className="tabbar-in">
          <NavLink to="/wedstrijden">
            <Icoon><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></Icoon>
            Wedstrijden
          </NavLink>
          <NavLink to="/spelers">
            <Icoon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icoon>
            Spelers
          </NavLink>
          <NavLink to="/seizoen">
            <Icoon><path d="M18 20V10M12 20V4M6 20v-6" /></Icoon>
            Seizoen
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
