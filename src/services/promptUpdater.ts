import { supabase, AdminFeedbackData, ChatData } from './supabase'
import { fetchSystemPrompt, updateSystemPrompt } from './prompt'

interface FeedbackWithChat extends AdminFeedbackData {
  chat_data?: ChatData
}

// Get all negative admin feedback with their associated chat data
export async function getAllNegativeFeedback(): Promise<FeedbackWithChat[]> {
  try {
    // First get all negative feedback
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('admin_feedback')
      .select('*')
      .eq('feedback_verdict', 'bad')

    if (feedbackError) throw feedbackError

    if (!feedbackData || feedbackData.length === 0) {
      return []
    }

    // Then get chat data for these feedback items
    const requestIds = feedbackData.map(f => f.request_id)
    const { data: chatData, error: chatError } = await supabase
      .from('chat_data')
      .select('*')
      .in('request_id', requestIds)

    if (chatError) throw chatError

    // Combine the data
    const result = feedbackData.map(feedback => {
      const chat = chatData?.find(c => c.request_id === feedback.request_id)
      return {
        ...feedback,
        chat_data: chat
      }
    })

    return result
  } catch (error) {
    console.error('Error fetching negative feedback:', error)
    throw error
  }
}

// Parse the current prompt to extract existing F-sections and Q-sections
function parsePromptSections(prompt: string): {
  beforeSection4: string
  section4Content: string[]
  betweenSection4And5: string
  section5Content: string[]
  afterSection5: string
} {
  // Find section 4 start and end
  const section4Start = prompt.indexOf('🟦 [4. 관리자 피드백')
  const section5Start = prompt.indexOf('🟦 [5. FAQ')
  
  if (section4Start === -1 || section5Start === -1) {
    throw new Error('Could not find required sections in prompt')
  }
  
  // Extract content before section 4
  const beforeSection4 = prompt.substring(0, section4Start)
  
  // Extract section 4 content (between header and section 5)
  const section4Content = prompt.substring(section4Start, section5Start)
  const fSections = extractFSections(section4Content)
  
  // Find section 6 or end of prompt for section 5 boundary
  const section6Start = prompt.indexOf('🟦 [6.', section5Start)
  const nextSectionStart = prompt.indexOf('**중요:', section5Start)
  const section5End = section6Start !== -1 ? section6Start : 
                     (nextSectionStart !== -1 ? nextSectionStart : prompt.length)
  
  // Extract section 5 content
  const section5Content = prompt.substring(section5Start, section5End)
  const qSections = extractQSections(section5Content)
  
  // Get text between sections (just the headers basically)
  const betweenSection4And5 = ''
  
  // Get everything after section 5 - this should include sections 6, 7, 8, etc.
  const afterSection5 = prompt.substring(section5End)
  
  return {
    beforeSection4,
    section4Content: fSections,
    betweenSection4And5,
    section5Content: qSections,
    afterSection5
  }
}

// Extract F-sections (F1., F2., etc.) from section 4 text
function extractFSections(sectionText: string): string[] {
  const fSections: string[] = []
  
  // Find the actual content between the header and the trailing note
  const lines = sectionText.split('\n')
  let inContent = false
  let currentF = ''
  
  for (const line of lines) {
    // Skip header lines
    if (line.includes('🟦 [4. 관리자 피드백') || line.includes('(운영자가 수시로')) {
      inContent = true
      continue
    }
    
    // Stop at trailing note
    if (line.includes('(이 항목은 운영 중 지속적으로')) {
      if (currentF.trim()) {
        fSections.push(currentF.trim())
      }
      break
    }
    
    if (inContent) {
      // Check if this is start of new F section
      if (line.match(/^F\d+\./)) {
        // Save previous F section if exists
        if (currentF.trim()) {
          fSections.push(currentF.trim())
        }
        currentF = line
      } else if (currentF) {
        // Continue current F section
        currentF += '\n' + line
      }
    }
  }
  
  // Add the last F section if exists
  if (currentF.trim()) {
    fSections.push(currentF.trim())
  }
  
  // Remove duplicates by comparing the actual feedback text content
  const uniqueFSections: string[] = []
  const seenFeedbackTexts = new Set<string>()
  
  for (const section of fSections) {
    // Extract just the feedback text without the "F1." prefix
    const feedbackText = section.replace(/^F\d+\.\s*/, '').trim().replace(/\s+/g, ' ')
    
    if (!seenFeedbackTexts.has(feedbackText)) {
      seenFeedbackTexts.add(feedbackText)
      uniqueFSections.push(section)
    }
  }
  
  return uniqueFSections
}

