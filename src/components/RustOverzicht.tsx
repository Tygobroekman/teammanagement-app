import type { FormationSlot } from '../lib/types'

type Props = {
  h1: Map<number, string>
  h2: Map<number, string>
  slots: FormationSlot[]
  naam: (pid: string) => string
}

// Wat verandert er in de rust: wie erin komt, wie eruit gaat en wie van positie wisselt.
export default function RustOverzicht({ h1, h2, slots, naam }: Props) {
  const pos = (slot: number) => slots.find((s) => s.slot === slot)?.position_code ?? ''
  const slotVan = (m: Map<number, string>, pid: string) => [...m.entries()].find(([, p]) => p === pid)?.[0]
  const in1 = new Set(h1.values())
  const in2 = new Set(h2.values())
  const erin = [...in2].filter((p) => !in1.has(p))
  const eruit = [...in1].filter((p) => !in2.has(p))
  const schuift = [...in2].filter((p) => {
    if (!in1.has(p)) return false
    const a = slotVan(h1, p)
    const b = slotVan(h2, p)
    return a !== undefined && b !== undefined && a !== b && pos(a) !== pos(b)
  })

  if (erin.length + eruit.length + schuift.length === 0) {
    return <p className="sub">Geen wissels of positiewijzigingen in de rust.</p>
  }

  return (
    <ul className="lijst rustlijst">
      {erin.map((p) => (
        <li key={`i${p}`} className="aanw">
          <span><span className="pijl erin">↑</span> <strong>{naam(p)}</strong> erin</span>
          <span className="chipje">{pos(slotVan(h2, p) ?? 0)}</span>
        </li>
      ))}
      {eruit.map((p) => (
        <li key={`u${p}`} className="aanw">
          <span><span className="pijl eruit">↓</span> <strong>{naam(p)}</strong> eruit</span>
          <span className="chipje grijs">{pos(slotVan(h1, p) ?? 0)}</span>
        </li>
      ))}
      {schuift.map((p) => (
        <li key={`s${p}`} className="aanw">
          <span><span className="pijl schuift">⇄</span> <strong>{naam(p)}</strong> schuift door</span>
          <span className="chipje">{pos(slotVan(h1, p) ?? 0)} → {pos(slotVan(h2, p) ?? 0)}</span>
        </li>
      ))}
    </ul>
  )
}
