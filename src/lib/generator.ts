// Opstellingsgenerator: stelt een basis en een wisselschema voor.
//
// Idee: de wedstrijd wordt in gelijke blokken verdeeld (standaard 6 van 15 minuten).
// Elke speler krijgt een streefaantal speelminuten. De schuif (weging) bepaalt dat doel:
//   0   = sterkste elf spelen alles
//   100 = eerlijke verdeling, waarbij spelers die dit seizoen weinig speelden extra krijgen
// Per blok worden daarna 11 spelers gekozen en aan posities toegewezen. Spelers die
// doorspelen blijven op hun plek, een wisselspeler neemt de plek van wie eruit gaat.

export type GenSpeler = {
  id: string
  naam: string
  niveaus: Record<string, number> // positiecode -> niveau 1 tot 5
  voorkeur: string | null
  seizoenGemiddeld: number | null // gem. gespeelde minuten per aanwezige wedstrijd, null = onbekend
}
export type GenSlot = { slot: number; position_code: string }
export type GenWissel = { minuut: number; slot: number; player_in: string; player_out: string }
export type GenVoorstel = {
  basis: { slot: number; player_id: string }[]
  wissels: GenWissel[]
  minuten: Map<string, number>
}

const ONBEKEND_NIVEAU = 0.5
const VOORKEUR_BONUS = 0.25
const BLIJF_BONUS = 10 // doorspelen op dezelfde plek gaat voor alles
const SEIZOEN_GEWICHT = 0.5 // hoeveel van het seizoenstekort in minuten wordt bijgesteld

export function sterkte(s: GenSpeler, positie: string) {
  return (s.niveaus[positie] ?? ONBEKEND_NIVEAU) + (s.voorkeur === positie ? VOORKEUR_BONUS : 0)
}

// Kleinste kosten toewijzing van n rijen aan m >= n kolommen (Hongaarse methode).
function hongaars(kosten: number[][]): number[] {
  const n = kosten.length
  const m = kosten[0].length
  const u = new Array(n + 1).fill(0)
  const v = new Array(m + 1).fill(0)
  const p = new Array(m + 1).fill(0)
  const way = new Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array(m + 1).fill(Infinity)
    const used = new Array(m + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue
        const cur = kosten[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0 }
        if (minv[j] < delta) { delta = minv[j]; j1 = j }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1 } while (j0)
  }
  const antwoord = new Array(n).fill(-1)
  for (let j = 1; j <= m; j++) if (p[j]) antwoord[p[j] - 1] = j - 1
  return antwoord
}

// Verdeelt `totaal` minuten over spelers zo dat de verhoudingen uit `ruw` behouden blijven,
// zonder dat iemand onder 0 of boven `max` komt.
function normaliseer(ruw: number[], totaal: number, max: number): number[] {
  let lo = -max * 2
  let hi = max * 2
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const som = ruw.reduce((a, r) => a + Math.min(max, Math.max(0, r + mid)), 0)
    if (som < totaal) lo = mid
    else hi = mid
  }
  return ruw.map((r) => Math.min(max, Math.max(0, r + (lo + hi) / 2)))
}

