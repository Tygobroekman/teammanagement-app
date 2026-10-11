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

const KLEUREN: [string, string][] = [
  ['#e6f3ec', '#0a5a31'], ['#e8f0ff', '#1d4ed8'], ['#fff4d6', '#8a5a00'], ['#fbeae8', '#9b2c20'],
  ['#efe9fb', '#5b34b0'], ['#e0f4f4', '#0b6b6b'],
]

export function initialen(naam: string) {
  const delen = naam.trim().split(/[\s-]+/).filter(Boolean)
  return ((delen[0]?.[0] ?? '') + (delen.length > 1 ? delen[delen.length - 1][0] : '')).toUpperCase()
}

export function avatarStijl(naam: string) {
  let h = 0
  for (const c of naam) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const [bg, fg] = KLEUREN[h % KLEUREN.length]
  return { background: bg, color: fg }
}

export function datumBlok(iso: string) {
  const d = new Date(iso)
  return {
    dag: d.getDate(),
    maand: d.toLocaleString('nl-NL', { month: 'short' }).replace('.', ''),
    tijd: d.toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
  }
}
