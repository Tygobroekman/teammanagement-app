import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { datumTijd } from '../lib/format'
import { speelminuten, veldNu } from '../lib/minuten'
import Speelveld from '../components/Speelveld'
import type {
  AttStatus, Attendance, FormationSlot, LineupSlot, Match, MatchStatus, Player, Substitution,
} from '../lib/types'

const STATUSSEN: { waarde: AttStatus; label: string; teken: string }[] = [
  { waarde: 'aanwezig', label: 'Aanwezig', teken: '✓' },
  { waarde: 'afwezig', label: 'Afwezig', teken: '✗' },
  { waarde: 'geblesseerd', label: 'Geblesseerd', teken: '+' },
]

const STAPPEN: { waarde: MatchStatus; label: string }[] = [
  { waarde: 'concept', label: 'Voorbereiden' },
  { waarde: 'klaar', label: 'Klaar' },
  { waarde: 'definitief', label: 'Definitief' },
]

export default function Wedstrijd() {
  const { id } = useParams()
  const [match, setMatch] = useState<Match | null>(null)
  const [slots, setSlots] = useState<FormationSlot[]>([])
  const [spelers, setSpelers] = useState<Player[]>([])
  const [aanw, setAanw] = useState<Attendance[]>([])
  const [basis, setBasis] = useState<LineupSlot[]>([])
  const [wissels, setWissels] = useState<Substitution[]>([])
  const [voor, setVoor] = useState('')
  const [tegen, setTegen] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  const laad = useCallback(async () => {
    if (!id) return
    const m = await supabase.from('matches').select('*').eq('id', id).single()
    if (m.error) return setFout('Wedstrijd niet gevonden.')
    const wedstrijd = m.data as Match
    const [fs, pl, at, lu, sb] = await Promise.all([
      supabase.from('formation_slots').select('*').eq('formation_code', wedstrijd.formation_code).order('slot'),
      supabase.from('players').select('*').order('naam'),
      supabase.from('attendance').select('*').eq('match_id', id),
      supabase.from('lineup_slots').select('*').eq('match_id', id),
      supabase.from('substitutions').select('*').eq('match_id', id).order('minuut').order('id'),
    ])
    if ([fs, pl, at, lu, sb].some((r) => r.error)) return setFout('Laden mislukt.')
    setMatch(wedstrijd)
    setSlots(fs.data as FormationSlot[])
    setSpelers(pl.data as Player[])
    setAanw(at.data as Attendance[])
    setBasis(lu.data as LineupSlot[])
    setWissels(sb.data as Substitution[])
    setVoor(wedstrijd.doelpunten_voor?.toString() ?? '')
    setTegen(wedstrijd.doelpunten_tegen?.toString() ?? '')
    setFout(null)
  }, [id])

  useEffect(() => { laad() }, [laad])

  if (fout && !match) return <p className="fout">{fout}</p>
  if (!match || !id) return <p>Laden...</p>

  const status = match.status
  const duur = match.duur_minuten
  const rust = Math.round(duur / 2)
  const statusVan = (pid: string) => aanw.find((a) => a.player_id === pid)?.status
  const naam = (pid: string) => spelers.find((s) => s.id === pid)?.naam ?? '?'
  const basisMap = new Map(basis.map((b) => [b.slot, b.player_id]))
  const rustWissels = wissels.filter((w) => w.minuut === rust)
  const tweedeHelft = veldNu(basisMap, rustWissels)
  const inBasis = new Set(basis.map((b) => b.player_id))
  const zichtbaar = spelers.filter((s) => s.actief || statusVan(s.id) || inBasis.has(s.id))
  const aanwezig = zichtbaar.filter((s) => statusVan(s.id) === 'aanwezig')
  const aantalAanwezig = aanwezig.length
  const klaarOk = aantalAanwezig >= slots.length && basis.length === slots.length
  const totaal = speelminuten(basis.map((b) => b.player_id), wissels, duur)
  const deelnemers = [...new Set([
    ...aanwezig.map((s) => s.id),
    ...basis.map((b) => b.player_id),
    ...wissels.flatMap((w) => [w.player_in, w.player_out]),
  ])]

  async function zetStatus(pid: string, nieuw: AttStatus) {
    const huidig = statusVan(pid)
    const doel = huidig === nieuw ? null : nieuw
    const res = doel
      ? await supabase.from('attendance').upsert({ match_id: id, player_id: pid, status: doel })
      : await supabase.from('attendance').delete().eq('match_id', id).eq('player_id', pid)
    if (res.error) return setFout('Opslaan mislukt.')
    if (doel !== 'aanwezig') {
      // Wie niet aanwezig is, hoort niet in de opstelling of in de wissels.
      await supabase.from('lineup_slots').delete().eq('match_id', id).eq('player_id', pid)
      await supabase.from('substitutions').delete().eq('match_id', id).or(`player_in.eq.${pid},player_out.eq.${pid}`)
    }
    await laad()
  }

  async function zetMatchStatus(nieuw: MatchStatus, extra: Partial<Match> = {}) {
    setBezig(true)
    const { error } = await supabase.from('matches').update({ status: nieuw, ...extra }).eq('id', id)
    setBezig(false)
    if (error) return setFout('Status wijzigen mislukt.')
    await laad()
  }

  async function definitief() {
    if (voor === '' || tegen === '') return setFout('Vul eerst de uitslag in.')
    const opmerking = wissels.length === 0
      ? 'Er zijn geen wissels ingevoerd. Klopt dat?\n\n'
      : `Er zijn ${wissels.length} wissel(s) geregistreerd. Kloppen die met de wedstrijd?\n\n`
    if (!window.confirm(`${opmerking}Wedstrijd definitief opslaan?`)) return
    setFout(null)
    await zetMatchStatus('definitief', { doelpunten_voor: Number(voor), doelpunten_tegen: Number(tegen) })
  }

  const bewerkbaar = status === 'concept'

  const aanwRij = (s: Player) => (
    <li key={s.id} className="aanw">
      <span className={s.actief ? '' : 'inactief'}>{s.naam}</span>
      <div className="keuze compact">
        {STATUSSEN.map((st) => (
          <button
            key={st.waarde}
            type="button"
            className={`${statusVan(s.id) === st.waarde ? 'actief ' : ''}${st.waarde}`}
            onClick={() => zetStatus(s.id, st.waarde)}
            aria-label={`${s.naam} ${st.label}`}
          >
            {st.teken}
          </button>
        ))}
      </div>
    </li>
  )

  const namen = (st: AttStatus) => zichtbaar.filter((s) => statusVan(s.id) === st).map((s) => s.naam).join(', ') || 'niemand'

  const opstellingen = (
    <>
      {basis.length === 0 ? (
        <p className="sub">Nog geen opstelling gemaakt.</p>
      ) : (
        <>
          <h3>{rustWissels.length ? '1e helft' : 'Opstelling'}</h3>
          <Speelveld slots={slots} veld={basisMap} naam={naam} />
          {rustWissels.length > 0 && (
            <>
              <h3>2e helft</h3>
              <Speelveld slots={slots} veld={tweedeHelft} naam={naam} />
            </>
          )}
        </>
      )}
    </>
  )

  const wisselLijst = (
    <>
      <h2>Wissels ({wissels.length})</h2>
      {wissels.length === 0 ? <p className="sub">Geen wissels.</p> : (
        <ul className="lijst">
          {wissels.map((w) => (
            <li key={w.id} className="aanw">
              <span>{w.minuut}' {naam(w.player_in)} erin, {naam(w.player_out)} eruit</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )

  const speeltijd = (
    <>
      <h2>Speeltijd</h2>
      <ul className="lijst">
        {[...deelnemers].sort((a, b) => (totaal.get(b) ?? 0) - (totaal.get(a) ?? 0)).map((pid) => (
          <li key={pid} className="aanw">
            <span>{naam(pid)}</span>
            <span className="sub">{totaal.get(pid) ?? 0}' gespeeld · {duur - (totaal.get(pid) ?? 0)}' bank</span>
          </li>
        ))}
      </ul>
    </>
  )

  return (
    <>
      <div className="rij">
        <div>
          <h1>{match.thuis_uit === 'thuis' ? 'Thuis' : 'Uit'} tegen {match.tegenstander}</h1>
          <span className="sub">
            {datumTijd(match.aanvang)}
            {match.doelpunten_voor !== null && match.doelpunten_tegen !== null && ` · ${match.doelpunten_voor} - ${match.doelpunten_tegen}`}
          </span>
        </div>
        {status !== 'definitief' && <Link to={`/wedstrijden/${id}/bewerken`} className="link klein">Bewerken</Link>}
      </div>

      <ol className="stappen">
        {STAPPEN.map((st, i) => (
          <li key={st.waarde} className={st.waarde === status ? 'nu' : STAPPEN.findIndex((x) => x.waarde === status) > i ? 'af' : ''}>
            <span className="nr">{i + 1}</span> {st.label}
          </li>
        ))}
      </ol>
      {fout && <p className="fout">{fout}</p>}

      {status === 'concept' && (
        <>
          <h2>Aanwezigheid ({aantalAanwezig} aanwezig)</h2>
          <ul className="lijst">{zichtbaar.filter((s) => !s.langdurig_geblesseerd).map(aanwRij)}</ul>
          {zichtbaar.some((s) => s.langdurig_geblesseerd) && (
            <>
              <h3>Langdurig geblesseerd</h3>
              <ul className="lijst">{zichtbaar.filter((s) => s.langdurig_geblesseerd).map(aanwRij)}</ul>
            </>
          )}
          <p className="sub">Vinkje = aanwezig, kruisje = afwezig, plus = geblesseerd. Tik nogmaals om te wissen.</p>

          <h2>Opstelling</h2>
          <Link to={`/wedstrijden/${id}/opstelling`} className="knop breed-knop">
            {basis.length ? 'Opstelling aanpassen' : 'Opstelling maken'}
          </Link>
          {opstellingen}

          <h2>Klaar maken</h2>
          <ul className="check">
            <li className={aantalAanwezig >= slots.length ? 'ok' : ''}>Minstens {slots.length} spelers aanwezig ({aantalAanwezig})</li>
            <li className={basis.length === slots.length ? 'ok' : ''}>Opstelling 1e helft compleet ({basis.length} van {slots.length})</li>
          </ul>
          <button className="breed-knop-b" disabled={!klaarOk || bezig} onClick={() => zetMatchStatus('klaar')}>
            Wedstrijd klaar maken
          </button>
        </>
      )}

      {status === 'klaar' && (
        <>
          <p className="banner">
            De opstelling staat klaar. Na de wedstrijd controleer je de wissels, vul je de uitslag in en sla je de
            wedstrijd definitief op.
          </p>
          {opstellingen}
          <p><strong>Aanwezig ({aantalAanwezig}):</strong> {namen('aanwezig')}</p>
          <p className="sub">Afwezig: {namen('afwezig')}. Geblesseerd: {namen('geblesseerd')}.</p>

          {wisselLijst}
          <Link to={`/wedstrijden/${id}/wissels`} className="knop breed-knop">Wissels controleren of invoeren</Link>
          {speeltijd}

          <h2>Uitslag</h2>
          <div className="regel uitslag">
            <input type="number" inputMode="numeric" min={0} value={voor} onChange={(e) => setVoor(e.target.value)} aria-label="Doelpunten wij" />
            <span>-</span>
            <input type="number" inputMode="numeric" min={0} value={tegen} onChange={(e) => setTegen(e.target.value)} aria-label="Doelpunten tegenstander" />
          </div>
          <p className="sub">Wij - tegenstander</p>
          <button className="breed-knop-b" disabled={bezig} onClick={definitief}>Wedstrijd definitief opslaan</button>
          <button className="link" onClick={() => zetMatchStatus('concept')}>Terug naar voorbereiden</button>
        </>
      )}

      {status === 'definitief' && (
        <>
          <p className="banner ok">Deze wedstrijd is definitief opgeslagen en telt mee in het seizoensoverzicht.</p>
          {opstellingen}
          {wisselLijst}
          {speeltijd}
          <button className="link" onClick={() => window.confirm('Wedstrijd heropenen om wissels of uitslag aan te passen?') && zetMatchStatus('klaar')}>
            Heropenen om aan te passen
          </button>
        </>
      )}
    </>
  )
}
