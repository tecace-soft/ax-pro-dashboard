import { supabaseN8N } from './supabaseN8N'

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

// UserFeedbackData interface for n8n (same structure as original)
export interface UserFeedbackDataN8N {
  id?: number
  request_id?: string
  chat_id?: string
  timestamp?: string
  user_name?: string
  user_id?: string
  conversation_id?: string
  reaction: string
  feedback_text?: string | null
  raw_data?: any
  created_at?: string
  chat_message?: string | null
  chat_response?: string | null
  read?: boolean
}

async function fetchUserFeedbackN8NImpl(dateRange?: readonly [string, string]): Promise<UserFeedbackDataN8N[]> {
  try {
    const buildFiltered = () => {
      let q = supabaseN8N.from('user_feedback').select('*')
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
    console.log('[fetchUserFeedbackN8N] probe', {
      sampleId: sample?.id,
      idsOk,
      dateRange: dateRange ?? null,
    })

    const rows: UserFeedbackDataN8N[] = []

    if (idsOk) {
      let lastId: number | null = null
      for (let p = 0; p < MAX_ID_PAGES; p++) {
        let q = buildFiltered().order('id', { ascending: true })
        if (lastId !== null) q = q.gt('id', lastId)
        const { data, error } = await q.limit(1000)
        if (error) throw error
        const batch = data ?? []
        console.log('[fetchUserFeedbackN8N] id-cursor page', {
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
      console.log('[fetchUserFeedbackN8N] id-cursor total rows', rows.length)
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
      console.log('[fetchUserFeedbackN8N] offset page', { page, offset, batchLength: batch.length })
      if (batch.length === 0) break
      rows.push(...batch)
      offset += batch.length
      page += 1
    }
    console.log('[fetchUserFeedbackN8N] offset path total rows', rows.length)
    return rows
  } catch (error) {
    console.error('Error fetching user feedback from n8n Supabase:', error)
    throw error
  }
}

/** All rows in `user_feedback` (no date filter). */
export async function fetchUserFeedbackN8N(): Promise<UserFeedbackDataN8N[]> {
  return fetchUserFeedbackN8NImpl()
}

export async function fetchUserFeedbackByDateRangeN8N(startDate: string, endDate: string): Promise<UserFeedbackDataN8N[]> {
  return fetchUserFeedbackN8NImpl([startDate, endDate])
}

export async function updateUserFeedbackReadN8N(feedbackId: number | string): Promise<void> {
  try {
    const id = typeof feedbackId === 'string' ? parseInt(feedbackId, 10) : feedbackId
    if (!Number.isFinite(id)) {
      throw new Error('Invalid feedback ID')
    }
    const { error } = await supabaseN8N.from('user_feedback').update({ read: true }).eq('id', id)
    if (error) throw error
  } catch (error) {
    console.error('Error updating user_feedback.read (n8n):', error)
    throw error
  }
}

// Delete user feedback by id
export async function deleteUserFeedbackN8N(feedbackId: number | string): Promise<void> {
  try {
    const id = typeof feedbackId === 'string' ? parseInt(feedbackId) : feedbackId
    if (isNaN(id)) {
      throw new Error('Invalid feedback ID')
    }
    
    const { error } = await supabaseN8N
      .from('user_feedback')
      .delete()
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting user feedback from n8n Supabase:', error)
    throw error
  }
}

