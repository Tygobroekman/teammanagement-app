import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Season } from './types'

const KEY = 'seizoen'

export function standaardSeizoenNaam(d = new Date()) {
  const y = d.getFullYear()
  const start = d.getMonth() >= 6 ? y : y - 1
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
}

export function useSeasons() {
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)

  const load = useCallback(async (kies?: string) => {
    const { data, error } = await supabase.from('seasons').select('*').order('created_at', { ascending: false })
    const lijst = error ? [] : (data as Season[])
    setSeasons(lijst)
    let opgeslagen: string | null = null
    try { opgeslagen = localStorage.getItem(KEY) } catch { /* geen opslag beschikbaar */ }
    const id = [kies, opgeslagen].map((k) => lijst.find((s) => s.id === k)?.id).find(Boolean) ?? lijst[0]?.id ?? null
    setCurrentId(id)
  }, [])

  useEffect(() => { load() }, [load])

  function kies(id: string) {
    setCurrentId(id)
    try { localStorage.setItem(KEY, id) } catch { /* geen opslag beschikbaar */ }
  }

  async function maakAan(naam: string) {
    const { data, error } = await supabase.from('seasons').insert({ naam }).select('id').single()
    if (error) return false
    try { localStorage.setItem(KEY, data.id) } catch { /* geen opslag beschikbaar */ }
    await load(data.id)
    return true
  }

  return { seasons, currentId, kies, maakAan }
}
