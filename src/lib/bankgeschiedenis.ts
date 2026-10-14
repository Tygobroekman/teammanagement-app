import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { rangen, sheetScore } from './eerlijkheid'

export type Staat = 'gespeeld' | 'deels' | 'bank' | 'afwezig' | 'geblesseerd' | 'onbekend'
export type WedstrijdKort = { id: string; aanvang: string; tegenstander: string }
export type BankStaat = { w: WedstrijdKort; staat: Staat; bank: number; duur: number }
export type SpelerBank = {
  id: string
  naam: string
  staten: BankStaat[]
  keren: number // aantal wedstrijden met bankminuten
  aanwezig: number // aantal wedstrijden dat de speler aanwezig was
  bankMin: number
  vorigeBank: boolean // zat in de laatste definitieve wedstrijd op de bank
  vorigeBankMin: number // bankminuten in de laatste definitieve wedstrijd (0 als hij niet meedeed)
  // De eerlijkheidsregels uit de sheet (zie eerlijkheid.ts): Relatief, Gem. en Rang over de laatste wedstrijden.
  relatief: number
  gem: number
  rang: number // hoger = vaker op de bank gezeten = eerder aan de beurt
}

export type Geschiedenis = {
  wedstrijden: WedstrijdKort[]
  spelers: SpelerBank[]
  perId: Map<string, SpelerBank>
  // Rang voor wie nog geen gegevens heeft (Gem. 0), zoals een nieuwe speler of een leenspeler.
  standaardRang: number
}

// Wie zat op de bank, per definitieve wedstrijd van een seizoen. Leenspelers doen niet mee.
export async function laadBankGeschiedenis(seasonId: string): Promise<Geschiedenis | null> {
  const m = await supabase.from('matches').select('id, aanvang, tegenstander').eq('season_id', seasonId).eq('status', 'definitief').order('aanvang')
  if (m.error) return null
  const wedstrijden = m.data as WedstrijdKort[]
  if (wedstrijden.length === 0) return { wedstrijden, spelers: [], perId: new Map(), standaardRang: 1 }
  const ids = wedstrijden.map((w) => w.id)
  const [mm, at, pl] = await Promise.all([
    supabase.from('match_minutes').select('match_id, player_id, minuten_bank, duur_minuten').in('match_id', ids),
    supabase.from('attendance').select('match_id, player_id, status').in('match_id', ids),
    supabase.from('players').select('id, naam').eq('leenspeler', false).eq('actief', true),
  ])
  if (mm.error || at.error || pl.error) return null
  const minuten = mm.data as { match_id: string; player_id: string; minuten_bank: number; duur_minuten: number }[]
  const aanwezigheid = at.data as { match_id: string; player_id: string; status: string }[]

  const spelers = (pl.data as { id: string; naam: string }[]).map((sp) => {
    const staten: BankStaat[] = wedstrijden.map((w) => {
      const x = minuten.find((r) => r.match_id === w.id && r.player_id === sp.id)
      if (x) {
        const staat: Staat = x.minuten_bank <= 0 ? 'gespeeld' : x.minuten_bank >= x.duur_minuten ? 'bank' : 'deels'
        return { w, staat, bank: x.minuten_bank, duur: x.duur_minuten }
      }
      const a = aanwezigheid.find((r) => r.match_id === w.id && r.player_id === sp.id)?.status
      return { w, staat: a === 'afwezig' ? 'afwezig' : a === 'geblesseerd' ? 'geblesseerd' : 'onbekend', bank: 0, duur: 0 }
    })
    const keren = staten.filter((s) => s.staat === 'deels' || s.staat === 'bank').length
    const aanwezig = staten.filter((s) => s.staat === 'gespeeld' || s.staat === 'deels' || s.staat === 'bank').length
    const laatste = staten[staten.length - 1]
    const score = sheetScore(staten.map((st) => ({ staat: st.staat, bank: st.bank })))
    return {
      id: sp.id,
      naam: sp.naam,
      staten,
      keren,
      aanwezig,
      bankMin: staten.reduce((a, s) => a + s.bank, 0),
      vorigeBank: laatste.staat === 'deels' || laatste.staat === 'bank',
      relatief: score.relatief,
      gem: score.gem,
      rang: 0, // wordt hieronder ingevuld
      vorigeBankMin: laatste.staat === 'gespeeld' || laatste.staat === 'deels' || laatste.staat === 'bank' ? laatste.bank : 0,
    }
  })
  // Rang over alle spelers in de selectie, zoals in de sheet.
  const ranglijst = rangen(spelers.map((s) => s.gem))
  spelers.forEach((s, i) => { s.rang = ranglijst[i] })
  const standaardRang = 1 + spelers.filter((s) => s.gem < -1e-9).length
  return { wedstrijden, spelers, perId: new Map(spelers.map((s) => [s.id, s])), standaardRang }
}

export function useBankGeschiedenis(seasonId: string | undefined) {
  const [geschiedenis, setGeschiedenis] = useState<Geschiedenis | null | undefined>(undefined)
  useEffect(() => {
    if (!seasonId) return
    setGeschiedenis(undefined)
    laadBankGeschiedenis(seasonId).then(setGeschiedenis)
  }, [seasonId])
  // undefined = laden, null = mislukt
  return geschiedenis
}
