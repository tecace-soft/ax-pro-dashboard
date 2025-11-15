import { supabaseN8N } from './supabaseN8N'

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
}

// Fetch all user feedback data, ordered by most recent first
export async function fetchUserFeedbackN8N(startDate?: string, endDate?: string): Promise<UserFeedbackDataN8N[]> {
  try {
    let query = supabaseN8N
      .from('user_feedback')
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

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Error fetching user feedback from n8n Supabase:', error)
    throw error
  }
}

// Fetch user feedback for a specific date range
export async function fetchUserFeedbackByDateRangeN8N(startDate: string, endDate: string): Promise<UserFeedbackDataN8N[]> {
  try {
    // Format dates to include entire day in local timezone
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T23:59:59.999')
    
    const { data, error } = await supabaseN8N
      .from('user_feedback')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Error fetching user feedback by date range from n8n Supabase:', error)
    throw error
  }
}

