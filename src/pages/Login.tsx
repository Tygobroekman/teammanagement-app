import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// Wachtwoordloos inloggen met een link per e-mail.
// De link brengt je terug naar deze pagina en logt je automatisch in.
export default function Login() {
  const [email, setEmail] = useState('')
  const [verstuurd, setVerstuurd] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  async function stuurLink(e: FormEvent) {
    e.preventDefault()
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
    else setVerstuurd(true)
  }

  return (
    <main className="page">
      <h1>Opstelling</h1>
      {verstuurd ? (
        <div className="form">
          <p>
            We hebben een inloglink gemaild naar <strong>{email}</strong>. Open de mail op dit
            apparaat en tik op de link.
          </p>
          <button type="button" className="link" onClick={() => setVerstuurd(false)}>
            Ander e-mailadres
          </button>
        </div>
      ) : (
        <form onSubmit={stuurLink} className="form">
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
          <button disabled={bezig}>{bezig ? 'Versturen...' : 'Stuur inloglink'}</button>
        </form>
      )}
      {fout && <p className="fout">{fout}</p>}
    </main>
  )
}
