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
export async function fetchUserFeedbackN8N(): Promise<UserFeedbackDataN8N[]> {
  try {
    const { data, error } = await supabaseN8N
      .from('user_feedback')
      .select('*')
      .order('created_at', { ascending: false })

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
    const { data, error } = await supabaseN8N
      .from('user_feedback')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
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

