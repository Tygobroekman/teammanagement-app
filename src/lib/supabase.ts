import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey && !url.includes('jouw-project'))

// Alleen de publieke anon key. De toegang wordt afgedwongen door RLS in de database.
export const supabase = createClient(
  isConfigured ? url! : 'http://localhost',
  isConfigured ? anonKey! : 'niet-ingesteld',
)
