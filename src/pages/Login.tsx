import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

// Wachtwoordloos inloggen: je krijgt een mail met een code en een link.
// Een app op het beginscherm van een iPhone opent mail-links in Safari, dus daar gebruik je de code.
export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stap, setStap] = useState<'email' | 'code'>('email')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  async function verstuur(e?: FormEvent) {
    e?.preventDefault()
    setBezig(true)
    setFout(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    })
    setBezig(false)
    if (error) setFout('Versturen mislukt. Controleer het e-mailadres en probeer het later opnieuw.')
    else { setStap('code'); setCode('') }
  }

  async function controleerCode(e: FormEvent) {
    e.preventDefault()
    setBezig(true)
    setFout(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.replace(/\s/g, ''),
      type: 'email',
    })
    setBezig(false)
    if (error) setFout('Deze code klopt niet of is verlopen. Vraag zo nodig een nieuwe code aan.')
  }

  return (
    <main className="inlog">
      <Logo className="logo" />
      <h1>Opstelling</h1>
      <p className="sub">Opstellingen, wissels en speelminuten van ons team.</p>
      <div className="kaart">
        {stap === 'email' ? (
          <form onSubmit={verstuur} className="form">
            <label>
              E-mailadres
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="naam@voorbeeld.nl"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button disabled={bezig}>{bezig ? 'Versturen...' : 'Stuur inlogcode'}</button>
            <p className="sub">Alleen captains kunnen inloggen. Je krijgt een e-mail met een code, een wachtwoord is niet nodig.</p>
          </form>
        ) : (
          <form onSubmit={controleerCode} className="form">
            <p>
              We hebben een e-mail gestuurd naar <strong>{email}</strong>. Vul hier de <strong>code</strong> uit de mail in.
            </p>
            <label>
              Code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,12}"
                maxLength={12}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="codeveld"
              />
            </label>
            <button disabled={bezig || code.trim().length < 6}>{bezig ? 'Controleren...' : 'Inloggen'}</button>
            <p className="sub">
              Gebruik je de app in Safari? Dan kun je ook op de link in de mail tikken. Staat er alleen een link in de mail, gebruik die dan.
            </p>
            <button type="button" className="link" onClick={() => verstuur()} disabled={bezig}>Stuur een nieuwe code</button>
            <button type="button" className="link" onClick={() => { setStap('email'); setFout(null) }}>Ander e-mailadres</button>
          </form>
        )}
        {fout && <p className="fout">{fout}</p>}
      </div>
    </main>
  )
}
