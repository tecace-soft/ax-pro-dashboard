import { supabase, UserFeedbackData } from './supabase'

const MAX_ID_PAGES = 500

function numericIdsFromBatch(rows: { id?: number | string }[]): number[] {
  return rows
    .map((r) => r.id)
    .map((id) => (typeof id === 'number' ? id : Number(id)))
    .filter((n) => Number.isFinite(n))
}

function sortFeedbackByCreatedAtDesc<T extends { created_at?: string; timestamp?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.created_at || a.timestamp || 0).getTime()
    const tb = new Date(b.created_at || b.timestamp || 0).getTime()
    return tb - ta
  })
}

async function fetchUserFeedbackImpl(dateRange?: readonly [string, string]): Promise<UserFeedbackData[]> {
  try {
    const buildFiltered = () => {
      let q = supabase.from('user_feedback').select('*')
      if (dateRange) {
        const [startDate, endDate] = dateRange
        const start = new Date(startDate + 'T00:00:00')
        const end = new Date(endDate + 'T23:59:59.999')
        q = q.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
      }
      return q
    }

    const probe = await buildFiltered().order('id', { ascending: true }).limit(1)
    if (probe.error) throw probe.error
    const sample = probe.data?.[0]
    const idsOk = sample != null && numericIdsFromBatch([sample]).length > 0
    console.log('[fetchUserFeedback] probe', {
      sampleId: sample?.id,
      idsOk,
      dateRange: dateRange ?? null,
    })

    const rows: UserFeedbackData[] = []

    if (idsOk) {
      let lastId: number | null = null
      for (let p = 0; p < MAX_ID_PAGES; p++) {
        let q = buildFiltered().order('id', { ascending: true })
        if (lastId !== null) q = q.gt('id', lastId)
        const { data, error } = await q.limit(1000)
        if (error) throw error
        const batch = data ?? []
        console.log('[fetchUserFeedback] id-cursor page', {
          page: p,
          batchLength: batch.length,
          lastIdBefore: lastId,
          idSample: numericIdsFromBatch(batch).slice(0, 3),
        })
        if (batch.length === 0) break
        rows.push(...batch)
        const ids = numericIdsFromBatch(batch)
        if (ids.length === 0) break
        const next = Math.max(...ids)
        if (lastId !== null && next <= lastId) break
        lastId = next
      }
      console.log('[fetchUserFeedback] id-cursor total rows', rows.length)
      return sortFeedbackByCreatedAtDesc(rows)
    }

    let offset = 0
    let page = 0
    while (true) {
      const { data, error } = await buildFiltered()
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + 999)
      if (error) throw error
      const batch = data ?? []
      console.log('[fetchUserFeedback] offset page', { page, offset, batchLength: batch.length })
      if (batch.length === 0) break
      rows.push(...batch)
      offset += batch.length
      page += 1
    }
    console.log('[fetchUserFeedback] offset path total rows', rows.length)
    return rows
  } catch (error) {
    console.error('Error fetching user feedback:', error)
    throw error
  }
}

/** All rows in `user_feedback` (no date filter). */
export async function fetchUserFeedback(): Promise<UserFeedbackData[]> {
  return fetchUserFeedbackImpl()
}

/** Optional date-bounded fetch for callers that still need a range. */
export async function fetchUserFeedbackByDateRange(startDate: string, endDate: string): Promise<UserFeedbackData[]> {
  return fetchUserFeedbackImpl([startDate, endDate])
}

export async function updateUserFeedbackRead(feedbackId: number | string): Promise<void> {
  try {
    const id = typeof feedbackId === 'string' ? parseInt(feedbackId, 10) : feedbackId
    if (!Number.isFinite(id)) {
      throw new Error('Invalid feedback ID')
    }
    const { error } = await supabase.from('user_feedback').update({ read: true }).eq('id', id)
    if (error) throw error
  } catch (error) {
    console.error('Error updating user_feedback.read:', error)
    throw error
  }
} 