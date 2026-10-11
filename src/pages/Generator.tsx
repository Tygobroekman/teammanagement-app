import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { genereer, type GenSpeler } from '../lib/generator'
import type { Attendance, FormationSlot, Match, Player, PlayerPosition } from '../lib/types'

type SeizoenRij = { player_id: string; aanwezig: number; minuten_gespeeld: number }

const BLOKKEN = [
  { waarde: 2, label: 'Weinig wissels', uitleg: 'Alleen bij de rust' },
  { waarde: 4, label: 'Normaal', uitleg: 'Rust en twee keer erbij' },
  { waarde: 6, label: 'Veel wissels', uitleg: 'Elke 15 minuten, eerlijkst' },
]

export default function Generator() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState<Match | null>(null)
  const [slots, setSlots] = useState<FormationSlot[]>([])
  const [spelers, setSpelers] = useState<Player[]>([])
  const [niveaus, setNiveaus] = useState<PlayerPosition[]>([])
  const [aanw, setAanw] = useState<Attendance[]>([])
  const [seizoen, setSeizoen] = useState<SeizoenRij[]>([])
  const [bestaand, setBestaand] = useState({ basis: 0, wissels: 0 })
  const [weging, setWeging] = useState(50)
  const [blokken, setBlokken] = useState(4)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const m = await supabase.from('matches').select('*').eq('id', id).single()
      if (m.error) return setFout('Wedstrijd niet gevonden.')
      const wedstrijd = m.data as Match
      const [fs, pl, pp, at, so, lu, sb] = await Promise.all([
        supabase.from('formation_slots').select('*').eq('formation_code', wedstrijd.formation_code).order('slot'),
        supabase.from('players').select('*'),
        supabase.from('player_positions').select('*'),
        supabase.from('attendance').select('*').eq('match_id', id),
        supabase.from('season_overview').select('player_id, aanwezig, minuten_gespeeld').eq('season_id', wedstrijd.season_id),
        supabase.from('lineup_slots').select('slot', { count: 'exact', head: true }).eq('match_id', id),
        supabase.from('substitutions').select('id', { count: 'exact', head: true }).eq('match_id', id),
      ])
      if ([fs, pl, pp, at, so, lu, sb].some((r) => r.error)) return setFout('Laden mislukt.')
      setMatch(wedstrijd)
      setSlots(fs.data as FormationSlot[])
      setSpelers(pl.data as Player[])
      setNiveaus(pp.data as PlayerPosition[])
      setAanw(at.data as Attendance[])
      setSeizoen(so.data as SeizoenRij[])
      setBestaand({ basis: lu.count ?? 0, wissels: sb.count ?? 0 })
    })()
  }, [id])

  const genSpelers: GenSpeler[] = useMemo(() => {
    const aanwezig = new Set(aanw.filter((a) => a.status === 'aanwezig').map((a) => a.player_id))
    return spelers
      .filter((s) => aanwezig.has(s.id))
      .map((s) => {
        const rij = seizoen.find((r) => r.player_id === s.id)
        const n: Record<string, number> = {}
        for (const p of niveaus) if (p.player_id === s.id) n[p.position_code] = p.niveau
        return {
          id: s.id,
          naam: s.naam,
          niveaus: n,
          voorkeur: s.voorkeurspositie,
          seizoenGemiddeld: rij && rij.aanwezig > 0 ? rij.minuten_gespeeld / rij.aanwezig : null,
        }
      })
  }, [spelers, niveaus, aanw, seizoen])

  const voorstel = useMemo(() => {
    if (!match || slots.length === 0) return null
    return genereer({
      spelers: genSpelers,
      slots: slots.map((s) => ({ slot: s.slot, position_code: s.position_code })),
      duur: match.duur_minuten,
      weging,
      blokken,
    })
  }, [match, slots, genSpelers, weging, blokken])

  if (fout) return <p className="fout">{fout}</p>
  if (!match || !id) return <p>Laden...</p>

  const naam = (pid: string) => spelers.find((s) => s.id === pid)?.naam ?? '?'
  const posVan = (slot: number) => slots.find((s) => s.slot === slot)?.position_code ?? ''

  async function pasToe(metWissels: boolean) {
    if (!voorstel) return
    if (
      (bestaand.basis > 0 || bestaand.wissels > 0) &&
      !window.confirm('Er staat al een opstelling of er zijn al wissels. Die worden vervangen. Doorgaan?')
    ) return
    setBezig(true)
    setFout(null)
    const dw = await supabase.from('substitutions').delete().eq('match_id', id)
    const dl = await supabase.from('lineup_slots').delete().eq('match_id', id)
    if (dw.error || dl.error) { setBezig(false); return setFout('Oude opstelling verwijderen mislukt.') }
    const il = await supabase.from('lineup_slots').insert(
      voorstel.basis.map((b) => ({ match_id: id, slot: b.slot, player_id: b.player_id, position_code: posVan(b.slot) })),
    )
    if (il.error) { setBezig(false); return setFout('Opstelling opslaan mislukt.') }
    if (metWissels && voorstel.wissels.length) {
      const is = await supabase.from('substitutions').insert(
        voorstel.wissels.map((w) => ({
          match_id: id, minuut: w.minuut, player_in: w.player_in, player_out: w.player_out,
          slot: w.slot, position_code: posVan(w.slot),
        })),
      )
      if (is.error) { setBezig(false); return setFout('Wissels opslaan mislukt.') }
    }
    setBezig(false)
    navigate(`/wedstrijden/${id}`)
  }

  const aantal = genSpelers.length
  const minuutLijst = voorstel
    ? [...voorstel.minuten.entries()].sort((a, b) => b[1] - a[1])
    : []

  return (
    <>
      <div className="rij">
        <Link to={`/wedstrijden/${id}`} className="link klein">Terug naar wedstrijd</Link>
        <span className="sub">{match.thuis_uit === 'thuis' ? 'Thuis' : 'Uit'} tegen {match.tegenstander}</span>
      </div>
      <h1>Opstelling voorstellen</h1>

      {aantal < slots.length ? (
        <p className="fout">
          Er zijn {aantal} aanwezige spelers, er zijn er {slots.length} nodig. Vink eerst spelers aan als aanwezig.
        </p>
      ) : (
        <>
          <p className="sub">{aantal} aanwezig. Het voorstel kun je daarna altijd zelf aanpassen.</p>

          <fieldset>
            <legend>Wat vind je belangrijker?</legend>
            <input
              type="range" min={0} max={100} step={5} value={weging}
              onChange={(e) => setWeging(Number(e.target.value))}
              aria-label="Weging tussen sterkste opstelling en eerlijke speeltijd"
            />
            <div className="schuiflabels">
              <span className={weging < 50 ? 'dik' : ''}>Sterkste elf</span>
              <span className={weging > 50 ? 'dik' : ''}>Eerlijke speeltijd</span>
            </div>
          </fieldset>

          <fieldset>
            <legend>Aantal wissels</legend>
            <div className="keuze">
              {BLOKKEN.map((b) => (
                <button key={b.waarde} type="button" className={blokken === b.waarde ? 'actief' : ''} onClick={() => setBlokken(b.waarde)}>
                  {b.label}
                </button>
              ))}
            </div>
            <p className="sub">{BLOKKEN.find((b) => b.waarde === blokken)?.uitleg}</p>
          </fieldset>

          {voorstel && (
            <>
              <h2>Basisopstelling</h2>
              <div className="veld">
                {slots.map((s) => {
                  const b = voorstel.basis.find((x) => x.slot === s.slot)
                  return (
                    <div key={s.slot} className="plek gevuld statisch" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                      <span className="pos">{s.position_code}</span>
                      <span className="nm">{b ? naam(b.player_id) : '-'}</span>
                    </div>
                  )
                })}
              </div>

              <h2>Wisselplan ({voorstel.wissels.length})</h2>
              {voorstel.wissels.length === 0 ? <p className="sub">Geen wissels in dit voorstel.</p> : (
                <ul className="lijst">
                  {voorstel.wissels.map((w, i) => (
                    <li key={i} className="aanw">
                      <span>{w.minuut}' {naam(w.player_in)} erin, {naam(w.player_out)} eruit</span>
                      <span className="sub">{posVan(w.slot)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h2>Speeltijd in dit voorstel</h2>
              <ul className="lijst">
                {minuutLijst.map(([pid, m]) => {
                  const g = genSpelers.find((s) => s.id === pid)?.seizoenGemiddeld
                  return (
                    <li key={pid} className="aanw">
                      <span>{naam(pid)}</span>
                      <span className="sub">
                        {m}' {g != null ? `· seizoen gem. ${Math.round(g)}'` : '· nog geen seizoensdata'}
                      </span>
                    </li>
                  )
                })}
                {genSpelers.filter((s) => !voorstel.minuten.has(s.id)).map((s) => (
                  <li key={s.id} className="aanw">
                    <span>{s.naam}</span>
                    <span className="sub">0' · seizoen gem. {s.seizoenGemiddeld != null ? Math.round(s.seizoenGemiddeld) + "'" : 'onbekend'}</span>
                  </li>
                ))}
              </ul>

              {fout && <p className="fout">{fout}</p>}
              <div className="form">
                <button disabled={bezig} onClick={() => pasToe(true)}>Basis en wisselplan toepassen</button>
                <button disabled={bezig} className="grijsknop" onClick={() => pasToe(false)}>Alleen basis toepassen</button>
              </div>
              <p className="sub">
                Het wisselplan wordt opgeslagen als wissels van deze wedstrijd. Klopt het in het echt anders, pas het dan
                aan bij Wissels invoeren.
              </p>
            </>
          )}
        </>
      )}
    </>
  )
}
