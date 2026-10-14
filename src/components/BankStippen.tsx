import type { BankStaat, Staat } from '../lib/bankgeschiedenis'

const UITLEG: Record<Staat, string> = {
  gespeeld: 'hele wedstrijd gespeeld',
  deels: 'deels op de bank',
  bank: 'hele wedstrijd op de bank',
  afwezig: 'afwezig',
  geblesseerd: 'geblesseerd',
  onbekend: 'geen gegevens',
}

const datumKort = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).replace('.', '')

// De laatste wedstrijden als stippen, van oud naar nieuw.
export function BankStippen({ staten, max = 8 }: { staten: BankStaat[]; max?: number }) {
  return (
    <span className="stippen" aria-label="Laatste wedstrijden">
      {staten.slice(-max).map((s) => (
        <span
          key={s.w.id}
          className={`stip ${s.staat}`}
          title={`${datumKort(s.w.aanvang)} ${s.w.tegenstander}: ${UITLEG[s.staat]}${s.bank > 0 ? ` (${s.bank}' bank)` : ''}`}
        />
      ))}
    </span>
  )
}

export function BankLegenda() {
  return (
    <div className="legenda">
      {(['gespeeld', 'deels', 'bank', 'afwezig', 'geblesseerd'] as Staat[]).map((s) => (
        <span key={s}><span className={`stip ${s}`} /> {UITLEG[s]}</span>
      ))}
    </div>
  )
}

export { datumKort }