// Extract Q-sections (Q1., Q2., etc.) from section 5 text
function extractQSections(sectionText: string): string[] {
  const qSections: string[] = []
  
  // Find the actual content between the header and the trailing note
  const lines = sectionText.split('\n')
  let inContent = false
  let currentQ = ''
  
  for (const line of lines) {
    // Skip header lines
    if (line.includes('🟦 [5. FAQ') || line.includes('(질문이 일치하거나')) {
      inContent = true
      continue
    }
    
    // Stop at trailing note that starts with [FAQ Q1~Q
    if (line.includes('[FAQ Q1~Q')) {
      if (currentQ.trim()) {
        qSections.push(currentQ.trim())
      }
      break
    }
    
    if (inContent) {
      // Check if this is start of new Q section
      if (line.match(/^Q\d+\./)) {
        // Save previous Q section if exists
        if (currentQ.trim()) {
          qSections.push(currentQ.trim())
        }
        currentQ = line
      } else if (currentQ) {
        // Continue current Q section
        currentQ += '\n' + line
      }
    }
  }
  
  // Add the last Q section if exists
  if (currentQ.trim()) {
    qSections.push(currentQ.trim())
  }
  
  // Remove duplicates by comparing the actual Q&A content, not just Q numbers
  const uniqueQSections: string[] = []
  const seenQNAs = new Set<string>()
  
  for (const section of qSections) {
    const lines = section.split('\n')
    const question = lines[0]?.replace(/^Q\d+\.\s*/, '').trim().replace(/\s+/g, ' ')
    const answer = lines.find(line => line.startsWith('답변:'))?.replace(/^답변:\s*/, '').trim().replace(/\s+/g, ' ')
    
    if (question && answer) {
      const qnaKey = `${question}|${answer}`
      
      if (!seenQNAs.has(qnaKey)) {
        seenQNAs.add(qnaKey)
        uniqueQSections.push(section)
      }
    } else {
      // If we can't parse the Q&A properly, add it anyway to avoid data loss
      uniqueQSections.push(section)
    }
  }
  
  return uniqueQSections
}

// Generate new F-section for supervisor feedback
function generateFSection(index: number, feedbackText: string): string {
  return `F${index}. ${feedbackText}`
}

// Generate new Q&A section for corrected responses
function generateQSection(index: number, userQuestion: string, correctedAnswer: string): string {
  return `Q${index}. ${userQuestion}
답변: ${correctedAnswer}`
}

