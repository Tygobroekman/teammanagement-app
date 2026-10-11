// Dezelfde berekening als de database-view match_minutes, maar live op het
// huidige minuutpunt: een speler die erin komt telt +(nu - minuut), een speler
// die eruit gaat telt -(nu - minuut), een basisspeler telt +nu.
export type Wissel = { minuut: number; player_in: string; player_out: string; slot: number }

export function speelminuten(basis: string[], wissels: Wissel[], nu: number): Map<string, number> {
  const m = new Map<string, number>()
  const tel = (pid: string, n: number) => m.set(pid, (m.get(pid) ?? 0) + n)
  for (const pid of basis) tel(pid, nu)
  for (const w of wissels) {
    const rest = Math.max(0, nu - w.minuut)
    tel(w.player_in, rest)
    tel(w.player_out, -rest)
  }
  return m
}

// Wie staat waar op het veld (slot naar speler) na alle wissels.
export function veldNu(basis: Map<number, string>, wissels: Wissel[]): Map<number, string> {
  const veld = new Map(basis)
  for (const w of wissels) veld.set(w.slot, w.player_in)
  return veld
}
