import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { genereer, type GenSpeler } from '../lib/generator'
import { veldNu } from '../lib/minuten'
import Speelveld from '../components/Speelveld'
import { useBevestig } from '../components/Bevestig'
import type {
  Attendance, Formation, FormationSlot, LineupSlot, Match, Player, PlayerPosition, Substitution,
} from '../lib/types'

type Selectie = { soort: 'slot'; slot: number } | { soort: 'bank'; pid: string } | null
type SeizoenRij = { player_id: string; aanwezig: number; minuten_gespeeld: number }

// Opstelling bouwen: kies formatie, zet spelers op het veld voor de 1e en 2e helft,
// of laat een voorstel maken en pas dat daarna met de hand aan.
export default function Opstelling() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { vraag, dialoog } = useBevestig()

  const [match, setMatch] = useState<Match | null>(null)
  const [formaties, setFormaties] = useState<Formation[]>([])
  const [formatie, setFormatie] = useState('')
  const [slots, setSlots] = useState<FormationSlot[]>([])
  const [spelers, setSpelers] = useState<Player[]>([])
  const [niveaus, setNiveaus] = useState<PlayerPosition[]>([])
  const [aanw, setAanw] = useState<Attendance[]>([])
  const [seizoen, setSeizoen] = useState<SeizoenRij[]>([])
  const [bestaandeWissels, setBestaandeWissels] = useState(0)
  const [h1, setH1] = useState<Map<number, string>>(new Map())
  const [h2Eigen, setH2Eigen] = useState<Map<number, string> | null>(null)
  const [helft, setHelft] = useState<1 | 2>(1)
  const [sel, setSel] = useState<Selectie>(null)
  const [voorstelOpen, setVoorstelOpen] = useState(false)
  const [meldingen, setMeldingen] = useState<string[]>([])
  const [weging, setWeging] = useState(50)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const m = await supabase.from('matches').select('*').eq('id', id).single()
      if (m.error) return setFout('Wedstrijd niet gevonden.')
      const wedstrijd = m.data as Match
      const [fm, fs, pl, pp, at, lu, sb, so] = await Promise.all([
        supabase.from('formations').select('*').order('code'),
        supabase.from('formation_slots').select('*').eq('formation_code', wedstrijd.formation_code).order('slot'),
        supabase.from('players').select('*').order('naam'),
        supabase.from('player_positions').select('*'),
        supabase.from('attendance').select('*').eq('match_id', id),
        supabase.from('lineup_slots').select('*').eq('match_id', id),
        supabase.from('substitutions').select('*').eq('match_id', id),
        supabase.from('season_overview').select('player_id, aanwezig, minuten_gespeeld').eq('season_id', wedstrijd.season_id),
      ])
      if ([fm, fs, pl, pp, at, lu, sb, so].some((r) => r.error)) return setFout('Laden mislukt.')
      setMatch(wedstrijd)
      setFormaties(fm.data as Formation[])
      setFormatie(wedstrijd.formation_code)
      setSlots(fs.data as FormationSlot[])
      setSpelers(pl.data as Player[])
      setNiveaus(pp.data as PlayerPosition[])
      setAanw(at.data as Attendance[])
      setSeizoen(so.data as SeizoenRij[])
      const basis = new Map((lu.data as LineupSlot[]).map((b) => [b.slot, b.player_id]))
      setH1(basis)
      const wissels = sb.data as Substitution[]
      setBestaandeWissels(wissels.length)
      const rust = Math.round(wedstrijd.duur_minuten / 2)
      const rustWissels = wissels.filter((w) => w.minuut === rust)
      if (rustWissels.length) setH2Eigen(veldNu(basis, rustWissels))
    })()
  }, [id])

  const genSpelers: GenSpeler[] = useMemo(() => {
    const aanwezig = new Set(aanw.filter((a) => a.status === 'aanwezig').map((a) => a.player_id))
    return spelers.filter((s) => aanwezig.has(s.id)).map((s) => {
      const rij = seizoen.find((r) => r.player_id === s.id)
      const n: Record<string, number> = {}
      for (const p of niveaus) if (p.player_id === s.id) n[p.position_code] = p.niveau
      return {
        id: s.id, naam: s.naam, niveaus: n, voorkeur: s.voorkeurspositie,
        seizoenGemiddeld: rij && rij.aanwezig > 0 ? rij.minuten_gespeeld / rij.aanwezig : null,
      }
    })
  }, [spelers, niveaus, aanw, seizoen])

  if (fout && !match) return <p className="fout">{fout}</p>
  if (!match || !id) return <p>Laden...</p>

  const duur = match.duur_minuten
  const rust = Math.round(duur / 2)
  const h2 = h2Eigen ?? h1
  const actief = helft === 1 ? h1 : h2
  const naam = (pid: string) => spelers.find((s) => s.id === pid)?.naam ?? '?'
  const niveauVoor = (pid: string, pos: string) => niveaus.find((n) => n.player_id === pid && n.position_code === pos)?.niveau
  const bank = genSpelers.filter((g) => ![...actief.values()].includes(g.id))
  const minuten = (pid: string) =>
    ([...h1.values()].includes(pid) ? rust : 0) + ([...h2.values()].includes(pid) ? duur - rust : 0)
  const geselecteerdeSlot = sel?.soort === 'slot' ? slots.find((s) => s.slot === sel.slot) : undefined

  function zetActief(m: Map<number, string>) {
    if (helft === 1) setH1(m)
    else setH2Eigen(m)
  }

  function tikSlot(slot: number) {
    if (!sel) return setSel({ soort: 'slot', slot })
    if (sel.soort === 'slot') {
      if (sel.slot !== slot) {
        const m = new Map(actief)
        const a = m.get(sel.slot)
        const b = m.get(slot)
        if (b) m.set(sel.slot, b); else m.delete(sel.slot)
        if (a) m.set(slot, a); else m.delete(slot)
        zetActief(m)
      }
      return setSel(null)
    }
    const m = new Map(actief)
    m.set(slot, sel.pid)
    zetActief(m)
    setSel(null)
  }

  function tikBank(pid: string) {
    if (!sel) return setSel({ soort: 'bank', pid })
    if (sel.soort === 'slot') {
      const m = new Map(actief)
      m.set(sel.slot, pid)
      zetActief(m)
      return setSel(null)
    }
    setSel(sel.pid === pid ? null : { soort: 'bank', pid })
  }

  function naarBank() {
    if (sel?.soort !== 'slot') return
    const m = new Map(actief)
    m.delete(sel.slot)
    zetActief(m)
    setSel(null)
  }

  async function wijzigFormatie(code: string) {
    const fs = await supabase.from('formation_slots').select('*').eq('formation_code', code).order('slot')
    if (fs.error) return setFout('Formatie laden mislukt.')
    setFormatie(code)
    setSlots(fs.data as FormationSlot[])
    setSel(null)
  }

  async function maakVoorstel() {
    if (h1.size > 0 && !(await vraag('De huidige opstelling wordt vervangen door het voorstel. Doorgaan?'))) return
    const v = genereer({
      spelers: genSpelers,
      slots: slots.map((s) => ({ slot: s.slot, position_code: s.position_code })),
      duur,
      weging,
      blokken: 2,
    })
    if (!v) return setFout(`Voor een voorstel zijn minstens ${slots.length} aanwezige spelers nodig.`)
    const basis = new Map(v.basis.map((b) => [b.slot, b.player_id]))
    setH1(basis)
    setH2Eigen(veldNu(basis, v.wissels))
    setHelft(1)
    setSel(null)
    setVoorstelOpen(false)
    setFout(null)
    // Waarschuwen voor wat het voorstel niet goed kon invullen.
    const m: string[] = []
    for (const pid of v.zonderPositie) m.push(`${naam(pid)} heeft geen posities ingevuld en wordt niet ingezet.`)
    for (const b of v.buitenPositie) {
      const pos = slots.find((x) => x.slot === b.slot)?.position_code ?? ''
      m.push(`${naam(b.player_id)} staat op ${pos}, maar daar is geen niveau voor ingevuld. Er was niemand anders voor die plek.`)
    }
    setMeldingen(m)
  }

  async function opslaan() {
    const vol1 = h1.size === slots.length
    const vol2 = h2.size === slots.length
    if (h2Eigen && !vol2 && !(await vraag('De 2e helft is nog niet compleet. Dan worden de rustwissels niet opgeslagen. Doorgaan?'))) return
    if (bestaandeWissels > 0 && !(await vraag('Bestaande wissels worden vervangen door de wissels uit deze opstelling. Doorgaan?'))) return
    setBezig(true)
    setFout(null)
    const posVan = (slot: number) => slots.find((s) => s.slot === slot)?.position_code ?? ''
    if (formatie !== match!.formation_code) {
      const u = await supabase.from('matches').update({ formation_code: formatie }).eq('id', id)
      if (u.error) { setBezig(false); return setFout('Formatie opslaan mislukt.') }
    }
    const dw = await supabase.from('substitutions').delete().eq('match_id', id)
    const dl = await supabase.from('lineup_slots').delete().eq('match_id', id)
    if (dw.error || dl.error) { setBezig(false); return setFout('Opslaan mislukt.') }
    if (h1.size > 0) {
      const il = await supabase.from('lineup_slots').insert(
        [...h1.entries()].map(([slot, pid]) => ({ match_id: id, slot, player_id: pid, position_code: posVan(slot) })),
      )
      if (il.error) { setBezig(false); return setFout('Opstelling opslaan mislukt.') }
    }
    const rijen = vol1 && vol2
      ? slots
          .filter((s) => h1.get(s.slot) !== h2.get(s.slot))
          .map((s) => ({
            match_id: id, minuut: rust, player_in: h2.get(s.slot)!, player_out: h1.get(s.slot)!,
            slot: s.slot, position_code: s.position_code,
          }))
      : []
    if (rijen.length) {
      const is = await supabase.from('substitutions').insert(rijen)
      if (is.error) { setBezig(false); return setFout('Wissels opslaan mislukt.') }
    }
    setBezig(false)
    navigate(`/wedstrijden/${id}`)
  }

  return (
    <>
      <div className="rij">
        <Link to={`/wedstrijden/${id}`} className="link klein">Terug</Link>
        <span className="sub">{match.thuis_uit === 'thuis' ? 'Thuis' : 'Uit'} tegen {match.tegenstander}</span>
      </div>
      <h1>Opstelling</h1>

      <div className="keuze tabs">
        <button type="button" className={helft === 1 ? 'actief' : ''} onClick={() => { setHelft(1); setSel(null) }}>
          1e helft
        </button>
        <button type="button" className={helft === 2 ? 'actief' : ''} onClick={() => { setHelft(2); setSel(null) }}>
          2e helft
        </button>
      </div>

      <div className="regel opties">
        <select value={formatie} onChange={(e) => wijzigFormatie(e.target.value)} aria-label="Formatie">
          {formaties.map((f) => <option key={f.code} value={f.code}>{f.naam}</option>)}
        </select>
        <button type="button" className="grijsknop kleinknop" onClick={() => setVoorstelOpen(!voorstelOpen)}>
          Voorstel maken
        </button>
      </div>

      {voorstelOpen && (
        <fieldset>
          <legend>Voorstel maken</legend>
          {genSpelers.length < slots.length ? (
            <p className="fout">Er zijn {genSpelers.length} aanwezige spelers, er zijn er {slots.length} nodig.</p>
          ) : (
            <>
              <p className="sub">{genSpelers.length} aanwezig. Wissels alleen in de rust.</p>
              <input
                type="range" min={0} max={100} step={5} value={weging}
                onChange={(e) => setWeging(Number(e.target.value))}
                aria-label="Weging tussen sterkste elf en eerlijke speeltijd"
              />
              <div className="schuiflabels">
                <span className={weging < 50 ? 'dik' : ''}>Sterkste elf</span>
                <span className={weging > 50 ? 'dik' : ''}>Eerlijke speeltijd</span>
              </div>
              <button type="button" onClick={maakVoorstel}>Maak voorstel</button>
              <p className="sub">Daarna kun je alles nog zelf aanpassen.</p>
            </>
          )}
        </fieldset>
      )}

      {meldingen.length > 0 && (
        <div className="banner">
          <strong>Let op bij dit voorstel:</strong>
          <ul className="meldingen">{meldingen.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      <p className="sub hint">
        {sel?.soort === 'slot'
          ? 'Tik op een andere plek om te wisselen, of op een speler van de bank.'
          : sel?.soort === 'bank'
            ? `Tik op de plek waar ${naam(sel.pid)} moet staan.`
            : 'Tik op een plek of een speler om te beginnen.'}
      </p>

      <Speelveld
        slots={slots}
        veld={actief}
        naam={naam}
        geselecteerd={sel?.soort === 'slot' ? sel.slot : null}
        onTik={tikSlot}
        badge={(s, pid) => {
          const n = pid ? niveauVoor(pid, s.position_code) : undefined
          return n ? String(n) : undefined
        }}
      />

      {sel?.soort === 'slot' && actief.get(sel.slot) && (
        <button type="button" className="grijsknop" onClick={naarBank}>Naar de bank</button>
      )}

      <div className="rij kopje">
        <h2>Bank ({bank.length})</h2>
        {helft === 2 && h2Eigen && (
          <button type="button" className="link klein" onClick={() => { setH2Eigen(null); setSel(null) }}>
            2e helft = 1e helft
          </button>
        )}
      </div>
      {genSpelers.length === 0 ? (
        <p className="sub">Nog geen aanwezige spelers. <Link to={`/wedstrijden/${id}`}>Geef eerst de aanwezigheid op.</Link></p>
      ) : bank.length === 0 ? <p className="sub">Niemand op de bank.</p> : (
        <div className="chips">
          {bank.map((g) => {
            const n = geselecteerdeSlot ? niveauVoor(g.id, geselecteerdeSlot.position_code) : undefined
            const m = minuten(g.id)
            return (
              <button
                key={g.id}
                type="button"
                className={`chip ${sel?.soort === 'bank' && sel.pid === g.id ? 'gekozen' : ''} ${m === 0 ? 'nul' : ''}`}
                onClick={() => tikBank(g.id)}
              >
                <span>{g.naam}</span>
                <span className="sub">{n ? `niv ${n} · ` : ''}{m}'</span>
              </button>
            )
          })}
        </div>
      )}
      <p className="sub">De minuten achter een naam zijn de totale speeltijd in beide helften.</p>

      {fout && <p className="fout">{fout}</p>}
      <div className="form opslaan">
        <button disabled={bezig} onClick={opslaan}>{bezig ? 'Opslaan...' : 'Opslaan'}</button>
        <p className="sub">
          Nu ingevuld: {h1.size} van {slots.length} in de 1e helft, {h2.size} van {slots.length} in de 2e helft.
          Verschillen tussen de helften worden wissels in de rust ({rust}').
        </p>
      </div>
      {dialoog}
    </>
  )
}
