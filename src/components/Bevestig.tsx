import { useState, type ReactNode } from 'react'

// Eigen bevestigingsvenster. De ingebouwde browserdialogen (window.confirm) worden op telefoons
// en in sommige browsers stilzwijgend geblokkeerd, waardoor een knop dan niets lijkt te doen.
export function useBevestig() {
  const [open, setOpen] = useState<{ tekst: string; klaar: (ja: boolean) => void } | null>(null)

  const vraag = (tekst: string) =>
    new Promise<boolean>((resolve) => {
      setOpen({ tekst, klaar: (ja) => { setOpen(null); resolve(ja) } })
    })

  const dialoog: ReactNode = open && (
    <div className="sheet-bg" onClick={() => open.klaar(false)} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <p className="vraagtekst">{open.tekst}</p>
        <div className="form">
          <button onClick={() => open.klaar(true)}>Ja, doorgaan</button>
          <button className="grijsknop" onClick={() => open.klaar(false)}>Annuleren</button>
        </div>
      </div>
    </div>
  )

  return { vraag, dialoog }
}