// Update the system prompt with new feedback and corrected responses
export async function updatePromptWithFeedback(): Promise<void> {
  try {
    // Get current prompt
    const currentPrompt = await fetchSystemPrompt()
    
    // Get all negative feedback
    const negativeFeedback = await getAllNegativeFeedback()
    
    // Parse current prompt sections
    const sections = parsePromptSections(currentPrompt)
    
    // Initialize arrays for new sections
    const newFSections: string[] = []
    const newQSections: string[] = []
    
    // For Supervisor Feedback section: preserve existing static content (F1-F4), rebuild F5+ from database
    const originalStaticFSections = sections.section4Content.slice(0, 4) // Preserve F1-F4
    const maxOriginalF = originalStaticFSections.length
    
    // Start numbering new feedback from F5 (or next available number)
    let fIndex = maxOriginalF + 1
    const seenFeedbackTexts = new Set<string>()
    
    // First, add all original static feedback to prevent duplicates
    originalStaticFSections.forEach(section => {
      const feedbackText = section.replace(/^F\d+\.\s*/, '').trim().replace(/\s+/g, ' ')
      if (feedbackText) {
        seenFeedbackTexts.add(feedbackText)
      }
    })
    
    // Sort feedback by creation date (oldest first) so oldest gets F5, newest gets highest number
    const sortedFeedbackForF = [...negativeFeedback].sort((a, b) => {
      const dateA = new Date(a.created_at || 0)
      const dateB = new Date(b.created_at || 0)
      return dateA.getTime() - dateB.getTime() // Oldest first
    })
    
    // Build new supervisor feedback sections from database data (oldest first), starting from F5
    for (const feedback of sortedFeedbackForF) {
      // Add to supervisor feedback (Section 4) if feedback_text exists
      if (feedback.feedback_text && feedback.feedback_text.trim()) {
        const normalizedText = feedback.feedback_text.trim().replace(/\s+/g, ' ')
        
        // Check if this feedback already exists in original static content OR if we've already added it in this run
        if (!seenFeedbackTexts.has(normalizedText)) {
          newFSections.push(generateFSection(fIndex, feedback.feedback_text))
          seenFeedbackTexts.add(normalizedText)
          fIndex++
        }
      }
    }
    
    // For FAQ section: preserve only the original static content (Q1-Q15), rebuild Q16+ from database
    const originalStaticQSections = sections.section5Content.slice(0, 15) // Only preserve Q1-Q15
    const maxOriginalQ = originalStaticQSections.length
    
    // Start numbering new Q&A from Q16 (or next available number)
    let qIndex = 16
    const seenQNAs = new Set<string>()
    
    // First, add all original static Q&A to prevent duplicates
    originalStaticQSections.forEach(section => {
      const lines = section.split('\n')
      const question = lines[0]?.replace(/^Q\d+\.\s*/, '').trim().replace(/\s+/g, ' ')
      const answer = lines.find(line => line.startsWith('답변:'))?.replace(/^답변:\s*/, '').trim().replace(/\s+/g, ' ')
      if (question && answer) {
        const qnaKey = `${question}|${answer}`
        seenQNAs.add(qnaKey)
      }
    })
    
    // Sort feedback by creation date (oldest first) so oldest gets Q16, newest gets highest number
    const sortedFeedback = [...negativeFeedback].sort((a, b) => {
      const dateA = new Date(a.created_at || 0)
      const dateB = new Date(b.created_at || 0)
      return dateA.getTime() - dateB.getTime() // Oldest first
    })
    
    // Now add new corrected responses from database, starting from Q16 (oldest first)
    for (const feedback of sortedFeedback) {
      if (feedback.corrected_response && feedback.corrected_response.trim() && 
          feedback.chat_data?.input_text) {
        
        const normalizedQuestion = feedback.chat_data.input_text.trim().replace(/\s+/g, ' ')
        const normalizedAnswer = feedback.corrected_response.trim().replace(/\s+/g, ' ')
        const qnaKey = `${normalizedQuestion}|${normalizedAnswer}`
        
        // Check if this Q&A already exists in original static content
        if (!seenQNAs.has(qnaKey)) {
          newQSections.push(generateQSection(
            qIndex, 
            feedback.chat_data.input_text, 
            feedback.corrected_response
          ))
          seenQNAs.add(qnaKey)
          qIndex++
        }
      }
    }
    
    // Reconstruct the prompt - preserve original static content and add new dynamic content
    const newPrompt = reconstructPrompt(
      sections,
      [...originalStaticFSections, ...newFSections],
      [...originalStaticQSections, ...newQSections]
    )
    
    // Update the system prompt
    await updateSystemPrompt(newPrompt)
    
  } catch (error) {
    console.error('Error updating prompt with feedback:', error)
    throw error
  }
}

// Reconstruct the prompt with new sections
function reconstructPrompt(
  sections: ReturnType<typeof parsePromptSections>,
  allFSections: string[],
  allQSections: string[]
): string {
  // Section 4: Supervisor Feedback
  const section4Header = '🟦 [4. 관리자 피드백 (Supervisor Feedback)]\n(운영자가 수시로 항목을 추가/수정하여 챗봇의 응답 성향을 조정함. 항상 최우선 적용)\n\n'
  const section4Content = allFSections.length > 0 ? 
    allFSections.join('\n\n') + '\n\n(이 항목은 운영 중 지속적으로 추가·수정될 수 있습니다.)\n\n' :
    '(이 항목은 운영 중 지속적으로 추가·수정될 수 있습니다.)\n\n'
  
  // Section 5: FAQ
  const section5Header = '🟦 [5. FAQ(High Priority FAQ)]\n(질문이 일치하거나 유사할 때 반드시 아래 스타일, 어투, 패턴, 길이, 문장구성까지 따라 작성)\n\n'
  const section5Content = allQSections.length > 0 ?
    allQSections.join('\n\n') + '\n\n[FAQ Q1~Q' + allQSections.length + '의 답변 스타일·구성·톤을 100% 따라야 하며, 답변 우선순위는 ①관리자 피드백 → ②FAQ → ③기타 정책 순으로 엄격히 적용]\n\n' :
    '[FAQ의 답변 스타일·구성·톤을 100% 따라야 하며, 답변 우선순위는 ①관리자 피드백 → ②FAQ → ③기타 정책 순으로 엄격히 적용]\n\n'
  
  return sections.beforeSection4 + 
         section4Header + 
         section4Content + 
         section5Header + 
         section5Content + 
         sections.afterSection5
} 