import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { avatarStijl, datumTijd, initialen } from '../lib/format'
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
  const [bankWaarden, setBankWaarden] = useState<Record<string, string>>({})
  const [melding, setMelding] = useState<string | null>(null)
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
  // Bij oude wedstrijden zonder opstelling staan de bankminuten rechtstreeks bij de aanwezigheid.
  const handmatig = new Map(aanw.filter((a) => a.minuten_bank !== null).map((a) => [a.player_id, a.minuten_bank as number]))
  const gespeeldVan = (pid: string) => (handmatig.has(pid) ? duur - handmatig.get(pid)! : totaal.get(pid) ?? 0)
  const deelnemers = [...new Set([
    ...aanwezig.map((s) => s.id),
    ...basis.map((b) => b.player_id),
    ...wissels.flatMap((w) => [w.player_in, w.player_out]),
  ])]

  async function zetStatus(pid: string, nieuw: AttStatus) {
    const huidig = statusVan(pid)
    const doel = huidig === nieuw ? null : nieuw
    const res = doel
      ? await supabase.from('attendance').upsert({ match_id: id, player_id: pid, status: doel, ...(doel !== 'aanwezig' ? { minuten_bank: null } : {}) })
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

  // Bankminuten: vooraf ingevuld uit de opstelling, daarna vrij aan te passen.
  const bankWaarde = (pid: string) => bankWaarden[pid] ?? String(duur - gespeeldVan(pid))

  function bankRijen() {
    const rijen: { match_id: string; player_id: string; status: 'aanwezig'; minuten_bank: number }[] = []
    for (const pid of deelnemers) {
      const w = bankWaarde(pid).trim()
      if (!/^\d+$/.test(w) || Number(w) > duur) {
        return { fout: `Vul bij ${naam(pid)} een getal tussen 0 en ${duur} in.`, rijen }
      }
      rijen.push({ match_id: id!, player_id: pid, status: 'aanwezig', minuten_bank: Number(w) })
    }
    return { fout: null, rijen }
  }

  async function slaBankOp(toonMelding = true): Promise<boolean> {
    const { fout: f, rijen } = bankRijen()
    if (f) { setFout(f); return false }
    if (rijen.length) {
      const { error } = await supabase.from('attendance').upsert(rijen)
      if (error) { setFout('Bankminuten opslaan mislukt.'); return false }
    }
    setBankWaarden({})
    setFout(null)
    await laad()
    if (toonMelding) {
      setMelding('Bankminuten opgeslagen.')
      setTimeout(() => setMelding(null), 3000)
    }
    return true
  }

  async function definitief() {
    if (voor === '' || tegen === '') return setFout('Vul eerst de uitslag in.')
    const { fout: f, rijen } = bankRijen()
    if (f) return setFout(f)
    const som = rijen.reduce((a, r) => a + r.minuten_bank, 0)
    if (!window.confirm(`Totaal ${som} bankminuten voor ${rijen.length} aanwezige spelers.\n\nWedstrijd definitief opslaan?`)) return
    setFout(null)
    if (!(await slaBankOp(false))) return
    await zetMatchStatus('definitief', { doelpunten_voor: Number(voor), doelpunten_tegen: Number(tegen) })
  }

  const bewerkbaar = status === 'concept'

  const aanwRij = (s: Player) => (
    <li key={s.id} className="aanw">
      <span className={`speler ${s.actief ? '' : 'inactief'}`}>
        <span className="avatar" style={avatarStijl(s.naam)}>{initialen(s.naam)}</span>
        <span>{s.naam}</span>
      </span>
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

  const bankSom = deelnemers.reduce((a, pid) => a + (Number(bankWaarde(pid)) || 0), 0)
  const bankVerwacht = Math.max(0, deelnemers.length - slots.length) * duur

  const bankLijst = (
    <>
      <h2>Bankminuten</h2>
      <p className="sub">
        Hoeveel minuten heeft iedereen op de bank gezeten? De getallen komen uit de opstelling. Pas aan wat er
        echt is gebeurd.
      </p>
      {deelnemers.length === 0 ? (
        <p className="leeg-staat">Geen aanwezige spelers.</p>
      ) : (
        <ul className="lijst">
          {[...deelnemers].sort((a, b) => naam(a).localeCompare(naam(b), 'nl')).map((pid) => (
            <li key={pid} className="aanw">
              <span className="speler">
                <span className="avatar" style={avatarStijl(naam(pid))}>{initialen(naam(pid))}</span>
                <span>{naam(pid)}</span>
              </span>
              <span className="bankinvoer">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={duur}
                  value={bankWaarde(pid)}
                  onChange={(e) => setBankWaarden({ ...bankWaarden, [pid]: e.target.value })}
                  aria-label={`Bankminuten ${naam(pid)}`}
                />
                <span className="sub">min</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="sub">
        Totaal {bankSom} minuten. Bij {deelnemers.length} aanwezigen is dat {bankVerwacht} als er steeds {slots.length} spelers
        op het veld stonden.
      </p>
      <button className="grijsknop breed-knop-b" disabled={bezig} onClick={() => slaBankOp()}>Bankminuten opslaan</button>
      {melding && <p className="banner ok">{melding}</p>}
    </>
  )

  const speeltijd = deelnemers.length === 0 ? null : (
    <>
      <h2>Speeltijd</h2>
      <ul className="lijst">
        {[...deelnemers].sort((a, b) => gespeeldVan(b) - gespeeldVan(a)).map((pid) => (
          <li key={pid} className="aanw">
            <span>{naam(pid)}</span>
            <span className="sub">{gespeeldVan(pid)}' gespeeld · {duur - gespeeldVan(pid)}' bank</span>
          </li>
        ))}
      </ul>
    </>
  )

  return (
    <>
      <div className="kop-kaart">
        <div className="rij">
          <span className="sub">{datumTijd(match.aanvang)}</span>
          <span className={`pil ${status}`}>{status}</span>
        </div>
        <h1>{match.thuis_uit === 'thuis' ? 'Thuis' : 'Uit'} tegen {match.tegenstander}</h1>
        <div className="rij">
          <span className="uitslagtekst">
            {match.doelpunten_voor !== null && match.doelpunten_tegen !== null ? `${match.doelpunten_voor} - ${match.doelpunten_tegen}` : ''}
          </span>
          {status !== 'definitief' && <Link to={`/wedstrijden/${id}/bewerken`} className="link klein">Bewerken</Link>}
        </div>
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
          {!klaarOk && (
            <>
              <p className="sub">Is de wedstrijd al gespeeld en heb je geen opstelling gemaakt?</p>
              <button
                className="grijsknop breed-knop-b"
                disabled={bezig}
                onClick={() => window.confirm('Opstelling overslaan en direct naar bankminuten en uitslag?') && zetMatchStatus('klaar')}
              >
                Opstelling overslaan, wedstrijd is al gespeeld
              </button>
            </>
          )}
        </>
      )}

      {status === 'klaar' && (
        <>
          <p className="banner">
            {basis.length === 0
              ? 'Deze wedstrijd heeft geen opstelling. Vul de bankminuten en de uitslag in en sla de wedstrijd definitief op.'
              : 'De opstelling staat klaar. Na de wedstrijd controleer je de bankminuten, vul je de uitslag in en sla je de wedstrijd definitief op.'}
          </p>
          {opstellingen}
          <p><strong>Aanwezig ({aantalAanwezig}):</strong> {namen('aanwezig')}</p>
          <p className="sub">Afwezig: {namen('afwezig')}. Geblesseerd: {namen('geblesseerd')}.</p>

          {bankLijst}

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
          {wissels.length > 0 && handmatig.size === 0 && wisselLijst}
          {speeltijd}
          <button className="link" onClick={() => window.confirm('Wedstrijd heropenen om bankminuten of uitslag aan te passen?') && zetMatchStatus('klaar')}>
            Heropenen om aan te passen
          </button>
        </>
      )}
    </>
  )
}
