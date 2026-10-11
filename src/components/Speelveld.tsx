import type { FormationSlot } from '../lib/types'

type Props = {
  slots: FormationSlot[]
  veld: Map<number, string>
  // Als dit is meegegeven, toont elke plek de speler van de 1e helft en daaronder (cursief) die van de 2e helft.
  veld2?: Map<number, string>
  naam: (pid: string) => string
  badge?: (slot: FormationSlot, pid: string | undefined) => string | undefined
  geselecteerd?: number | null
  onTik?: (slot: number) => void
}

// Voetbalveld met lijnen. Boven is het doel van de tegenstander, onder ons eigen doel.
// Spelers staan als tekst op het veld met een cirkel voor de positie.
export default function Speelveld({ slots, veld, veld2, naam, badge, geselecteerd, onTik }: Props) {
  return (
    <div className="veld">
      <svg className="lijnen" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">
        <g fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" vectorEffect="non-scaling-stroke">
          <rect x="8" y="8" width="284" height="384" />
          <line x1="8" y1="200" x2="292" y2="200" />
          <circle cx="150" cy="200" r="36" />
          <rect x="60" y="8" width="180" height="72" />
          <rect x="105" y="8" width="90" height="26" />
          <path d="M 120 80 A 30 30 0 0 0 180 80" />
          <rect x="60" y="320" width="180" height="72" />
          <rect x="105" y="366" width="90" height="26" />
          <path d="M 120 320 A 30 30 0 0 1 180 320" />
          <path d="M 8 18 A 10 10 0 0 0 18 8" />
          <path d="M 282 8 A 10 10 0 0 0 292 18" />
          <path d="M 8 382 A 10 10 0 0 1 18 392" />
          <path d="M 292 382 A 10 10 0 0 0 282 392" />
        </g>
        <g fill="rgba(255,255,255,.85)">
          <circle cx="150" cy="200" r="2.5" />
          <circle cx="150" cy="56" r="2.5" />
          <circle cx="150" cy="344" r="2.5" />
        </g>
      </svg>
      {slots.map((s) => {
        const pid = veld.get(s.slot)
        const pid2 = veld2?.get(s.slot)
        const gewijzigd = veld2 !== undefined && pid !== pid2
        const b = badge?.(s, pid)
        const inhoud = (
          <>
            <span className="cirkel">
              <span className="shirt">{s.position_code}</span>
              {b && <span className="badge">{b}</span>}
            </span>
            <span className="n1">{pid ? naam(pid) : '+'}</span>
            {gewijzigd && <span className="n2">{pid2 ? `→ ${naam(pid2)}` : '→ ?'}</span>}
          </>
        )
        const klasse = `plek ${pid ? '' : 'leeg'} ${gewijzigd ? 'wissel' : ''} ${geselecteerd === s.slot ? 'gekozen' : ''}`
        const stijl = { left: `${s.x}%`, top: `${s.y}%` }
        return onTik ? (
          <button key={s.slot} type="button" className={klasse} style={stijl} onClick={() => onTik(s.slot)}>
            {inhoud}
          </button>
        ) : (
          <div key={s.slot} className={`${klasse} statisch`} style={stijl}>{inhoud}</div>
        )
      })}
    </div>
  )
}
