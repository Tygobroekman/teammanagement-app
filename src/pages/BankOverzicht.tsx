import { useBankGeschiedenis } from '../lib/bankgeschiedenis'
import { BankLegenda, datumKort } from '../components/BankStippen'
import BankRij from '../components/BankRij'

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
    .sort((a, b) => b.rang - a.rang || b.keren - a.keren || a.naam.localeCompare(b.naam, 'nl'))

  return (
    <>
      <p className="sub">
        Gesorteerd op rang, zoals in de sheet: bovenaan zat het vaakst op de bank en is het eerst aan de beurt. Laatste wedstrijd:
        {laatste.tegenstander} ({datumKort(laatste.aanvang)}). De stippen lopen van oud naar nieuw.
      </p>
      <ul className="lijst">
        {rijen.map((r) => <BankRij key={r.id} r={r} aanwezigTekst={`van ${r.aanwezig} aanwezig`} />)}
      </ul>
      <p className="sub">Tik op een speler om per wedstrijd de bankminuten te zien.</p>
      <BankLegenda />
      <p className="sub">
        "Op de bank" betekent: aanwezig met meer dan 0 bankminuten in die wedstrijd. Leenspelers staan er niet in.
      </p>
    </>
  )
}
