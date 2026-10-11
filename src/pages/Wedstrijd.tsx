import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { datumTijd } from '../lib/format'
import type {
  AttStatus, Attendance, Formation, FormationSlot, LineupSlot, Match, Player, PlayerPosition,
} from '../lib/types'

const STATUSSEN: { waarde: AttStatus; label: string }[] = [
  { waarde: 'aanwezig', label: 'Aanwezig' },
  { waarde: 'afwezig', label: 'Afwezig' },
  { waarde: 'geblesseerd', label: 'Geblesseerd' },
]

export default function Wedstrijd() {
  const { id } = useParams()
  const [match, setMatch] = useState<Match | null>(null)
  const [formaties, setFormaties] = useState<Formation[]>([])
  const [slots, setSlots] = useState<FormationSlot[]>([])
  const [spelers, setSpelers] = useState<Player[]>([])
  const [niveaus, setNiveaus] = useState<PlayerPosition[]>([])
  const [aanw, setAanw] = useState<Attendance[]>([])
  const [basis, setBasis] = useState<LineupSlot[]>([])
  const [aantalWissels, setAantalWissels] = useState(0)
  const [kiesSlot, setKiesSlot] = useState<number | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  const laad = useCallback(async () => {
    if (!id) return
    const m = await supabase.from('matches').select('*').eq('id', id).single()
    if (m.error) return setFout('Wedstrijd niet gevonden.')
    const wedstrijd = m.data as Match
    const [fm, fs, pl, pp, at, lu, sb] = await Promise.all([
      supabase.from('formations').select('*').order('code'),
      supabase.from('formation_slots').select('*').eq('formation_code', wedstrijd.formation_code).order('slot'),
      supabase.from('players').select('*').order('naam'),
      supabase.from('player_positions').select('*'),
      supabase.from('attendance').select('*').eq('match_id', id),
      supabase.from('lineup_slots').select('*').eq('match_id', id),
      supabase.from('substitutions').select('id', { count: 'exact', head: true }).eq('match_id', id),
    ])
    if ([fm, fs, pl, pp, at, lu, sb].some((r) => r.error)) return setFout('Laden mislukt.')
    setMatch(wedstrijd)
    setFormaties(fm.data as Formation[])
    setSlots(fs.data as FormationSlot[])
    setSpelers(pl.data as Player[])
    setNiveaus(pp.data as PlayerPosition[])
    setAanw(at.data as Attendance[])
    setBasis(lu.data as LineupSlot[])
    setAantalWissels(sb.count ?? 0)
    setFout(null)
  }, [id])

  useEffect(() => { laad() }, [laad])

  if (fout) return <p className="fout">{fout}</p>
  if (!match || !id) return <p>Laden...</p>

  const statusVan = (pid: string) => aanw.find((a) => a.player_id === pid)?.status
  const spelerVan = (pid: string) => spelers.find((s) => s.id === pid)
  const inBasis = new Set(basis.map((b) => b.player_id))
  const zichtbaar = spelers.filter((s) => s.actief || statusVan(s.id) || inBasis.has(s.id))
  const aanwezig = zichtbaar.filter((s) => statusVan(s.id) === 'aanwezig')
  const bank = aanwezig.filter((s) => !inBasis.has(s.id))

  async function zetStatus(pid: string, nieuw: AttStatus) {
    // Tik op de actieve status om hem weer leeg te maken.
    const huidig = statusVan(pid)
    const doel = huidig === nieuw ? null : nieuw
    const wasInBasis = basis.some((b) => b.player_id === pid)
    setAanw((a) => {
      const rest = a.filter((x) => x.player_id !== pid)
      return doel ? [...rest, { match_id: id!, player_id: pid, status: doel }] : rest
    })
    const res = doel
      ? await supabase.from('attendance').upsert({ match_id: id, player_id: pid, status: doel })
      : await supabase.from('attendance').delete().eq('match_id', id).eq('player_id', pid)
    if (res.error) return laad().then(() => setFout('Opslaan mislukt.'))
    if (doel !== 'aanwezig' && wasInBasis) {
      setBasis((b) => b.filter((x) => x.player_id !== pid))
      const del = await supabase.from('lineup_slots').delete().eq('match_id', id).eq('player_id', pid)
      if (del.error) laad().then(() => setFout('Opslaan mislukt.'))
    }
  }

  async function zetSlot(slot: number, pid: string | null) {
    setKiesSlot(null)
    const def = slots.find((s) => s.slot === slot)
    if (!def) return
    setBasis((b) => {
      const rest = b.filter((x) => x.slot !== slot)
      return pid ? [...rest, { match_id: id!, slot, player_id: pid, position_code: def.position_code }] : rest
    })
    const res = pid
      ? await supabase.from('lineup_slots').upsert({ match_id: id, slot, player_id: pid, position_code: def.position_code })
      : await supabase.from('lineup_slots').delete().eq('match_id', id).eq('slot', slot)
    if (res.error) laad().then(() => setFout('Opslaan mislukt.'))
  }

  async function wijzigFormatie(code: string) {
    const fs = await supabase.from('formation_slots').select('*').eq('formation_code', code).order('slot')
    if (fs.error) return setFout('Formatie laden mislukt.')
    const nieuweSlots = fs.data as FormationSlot[]
    const m = await supabase.from('matches').update({ formation_code: code }).eq('id', id)
    if (m.error) return setFout('Formatie wijzigen mislukt.')
    // Spelers blijven op hun plek (slotnummer), de positie volgt de nieuwe formatie.
    const bijgewerkt = basis.map((b) => ({
      ...b,
      position_code: nieuweSlots.find((s) => s.slot === b.slot)?.position_code ?? b.position_code,
    }))
    if (bijgewerkt.length) {
      const up = await supabase.from('lineup_slots').upsert(bijgewerkt)
      if (up.error) return setFout('Opstelling bijwerken mislukt.')
    }
    setMatch({ ...match!, formation_code: code })
    setSlots(nieuweSlots)
    setBasis(bijgewerkt)
  }

  const niveauVoor = (pid: string, pos: string) => niveaus.find((n) => n.player_id === pid && n.position_code === pos)?.niveau
  const gekozen = kiesSlot ? slots.find((s) => s.slot === kiesSlot) : undefined
  const kandidaten = gekozen
    ? aanwezig
        .filter((s) => !inBasis.has(s.id))
        .sort((a, b) => (niveauVoor(b.id, gekozen.position_code) ?? 0) - (niveauVoor(a.id, gekozen.position_code) ?? 0))
    : []

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
            {['✓', '✗', '+'][STATUSSEN.indexOf(st)]}
          </button>
        ))}
      </div>
    </li>
  )

  return (
    <>
      <div className="rij">
        <div>
          <h1>{match.thuis_uit === 'thuis' ? 'Thuis' : 'Uit'} tegen {match.tegenstander}</h1>
          <span className="sub">
            {datumTijd(match.aanvang)} · {match.status}
            {match.doelpunten_voor !== null && match.doelpunten_tegen !== null && ` · ${match.doelpunten_voor} - ${match.doelpunten_tegen}`}
          </span>
        </div>
        <Link to={`/wedstrijden/${id}/bewerken`} className="link klein">Bewerken</Link>
      </div>

      <Link to={`/wedstrijden/${id}/wissels`} className="knop breed-knop">Wissels invoeren</Link>
      <Link to={`/wedstrijden/${id}/voorstel`} className="knop breed-knop grijsknop">Opstelling voorstellen</Link>

      <h2>Aanwezigheid ({aanwezig.length} aanwezig)</h2>
      <ul className="lijst">{zichtbaar.filter((s) => !s.langdurig_geblesseerd).map(aanwRij)}</ul>
      {zichtbaar.some((s) => s.langdurig_geblesseerd) && (
        <>
          <h3>Langdurig geblesseerd</h3>
          <ul className="lijst">{zichtbaar.filter((s) => s.langdurig_geblesseerd).map(aanwRij)}</ul>
        </>
      )}
      <p className="sub">Vinkje = aanwezig, kruisje = afwezig, plus = geblesseerd. Tik nogmaals om te wissen.</p>

      <h2>Opstelling</h2>
      <label>
        Formatie
        <select value={match.formation_code} onChange={(e) => wijzigFormatie(e.target.value)}>
          {formaties.map((f) => <option key={f.code} value={f.code}>{f.naam}</option>)}
        </select>
      </label>
      <p className="sub">{basis.length} van 11 ingevuld. Tik op een plek om een speler te kiezen.</p>
      {aantalWissels > 0 && (
        <p className="fout">Er zijn al wissels geregistreerd. Verander de basisopstelling alleen als je ook de wissels aanpast.</p>
      )}
      <div className="veld">
        {slots.map((s) => {
          const b = basis.find((x) => x.slot === s.slot)
          const speler = b && spelerVan(b.player_id)
          return (
            <button
              key={s.slot}
              type="button"
              className={`plek ${speler ? 'gevuld' : ''}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              onClick={() => setKiesSlot(s.slot)}
            >
              <span className="pos">{s.position_code}</span>
              <span className="nm">{speler ? speler.naam : '+'}</span>
            </button>
          )
        })}
      </div>

      <h2>Bank ({bank.length})</h2>
      {bank.length === 0 ? <p className="sub">Geen wisselspelers.</p> : (
        <p>{bank.map((s) => s.naam).join(', ')}</p>
      )}

      {gekozen && (
        <div className="sheet-bg" onClick={() => setKiesSlot(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rij">
              <strong>Kies speler voor {gekozen.position_code}</strong>
              <button className="link klein" onClick={() => setKiesSlot(null)}>Sluiten</button>
            </div>
            {basis.some((b) => b.slot === gekozen.slot) && (
              <button className="leeg" onClick={() => zetSlot(gekozen.slot, null)}>Plek leegmaken</button>
            )}
            {kandidaten.length === 0 && <p className="sub">Geen beschikbare aanwezige spelers. Vink eerst spelers aan als aanwezig.</p>}
            <ul className="lijst">
              {kandidaten.map((s) => {
                const n = niveauVoor(s.id, gekozen.position_code)
                return (
                  <li key={s.id}>
                    <a role="button" onClick={() => zetSlot(gekozen.slot, s.id)}>
                      <span>{s.naam}</span>
                      <span className="sub">{n ? `niveau ${n}` : 'geen niveau'}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
