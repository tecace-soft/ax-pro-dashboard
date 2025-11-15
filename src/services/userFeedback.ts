import { supabase, UserFeedbackData } from './supabase'

// Fetch all user feedback data, ordered by most recent first
export async function fetchUserFeedback(startDate?: string, endDate?: string): Promise<UserFeedbackData[]> {
  try {
    let query = supabase
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
    console.error('Error fetching user feedback:', error)
    throw error
  }
}

// Fetch user feedback for a specific date range
export async function fetchUserFeedbackByDateRange(startDate: string, endDate: string): Promise<UserFeedbackData[]> {
  try {
    // Format dates to include entire day in local timezone
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T23:59:59.999')
    
    const { data, error } = await supabase
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
    console.error('Error fetching user feedback by date range:', error)
    throw error
  }
} 