import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSeasons } from '../lib/useSeasons'

type Rij = {
  player_id: string
  naam: string
  wedstrijden: number
  aanwezig: number
  afwezig: number
  geblesseerd: number
  minuten_gespeeld: number
  minuten_bank: number
}

type Sortering = 'naam' | 'gespeeld' | 'bank' | 'aanwezig'

export default function Seizoen() {
  const { seasons, currentId, kies } = useSeasons()
  const [rijen, setRijen] = useState<Rij[] | null>(null)
  const [sort, setSort] = useState<Sortering>('gespeeld')
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    if (!currentId) return
    setRijen(null)
    supabase
      .from('season_overview')
      .select('*')
      .eq('season_id', currentId)
      .then(({ data, error }) => {
        if (error) setFout('Overzicht laden mislukt.')
        else setRijen(data as Rij[])
      })
  }, [currentId])

  if (!seasons) return <p>Laden...</p>
  if (seasons.length === 0) return <><h1>Seizoen</h1><p>Er is nog geen seizoen. Maak er een aan onder Wedstrijden.</p></>

  const aantalWedstrijden = rijen?.reduce((m, r) => Math.max(m, r.wedstrijden), 0) ?? 0
  const gesorteerd = rijen && [...rijen].sort((a, b) => {
    if (sort === 'naam') return a.naam.localeCompare(b.naam, 'nl')
    if (sort === 'gespeeld') return b.minuten_gespeeld - a.minuten_gespeeld
    if (sort === 'bank') return b.minuten_bank - a.minuten_bank
    return b.aanwezig - a.aanwezig
  })

  return (
    <>
      <h1>Seizoen</h1>
      <div className="regel">
        <select value={currentId ?? ''} onChange={(e) => kies(e.target.value)}>
          {seasons.map((s) => <option key={s.id} value={s.id}>Seizoen {s.naam}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sortering)} aria-label="Sorteren">
          <option value="gespeeld">Meeste minuten</option>
          <option value="bank">Meeste bankminuten</option>
          <option value="aanwezig">Meest aanwezig</option>
          <option value="naam">Naam</option>
        </select>
      </div>
      {fout && <p className="fout">{fout}</p>}
      {!gesorteerd ? <p>Laden...</p> : gesorteerd.length === 0 ? (
        <p>Nog geen definitieve wedstrijden. Zet een wedstrijd op "Definitief" om hem mee te laten tellen.</p>
      ) : (
        <>
          <p className="sub">{aantalWedstrijden} definitieve wedstrijd{aantalWedstrijden === 1 ? '' : 'en'}.</p>
          <div className="tabelwrap">
            <table className="tabel">
              <thead>
                <tr><th>Speler</th><th>Aanw</th><th>Afw</th><th>Gebl</th><th>Min</th><th>Bank</th><th>Gem</th></tr>
              </thead>
              <tbody>
                {gesorteerd.map((r) => (
                  <tr key={r.player_id}>
                    <td>{r.naam}</td>
                    <td>{r.aanwezig}</td>
                    <td>{r.afwezig}</td>
                    <td>{r.geblesseerd}</td>
                    <td>{r.minuten_gespeeld}</td>
                    <td>{r.minuten_bank}</td>
                    <td>{r.aanwezig ? Math.round(r.minuten_gespeeld / r.aanwezig) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sub">
            Aanw = aanwezig, Afw = afwezig, Gebl = geblesseerd, Min = gespeelde minuten, Bank = minuten op de bank,
            Gem = gemiddeld aantal gespeelde minuten per aanwezige wedstrijd. Spelers die niet zijn opgegeven tellen
            nergens mee.
          </p>
        </>
      )}
    </>
  )
}
