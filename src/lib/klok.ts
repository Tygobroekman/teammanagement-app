import { useCallback, useEffect, useState } from 'react'

type Opslag = { basis: number; start: number | null }

function lees(sleutel: string): Opslag {
  try {
    const raw = localStorage.getItem(sleutel)
    if (raw) return JSON.parse(raw) as Opslag
  } catch { /* geen opslag beschikbaar */ }
  return { basis: 0, start: null }
}

// Wedstrijdklok die een herlaadbeurt overleeft. Houdt tijdstempels bij, geen teller.
export function useKlok(matchId: string) {
  const sleutel = `klok:${matchId}`
  const [opslag, setOpslag] = useState<Opslag>(() => lees(sleutel))
  const [nu, setNu] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNu(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  const bewaar = useCallback((o: Opslag) => {
    setOpslag(o)
    try { localStorage.setItem(sleutel, JSON.stringify(o)) } catch { /* geen opslag beschikbaar */ }
  }, [sleutel])

  const seconden = opslag.basis + (opslag.start ? (nu - opslag.start) / 1000 : 0)
  const loopt = opslag.start !== null

  return {
    seconden,
    minuut: Math.floor(seconden / 60),
    loopt,
    start: () => !loopt && bewaar({ basis: opslag.basis, start: Date.now() }),
    pauze: () => loopt && bewaar({ basis: seconden, start: null }),
    zetOp: (sec: number, doorlopen: boolean) => bewaar({ basis: sec, start: doorlopen ? Date.now() : null }),
    corrigeer: (deltaSec: number) =>
      bewaar({ basis: Math.max(0, opslag.basis + deltaSec), start: opslag.start }),
  }
}
