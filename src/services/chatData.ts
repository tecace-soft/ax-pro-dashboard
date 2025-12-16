import { supabase, ChatData } from './supabase'

// Ensure chat data exists for a request (create if it doesn't exist)
export async function ensureChatDataExists(
  requestId: string, 
  sessionId: string, 
  inputText: string, 
  outputText: string
): Promise<ChatData> {
  try {
    // First try to get existing chat data from chat table
    const existingData = await getChatData(requestId)
    if (existingData) {
      return existingData
    }

    // Chat data doesn't exist, try to create in chat table first
    try {
      const { data: newChatData, error: chatInsertError } = await supabase
        .from('chat')
        .insert({
          chat_id: requestId,
          session_id: sessionId,
          chat_message: inputText,
          response: outputText
        })
        .select()
        .single()

      if (newChatData && !chatInsertError) {
        return {
          id: newChatData.id,
          request_id: newChatData.chat_id || newChatData.id?.toString() || requestId,
          session_id: newChatData.session_id || sessionId,
          input_text: newChatData.chat_message || inputText,
          output_text: newChatData.response || outputText,
          created_at: newChatData.created_at,
          updated_at: newChatData.updated_at
        }
      }
    } catch (chatError: any) {
      // If chat table insert fails, try chat_data table (legacy)
      if (chatError?.code !== 'PGRST205') {
        // Not a "table not found" error, try chat_data
        const { data: newData, error: insertError } = await supabase
          .from('chat_data')
          .insert({
            request_id: requestId,
            session_id: sessionId,
            input_text: inputText,
            output_text: outputText
          })
          .select()
          .single()

        if (insertError) throw insertError
        return newData
      }
      // Table doesn't exist, can't create
      throw chatError
    }

    throw new Error('Failed to create chat data')
  } catch (error) {
    console.error('Error ensuring chat data exists:', error)
    // Don't throw for table not found errors
    if ((error as any)?.code === 'PGRST205') {
      // Return a mock object so the function doesn't fail completely
      return {
        request_id: requestId,
        session_id: sessionId,
        input_text: inputText,
        output_text: outputText
      }
    }
    throw error
  }
}

// Get existing chat data for a request
export async function getChatData(requestId: string): Promise<ChatData | null> {
  try {
    // Try 'chat' table first (new structure)
    let data: any = null
    let error: any = null
    
    // Try chat table with chat_id or id matching requestId
    const { data: chatData, error: chatError } = await supabase
      .from('chat')
      .select('*')
      .or(`chat_id.eq.${requestId},id.eq.${requestId}`)
      .maybeSingle()

    if (chatData && !chatError) {
      // Map chat table fields to ChatData interface
      return {
        id: chatData.id,
        request_id: chatData.chat_id || chatData.id?.toString() || requestId,
        session_id: chatData.session_id || '',
        input_text: chatData.chat_message || chatData.input_text || '',
        output_text: chatData.response || chatData.output_text || '',
        created_at: chatData.created_at,
        updated_at: chatData.updated_at
      }
    }

    // Fallback to chat_data table (legacy)
    const { data: chatDataData, error: chatDataError } = await supabase
      .from('chat_data')
      .select('*')
      .eq('request_id', requestId)
      .maybeSingle()

    if (chatDataData && !chatDataError) {
      return chatDataData
    }

    // If both fail, check error codes
    if (chatError && chatError.code !== 'PGRST116' && chatDataError && chatDataError.code !== 'PGRST116') {
      // Both queries failed with non-404 errors
      if (chatDataError.code === 'PGRST205') {
        // chat_data table doesn't exist, only chat table exists
        // Return null if chat table also didn't find it
        return null
      }
      throw chatError || chatDataError
    }

    // No rows found in either table
    return null
  } catch (error) {
    console.error('Error fetching chat data:', error)
    // Don't throw for table not found errors, just return null
    if ((error as any)?.code === 'PGRST205') {
      return null
    }
    throw error
  }
} 