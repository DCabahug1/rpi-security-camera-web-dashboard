import { createClient } from '@/lib/supabase/server'
import { Recording } from '@/lib/types'
import { PostgrestError } from '@supabase/supabase-js'

export const RECORDINGS_PER_PAGE = 5

export type RecordingsPageResult = {
  recordings: Recording[]
  total: number
  page: number
  perPage: number
}

export async function getRecordingsPage(
  requestedPage: number
): Promise<RecordingsPageResult | PostgrestError> {
  const supabase = await createClient()
  const perPage = RECORDINGS_PER_PAGE

  const { count, error: countError } = await supabase
    .from('recordings')
    .select('*', { count: 'exact', head: true })

  if (countError) return countError

  const total = count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const page = Math.min(
    Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1),
    lastPage
  )
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return error

  return {
    recordings: data ?? [],
    total,
    page,
    perPage,
  }
}
