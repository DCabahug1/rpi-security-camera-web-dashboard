'use server'
import { createClient } from '@/lib/supabase/server'
import { Recording } from '@/lib/types'
import { PostgrestError } from '@supabase/supabase-js'

export async function getRecordings(): Promise<Recording[] | null | PostgrestError> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('recordings').select('*')
  if (error) return error
  return data
}