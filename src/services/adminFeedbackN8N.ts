import { supabaseN8N } from './supabaseN8N'

export interface AdminFeedbackDataN8N {
  id?: number
  created_at?: string
  feedback_verdict?: 'good' | 'bad' | null
  feedback_text?: string | null
  corrected_response?: string | null
  updated_at?: string | null
  chat_id?: string | null
  apply?: boolean
}

// Fetch admin feedback for a specific chat_id
export async function getAdminFeedbackN8N(chatId: string): Promise<AdminFeedbackDataN8N | null> {
  try {
    const { data, error } = await supabaseN8N
      .from('admin_feedback')
      .select('*')
      .eq('chat_id', chatId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - this is expected for chats without feedback
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching n8n admin feedback:', error)
    throw error
  }
}

// Save new admin feedback
export async function saveAdminFeedbackN8N(
  chatId: string, 
  verdict: 'good' | 'bad', 
  text: string,
  correctedResponse?: string
): Promise<AdminFeedbackDataN8N> {
  try {
    const { data, error } = await supabaseN8N
      .from('admin_feedback')
      .insert({
        chat_id: chatId,
        feedback_verdict: verdict,
        feedback_text: text,
        corrected_response: correctedResponse || null,
        apply: true
      })
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error saving n8n admin feedback:', error)
    throw error
  }
}

// Update existing admin feedback
export async function updateAdminFeedbackN8N(
  chatId: string, 
  verdict: 'good' | 'bad', 
  text: string,
  correctedResponse?: string
): Promise<AdminFeedbackDataN8N> {
  try {
    const { data, error } = await supabaseN8N
      .from('admin_feedback')
      .update({
        feedback_verdict: verdict,
        feedback_text: text,
        corrected_response: correctedResponse || null,
        updated_at: new Date().toISOString()
      })
      .eq('chat_id', chatId)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error updating n8n admin feedback:', error)
    throw error
  }
}

// Update apply field for admin feedback
export async function updateAdminFeedbackApplyN8N(chatId: string, apply: boolean): Promise<AdminFeedbackDataN8N> {
  try {
    const { data, error } = await supabaseN8N
      .from('admin_feedback')
      .update({
        apply: apply,
        updated_at: new Date().toISOString()
      })
      .eq('chat_id', chatId)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error updating n8n admin feedback apply:', error)
    throw error
  }
}

// Delete admin feedback
export async function deleteAdminFeedbackN8N(chatId: string): Promise<void> {
  try {
    const { error } = await supabaseN8N
      .from('admin_feedback')
      .delete()
      .eq('chat_id', chatId)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting n8n admin feedback:', error)
    throw error
  }
}

// Get admin feedback for multiple chat_ids (batch operation)
export async function getAdminFeedbackBatchN8N(chatIds: string[]): Promise<Record<string, AdminFeedbackDataN8N>> {
  try {
    const { data, error } = await supabaseN8N
      .from('admin_feedback')
      .select('*')
      .in('chat_id', chatIds)

    if (error) throw error

    // Convert array to object keyed by chat_id
    const feedbackMap: Record<string, AdminFeedbackDataN8N> = {}
    data?.forEach(feedback => {
      if (feedback.chat_id) {
        feedbackMap[feedback.chat_id] = feedback
      }
    })

    return feedbackMap
  } catch (error) {
    console.error('Error fetching n8n admin feedback batch:', error)
    throw error
  }
}

// Get ALL admin feedback entries
export async function getAllAdminFeedbackN8N(startDate?: string, endDate?: string): Promise<Record<string, AdminFeedbackDataN8N>> {
  try {
    let query = supabaseN8N
      .from('admin_feedback')
      .select('*')
    
    // Apply date filter if provided
    if (startDate && endDate) {
      // Format dates for Supabase (ISO format)
      // Use local timezone to ensure we include the entire day
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate + 'T23:59:59.999')
      
      query = query
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    // Convert array to object keyed by chat_id
    const feedbackMap: Record<string, AdminFeedbackDataN8N> = {}
    data?.forEach(feedback => {
      if (feedback.chat_id) {
        feedbackMap[feedback.chat_id] = feedback
      }
    })

    return feedbackMap
  } catch (error) {
    console.error('Error fetching all n8n admin feedback:', error)
    throw error
  }
}

// Generate a unique chat_id for manual entries
function generateManualChatId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  return `manual-${timestamp}-${random}`
}

