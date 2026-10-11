import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useKlok } from '../lib/klok'
import { speelminuten, veldNu } from '../lib/minuten'
import type {
  Attendance, FormationSlot, LineupSlot, Match, Player, PlayerPosition, Substitution,
} from '../lib/types'

type Item = Omit<Substitution, 'id' | 'match_id'> & { id: number | null; key: string }

const pendingSleutel = (id: string) => `wissels-wachtrij:${id}`
function leesPending(id: string): Item[] {
  try { return JSON.parse(localStorage.getItem(pendingSleutel(id)) ?? '[]') as Item[] } catch { return [] }
}
function schrijfPending(id: string, lijst: Item[]) {
  try { localStorage.setItem(pendingSleutel(id), JSON.stringify(lijst)) } catch { /* geen opslag beschikbaar */ }
}

const mmss = (sec: number) => {
  const s = Math.floor(sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function Wissels() {
  const { id } = useParams()
  const klok = useKlok(id ?? '')
  const [match, setMatch] = useState<Match | null>(null)
  const [slots, setSlots] = useState<FormationSlot[]>([])
  const [basis, setBasis] = useState<LineupSlot[]>([])
  const [spelers, setSpelers] = useState<Player[]>([])
  const [niveaus, setNiveaus] = useState<PlayerPosition[]>([])
  const [aanw, setAanw] = useState<Attendance[]>([])
  const [opgeslagen, setOpgeslagen] = useState<Item[]>([])
  const [pending, setPending] = useState<Item[]>(() => (id ? leesPending(id) : []))
  const [uit, setUit] = useState<number | null>(null)
  const [laatste, setLaatste] = useState<{ key: string; tekst: string } | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const bezigMetFlush = useRef(false)

  const laadWissels = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase.from('substitutions').select('*').eq('match_id', id).order('minuut').order('id')
    if (error) return
    setOpgeslagen((data as Substitution[]).map((s) => ({ ...s, key: `db${s.id}` })))
  }, [id])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const m = await supabase.from('matches').select('*').eq('id', id).single()
      if (m.error) return setFout('Wedstrijd niet gevonden.')
      const wedstrijd = m.data as Match
      const [fs, lu, pl, pp, at] = await Promise.all([
        supabase.from('formation_slots').select('*').eq('formation_code', wedstrijd.formation_code).order('slot'),
        supabase.from('lineup_slots').select('*').eq('match_id', id),
        supabase.from('players').select('*'),
        supabase.from('player_positions').select('*'),
        supabase.from('attendance').select('*').eq('match_id', id),
      ])
      if ([fs, lu, pl, pp, at].some((r) => r.error)) return setFout('Laden mislukt.')
      setMatch(wedstrijd)
      setSlots(fs.data as FormationSlot[])
      setBasis(lu.data as LineupSlot[])
      setSpelers(pl.data as Player[])
      setNiveaus(pp.data as PlayerPosition[])
      setAanw(at.data as Attendance[])
      await laadWissels()
    })()
  }, [id, laadWissels])

  // Wissels die nog niet zijn opgeslagen (geen verbinding) opnieuw proberen.
  const flush = useCallback(async () => {
    if (!id || bezigMetFlush.current) return
    bezigMetFlush.current = true
    try {
      let wachtrij = leesPending(id)
      for (const p of wachtrij) {
        const { error } = await supabase.from('substitutions').insert({
          match_id: id, minuut: p.minuut, player_in: p.player_in, player_out: p.player_out,
          slot: p.slot, position_code: p.position_code,
        })
        if (error) break
        wachtrij = wachtrij.filter((q) => q.key !== p.key)
        schrijfPending(id, wachtrij)
      }
      setPending(wachtrij)
      await laadWissels()
    } finally {
      bezigMetFlush.current = false
    }
  }, [id, laadWissels])

  useEffect(() => {
    flush()
    const t = setInterval(flush, 10000)
    window.addEventListener('online', flush)
    return () => { clearInterval(t); window.removeEventListener('online', flush) }
  }, [flush])

  // Scherm aan houden zolang de klok loopt.
  useEffect(() => {
    if (!klok.loopt) return
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => undefined)
    return () => { lock?.release().catch(() => undefined) }
  }, [klok.loopt])

  if (fout) return <p className="fout">{fout}</p>
  if (!match || !id) return <p>Laden...</p>

  const wissels = [...opgeslagen, ...pending].sort((a, b) => a.minuut - b.minuut || (a.id ?? Infinity) - (b.id ?? Infinity))
  const basisMap = new Map(basis.map((b) => [b.slot, b.player_id]))
  const veld = veldNu(basisMap, wissels)
  const opVeld = new Set(veld.values())
  const naam = (pid: string) => spelers.find((s) => s.id === pid)?.naam ?? '?'
  const huidigeMinuut = Math.min(klok.minuut, match.duur_minuten)
  const gespeeld = speelminuten(basis.map((b) => b.player_id), wissels, huidigeMinuut)
  const aanwezig = aanw.filter((a) => a.status === 'aanwezig').map((a) => a.player_id)
  const spelend = new Set([...aanwezig, ...basis.map((b) => b.player_id)])
  const bankminuten = (pid: string) => huidigeMinuut - (gespeeld.get(pid) ?? 0)
  const bank = [...spelend].filter((pid) => !opVeld.has(pid)).sort((a, b) => bankminuten(b) - bankminuten(a))
  const uitSlot = uit !== null ? slots.find((s) => s.slot === uit) : undefined
  const niveauVoor = (pid: string, pos: string) => niveaus.find((n) => n.player_id === pid && n.position_code === pos)?.niveau

  async function wissel(slot: number, spelerIn: string) {
    const spelerUit = veld.get(slot)
    const def = slots.find((s) => s.slot === slot)
    if (!spelerUit || !def) return
    const item: Item = {
      id: null, key: crypto.randomUUID(), minuut: huidigeMinuut,
      player_in: spelerIn, player_out: spelerUit, slot, position_code: def.position_code,
    }
    const lijst = [...leesPending(id!), item]
    schrijfPending(id!, lijst)
    setPending(lijst)
    setUit(null)
    setLaatste({ key: item.key, tekst: `${naam(spelerIn)} erin, ${naam(spelerUit)} eruit (${item.minuut}')` })
    setTimeout(() => setLaatste((l) => (l?.key === item.key ? null : l)), 8000)
    flush()
  }

  async function verwijder(item: Item) {
    setLaatste(null)
    if (item.id === null) {
      const lijst = leesPending(id!).filter((p) => p.key !== item.key)
      schrijfPending(id!, lijst)
      setPending(lijst)
      return
    }
    const { error } = await supabase.from('substitutions').delete().eq('id', item.id)
    if (error) return setFout('Verwijderen mislukt. Controleer je verbinding.')
    await laadWissels()
  }

  const laatsteItem = laatste ? wissels.find((w) => w.key === laatste.key) : undefined
  const helft = Math.round((match.duur_minuten / 2) * 60)

  return (
    <>
      <div className="rij">
        <Link to={`/wedstrijden/${id}`} className="link klein">Terug</Link>
        <span className="sub">{match.thuis_uit === 'thuis' ? 'Thuis' : 'Uit'} tegen {match.tegenstander}</span>
      </div>

      <div className="klok">
        <div className="tijd">{mmss(klok.seconden)}</div>
        <div className="klokknoppen">
          {klok.loopt
            ? <button onClick={klok.pauze}>Pauze</button>
            : <button onClick={klok.start}>{klok.seconden > 0 ? 'Hervat' : 'Start'}</button>}
          <button className="grijs" onClick={() => klok.zetOp(helft, true)}>2e helft</button>
          <button className="grijs" onClick={() => klok.corrigeer(-60)}>-1</button>
          <button className="grijs" onClick={() => klok.corrigeer(60)}>+1</button>
        </div>
      </div>

      {basis.length < 11 ? (
        <p className="fout">Maak eerst een basisopstelling van 11 spelers. <Link to={`/wedstrijden/${id}`}>Naar de wedstrijd</Link></p>
      ) : (
        <>
          <p className="sub">Tik op de speler die eruit gaat.</p>
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
                  <span className="pos">{pid ? `${gespeeld.get(pid) ?? 0}'` : ''}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {pending.length > 0 && <p className="fout">{pending.length} wissel(s) nog niet opgeslagen. We proberen het opnieuw zodra er verbinding is.</p>}

      {laatste && laatsteItem && (
        <div className="toast">
          <span>{laatste.tekst}</span>
          <button onClick={() => verwijder(laatsteItem)}>Ongedaan maken</button>
        </div>
      )}

      <h2>Wissels</h2>
      {wissels.length === 0 ? <p className="sub">Nog geen wissels.</p> : (
        <ul className="lijst">
          {wissels.map((w) => (
            <li key={w.key} className="aanw">
              <span>{w.minuut}' {naam(w.player_in)} erin, {naam(w.player_out)} eruit{w.id === null ? ' (wacht op verbinding)' : ''}</span>
              <button className="link klein gevaar" onClick={() => verwijder(w)}>Verwijder</button>
            </li>
          ))}
        </ul>
      )}

      <h2>Speeltijd tot nu toe</h2>
      <ul className="lijst">
        {[...spelend].sort((a, b) => (gespeeld.get(b) ?? 0) - (gespeeld.get(a) ?? 0)).map((pid) => (
          <li key={pid} className="aanw">
            <span>{naam(pid)}{opVeld.has(pid) ? '' : ' (bank)'}</span>
            <span className="sub">{gespeeld.get(pid) ?? 0}' gespeeld · {bankminuten(pid)}' bank</span>
          </li>
        ))}
      </ul>

      {uit !== null && uitSlot && (
        <div className="sheet-bg" onClick={() => setUit(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rij">
              <strong>{naam(veld.get(uit) ?? '')} eruit. Wie komt erin?</strong>
              <button className="link klein" onClick={() => setUit(null)}>Annuleren</button>
            </div>
            {bank.length === 0 && <p className="sub">Niemand op de bank.</p>}
            <ul className="lijst">
              {bank.map((pid) => {
                const n = niveauVoor(pid, uitSlot.position_code)
                return (
                  <li key={pid}>
                    <a role="button" className="groot" onClick={() => wissel(uit, pid)}>
                      <span>{naam(pid)}</span>
                      <span className="sub">
                        {gespeeld.get(pid) ?? 0}' gespeeld · {bankminuten(pid)}' bank{n ? ` · niv ${n}` : ''}
                      </span>
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
