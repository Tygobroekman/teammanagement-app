import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Staat = 'gespeeld' | 'deels' | 'bank' | 'afwezig' | 'geblesseerd' | 'onbekend'
export type WedstrijdKort = { id: string; aanvang: string; tegenstander: string }
export type BankStaat = { w: WedstrijdKort; staat: Staat; bank: number }
export type SpelerBank = {
  id: string
  naam: string
  staten: BankStaat[]
  keren: number // aantal wedstrijden met bankminuten
  aanwezig: number // aantal wedstrijden dat de speler aanwezig was
  bankMin: number
  vorigeBank: boolean // zat in de laatste definitieve wedstrijd op de bank
}
export type Geschiedenis = { wedstrijden: WedstrijdKort[]; spelers: SpelerBank[]; perId: Map<string, SpelerBank> }

// Wie zat op de bank, per definitieve wedstrijd van een seizoen. Leenspelers doen niet mee.
export async function laadBankGeschiedenis(seasonId: string): Promise<Geschiedenis | null> {
  const m = await supabase.from('matches').select('id, aanvang, tegenstander').eq('season_id', seasonId).eq('status', 'definitief').order('aanvang')
  if (m.error) return null
  const wedstrijden = m.data as WedstrijdKort[]
  if (wedstrijden.length === 0) return { wedstrijden, spelers: [], perId: new Map() }
  const ids = wedstrijden.map((w) => w.id)
  const [mm, at, pl] = await Promise.all([
    supabase.from('match_minutes').select('match_id, player_id, minuten_bank, duur_minuten').in('match_id', ids),
    supabase.from('attendance').select('match_id, player_id, status').in('match_id', ids),
    supabase.from('players').select('id, naam').eq('leenspeler', false),
  ])
  if (mm.error || at.error || pl.error) return null
  const minuten = mm.data as { match_id: string; player_id: string; minuten_bank: number; duur_minuten: number }[]
  const aanwezigheid = at.data as { match_id: string; player_id: string; status: string }[]

  const spelers = (pl.data as { id: string; naam: string }[]).map((sp) => {
    const staten: BankStaat[] = wedstrijden.map((w) => {
      const x = minuten.find((r) => r.match_id === w.id && r.player_id === sp.id)
      if (x) {
        const staat: Staat = x.minuten_bank <= 0 ? 'gespeeld' : x.minuten_bank >= x.duur_minuten ? 'bank' : 'deels'
        return { w, staat, bank: x.minuten_bank }
      }
      const a = aanwezigheid.find((r) => r.match_id === w.id && r.player_id === sp.id)?.status
      return { w, staat: a === 'afwezig' ? 'afwezig' : a === 'geblesseerd' ? 'geblesseerd' : 'onbekend', bank: 0 }
    })
    const keren = staten.filter((s) => s.staat === 'deels' || s.staat === 'bank').length
    const aanwezig = staten.filter((s) => s.staat === 'gespeeld' || s.staat === 'deels' || s.staat === 'bank').length
    const laatste = staten[staten.length - 1]
    return {
      id: sp.id,
      naam: sp.naam,
      staten,
      keren,
      aanwezig,
      bankMin: staten.reduce((a, s) => a + s.bank, 0),
      vorigeBank: laatste.staat === 'deels' || laatste.staat === 'bank',
    }
  })
  return { wedstrijden, spelers, perId: new Map(spelers.map((s) => [s.id, s])) }
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
