import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Player } from '../lib/types'

export default function Spelers() {
  const [spelers, setSpelers] = useState<Player[] | null>(null)
  const [toonInactief, setToonInactief] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('players')
      .select('*')
      .order('naam')
      .then(({ data, error }) => {
        if (error) setFout('Spelers laden mislukt.')
        else setSpelers(data as Player[])
      })
  }, [])

  if (fout) return <p className="fout">{fout}</p>
  if (!spelers) return <p>Laden...</p>

  const zichtbaar = spelers.filter((s) => s.actief || toonInactief)
  const gewoon = zichtbaar.filter((s) => !s.langdurig_geblesseerd)
  const blessure = zichtbaar.filter((s) => s.langdurig_geblesseerd)
  const aantalActief = spelers.filter((s) => s.actief).length

  const rij = (s: Player) => (
    <li key={s.id}>
      <Link to={`/spelers/${s.id}`} className={s.actief ? '' : 'inactief'}>
        <span>{s.naam}</span>
        <span className="sub">
          {s.voorkeurspositie ?? ''} {s.actief ? '' : '(inactief)'}
        </span>
      </Link>
    </li>
  )

  return (
    <>
      <div className="rij">
        <h1>Spelers ({aantalActief})</h1>
        <Link to="/spelers/nieuw" className="knop">Toevoegen</Link>
      </div>
      <label className="regel">
        <input type="checkbox" checked={toonInactief} onChange={(e) => setToonInactief(e.target.checked)} />
        Toon ook inactieve spelers
      </label>
      {zichtbaar.length === 0 && <p>Nog geen spelers. Voeg de eerste toe.</p>}
      <ul className="lijst">{gewoon.map(rij)}</ul>
      {blessure.length > 0 && (
        <>
          <h2>Langdurig geblesseerd ({blessure.length})</h2>
          <ul className="lijst">{blessure.map(rij)}</ul>
        </>
      )}
    </>
  )
}
