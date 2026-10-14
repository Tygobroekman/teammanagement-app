import { avatarStijl, initialen } from '../lib/format'
import { useBankGeschiedenis } from '../lib/bankgeschiedenis'
import { BankLegenda, BankStippen, datumKort } from '../components/BankStippen'

// Hoe vaak heeft iemand op de bank gezeten, en wanneer. Telt alleen definitieve wedstrijden.
export default function BankOverzicht({ seasonId }: { seasonId: string }) {
  const g = useBankGeschiedenis(seasonId)

  if (g === null) return <p className="fout">Overzicht laden mislukt.</p>
  if (g === undefined) return <p>Laden...</p>
  if (g.wedstrijden.length === 0) {
    return <p className="leeg-staat">Nog geen definitieve wedstrijden. Zodra er een wedstrijd definitief is, zie je hier wie er op de bank zat.</p>
  }

  const laatste = g.wedstrijden[g.wedstrijden.length - 1]
  const rijen = g.spelers
    .filter((r) => r.aanwezig > 0)
    .sort((a, b) => b.keren - a.keren || b.bankMin - a.bankMin || a.naam.localeCompare(b.naam, 'nl'))

  return (
    <>
      <p className="sub">
        Laatste wedstrijd: {laatste.tegenstander} ({datumKort(laatste.aanvang)}). De stippen lopen van oud naar nieuw, de
        meest rechtse is de laatste wedstrijd.
      </p>
      <ul className="lijst">
        {rijen.map((r) => (
          <li key={r.id} className="aanw seizoenrij">
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
              <span className="sub klein-regel">van {r.aanwezig} aanwezig</span>
            </span>
          </li>
        ))}
      </ul>
      <BankLegenda />
      <p className="sub">
        "Op de bank" betekent: aanwezig met meer dan 0 bankminuten in die wedstrijd. Leenspelers staan er niet in.
      </p>
    </>
  )
}
