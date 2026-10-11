import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Player, PlayerPosition, Position, Voet } from '../lib/types'

export default function SpelerForm() {
  const { id } = useParams()
  const nieuw = !id
  const navigate = useNavigate()

  const [posities, setPosities] = useState<Position[]>([])
  const [naam, setNaam] = useState('')
  const [voorkeurspositie, setVoorkeurspositie] = useState('')
  const [voet, setVoet] = useState<Voet>('rechts')
  const [notities, setNotities] = useState('')
  const [actief, setActief] = useState(true)
  const [langdurig, setLangdurig] = useState(false)
  const [niveaus, setNiveaus] = useState<Record<string, number>>({})
  const [laden, setLaden] = useState(true)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    async function laad() {
      const pos = await supabase.from('positions').select('*').order('volgorde')
      if (pos.error) return setFout('Laden mislukt.')
      setPosities(pos.data as Position[])
      if (id) {
        const [sp, pp] = await Promise.all([
          supabase.from('players').select('*').eq('id', id).single(),
          supabase.from('player_positions').select('*').eq('player_id', id),
        ])
        if (sp.error || pp.error) return setFout('Speler niet gevonden.')
        const p = sp.data as Player
        setNaam(p.naam)
        setVoorkeurspositie(p.voorkeurspositie ?? '')
        setVoet(p.voorkeursvoet)
        setNotities(p.notities ?? '')
        setActief(p.actief)
        setLangdurig(p.langdurig_geblesseerd)
        const n: Record<string, number> = {}
        for (const r of pp.data as PlayerPosition[]) n[r.position_code] = r.niveau
        setNiveaus(n)
      }
      setLaden(false)
    }
    laad()
  }, [id])

  async function opslaan(e: FormEvent) {
    e.preventDefault()
    setBezig(true)
    setFout(null)
    const rij = {
      naam: naam.trim(),
      voorkeurspositie: voorkeurspositie || null,
      voorkeursvoet: voet,
      notities: notities.trim() || null,
      actief,
      langdurig_geblesseerd: langdurig,
    }
    const res = id
      ? await supabase.from('players').update(rij).eq('id', id).select('id').single()
      : await supabase.from('players').insert(rij).select('id').single()
    if (res.error) {
      setBezig(false)
      return setFout('Opslaan mislukt.')
    }
    const spelerId = res.data.id as string
    // Posities en niveaus vervangen door de nieuwe keuze.
    const del = await supabase.from('player_positions').delete().eq('player_id', spelerId)
    const nieuweRijen = Object.entries(niveaus)
      .filter(([, n]) => n > 0)
      .map(([position_code, niveau]) => ({ player_id: spelerId, position_code, niveau }))
    const ins = nieuweRijen.length
      ? await supabase.from('player_positions').insert(nieuweRijen)
      : { error: null }
    setBezig(false)
    if (del.error || ins.error) return setFout('Posities opslaan mislukt.')
    navigate('/spelers')
  }

  async function verwijder() {
    if (!id || !window.confirm(`${naam} definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return
    setFout(null)
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) {
      // 23503 = er verwijzen nog wedstrijdgegevens naar deze speler
      return setFout(
        error.code === '23503'
          ? 'Deze speler heeft wedstrijdgeschiedenis en kan niet worden verwijderd. Zet hem op inactief, dan blijft de geschiedenis kloppen.'
          : 'Verwijderen mislukt.',
      )
    }
    navigate('/spelers')
  }

  if (laden && !fout) return <p>Laden...</p>

  return (
    <form onSubmit={opslaan} className="form">
      <h1>{nieuw ? 'Nieuwe speler' : 'Speler bewerken'}</h1>
      <label>
        Naam
        <input required value={naam} onChange={(e) => setNaam(e.target.value)} />
      </label>

      <fieldset>
        <legend>Posities en niveau</legend>
        <p className="sub">Kies per positie het niveau (1 zwak, 5 sterk). Laat leeg als hij daar niet speelt.</p>
        {posities.map((p) => (
          <div className="regel" key={p.code}>
            <span className="breed">{p.naam}</span>
            <select
              value={niveaus[p.code] ?? 0}
              onChange={(e) => setNiveaus({ ...niveaus, [p.code]: Number(e.target.value) })}
            >
              <option value={0}>-</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        ))}
      </fieldset>

      <label>
        Voorkeurspositie
        <select value={voorkeurspositie} onChange={(e) => setVoorkeurspositie(e.target.value)}>
          <option value="">Geen voorkeur</option>
          {posities.map((p) => (
            <option key={p.code} value={p.code}>{p.naam}</option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Voorkeursvoet</legend>
        <div className="keuze">
          {(['links', 'rechts', 'beide'] as Voet[]).map((v) => (
            <button type="button" key={v} className={voet === v ? 'actief' : ''} onClick={() => setVoet(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>

      <label>
        Notities (alleen voor captains)
        <textarea rows={3} value={notities} onChange={(e) => setNotities(e.target.value)} />
      </label>

      <label className="regel">
        <input type="checkbox" checked={actief} onChange={(e) => setActief(e.target.checked)} />
        Actief in de selectie
      </label>

      <label className="regel">
        <input type="checkbox" checked={langdurig} onChange={(e) => setLangdurig(e.target.checked)} />
        Langdurig geblesseerd (staat bij nieuwe wedstrijden standaard op geblesseerd)
      </label>

      {fout && <p className="fout">{fout}</p>}
      <button disabled={bezig}>{bezig ? 'Opslaan...' : 'Opslaan'}</button>
      <button type="button" className="link" onClick={() => navigate('/spelers')}>Annuleren</button>
      {!nieuw && <button type="button" className="link gevaar" onClick={verwijder}>Speler verwijderen</button>}
    </form>
  )
}
