import { supabase, UserFeedbackData } from './supabase'

// Fetch all user feedback data, ordered by most recent first
export async function fetchUserFeedback(): Promise<UserFeedbackData[]> {
  try {
    const { data, error } = await supabase
      .from('user_feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Error fetching user feedback:', error)
    throw error
  }
}

// Fetch user feedback for a specific date range
export async function fetchUserFeedbackByDateRange(startDate: string, endDate: string): Promise<UserFeedbackData[]> {
  try {
    const { data, error } = await supabase
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
    console.error('Error fetching user feedback by date range:', error)
    throw error
  }
} 