import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { avatarStijl, initialen } from '../lib/format'

type Wedstrijd = { id: string; aanvang: string; tegenstander: string }
type Minuten = { match_id: string; player_id: string; minuten_gespeeld: number; minuten_bank: number; duur_minuten: number }
type Aanwezig = { match_id: string; player_id: string; status: string }
type Speler = { id: string; naam: string }

type Staat = 'gespeeld' | 'deels' | 'bank' | 'afwezig' | 'geblesseerd' | 'onbekend'

const UITLEG: Record<Staat, string> = {
  gespeeld: 'hele wedstrijd gespeeld',
  deels: 'deels op de bank',
  bank: 'hele wedstrijd op de bank',
  afwezig: 'afwezig',
  geblesseerd: 'geblesseerd',
  onbekend: 'geen gegevens',
}

const MAX_STIPPEN = 8

// Hoe vaak heeft iemand op de bank gezeten, en wanneer. Telt alleen definitieve wedstrijden.
export default function BankOverzicht({ seasonId }: { seasonId: string }) {
  const [data, setData] = useState<{ wedstrijden: Wedstrijd[]; minuten: Minuten[]; aanwezig: Aanwezig[]; spelers: Speler[] } | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    ;(async () => {
      const m = await supabase.from('matches').select('id, aanvang, tegenstander').eq('season_id', seasonId).eq('status', 'definitief').order('aanvang')
      if (m.error) return setFout('Overzicht laden mislukt.')
      const wedstrijden = m.data as Wedstrijd[]
      const ids = wedstrijden.map((w) => w.id)
      if (ids.length === 0) return setData({ wedstrijden, minuten: [], aanwezig: [], spelers: [] })
      const [mm, at, pl] = await Promise.all([
        supabase.from('match_minutes').select('match_id, player_id, minuten_gespeeld, minuten_bank, duur_minuten').in('match_id', ids),
        supabase.from('attendance').select('match_id, player_id, status').in('match_id', ids),
        supabase.from('players').select('id, naam').eq('leenspeler', false),
      ])
      if (mm.error || at.error || pl.error) return setFout('Overzicht laden mislukt.')
      setData({ wedstrijden, minuten: mm.data as Minuten[], aanwezig: at.data as Aanwezig[], spelers: pl.data as Speler[] })
    })()
  }, [seasonId])

  if (fout) return <p className="fout">{fout}</p>
  if (!data) return <p>Laden...</p>
  if (data.wedstrijden.length === 0) {
    return <p className="leeg-staat">Nog geen definitieve wedstrijden. Zodra er een wedstrijd definitief is, zie je hier wie er op de bank zat.</p>
  }

  const laatste = data.wedstrijden[data.wedstrijden.length - 1]
  const datumKort = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).replace('.', '')

  const rijen = data.spelers
    .map((sp) => {
      const staten = data.wedstrijden.map((w) => {
        const mm = data.minuten.find((x) => x.match_id === w.id && x.player_id === sp.id)
        let staat: Staat = 'onbekend'
        let bank = 0
        if (mm) {
          bank = mm.minuten_bank
          staat = bank <= 0 ? 'gespeeld' : bank >= mm.duur_minuten ? 'bank' : 'deels'
        } else {
          const a = data.aanwezig.find((x) => x.match_id === w.id && x.player_id === sp.id)?.status
          if (a === 'afwezig') staat = 'afwezig'
          else if (a === 'geblesseerd') staat = 'geblesseerd'
        }
        return { w, staat, bank }
      })
      const keren = staten.filter((s) => s.staat === 'deels' || s.staat === 'bank').length
      const aanwezig = staten.filter((s) => ['gespeeld', 'deels', 'bank'].includes(s.staat)).length
      const bankMin = staten.reduce((a, s) => a + s.bank, 0)
      const vorige = staten[staten.length - 1]
      return { sp, staten, keren, aanwezig, bankMin, vorigeBank: vorige.staat === 'deels' || vorige.staat === 'bank' }
    })
    .filter((r) => r.aanwezig > 0)
    .sort((a, b) => b.keren - a.keren || b.bankMin - a.bankMin || a.sp.naam.localeCompare(b.sp.naam, 'nl'))

  return (
    <>
      <p className="sub">
        Laatste wedstrijd: {laatste.tegenstander} ({datumKort(laatste.aanvang)}). De stippen lopen van oud naar nieuw, de
        meest rechtse is de laatste wedstrijd.
      </p>
      <ul className="lijst">
        {rijen.map((r) => (
          <li key={r.sp.id} className="aanw seizoenrij">
            <span className="speler">
              <span className="avatar" style={avatarStijl(r.sp.naam)}>{initialen(r.sp.naam)}</span>
              <span className="blok">
                <span className="naamregel">
                  <span>{r.sp.naam}</span>
                  {r.vorigeBank && <span className="chipje geel">vorige keer bank</span>}
                </span>
                <span className="stippen" aria-label="Laatste wedstrijden">
                  {r.staten.slice(-MAX_STIPPEN).map((s) => (
                    <span
                      key={s.w.id}
                      className={`stip ${s.staat}`}
                      title={`${datumKort(s.w.aanvang)} ${s.w.tegenstander}: ${UITLEG[s.staat]}${s.bank > 0 ? ` (${s.bank}' bank)` : ''}`}
                    />
                  ))}
                </span>
              </span>
            </span>
            <span className="rechts">
              <span className="groot-getal">{r.keren}x</span>
              <span className="sub klein-regel">van {r.aanwezig} aanwezig</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="legenda">
        {(['gespeeld', 'deels', 'bank', 'afwezig', 'geblesseerd'] as Staat[]).map((s) => (
          <span key={s}><span className={`stip ${s}`} /> {UITLEG[s]}</span>
        ))}
      </div>
      <p className="sub">
        "Op de bank" betekent: aanwezig met meer dan 0 bankminuten in die wedstrijd. Leenspelers staan er niet in.
      </p>
    </>
  )
}
