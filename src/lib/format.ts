export function datumTijd(iso: string) {
  return new Date(iso).toLocaleString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// Waarde voor <input type="datetime-local"> in lokale tijd.
export function naarInput(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function standaardAanvang() {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)) // eerstvolgende zaterdag
  d.setHours(14, 30, 0, 0)
  return naarInput(d.toISOString())
}
