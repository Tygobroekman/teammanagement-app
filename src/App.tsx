import { isConfigured } from './lib/supabase'

export default function App() {
  return (
    <main className="page">
      <h1>Opstelling</h1>
      <p>
        {isConfigured
          ? 'Verbonden met Supabase. Inloggen volgt in de volgende stap.'
          : 'Supabase is nog niet ingesteld. Vul .env in (zie .env.example).'}
      </p>
    </main>
  )
}
