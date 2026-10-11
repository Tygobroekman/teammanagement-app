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

// Controle of een reeks wissels klopt. Wissels in dezelfde minuut tellen als een geheel,
// zodat spelers in de rust ook van positie kunnen wisselen: X gaat van plek 6 naar plek 5,
// Y gaat eruit en Z komt op plek 6. Na elke minuut mag niemand dubbel op het veld staan.
export function geldigeWissels(
  basis: Map<number, string>,
  lijst: { minuut: number; player_in: string; player_out: string; slot: number; id: number }[],
): boolean {
  const veld = new Map(basis)
  const perMinuut = new Map<number, typeof lijst>()
  for (const w of lijst) perMinuut.set(w.minuut, [...(perMinuut.get(w.minuut) ?? []), w])
  for (const minuut of [...perMinuut.keys()].sort((a, b) => a - b)) {
    for (const w of perMinuut.get(minuut)!.sort((a, b) => a.id - b.id)) {
      if (veld.get(w.slot) !== w.player_out) return false
      veld.set(w.slot, w.player_in)
    }
    if (new Set(veld.values()).size !== veld.size) return false
  }
  return true
}
