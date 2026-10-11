import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { standaardSeizoenNaam, useSeasons } from '../lib/useSeasons'
import { datumBlok } from '../lib/format'
import type { Match } from '../lib/types'

export default function Wedstrijden() {
  const { seasons, currentId, kies, maakAan } = useSeasons()
  const [wedstrijden, setWedstrijden] = useState<Match[] | null>(null)
  const [nieuwSeizoen, setNieuwSeizoen] = useState(false)
  const [naam, setNaam] = useState(standaardSeizoenNaam())
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    if (!currentId) return
    supabase
      .from('matches')
      .select('*')
      .eq('season_id', currentId)
      .order('aanvang', { ascending: false })
      .then(({ data, error }) => {
        if (error) setFout('Wedstrijden laden mislukt.')
        else setWedstrijden(data as Match[])
      })
  }, [currentId])

  async function seizoenOpslaan() {
    const ok = await maakAan(naam.trim())
    if (!ok) return setFout('Seizoen aanmaken mislukt (bestaat de naam al?).')
    setFout(null)
    setNieuwSeizoen(false)
    setWedstrijden(null)
  }

  if (!seasons) return <p>Laden...</p>

  // Een wedstrijd telt tot drie uur na de aftrap nog als komend.
  const grens = Date.now() - 3 * 60 * 60 * 1000
  const komend = (wedstrijden ?? []).filter((m) => new Date(m.aanvang).getTime() >= grens)
    .sort((a, b) => a.aanvang.localeCompare(b.aanvang))
  const eerder = (wedstrijden ?? []).filter((m) => new Date(m.aanvang).getTime() < grens)
    .sort((a, b) => b.aanvang.localeCompare(a.aanvang))

  const lijst = (rijen: Match[]) => (
    <ul className="lijst">
      {rijen.map((m) => {
        const d = datumBlok(m.aanvang)
        const gespeeld = m.doelpunten_voor !== null && m.doelpunten_tegen !== null
        return (
          <li key={m.id}>
            <Link to={`/wedstrijden/${m.id}`} className="wk">
              <span className="datum"><b>{d.dag}</b><small>{d.maand}</small></span>
              <span className="tekst">
                <strong>{m.thuis_uit === 'thuis' ? 'Thuis' : 'Uit'} tegen {m.tegenstander}</strong>
                <span className="sub">{d.tijd}</span>
              </span>
              <span className="rechts">
                {gespeeld && <span className="uitslagtekst">{m.doelpunten_voor} - {m.doelpunten_tegen}</span>}
                <span className={`pil ${m.status}`}>{m.status}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )

  if (seasons.length === 0 || nieuwSeizoen) {
    return (
      <div className="form">
        <h1>{seasons.length === 0 ? 'Eerste seizoen' : 'Nieuw seizoen'}</h1>
        <label>
          Naam van het seizoen
          <input value={naam} onChange={(e) => setNaam(e.target.value)} />
        </label>
        {fout && <p className="fout">{fout}</p>}
        <button onClick={seizoenOpslaan} disabled={!naam.trim()}>Seizoen aanmaken</button>
        {seasons.length > 0 && <button className="link" onClick={() => setNieuwSeizoen(false)}>Annuleren</button>}
      </div>
    )
  }

  return (
    <>
      <div className="rij">
        <h1>Wedstrijden</h1>
        <Link to="/wedstrijden/nieuw" className="knop">Toevoegen</Link>
      </div>
      <div className="regel">
        <select value={currentId ?? ''} onChange={(e) => { setWedstrijden(null); kies(e.target.value) }}>
          {seasons.map((s) => <option key={s.id} value={s.id}>Seizoen {s.naam}</option>)}
        </select>
        <button className="link klein" onClick={() => { setNaam(standaardSeizoenNaam()); setNieuwSeizoen(true) }}>
          Nieuw seizoen
        </button>
      </div>
      {fout && <p className="fout">{fout}</p>}
      {!wedstrijden ? <p>Laden...</p> : wedstrijden.length === 0 ? <p className="leeg-staat">Nog geen wedstrijden dit seizoen.</p> : (
        <>
          {komend.length > 0 && (
            <>
              <h2>Volgende wedstrijd</h2>
              {lijst(komend.slice(0, 1))}
            </>
          )}
          {komend.length > 1 && (
            <>
              <h2>Komende wedstrijden ({komend.length - 1})</h2>
              {lijst(komend.slice(1))}
            </>
          )}
          {eerder.length > 0 && (
            <>
              <h2>Eerder ({eerder.length})</h2>
              {lijst(eerder)}
            </>
          )}
        </>
      )}
    </>
  )
}
