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
  vorigeBankMin?: number // bankminuten in de laatste wedstrijd: hoe meer, hoe meer voorrang nu
}
export type GenSlot = { slot: number; position_code: string }
export type GenWissel = { minuut: number; slot: number; player_in: string; player_out: string }
export type GenVoorstel = {
  basis: { slot: number; player_id: string }[]
  wissels: GenWissel[]
  minuten: Map<string, number>
  // Spelers die op een positie staan waar je geen niveau voor hebt ingevuld (alleen als het niet anders kon).
  buitenPositie: { player_id: string; slot: number }[]
  // Spelers voor wie geen enkele positie van deze formatie is opgegeven.
  zonderPositie: string[]
  // Spelers die wel een positie hebben, maar niet konden worden ingepast zonder anderen op een verkeerde positie te zetten.
  nietIngezet: string[]
}

const ONBEKEND_NIVEAU = 0.5
const VOORKEUR_BONUS = 0.25
const BLIJF_BONUS = 6 // doorspelen op dezelfde plek gaat voor een andere positie (sterkte loopt tot ongeveer 5)
const SEIZOEN_GEWICHT = 0.5 // hoeveel van het seizoenstekort in minuten wordt bijgesteld
// Gewichten voor het kiezen per blok. Hoe groter, hoe zwaarder het telt:
const BEHOEFTE_GEWICHT = 1000 // wie nog minuten nodig heeft, gaat voor
const VERPLICHT_BONUS = 3000 // wie de rest van de wedstrijd moet spelen om zijn minuten te halen
const GEEN_RUST = 3000 // wie zijn minuten al heeft, speelt alleen mee als het niet anders kan
// Voorrang voor wie vorige keer op de bank zat. De voorrang groeit met de bankminuten: een halve wedstrijd
// of meer op de bank (de hele wedstrijd, de eerste helft of vanaf de rust) geeft volle voorrang. Wie is ingevallen
// zat korter op de bank en krijgt dus minder voorrang, want die gespeelde minuten tellen mee.
const VOORRANG_NIVEAU = 3 // telt mee bij het kiezen van de basis, ook bij 'sterkste elf'
const VOORRANG_MINUTEN = 0.4 // extra streefminuten, als deel van de wedstrijdduur, bij eerlijke speeltijd
const ONTOEGESTAAN = 20000 // een positie waar een speler niet voor is opgegeven, alleen als niemand anders kan

