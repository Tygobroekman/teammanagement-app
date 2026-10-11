import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { speelminuten, veldNu } from '../lib/minuten'
import type {
  Attendance, FormationSlot, LineupSlot, Match, Player, PlayerPosition, Substitution,
} from '../lib/types'

// Wissels achteraf invoeren: kies de minuut, tik de speler die eruit ging en kies wie erin kwam.
type Plan = { minuut: number; player_in: string; player_out: string; slot: number; id: number }

function geldig(basis: Map<number, string>, lijst: Plan[]) {
  const veld = new Map(basis)
  const gesorteerd = [...lijst].sort((a, b) => a.minuut - b.minuut || a.id - b.id)
  for (const w of gesorteerd) {
    if (veld.get(w.slot) !== w.player_out) return false
    if ([...veld.values()].includes(w.player_in)) return false
    veld.set(w.slot, w.player_in)
  }
  return true
}

export default function Wissels() {
  const { id } = useParams()
  const [match, setMatch] = useState<Match | null>(null)
  const [slots, setSlots] = useState<FormationSlot[]>([])
  const [basis, setBasis] = useState<LineupSlot[]>([])
  const [spelers, setSpelers] = useState<Player[]>([])
  const [niveaus, setNiveaus] = useState<PlayerPosition[]>([])
  const [aanw, setAanw] = useState<Attendance[]>([])
  const [wissels, setWissels] = useState<Substitution[]>([])
  const [minuut, setMinuut] = useState<number | null>(null)
  const [uit, setUit] = useState<number | null>(null)
  const [laatste, setLaatste] = useState<{ id: number; tekst: string } | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  const laadWissels = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase.from('substitutions').select('*').eq('match_id', id).order('minuut').order('id')
    if (error) return setFout('Wissels laden mislukt.')
    setWissels(data as Substitution[])
  }, [id])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const m = await supabase.from('matches').select('*').eq('id', id).single()
      if (m.error) return setFout('Wedstrijd niet gevonden.')
      const wedstrijd = m.data as Match
      const [fs, lu, pl, pp, at, sb] = await Promise.all([
        supabase.from('formation_slots').select('*').eq('formation_code', wedstrijd.formation_code).order('slot'),
        supabase.from('lineup_slots').select('*').eq('match_id', id),
        supabase.from('players').select('*'),
        supabase.from('player_positions').select('*'),
        supabase.from('attendance').select('*').eq('match_id', id),
        supabase.from('substitutions').select('*').eq('match_id', id).order('minuut').order('id'),
      ])
      if ([fs, lu, pl, pp, at, sb].some((r) => r.error)) return setFout('Laden mislukt.')
      setMatch(wedstrijd)
      setSlots(fs.data as FormationSlot[])
      setBasis(lu.data as LineupSlot[])
      setSpelers(pl.data as Player[])
      setNiveaus(pp.data as PlayerPosition[])
      setAanw(at.data as Attendance[])
      const w = sb.data as Substitution[]
      setWissels(w)
      setMinuut(w.length ? w[w.length - 1].minuut : Math.round(wedstrijd.duur_minuten / 2))
    })()
  }, [id])

  if (fout) return <p className="fout">{fout}</p>
  if (!match || !id || minuut === null) return <p>Laden...</p>

  const duur = match.duur_minuten
  const basisMap = new Map(basis.map((b) => [b.slot, b.player_id]))
  const veld = veldNu(basisMap, wissels.filter((w) => w.minuut <= minuut))
  const opVeld = new Set(veld.values())
  const naam = (pid: string) => spelers.find((s) => s.id === pid)?.naam ?? '?'
  const totaal = speelminuten(basis.map((b) => b.player_id), wissels, duur)
  const deelnemers = new Set([
    ...aanw.filter((a) => a.status === 'aanwezig').map((a) => a.player_id),
    ...basis.map((b) => b.player_id),
    ...wissels.flatMap((w) => [w.player_in, w.player_out]),
  ])
  const gespeeld = (pid: string) => totaal.get(pid) ?? 0
  const bank = [...deelnemers].filter((pid) => !opVeld.has(pid)).sort((a, b) => gespeeld(a) - gespeeld(b))
  const uitSlot = uit !== null ? slots.find((s) => s.slot === uit) : undefined
  const niveauVoor = (pid: string, pos: string) => niveaus.find((n) => n.player_id === pid && n.position_code === pos)?.niveau
  const zet = (n: number) => setMinuut(Math.min(duur, Math.max(0, n)))

  async function voerIn(slot: number, spelerIn: string) {
    const spelerUit = veld.get(slot)
    const def = slots.find((s) => s.slot === slot)
    if (!spelerUit || !def || minuut === null) return
    const kandidaat: Plan = { minuut, player_in: spelerIn, player_out: spelerUit, slot, id: Infinity }
    if (!geldig(basisMap, [...wissels, kandidaat])) {
      setUit(null)
      return setFout('Deze wissel past niet bij de latere wissels. Verwijder eerst de wissels die daarna komen.')
    }
    setFout(null)
    setUit(null)
    const { data, error } = await supabase
      .from('substitutions')
      .insert({ match_id: id, minuut, player_in: spelerIn, player_out: spelerUit, slot, position_code: def.position_code })
      .select('id')
      .single()
    if (error) return setFout('Opslaan mislukt.')
    setLaatste({ id: data.id as number, tekst: `${minuut}' ${naam(spelerIn)} erin, ${naam(spelerUit)} eruit` })
    await laadWissels()
  }

  async function verwijder(wid: number) {
    const rest = wissels.filter((w) => w.id !== wid)
    if (!geldig(basisMap, rest)) return setFout('Verwijder eerst de latere wissels die van deze wissel afhangen.')
    const { error } = await supabase.from('substitutions').delete().eq('id', wid)
    if (error) return setFout('Verwijderen mislukt.')
    setFout(null)
    setLaatste(null)
    await laadWissels()
  }

  return (
    <>
      <div className="rij">
        <Link to={`/wedstrijden/${id}`} className="link klein">Terug naar wedstrijd</Link>
        <span className="sub">{match.thuis_uit === 'thuis' ? 'Thuis' : 'Uit'} tegen {match.tegenstander}</span>
      </div>
      <h1>Wissels invoeren</h1>

      {basis.length < 11 ? (
        <p className="fout">Maak eerst een basisopstelling van 11 spelers. <Link to={`/wedstrijden/${id}`}>Naar de wedstrijd</Link></p>
      ) : (
        <>
          <div className="klok">
            <div className="sub-licht">Minuut van de wissel</div>
            <div className="tijd">{minuut}'</div>
            <div className="klokknoppen">
              <button className="grijs" onClick={() => zet(minuut - 5)}>-5</button>
              <button className="grijs" onClick={() => zet(minuut - 1)}>-1</button>
              <button className="grijs" onClick={() => zet(minuut + 1)}>+1</button>
              <button className="grijs" onClick={() => zet(minuut + 5)}>+5</button>
            </div>
          </div>
          <p className="sub">Het veld toont de stand op deze minuut. Tik op de speler die eruit ging.</p>
          <div className="veld">
            {slots.map((s) => {
              const pid = veld.get(s.slot)
              return (
                <button
                  key={s.slot}
                  type="button"
                  className={`plek gevuld ${uit === s.slot ? 'gekozen' : ''}`}
                  style={{ left: `${s.x}%`, top: `${s.y}%` }}
                  onClick={() => setUit(s.slot)}
                >
                  <span className="pos">{s.position_code}</span>
                  <span className="nm">{pid ? naam(pid) : '-'}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {laatste && (
        <div className="toast">
          <span>{laatste.tekst}</span>
          <button onClick={() => verwijder(laatste.id)}>Ongedaan maken</button>
        </div>
      )}

      <h2>Wissels ({wissels.length})</h2>
      {wissels.length === 0 ? <p className="sub">Nog geen wissels ingevoerd.</p> : (
        <ul className="lijst">
          {wissels.map((w) => (
            <li key={w.id} className="aanw">
              <span>{w.minuut}' {naam(w.player_in)} erin, {naam(w.player_out)} eruit</span>
              <button className="link klein gevaar" onClick={() => verwijder(w.id)}>Verwijder</button>
            </li>
          ))}
        </ul>
      )}

      <h2>Speeltijd van deze wedstrijd</h2>
      <ul className="lijst">
        {[...deelnemers].sort((a, b) => gespeeld(b) - gespeeld(a)).map((pid) => (
          <li key={pid} className="aanw">
            <span>{naam(pid)}</span>
            <span className="sub">{gespeeld(pid)}' gespeeld · {duur - gespeeld(pid)}' bank</span>
          </li>
        ))}
      </ul>

      {uit !== null && uitSlot && (
        <div className="sheet-bg" onClick={() => setUit(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rij">
              <strong>{minuut}' {naam(veld.get(uit) ?? '')} eruit. Wie kwam erin?</strong>
              <button className="link klein" onClick={() => setUit(null)}>Annuleren</button>
            </div>
            {bank.length === 0 && <p className="sub">Niemand op de bank op dit moment.</p>}
            <ul className="lijst">
              {bank.map((pid) => {
                const n = niveauVoor(pid, uitSlot.position_code)
                return (
                  <li key={pid}>
                    <a role="button" className="groot" onClick={() => voerIn(uit, pid)}>
                      <span>{naam(pid)}</span>
                      <span className="sub">{gespeeld(pid)}' gespeeld{n ? ` · niv ${n}` : ''}</span>
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
