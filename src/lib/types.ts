export type Voet = 'links' | 'rechts' | 'beide'

export type Position = { code: string; naam: string; volgorde: number }

export type Player = {
  id: string
  naam: string
  voorkeurspositie: string | null
  voorkeursvoet: Voet
  notities: string | null
  actief: boolean
}

export type PlayerPosition = { player_id: string; position_code: string; niveau: number }