export function genereer(opts: {
  spelers: GenSpeler[]
  slots: GenSlot[]
  duur: number
  weging: number // 0 tot 100
  blokken?: number
}): GenVoorstel | null {
  const { spelers, slots, duur } = opts
  const w = Math.min(100, Math.max(0, opts.weging)) / 100
  const K = opts.blokken ?? 6
  if (spelers.length < slots.length) return null

  // De keeper blijft staan: een vaste keeper wordt niet gewisseld met veldspelers.
  const keeperSlot = slots.find((s) => s.position_code === 'GK')
  const keeper = keeperSlot
    ? [...spelers].filter((s) => (s.niveaus.GK ?? 0) > 0).sort((a, b) => (b.niveaus.GK ?? 0) - (a.niveaus.GK ?? 0))[0]
    : undefined
  const veldSlots = keeper ? slots.filter((s) => s !== keeperSlot) : slots
  const pool = keeper ? spelers.filter((s) => s.id !== keeper.id) : spelers
  const f = veldSlots.length
  const P = pool.length

  const kies = (kandidaten: GenSpeler[], vorige?: Map<string, number>) => {
    const kosten = veldSlots.map((sl) =>
      kandidaten.map((sp) => -(sterkte(sp, sl.position_code) + (vorige?.get(sp.id) === sl.slot ? BLIJF_BONUS : 0))),
    )
    return hongaars(kosten).map((j, i) => ({ slot: veldSlots[i].slot, speler: kandidaten[j] }))
  }

  // 1. Streefminuten bij "sterkste elf": de beste toewijzing speelt alles.
  const sterkste = new Set(kies(pool).map((x) => x.speler.id))
  const doelSterk = pool.map((s) => (sterkste.has(s.id) ? duur : 0))

  // 2. Streefminuten bij "eerlijk": gelijk verdeeld, met bijstelling voor het seizoenstekort.
  const bekend = pool.filter((s) => s.seizoenGemiddeld !== null).map((s) => s.seizoenGemiddeld as number)
  const groep = bekend.length ? bekend.reduce((a, b) => a + b, 0) / bekend.length : 0
  const ruwEerlijk = pool.map((s) => (duur * f) / P + SEIZOEN_GEWICHT * (groep - (s.seizoenGemiddeld ?? groep)))
  const doelEerlijk = normaliseer(ruwEerlijk, duur * f, duur)

  const doel = pool.map((_, i) => (1 - w) * doelSterk[i] + w * doelEerlijk[i])

  // 3. Aantal blokken per speler, met grootste-restmethode zodat de som exact f * K is.
  const L = duur / K
  const x = doel.map((d) => Math.min(K, d / L))
  const n = x.map((v) => Math.floor(v + 1e-9))
  let tekort = f * K - n.reduce((a, b) => a + b, 0)
  const volgorde = x.map((v, i) => ({ i, rest: v - n[i] })).sort((a, b) => b.rest - a.rest)
  for (const { i } of volgorde) {
    if (tekort <= 0) break
    if (n[i] < K) { n[i]++; tekort-- }
  }

  // 4. Per blok f spelers kiezen op basis van resterende behoefte.
  const rest = [...n]
  const opVeld = new Set<string>()
  const keuzes: GenSpeler[][] = []
  for (let b = 0; b < K; b++) {
    const over = K - b
    const idx = pool.map((_, i) => i)
    const verplicht = idx.filter((i) => rest[i] >= over)
    const kandi = idx
      .filter((i) => rest[i] > 0 && rest[i] < over)
      .sort((a, c) => {
        const sa = rest[a] / over + (sterkste.has(pool[a].id) ? 0.03 : 0) + (opVeld.has(pool[a].id) ? 0.02 : 0)
        const sc = rest[c] / over + (sterkste.has(pool[c].id) ? 0.03 : 0) + (opVeld.has(pool[c].id) ? 0.02 : 0)
        return sc - sa
      })
    const gekozen = [...verplicht, ...kandi].slice(0, f)
    for (const i of gekozen) rest[i]--
    opVeld.clear()
    gekozen.forEach((i) => opVeld.add(pool[i].id))
    keuzes.push(gekozen.map((i) => pool[i]))
  }

  // 5. Per blok de gekozen spelers aan posities toewijzen; doorspelers blijven staan.
  const grenzen = Array.from({ length: K + 1 }, (_, b) => Math.round((b * duur) / K))
  let vorige: Map<string, number> | undefined
  const basis: { slot: number; player_id: string }[] = []
  const wissels: GenWissel[] = []
  const minuten = new Map<string, number>()
  const tel = (id: string, m: number) => minuten.set(id, (minuten.get(id) ?? 0) + m)
  if (keeper && keeperSlot) {
    basis.push({ slot: keeperSlot.slot, player_id: keeper.id })
    tel(keeper.id, duur)
  }
  for (let b = 0; b < K; b++) {
    const toewijzing = kies(keuzes[b], vorige)
    const nu = new Map(toewijzing.map((t) => [t.speler.id, t.slot]))
    for (const t of toewijzing) tel(t.speler.id, grenzen[b + 1] - grenzen[b])
    if (b === 0) {
      toewijzing.forEach((t) => basis.push({ slot: t.slot, player_id: t.speler.id }))
    } else {
      const wasOpSlot = new Map([...(vorige ?? [])].map(([id, slot]) => [slot, id]))
      for (const t of toewijzing) {
        const eruit = wasOpSlot.get(t.slot)
        if (eruit && eruit !== t.speler.id) {
          wissels.push({ minuut: grenzen[b], slot: t.slot, player_in: t.speler.id, player_out: eruit })
        }
      }
    }
    vorige = nu
  }
  basis.sort((a, c) => a.slot - c.slot)
  return { basis, wissels, minuten }
}
