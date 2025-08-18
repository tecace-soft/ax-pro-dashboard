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
        corrected_response: correctedResponse || null
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