// Create a manual session entry for manual admin feedback
async function createManualSessionN8N(sessionId: string): Promise<void> {
  try {
    const { error } = await supabaseN8N
      .from('session')
      .insert({
        session_id: sessionId,
        created_at: new Date().toISOString()
      })

    if (error) {
      // If session already exists, that's okay
      if (error.code !== '23505') { // 23505 is unique violation
        throw error
      }
    }
  } catch (error) {
    console.error('Error creating manual session:', error)
    throw error
  }
}

// Create a manual chat entry for manual admin feedback
async function createManualChatEntryN8N(
  chatId: string,
  userMessage: string,
  aiResponse: string
): Promise<void> {
  try {
    // Generate a session_id for manual entries
    const sessionId = `manual-session-${Date.now()}`
    
    // First, create the session entry (required for foreign key constraint)
    await createManualSessionN8N(sessionId)
    
    // Then create the chat entry
    const { error } = await supabaseN8N
      .from('chat')
      .insert({
        chat_id: chatId,
        session_id: sessionId,
        chat_message: userMessage || '',
        response: aiResponse || '',
        user_id: null // Manual entries don't have a user_id
      })

    if (error) throw error
  } catch (error) {
    console.error('Error creating manual chat entry:', error)
    throw error
  }
}

// Save manual admin feedback (creates a new entry with generated chat_id)
export async function saveManualAdminFeedbackN8N(
  verdict: 'good' | 'bad',
  text: string,
  userMessage?: string,
  aiResponse?: string,
  correctedResponse?: string
): Promise<AdminFeedbackDataN8N> {
  try {
    const chatId = generateManualChatId()
    
    // First, create a chat entry if we have user message or AI response
    // This is required because of the foreign key constraint
    if (userMessage || aiResponse) {
      await createManualChatEntryN8N(chatId, userMessage || '', aiResponse || '')
    } else {
      // If no user message or AI response, we still need a chat entry
      // Create a minimal one
      await createManualChatEntryN8N(chatId, '', '')
    }
    
    // Now create the admin feedback entry
    const { data, error } = await supabaseN8N
      .from('admin_feedback')
      .insert({
        chat_id: chatId,
        feedback_verdict: verdict,
        feedback_text: text,
        corrected_response: correctedResponse || null,
        apply: true
      })
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error saving manual n8n admin feedback:', error)
    throw error
  }
}

// Bulk save admin feedback (for import)
export async function bulkSaveAdminFeedbackN8N(
  feedbacks: Array<{
    chatId?: string
    verdict: 'good' | 'bad'
    text: string
    userMessage?: string
    aiResponse?: string
    correctedResponse?: string
  }>
): Promise<AdminFeedbackDataN8N[]> {
  try {
    // First, create all session entries
    const sessionIds = feedbacks.map(() => `manual-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`)
    
    // Create unique session IDs
    const uniqueSessionIds = Array.from(new Set(sessionIds))
    
    // Insert all session entries
    const sessionEntries = uniqueSessionIds.map(sessionId => ({
      session_id: sessionId,
      created_at: new Date().toISOString()
    }))

    try {
      const { error: sessionError } = await supabaseN8N
        .from('session')
        .insert(sessionEntries)

      if (sessionError && sessionError.code !== '23505') { // Ignore unique violations
        throw sessionError
      }
    } catch (sessionError: any) {
      console.warn('Some sessions may already exist:', sessionError)
    }

    // Then, create all chat entries
    const chatEntries = feedbacks.map((feedback, index) => {
      const chatId = feedback.chatId || generateManualChatId()
      const sessionId = sessionIds[index]
      return {
        chat_id: chatId,
        session_id: sessionId,
        chat_message: feedback.userMessage || '',
        response: feedback.aiResponse || '',
        user_id: null
      }
    })

    // Insert all chat entries
    const { error: chatError } = await supabaseN8N
      .from('chat')
      .insert(chatEntries)

    if (chatError) throw chatError

    // Now create admin feedback entries
    const insertData = feedbacks.map((feedback, index) => ({
      chat_id: feedback.chatId || chatEntries[index].chat_id,
      feedback_verdict: feedback.verdict,
      feedback_text: feedback.text,
      corrected_response: feedback.correctedResponse || null,
      apply: true
    }))

    const { data, error } = await supabaseN8N
      .from('admin_feedback')
      .insert(insertData)
      .select()

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error bulk saving n8n admin feedback:', error)
    throw error
  }
}

