import { supabase, AdminFeedbackData } from './supabase'

// Fetch admin feedback for a specific request
export async function getAdminFeedback(requestId: string): Promise<AdminFeedbackData | null> {
  try {
    const { data, error } = await supabase
      .from('admin_feedback')
      .select('*')
      .eq('request_id', requestId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - this is expected for requests without feedback
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching admin feedback:', error)
    throw error
  }
}

// Save new admin feedback
export async function saveAdminFeedback(
  requestId: string, 
  verdict: 'good' | 'bad', 
  text: string,
  correctedResponse?: string
): Promise<AdminFeedbackData> {
  try {
    const { data, error } = await supabase
      .from('admin_feedback')
      .insert({
        request_id: requestId,
        feedback_verdict: verdict,
        feedback_text: text,
        corrected_response: correctedResponse || null,
        prompt_apply: true
      })
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error saving admin feedback:', error)
    throw error
  }
}

// Update existing admin feedback
export async function updateAdminFeedback(
  requestId: string, 
  verdict: 'good' | 'bad', 
  text: string,
  correctedResponse?: string
): Promise<AdminFeedbackData> {
  try {
    const { data, error } = await supabase
      .from('admin_feedback')
      .update({
        feedback_verdict: verdict,
        feedback_text: text,
        corrected_response: correctedResponse || null,
        updated_at: new Date().toISOString()
      })
      .eq('request_id', requestId)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error updating admin feedback:', error)
    throw error
  }
}

// Update prompt_apply field for admin feedback
export async function updateAdminFeedbackPromptApply(requestId: string, promptApply: boolean): Promise<AdminFeedbackData> {
  try {
    const { data, error } = await supabase
      .from('admin_feedback')
      .update({
        prompt_apply: promptApply,
        updated_at: new Date().toISOString()
      })
      .eq('request_id', requestId)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error updating admin feedback prompt_apply:', error)
    throw error
  }
}

// Delete admin feedback
export async function deleteAdminFeedback(requestId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('admin_feedback')
      .delete()
      .eq('request_id', requestId)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting admin feedback:', error)
    throw error
  }
}

// Get admin feedback for multiple requests (batch operation)
export async function getAdminFeedbackBatch(requestIds: string[]): Promise<Record<string, AdminFeedbackData>> {
  try {
    const { data, error } = await supabase
      .from('admin_feedback')
      .select('*')
      .in('request_id', requestIds)

    if (error) throw error

    // Convert array to object keyed by request_id
    const feedbackMap: Record<string, AdminFeedbackData> = {}
    data?.forEach(feedback => {
      feedbackMap[feedback.request_id] = feedback
    })

    return feedbackMap
  } catch (error) {
    console.error('Error fetching admin feedback batch:', error)
    throw error
  }
}

// Get ALL admin feedback entries
export async function getAllAdminFeedback(): Promise<Record<string, AdminFeedbackData>> {
  try {
    const { data, error } = await supabase
      .from('admin_feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Convert array to object keyed by request_id
    const feedbackMap: Record<string, AdminFeedbackData> = {}
    data?.forEach(feedback => {
      feedbackMap[feedback.request_id] = feedback
    })

    return feedbackMap
  } catch (error) {
    console.error('Error fetching all admin feedback:', error)
    throw error
  }
}

// Generate a unique request_id for manual entries
function generateManualRequestId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  return `manual-${timestamp}-${random}`
}

// Save manual admin feedback (creates a new entry with generated request_id)
export async function saveManualAdminFeedback(
  verdict: 'good' | 'bad',
  text: string,
  userMessage?: string,
  aiResponse?: string,
  correctedResponse?: string
): Promise<AdminFeedbackData> {
  try {
    const requestId = generateManualRequestId()
    
    // Create chat_data entry for manual feedback (so it can be displayed properly)
    // Generate a session_id for manual entries
    const sessionId = `manual-session-${Date.now()}`
    
    try {
      await supabase
        .from('chat_data')
        .insert({
          request_id: requestId,
          session_id: sessionId,
          input_text: userMessage || '',
          output_text: aiResponse || ''
        })
    } catch (chatError: any) {
      // If chat_data insert fails (e.g., foreign key constraint), log but continue
      // The admin_feedback might still work without chat_data
      console.warn('Could not create chat_data for manual feedback:', chatError)
    }
    
    const { data, error } = await supabase
      .from('admin_feedback')
      .insert({
        request_id: requestId,
        feedback_verdict: verdict,
        feedback_text: text,
        corrected_response: correctedResponse || null,
        prompt_apply: true
      })
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error saving manual admin feedback:', error)
    throw error
  }
}

// Bulk save admin feedback (for import)
export async function bulkSaveAdminFeedback(
  feedbacks: Array<{
    requestId?: string
    verdict: 'good' | 'bad'
    text: string
    userMessage?: string
    aiResponse?: string
    correctedResponse?: string
  }>
): Promise<AdminFeedbackData[]> {
  try {
    // First, create all chat_data entries
    const chatDataEntries = feedbacks.map(feedback => {
      const requestId = feedback.requestId || generateManualRequestId()
      const sessionId = `manual-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      return {
        request_id: requestId,
        session_id: sessionId,
        input_text: feedback.userMessage || '',
        output_text: feedback.aiResponse || ''
      }
    })

    // Insert all chat_data entries (ignore errors if foreign key constraints exist)
    try {
      await supabase
        .from('chat_data')
        .insert(chatDataEntries)
    } catch (chatError: any) {
      console.warn('Could not create chat_data entries for bulk import:', chatError)
    }

    // Now create admin feedback entries
    const insertData = feedbacks.map((feedback, index) => ({
      request_id: feedback.requestId || chatDataEntries[index].request_id,
      feedback_verdict: feedback.verdict,
      feedback_text: feedback.text,
      corrected_response: feedback.correctedResponse || null,
      prompt_apply: true
    }))

    const { data, error } = await supabase
      .from('admin_feedback')
      .insert(insertData)
      .select()

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error bulk saving admin feedback:', error)
    throw error
  }
} 