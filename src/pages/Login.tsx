import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// Wachtwoordloos inloggen: e-mailadres invullen, code uit de mail invoeren.
export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stap, setStap] = useState<'email' | 'code'>('email')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  async function stuurCode(e: FormEvent) {
    e.preventDefault()
    setBezig(true)
    setFout(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })
    setBezig(false)
    if (error) setFout('Versturen mislukt. Controleer het e-mailadres en probeer het later opnieuw.')
    else setStap('code')
  }

  async function controleerCode(e: FormEvent) {
    e.preventDefault()
    setBezig(true)
    setFout(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    setBezig(false)
    if (error) setFout('Deze code klopt niet of is verlopen.')
  }

  return (
    <main className="page">
      <h1>Opstelling</h1>
      {stap === 'email' ? (
        <form onSubmit={stuurCode} className="form">
          <label>
            E-mailadres
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button disabled={bezig}>{bezig ? 'Versturen...' : 'Stuur inlogcode'}</button>
        </form>
      ) : (
        <form onSubmit={controleerCode} className="form">
          <p>We hebben een code gemaild naar {email}.</p>
          <label>
            Code uit de e-mail
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button disabled={bezig}>{bezig ? 'Controleren...' : 'Inloggen'}</button>
          <button type="button" className="link" onClick={() => setStap('email')}>
            Ander e-mailadres
          </button>
        </form>
      )}
      {fout && <p className="fout">{fout}</p>}
    </main>
  )
}
