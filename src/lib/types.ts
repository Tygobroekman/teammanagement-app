export type Voet = 'links' | 'rechts' | 'beide'

export type Position = { code: string; naam: string; volgorde: number }

export type Player = {
  id: string
  naam: string
  voorkeurspositie: string | null
  voorkeursvoet: Voet
  notities: string | null
  actief: boolean
  langdurig_geblesseerd: boolean
  leenspeler: boolean
  leen_match_id: string | null
}

export type PlayerPosition = { player_id: string; position_code: string; niveau: number }

export type Season = { id: string; naam: string; created_at: string }
export type Formation = { code: string; naam: string }
export type FormationSlot = { formation_code: string; slot: number; position_code: string; x: number; y: number }
export type AttStatus = 'aanwezig' | 'afwezig' | 'geblesseerd'
export type MatchStatus = 'concept' | 'klaar' | 'definitief'

export type Match = {
  id: string
  season_id: string
  aanvang: string
  tegenstander: string
  thuis_uit: 'thuis' | 'uit'
  doelpunten_voor: number | null
  doelpunten_tegen: number | null
  status: MatchStatus
  formation_code: string
  duur_minuten: number
}

export type Attendance = { match_id: string; player_id: string; status: AttStatus; minuten_bank: number | null }
export type LineupSlot = { match_id: string; slot: number; player_id: string; position_code: string }

export type Substitution = {
  id: number
  match_id: string
  minuut: number
  player_in: string
  player_out: string
  slot: number
  position_code: string
}
