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
export async function getAllAdminFeedbackN8N(): Promise<Record<string, AdminFeedbackDataN8N>> {
  try {
    const { data, error } = await supabaseN8N
      .from('admin_feedback')
      .select('*')
      .order('created_at', { ascending: false })

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

