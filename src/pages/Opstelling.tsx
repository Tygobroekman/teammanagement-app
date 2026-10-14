import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { genereer, type GenSpeler } from '../lib/generator'
import { veldNu } from '../lib/minuten'
import Speelveld from '../components/Speelveld'
import RustOverzicht from '../components/RustOverzicht'
import { BankLegenda } from '../components/BankStippen'
import BankRij from '../components/BankRij'
import { useBankGeschiedenis } from '../lib/bankgeschiedenis'
import { avatarStijl, initialen } from '../lib/format'
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
  const [helft, setHelft] = useState<1 | 2 | 'samen'>(1)
  const [sel, setSel] = useState<Selectie>(null)
  const [voorstelOpen, setVoorstelOpen] = useState(false)
  const [meldingen, setMeldingen] = useState<string[]>([])
  const [voorrangInfo, setVoorrangInfo] = useState<string | null>(null)
  const [keeperWisselen, setKeeperWisselen] = useState(false)
  const [keeperInfo, setKeeperInfo] = useState<string | null>(null)
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
      if (rustWissels.length) { setH2Eigen(veldNu(basis, rustWissels)); setHelft('samen') }
    })()
  }, [id])

  const bankGeschiedenis = useBankGeschiedenis(match?.season_id)

  const genSpelers: GenSpeler[] = useMemo(() => {
    const aanwezig = new Set(aanw.filter((a) => a.status === 'aanwezig').map((a) => a.player_id))
    return spelers.filter((s) => aanwezig.has(s.id)).map((s) => {
      const rij = seizoen.find((r) => r.player_id === s.id)
      const n: Record<string, number> = {}
      for (const p of niveaus) if (p.player_id === s.id) n[p.position_code] = p.niveau
      return {
        id: s.id, naam: s.naam, niveaus: n, voorkeur: s.voorkeurspositie,
        seizoenGemiddeld: rij && rij.aanwezig > 0 ? rij.minuten_gespeeld / rij.aanwezig : null,
        vorigeBankMin: bankGeschiedenis?.perId.get(s.id)?.vorigeBankMin ?? 0,
      }
    })
  }, [spelers, niveaus, aanw, seizoen, bankGeschiedenis])

  if (fout && !match) return <p className="fout">{fout}</p>
  if (!match || !id) return <p>Laden...</p>

  const duur = match.duur_minuten
  const rust = Math.round(duur / 2)
  const h2 = h2Eigen ?? h1
  const actief = helft === 2 ? h2 : h1
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

  // Vanuit de Samen-weergave: tik op een plek om die in de 2e helft aan te passen.
  function tikSamen(slot: number) {
    setHelft(2)
    setSel({ soort: 'slot', slot })
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
      keepersWisselen: keeperWisselen,
    })
    if (!v) return setFout(`Voor een voorstel zijn minstens ${slots.length} aanwezige spelers nodig.`)
    const basis = new Map(v.basis.map((b) => [b.slot, b.player_id]))
    setH1(basis)
    setH2Eigen(veldNu(basis, v.wissels))
    setHelft('samen')
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
    // Iedereen die kan spelen krijgt minstens een helft. Lukt dat niet, dan zeggen we wie en waarom.
    for (const pid of v.nietIngezet) {
      m.push(`${naam(pid)} kon niet worden ingepast: zijn posities passen niet bij de rest van de opstelling. Vul bij hem meer posities in.`)
    }
    if (v.wissels.length === 0 && genSpelers.length > slots.length) {
      m.push('Er zijn geen wissels in de rust, omdat de spelers op de bank op geen enkele plek kunnen staan. Vul bij hen posities in bij Spelers.')
    }
    setMeldingen(m)
    // Terugkoppeling over de voorrang voor wie vorige keer op de bank zat.
    const inBasis = new Set(v.basis.map((b) => b.player_id))
    const voorrang = genSpelers.filter((g) => (g.vorigeBankMin ?? 0) > 0).sort((a, b) => (b.vorigeBankMin ?? 0) - (a.vorigeBankMin ?? 0)).map((g) => {
      const min = v.minuten.get(g.id) ?? 0
      return `${g.naam} (${g.vorigeBankMin}' bank, nu ${inBasis.has(g.id) ? 'basis' : min > 0 ? '2e helft' : 'speelt niet'})`
    })
    setVoorrangInfo(voorrang.length ? voorrang.join(', ') : null)
    setKeeperInfo(
      v.reservekeepers.length
        ? `${v.reservekeepers.map((id) => naam(id)).join(', ')} is reservekeeper en speelt niet mee, want de keeper blijft de hele wedstrijd staan.`
        : null,
    )
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
        <button type="button" className={helft === 'samen' ? 'actief' : ''} onClick={() => { setHelft('samen'); setSel(null) }}>
          Samen
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
              <p className="sub">{genSpelers.length} aanwezig. Wissels alleen in de rust. Iedereen speelt minstens een helft.</p>
              <input
                type="range" min={0} max={100} step={5} value={weging}
                onChange={(e) => setWeging(Number(e.target.value))}
                aria-label="Weging tussen sterkste elf en eerlijke speeltijd"
              />
              <div className="schuiflabels">
                <span className={weging < 50 ? 'dik' : ''}>Sterkste elf</span>
                <span className={weging > 50 ? 'dik' : ''}>Eerlijke speeltijd</span>
              </div>
              {genSpelers.filter((g) => (g.niveaus.GK ?? 0) > 0).length >= 2 && (
                <label className="regel">
                  <input type="checkbox" checked={keeperWisselen} onChange={(e) => setKeeperWisselen(e.target.checked)} />
                  Reservekeeper mag in de 2e helft keepen
                </label>
              )}
              <button type="button" onClick={maakVoorstel}>Maak voorstel</button>
              <p className="sub">Daarna kun je alles nog zelf aanpassen.</p>
            </>
          )}
        </fieldset>
      )}

      {voorrangInfo && (
        <p className="banner ok">
          <strong>Voorrang:</strong> zaten vorige keer op de bank: {voorrangInfo}.
        </p>
      )}

      {keeperInfo && <p className="sub">{keeperInfo}</p>}

      {meldingen.length > 0 && (
        <div className="banner">
          <strong>Let op bij dit voorstel:</strong>
          <ul className="meldingen">{meldingen.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      {helft === 'samen' && (
        <>
          <p className="sub hint">Vet is de 1e helft, cursief met pijl is de 2e helft. Tik op een plek om die in de 2e helft aan te passen.</p>
          <Speelveld slots={slots} veld={h1} veld2={h2} naam={naam} onTik={tikSamen} />
          <h2>In de rust</h2>
          <RustOverzicht h1={h1} h2={h2} slots={slots} naam={naam} />
          <h2>Bank</h2>
          <p><strong>1e helft:</strong> {genSpelers.filter((g) => ![...h1.values()].includes(g.id)).map((g) => g.naam).join(', ') || 'niemand'}</p>
          <p><strong>2e helft:</strong> {genSpelers.filter((g) => ![...h2.values()].includes(g.id)).map((g) => g.naam).join(', ') || 'niemand'}</p>
        </>
      )}

      {helft !== 'samen' && (
      <>
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
            const bg = bankGeschiedenis?.perId.get(g.id)
            return (
              <button
                key={g.id}
                type="button"
                className={`chip ${sel?.soort === 'bank' && sel.pid === g.id ? 'gekozen' : ''} ${m === 0 ? 'nul' : ''} ${bg?.vorigeBank ? 'vorige' : ''}`}
                onClick={() => tikBank(g.id)}
              >
                <span>{g.naam}</span>
                <span className="sub">{n ? `niv ${n} · ` : ''}{m}'{bg && bg.keren > 0 ? ` · bank ${bg.keren}x` : ''}</span>
              </button>
            )
          })}
        </div>
      )}
      <p className="sub">
        De minuten achter een naam zijn de totale speeltijd in beide helften. Een gele naam zat in de laatste wedstrijd op de bank.
      </p>
      </>
      )}

      {bankGeschiedenis && bankGeschiedenis.wedstrijden.length > 0 && genSpelers.length > 0 && (
        <details className="bankhistorie" open>
          <summary>Wie zat er eerder op de bank?</summary>
          <ul className="lijst">
            {genSpelers
              .map((g) => bankGeschiedenis.perId.get(g.id))
              .filter((r): r is NonNullable<typeof r> => r !== undefined)
              .sort((a, b) => b.keren - a.keren || b.bankMin - a.bankMin || a.naam.localeCompare(b.naam, 'nl'))
              .map((r) => <BankRij key={r.id} r={r} aanwezigTekst={`van ${r.aanwezig}`} />)}
          </ul>
          <BankLegenda />
          <p className="sub">Tik op een speler om per wedstrijd de bankminuten te zien. Alleen definitieve wedstrijden.</p>
        </details>
      )}

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
