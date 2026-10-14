import { useState } from 'react'
import type { SpelerBank } from '../lib/bankgeschiedenis'
import { avatarStijl, initialen } from '../lib/format'
import { BankStippen, datumKort } from './BankStippen'
import { BEREIK, GEWICHT_AFWEZIG } from '../lib/eerlijkheid'

// Een speler in het bankoverzicht. Tik op de rij om per wedstrijd te zien hoeveel minuten hij op de bank zat.
export default function BankRij({ r, aanwezigTekst }: { r: SpelerBank; aanwezigTekst: string }) {
  const [open, setOpen] = useState(false)
  const nieuwsteEerst = [...r.staten].reverse()

  return (
    <li className="bankrij">
      <button type="button" className="kop" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="speler">
          <span className="avatar" style={avatarStijl(r.naam)}>{initialen(r.naam)}</span>
          <span className="blok">
            <span className="naamregel">
              <span>{r.naam}</span>
              {r.vorigeBank && <span className="chipje geel">vorige keer bank</span>}
            </span>
            <BankStippen staten={r.staten} />
          </span>
        </span>
        <span className="rechts">
          <span className="groot-getal">{r.keren}x</span>
          <span className="sub klein-regel">rang {r.rang}</span>
        </span>
        <span className={`pijltje ${open ? 'open' : ''}`} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="bankdetail">
          <ul>
            {nieuwsteEerst.map((s) => (
              <li key={s.w.id}>
                <span className={`stip ${s.staat}`} />
                <span className="wedstrijd">
                  {datumKort(s.w.aanvang)} · {s.w.tegenstander}
                </span>
                <span className={`minuten ${s.bank > 0 ? 'bankmin' : ''}`}>
                  {s.staat === 'afwezig' && 'afwezig'}
                  {s.staat === 'geblesseerd' && 'geblesseerd'}
                  {s.staat === 'onbekend' && 'geen gegevens'}
                  {(s.staat === 'gespeeld' || s.staat === 'deels' || s.staat === 'bank') &&
                    (s.bank > 0 ? `${s.bank}' op de bank` : 'hele wedstrijd gespeeld')}
                </span>
              </li>
            ))}
          </ul>
          <p className="sub">
            Totaal {r.bankMin}' op de bank, verdeeld over {r.keren} wedstrijd{r.keren === 1 ? '' : 'en'} ({aanwezigTekst}).
          </p>
          <p className="sub">
            <strong>Rang {r.rang}</strong> · Gem. {Math.round(r.gem * 10) / 10} · Relatief {r.relatief}. Berekend over de laatste{' '}
            {Math.min(BEREIK, r.staten.length)} wedstrijden: bankminuten opgeteld, elke afwezigheid telt min {GEWICHT_AFWEZIG}, een
            blessure telt niet mee. Hoe hoger de rang, hoe eerder je aan de beurt bent om te spelen.
          </p>
        </div>
      )}
    </li>
  )
}
