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

// Fetch all chats, group by session_id, then fetch sessions and order by session.created_at
export async function fetchAllConversationsN8N(
  startDate: string,
  endDate: string
): Promise<{
  sessions: Array<{
    sessionId: string
    createdAt: string
    id: string
    date: string
  }>
  sessionRequests: Record<string, Array<{
    requestId: string
    id: string
    createdAt: string
    chat_message: string
    response: string
    sessionId: string
  }>>
}> {
  try {
    // Step 1: Fetch ALL chats (not filtered by date range)
    const { data: allChats, error: chatsError } = await supabaseN8N
      .from('chat')
      .select('id, created_at, chat_message, response, session_id, chat_id, user_id')
      .order('created_at', { ascending: true })

    if (chatsError) throw chatsError

    // Step 2: Group chats by session_id
    const chatsBySession: Record<string, ChatN8N[]> = {}
    const uniqueSessionIds = new Set<string>()

    ;(allChats || []).forEach((chat: ChatN8N) => {
      if (!chat.session_id) return
      uniqueSessionIds.add(chat.session_id)
      if (!chatsBySession[chat.session_id]) {
        chatsBySession[chat.session_id] = []
      }
      chatsBySession[chat.session_id].push(chat)
    })

    // Step 3: Fetch sessions for all unique session_ids
    const sessionIdsArray = Array.from(uniqueSessionIds)
    if (sessionIdsArray.length === 0) {
      return { sessions: [], sessionRequests: {} }
    }

    const { data: sessionsData, error: sessionsError } = await supabaseN8N
      .from('session')
      .select('session_id, created_at')
      .in('session_id', sessionIdsArray)

    if (sessionsError) throw sessionsError

    // Step 4: Create session objects and order by session.created_at (descending)
    const sessionsWithChats = (sessionsData || [])
      .map((session: SessionN8N) => ({
        sessionId: session.session_id,
        createdAt: session.created_at,
        id: session.session_id,
        date: session.created_at
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Step 5: Build sessionRequests map with chat_message and response included
    const sessionRequestsMap: Record<string, Array<{
      requestId: string
      id: string
      createdAt: string
      chat_message: string
      response: string
      sessionId: string
      user_id?: string | null
    }>> = {}

    sessionsWithChats.forEach(session => {
      const chats = chatsBySession[session.sessionId] || []
      sessionRequestsMap[session.sessionId] = chats.map((chat: ChatN8N) => ({
        requestId: chat.chat_id || String(chat.id),
        id: chat.chat_id || String(chat.id),
        createdAt: chat.created_at,
        chat_message: chat.chat_message || '',
        response: chat.response || '',
        sessionId: chat.session_id,
        user_id: chat.user_id || null
      }))
    })

    return {
      sessions: sessionsWithChats,
      sessionRequests: sessionRequestsMap
    }
  } catch (error) {
    console.error('Error fetching all n8n conversations:', error)
    throw error
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
    // Fetch ALL chats for this session (not filtered by date)
    const { data, error } = await supabaseN8N
      .from('chat')
      .select('id, created_at, chat_message, response, session_id, chat_id, user_id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const requests = (data || []).map((chat: ChatN8N) => ({
      requestId: chat.chat_id || String(chat.id),
      id: chat.chat_id || String(chat.id),
      createdAt: chat.created_at,
      chat_message: chat.chat_message || '',
      response: chat.response || '',
      sessionId: chat.session_id,
      user_id: chat.user_id || null
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

