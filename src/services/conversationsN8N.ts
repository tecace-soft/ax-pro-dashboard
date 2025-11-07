import { supabaseN8N } from './supabaseN8N'

export interface SessionN8N {
  session_id: string
  created_at: string
}

export interface ChatN8N {
  id: number
  created_at: string
  chat_message: string
  response: string
  session_id: string
  chat_id: string
  user_id: string
}

export interface SessionResponseN8N {
  sessions: Array<{
    sessionId: string
    createdAt: string
    [key: string]: any
  }>
}

export interface RequestResponseN8N {
  requests: Array<{
    requestId: string
    id: string
    createdAt: string
    [key: string]: any
  }>
}

export interface RequestDetailN8N {
  request: {
    inputText: string
    outputText: string
    [key: string]: any
  }
}

export async function fetchSessionsN8N(
  startDate: string,
  endDate: string
): Promise<SessionResponseN8N> {
  try {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const { data, error } = await supabaseN8N
      .from('session')
      .select('session_id, created_at')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error

    const sessions = (data || []).map((session: SessionN8N) => ({
      sessionId: session.session_id,
      createdAt: session.created_at,
      id: session.session_id,
      date: session.created_at
    }))

    return {
      sessions
    }
  } catch (error) {
    console.error('Error fetching n8n sessions:', error)
    throw error
  }
}

export async function fetchSessionRequestsN8N(
  sessionId: string,
  startDate: string,
  endDate: string
): Promise<RequestResponseN8N> {
  try {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const { data, error } = await supabaseN8N
      .from('chat')
      .select('id, created_at, chat_message, response, session_id, chat_id, user_id')
      .eq('session_id', sessionId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    const requests = (data || []).map((chat: ChatN8N) => ({
      requestId: chat.chat_id || String(chat.id),
      id: chat.chat_id || String(chat.id),
      createdAt: chat.created_at,
      sessionId: chat.session_id
    }))

    return {
      requests
    }
  } catch (error) {
    console.error(`Error fetching n8n chats for session ${sessionId}:`, error)
    throw error
  }
}

export async function fetchRequestDetailN8N(
  requestId: string
): Promise<RequestDetailN8N> {
  try {
    // Try to parse as number for id lookup, otherwise use as string for chat_id
    const numericId = Number(requestId)
    const isNumeric = !isNaN(numericId) && isFinite(numericId)

    let query = supabaseN8N
      .from('chat')
      .select('chat_message, response')

    if (isNumeric) {
      query = query.or(`chat_id.eq.${requestId},id.eq.${numericId}`)
    } else {
      query = query.eq('chat_id', requestId)
    }

    const { data, error } = await query.limit(1).single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { request: { inputText: '', outputText: '' } }
      }
      throw error
    }

    return {
      request: {
        inputText: data?.chat_message || '',
        outputText: data?.response || ''
      }
    }
  } catch (error) {
    console.error(`Error fetching n8n chat detail for ${requestId}:`, error)
    throw error
  }
}