// Een speler mag alleen op posities staan waar een niveau voor is ingevuld (of zijn voorkeurspositie).
export function kan(s: GenSpeler, positie: string) {
  return (s.niveaus[positie] ?? 0) > 0 || s.voorkeur === positie
}

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
// zonder dat iemand onder zijn minimum of boven zijn maximum komt.
function normaliseer(ruw: number[], totaal: number, min: number[], max: number[]): number[] {
  const grens = Math.max(...max, 1) * 2
  let lo = -grens
  let hi = grens
  const klem = (i: number, m: number) => Math.min(max[i], Math.max(min[i], ruw[i] + m))
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const som = ruw.reduce((a, _, i2) => a + klem(i2, mid), 0)
    if (som < totaal) lo = mid
    else hi = mid
  }
  return ruw.map((_, i) => klem(i, (lo + hi) / 2))
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

  // Is er precies een keeper, dan blijft die staan. Zijn er twee of meer, dan doen ze mee in de wisselronde
  // zodat ook de tweede keeper speelminuten krijgt.
  const keeperSlot = slots.find((s) => s.position_code === 'GK')
  const keepers = spelers.filter((s) => (s.niveaus.GK ?? 0) > 0)
  const keeper = keeperSlot && keepers.length === 1 ? keepers[0] : undefined
  const veldSlots = keeper ? slots.filter((s) => s !== keeperSlot) : slots
  const pool = keeper ? spelers.filter((s) => s.id !== keeper.id) : spelers
  const f = veldSlots.length
  const P = pool.length

  // Kwadratisch: een halve wedstrijd op de bank is volle voorrang, een korte stint op de bank telt maar een beetje.
  const voorrang = (sp: GenSpeler) => Math.min(1, Math.max(0, (sp.vorigeBankMin ?? 0) / (duur / 2))) ** 2

  const kies = (kandidaten: GenSpeler[], vorige?: Map<string, number>) => {
    const kosten = veldSlots.map((sl) =>
      kandidaten.map((sp) =>
        -(sterkte(sp, sl.position_code) + VOORRANG_NIVEAU * voorrang(sp) + (vorige?.get(sp.id) === sl.slot ? BLIJF_BONUS : 0) - (kan(sp, sl.position_code) ? 0 : ONTOEGESTAAN)),
      ),
    )
    return hongaars(kosten).map((j, i) => ({ slot: veldSlots[i].slot, speler: kandidaten[j] }))
  }

  // 1. Streefminuten bij "sterkste elf": de beste toewijzing speelt alles.
  const sterkste = new Set(kies(pool).map((x) => x.speler.id))
  const doelSterk = pool.map((s) => (sterkste.has(s.id) ? duur : 0))

  // 2. Streefminuten bij "eerlijk": gelijk verdeeld, met bijstelling voor het seizoenstekort.
  const bekend = pool.filter((s) => s.seizoenGemiddeld !== null).map((s) => s.seizoenGemiddeld as number)
  const groep = bekend.length ? bekend.reduce((a, b) => a + b, 0) / bekend.length : 0
  const ruwEerlijk = pool.map(
    (s) => (duur * f) / P + SEIZOEN_GEWICHT * (groep - (s.seizoenGemiddeld ?? groep)) + VOORRANG_MINUTEN * duur * voorrang(s),
  )
  // Wie op geen enkele plek kan staan, krijgt geen minuten toegewezen (en wordt gemeld).
  const kanSpelen = pool.map((sp) => veldSlots.some((sl) => kan(sp, sl.position_code)))
  const maxMin = pool.map((_, i) => (kanSpelen[i] ? duur : 0))
  const nul = pool.map(() => 0)
  const doelEerlijk = normaliseer(ruwEerlijk, duur * f, nul, maxMin)

  const L = duur / K
  const blend = pool.map((_, i) => (1 - w) * doelSterk[i] + w * doelEerlijk[i])
  // Vaste regel: iedereen die kan spelen krijgt minstens een blok (bij twee blokken een helft). De schuif bepaalt
  // alleen nog wie de hele wedstrijd speelt. Zo wordt er altijd gewisseld zodra er meer dan f spelers zijn.
  const aantalSpelers = kanSpelen.filter(Boolean).length
  const minTijd = Math.min(L, (duur * f) / Math.max(1, aantalSpelers))
  const doel = normaliseer(blend, duur * f, pool.map((_, i) => (kanSpelen[i] ? minTijd : 0)), maxMin)

  // 3. Aantal blokken per speler, met grootste-restmethode zodat de som exact f * K is.
  const x = doel.map((d) => Math.min(K, d / L))
  const n = x.map((v) => Math.floor(v + 1e-9))
  let tekort = f * K - n.reduce((a, b) => a + b, 0)
  // Bij gelijke resten krijgen de sterkste spelers en wie voorrang heeft het extra blok.
  const volgorde = x
    .map((v, i) => ({ i, rest: v - n[i] + (sterkste.has(pool[i].id) ? 1e-3 : 0) + 5e-4 * voorrang(pool[i]) }))
    .sort((a, b) => b.rest - a.rest)
  for (const { i } of volgorde) {
    if (tekort <= 0) break
    if (n[i] < K) { n[i]++; tekort-- }
  }

  // 4. Per blok tegelijk kiezen wie er speelt en waar, zodat niemand op een niet opgegeven positie
  // terechtkomt zolang een ander die plek kan invullen. Doorspelers blijven op hun plek staan.
  const rest = [...n]
  const grenzen = Array.from({ length: K + 1 }, (_, b) => Math.round((b * duur) / K))
  const blokken: Map<number, number>[] = [] // per blok: slot -> index in pool
  for (let b = 0; b < K; b++) {
    const over = K - b
    const vorige = blokken[b - 1]
    const vorigeSlotVan = new Map<number, number>([...(vorige ?? [])].map(([slot, idx]) => [idx, slot]))
    const kosten = veldSlots.map((sl) =>
      pool.map((sp, i) => {
        const key = rest[i] / over + (sterkste.has(sp.id) ? 0.03 : 0) + (vorigeSlotVan.has(i) ? 0.02 : 0)
        let score = BEHOEFTE_GEWICHT * key + sterkte(sp, sl.position_code) + VOORRANG_NIVEAU * voorrang(sp)
        if (rest[i] >= over) score += VERPLICHT_BONUS
        if (rest[i] <= 0) score -= GEEN_RUST
        if (vorigeSlotVan.get(i) === sl.slot) score += BLIJF_BONUS
        if (!kan(sp, sl.position_code)) score -= ONTOEGESTAAN
        return -score
      }),
    )
    const toewijzing = new Map<number, number>()
    hongaars(kosten).forEach((j, i) => toewijzing.set(veldSlots[i].slot, j))
    for (const idx of toewijzing.values()) rest[idx]--
    blokken.push(toewijzing)
  }

  // 5. Herstel: wie kan spelen maar nog geen blok heeft, neemt in een blok de plek in van iemand die minstens
  // twee blokken speelt, zolang daardoor iedereen op een opgegeven positie blijft staan. Eerst de laatste helft:
  // een invaller komt het liefst in de rust.
  const speelt = (i: number) => blokken.filter((bl) => [...bl.values()].includes(i)).length
  const herbereken = (b: number, kandidaten: number[]): Map<number, number> | null => {
    const vorige = blokken[b - 1]
    const kosten = veldSlots.map((sl) =>
      kandidaten.map((i) => {
        const sp = pool[i]
        let score = sterkte(sp, sl.position_code) + VOORRANG_NIVEAU * voorrang(sp)
        if (vorige?.get(sl.slot) === i) score += BLIJF_BONUS
        if (!kan(sp, sl.position_code)) score -= ONTOEGESTAAN
        return -score
      }),
    )
    const uitkomst = new Map<number, number>()
    for (const [r, j] of hongaars(kosten).entries()) {
      if (!kan(pool[kandidaten[j]], veldSlots[r].position_code)) return null
      uitkomst.set(veldSlots[r].slot, kandidaten[j])
    }
    return uitkomst
  }
  for (let u = 0; u < P; u++) {
    if (!kanSpelen[u] || speelt(u) > 0) continue
    let gedaan = false
    for (let b = K - 1; b >= 0 && !gedaan; b--) {
      const opBlok = [...blokken[b].values()]
      const vervangbaar = opBlok
        .filter((v) => speelt(v) >= 2)
        .sort((a, c) => speelt(c) - speelt(a) || voorrang(pool[a]) - voorrang(pool[c]))
      for (const v of vervangbaar) {
        const nieuwBlok = herbereken(b, [...opBlok.filter((x) => x !== v), u])
        if (nieuwBlok) { blokken[b] = nieuwBlok; gedaan = true; break }
      }
    }
  }

  // 6. Uitkomst afleiden: basis, wissels op de blokgrenzen, minuten en waarschuwingen.
  const basis: { slot: number; player_id: string }[] = []
  const wissels: GenWissel[] = []
  const minuten = new Map<string, number>()
  const buitenPositie: { player_id: string; slot: number }[] = []
  const tel = (id: string, m: number) => minuten.set(id, (minuten.get(id) ?? 0) + m)
  if (keeper && keeperSlot) {
    basis.push({ slot: keeperSlot.slot, player_id: keeper.id })
    tel(keeper.id, duur)
  }
  blokken.forEach((bl, b) => {
    for (const sl of veldSlots) {
      const idx = bl.get(sl.slot)
      if (idx === undefined) continue
      const sp = pool[idx]
      tel(sp.id, grenzen[b + 1] - grenzen[b])
      if (!kan(sp, sl.position_code) && !buitenPositie.some((x) => x.player_id === sp.id && x.slot === sl.slot)) {
        buitenPositie.push({ player_id: sp.id, slot: sl.slot })
      }
      if (b === 0) basis.push({ slot: sl.slot, player_id: sp.id })
      else {
        const eruit = blokken[b - 1].get(sl.slot)
        if (eruit !== undefined && eruit !== idx) {
          wissels.push({ minuut: grenzen[b], slot: sl.slot, player_in: sp.id, player_out: pool[eruit].id })
        }
      }
    }
  })
  const zonderPositie = spelers.filter((sp) => !slots.some((sl) => kan(sp, sl.position_code))).map((sp) => sp.id)
  const nietIngezet = pool.filter((sp, i) => kanSpelen[i] && (minuten.get(sp.id) ?? 0) === 0).map((sp) => sp.id)
  basis.sort((a, c) => a.slot - c.slot)
  return { basis, wissels, minuten, buitenPositie, zonderPositie, nietIngezet }
}
