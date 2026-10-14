// De eerlijkheidsregels uit de sheet "Wissels" van het team, zodat de app hetzelfde rekent.
//
// Per speler kijken we naar de laatste BEREIK definitieve wedstrijden:
//   Relatief = som van de bankminuten, min GEWICHT_AFWEZIG voor elke afwezigheid.
//   Gem.     = Relatief gedeeld door het aantal wedstrijden waarin de speler niet geblesseerd was.
//   Rang     = 1 plus het aantal spelers met een lagere Gem.
// Een hogere rang betekent: meer op de bank gezeten, dus eerder aan de beurt om te spelen.

export const GEWICHT_AFWEZIG = 15
export const BEREIK = 4

export type Cel = { staat: 'gespeeld' | 'deels' | 'bank' | 'afwezig' | 'geblesseerd' | 'onbekend'; bank: number }

// `cellen` loopt van oud naar nieuw, een cel per definitieve wedstrijd.
export function sheetScore(cellen: Cel[]): { relatief: number; gem: number; venster: number } {
  const venster = cellen.slice(-BEREIK)
  let relatief = 0
  let deler = 0
  for (const c of venster) {
    if (c.staat === 'afwezig') {
      relatief -= GEWICHT_AFWEZIG
      deler += 1
    } else if (c.staat === 'gespeeld' || c.staat === 'deels' || c.staat === 'bank') {
      relatief += c.bank
      deler += 1
    }
    // Geblesseerd en onbekend tellen nergens mee.
  }
  return { relatief, gem: deler > 0 ? relatief / deler : relatief, venster: venster.length }
}

// Rang zoals in de sheet: 1 plus het aantal spelers met een strikt lagere Gem. Gelijke Gem. delen dezelfde rang.
export function rangen(gems: number[]): number[] {
  return gems.map((g) => 1 + gems.filter((x) => x < g - 1e-9).length)
}
