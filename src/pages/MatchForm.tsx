import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSeasons } from '../lib/useSeasons'
import { useBevestig } from '../components/Bevestig'
import { naarInput, standaardAanvang } from '../lib/format'
import type { Formation, Match } from '../lib/types'

export default function MatchForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentId } = useSeasons()
  const { vraag, dialoog } = useBevestig()

  const [formaties, setFormaties] = useState<Formation[]>([])
  const [aanvang, setAanvang] = useState(standaardAanvang())
  const [tegenstander, setTegenstander] = useState('')
  const [thuisUit, setThuisUit] = useState<'thuis' | 'uit'>('thuis')
  const [formatie, setFormatie] = useState('4-3-3')
  const [duur, setDuur] = useState(90)
  const [voor, setVoor] = useState('')
  const [tegen, setTegen] = useState('')
  const [laden, setLaden] = useState(Boolean(id))
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('formations').select('*').order('code').then(({ data }) => setFormaties((data ?? []) as Formation[]))
    if (!id) return
    supabase.from('matches').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) return setFout('Wedstrijd niet gevonden.')
      const m = data as Match
      setAanvang(naarInput(m.aanvang))
      setTegenstander(m.tegenstander)
      setThuisUit(m.thuis_uit)
      setFormatie(m.formation_code)
      setDuur(m.duur_minuten)
      setVoor(m.doelpunten_voor?.toString() ?? '')
      setTegen(m.doelpunten_tegen?.toString() ?? '')
      setLaden(false)
    })
  }, [id])

  async function opslaan(e: FormEvent) {
    e.preventDefault()
    setBezig(true)
    setFout(null)
    const rij = {
      aanvang: new Date(aanvang).toISOString(),
      tegenstander: tegenstander.trim(),
      thuis_uit: thuisUit,
      formation_code: formatie,
      duur_minuten: duur,
      doelpunten_voor: voor === '' ? null : Number(voor),
      doelpunten_tegen: tegen === '' ? null : Number(tegen),
    }
    if (id) {
      const { error } = await supabase.from('matches').update(rij).eq('id', id)
      setBezig(false)
      if (error) return setFout('Opslaan mislukt.')
      return navigate(`/wedstrijden/${id}`)
    }
    if (!currentId) { setBezig(false); return setFout('Geen seizoen gevonden.') }
    const { data, error } = await supabase.from('matches').insert({ ...rij, season_id: currentId }).select('id').single()
    if (error) { setBezig(false); return setFout('Opslaan mislukt.') }
    // Langdurig geblesseerde spelers staan standaard op geblesseerd.
    const lang = await supabase.from('players').select('id').eq('actief', true).eq('langdurig_geblesseerd', true)
    if (!lang.error && lang.data.length > 0) {
      await supabase.from('attendance').insert(
        lang.data.map((p) => ({ match_id: data.id, player_id: p.id as string, status: 'geblesseerd' })),
      )
    }
    setBezig(false)
    navigate(`/wedstrijden/${data.id}`)
  }

  async function verwijder() {
    if (!id || !(await vraag('Deze wedstrijd met opstelling, aanwezigheid en wissels definitief verwijderen?'))) return
    const { error } = await supabase.from('matches').delete().eq('id', id)
    if (error) return setFout('Verwijderen mislukt.')
    navigate('/wedstrijden')
  }

  if (laden && !fout) return <p>Laden...</p>

  return (
    <form onSubmit={opslaan} className="form">
      <h1>{id ? 'Wedstrijd bewerken' : 'Nieuwe wedstrijd'}</h1>
      <label>
        Tegenstander
        <input required value={tegenstander} onChange={(e) => setTegenstander(e.target.value)} />
      </label>
      <label>
        Datum en aanvangstijd
        <input type="datetime-local" required value={aanvang} onChange={(e) => setAanvang(e.target.value)} />
      </label>
      <fieldset>
        <legend>Thuis of uit</legend>
        <div className="keuze">
          {(['thuis', 'uit'] as const).map((v) => (
            <button type="button" key={v} className={thuisUit === v ? 'actief' : ''} onClick={() => setThuisUit(v)}>
              {v === 'thuis' ? 'Thuis' : 'Uit'}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Formatie
        <select value={formatie} onChange={(e) => setFormatie(e.target.value)}>
          {formaties.map((f) => <option key={f.code} value={f.code}>{f.naam}</option>)}
        </select>
      </label>
      <label>
        Duur in minuten
        <input type="number" inputMode="numeric" min={1} max={150} value={duur} onChange={(e) => setDuur(Number(e.target.value))} />
      </label>
      {id && (
        <>
          <fieldset>
            <legend>Uitslag (wij - tegenstander)</legend>
            <div className="regel">
              <input type="number" inputMode="numeric" min={0} value={voor} onChange={(e) => setVoor(e.target.value)} />
              <span>-</span>
              <input type="number" inputMode="numeric" min={0} value={tegen} onChange={(e) => setTegen(e.target.value)} />
            </div>
          </fieldset>
        </>
      )}
      {fout && <p className="fout">{fout}</p>}
      <button disabled={bezig}>{bezig ? 'Opslaan...' : 'Opslaan'}</button>
      <button type="button" className="link" onClick={() => navigate(id ? `/wedstrijden/${id}` : '/wedstrijden')}>Annuleren</button>
      {id && <button type="button" className="link gevaar" onClick={verwijder}>Wedstrijd verwijderen</button>}
      {dialoog}
    </form>
  )
}
