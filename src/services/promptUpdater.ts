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
  
  console.log('Section boundaries:', {
    section4Start,
    section5Start,
    section5End,
    section6Start,
    nextSectionStart,
    afterSection5Length: afterSection5.length,
    afterSection5Preview: afterSection5.substring(0, 200)
  })
  
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
    } else {
      console.log('Removing duplicate F section:', feedbackText.substring(0, 50))
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
  
  // Remove duplicates by checking content
  const uniqueQSections: string[] = []
  for (const section of qSections) {
    const isDuplicate = uniqueQSections.some(existing => 
      existing.includes(section.split('\n')[0]) // Check if Q number is duplicate
    )
    if (!isDuplicate) {
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
    console.log('Retrieved negative feedback:', negativeFeedback.length, 'items')
    console.log('Feedback details:', negativeFeedback.map(f => ({
      hasText: !!f.feedback_text,
      hasCorrected: !!f.corrected_response,
      hasUserMessage: !!f.chat_data?.input_text
    })))
    
    // Parse current prompt sections
    const sections = parsePromptSections(currentPrompt)
    console.log('Parsed sections:', {
      beforeSection4Length: sections.beforeSection4.length,
      existingFSections: sections.section4Content.length,
      existingQSections: sections.section5Content.length,
      afterSection5Length: sections.afterSection5.length
    })
    
    // Log existing F sections for debugging
    console.log('Existing F sections:', sections.section4Content.map((f, i) => ({
      index: i,
      content: f.substring(0, 100)
    })))
    
    // Log the raw section content to see what's being parsed
    console.log('Raw section 4 content length:', sections.section4Content.length)
    sections.section4Content.forEach((section, i) => {
      console.log(`F section ${i}:`, section)
    })
    
    // Generate new F-sections for feedback_text
    const newFSections: string[] = []
    const newQSections: string[] = []
    
    // Start numbering from the next available number
    let fIndex = sections.section4Content.length + 1
    let qIndex = sections.section5Content.length + 1
    
    console.log('Starting indices:', { fIndex, qIndex, existingF: sections.section4Content.length, existingQ: sections.section5Content.length })
    
    // Create a set to track what we've already added to prevent duplicates
    const addedFeedbackTexts = new Set<string>()
    const addedQNAs = new Set<string>()
    
    for (const feedback of negativeFeedback) {
      // Add to supervisor feedback (Section 4) if feedback_text exists and not already present
      if (feedback.feedback_text && feedback.feedback_text.trim()) {
        const normalizedText = feedback.feedback_text.trim().replace(/\s+/g, ' ')
        
        // Check if we've already added this exact feedback text in this run
        if (addedFeedbackTexts.has(normalizedText)) {
          console.log('Feedback already added in this run, skipping:', normalizedText.substring(0, 50))
          continue
        }
        
        // Check if this exact feedback already exists in the current prompt
        const feedbackAlreadyExists = sections.section4Content.some(existing => {
          const existingLines = existing.split('\n')
          const existingFeedback = existingLines[0] // F1. feedback text
          
          // Extract just the feedback text without the "F1." prefix
          const existingText = existingFeedback.replace(/^F\d+\.\s*/, '').trim().replace(/\s+/g, ' ')
          
          console.log('Comparing existing feedback:', {
            existing: existingText.substring(0, 50),
            new: normalizedText.substring(0, 50),
            matches: existingText === normalizedText
          })
          
          return existingText === normalizedText
        })
        
        if (!feedbackAlreadyExists) {
          newFSections.push(generateFSection(fIndex, feedback.feedback_text))
          addedFeedbackTexts.add(normalizedText)
          fIndex++
          console.log(`Added new F${fIndex-1} section for:`, normalizedText.substring(0, 50))
        } else {
          console.log('Feedback already exists in prompt, skipping:', normalizedText.substring(0, 50))
        }
      }
      
      // Add to FAQ (Section 5) if corrected_response exists and we have the user question
      if (feedback.corrected_response && feedback.corrected_response.trim() && 
          feedback.chat_data?.input_text) {
        
        const normalizedQuestion = feedback.chat_data.input_text.trim().replace(/\s+/g, ' ')
        const normalizedAnswer = feedback.corrected_response.trim().replace(/\s+/g, ' ')
        const qnaKey = `${normalizedQuestion}|${normalizedAnswer}`
        
        // Check if we've already added this exact Q&A in this run
        if (addedQNAs.has(qnaKey)) {
          console.log('Q&A already added in this run, skipping:', normalizedQuestion.substring(0, 50))
          continue
        }
        
        // Check if this exact Q&A already exists in the current prompt
        const qnaAlreadyExists = sections.section5Content.some(existing => {
          const existingLines = existing.split('\n')
          const existingQuestion = existingLines[0] // Q1. question
          const existingAnswer = existingLines.find(line => line.startsWith('답변:'))
          
          if (!existingQuestion || !existingAnswer) return false
          
          const existingQ = existingQuestion.replace(/^Q\d+\.\s*/, '').trim().replace(/\s+/g, ' ')
          const existingA = existingAnswer.replace(/^답변:\s*/, '').trim().replace(/\s+/g, ' ')
          
          return existingQ === normalizedQuestion && existingA === normalizedAnswer
        })
        
        if (!qnaAlreadyExists) {
          newQSections.push(generateQSection(
            qIndex, 
            feedback.chat_data.input_text, 
            feedback.corrected_response
          ))
          addedQNAs.add(qnaKey)
          qIndex++
          console.log(`Added new Q${qIndex-1} section for:`, normalizedQuestion.substring(0, 50))
        } else {
          console.log('Q&A already exists in prompt, skipping:', normalizedQuestion.substring(0, 50))
        }
      }
    }
    
    // Reconstruct the prompt - use the deduplicated sections from parsing
    const newPrompt = reconstructPrompt(
      sections,
      [...sections.section4Content, ...newFSections],
      [...sections.section5Content, ...newQSections]
    )
    
    console.log('Reconstruction details:', {
      existingFSections: sections.section4Content.length,
      newFSections: newFSections.length,
      totalFSections: sections.section4Content.length + newFSections.length,
      existingQSections: sections.section5Content.length,
      newQSections: newQSections.length,
      totalQSections: sections.section5Content.length + newQSections.length
    })
    
    // Update the system prompt
    await updateSystemPrompt(newPrompt)
    
    console.log('System prompt updated successfully with feedback', {
      totalFSections: [...sections.section4Content, ...newFSections].length,
      totalQSections: [...sections.section5Content, ...newQSections].length,
      newFSections: newFSections.length,
      newQSections: newQSections.length,
      originalPromptLength: currentPrompt.length,
      newPromptLength: newPrompt.length,
      afterSection5Length: sections.afterSection5.length
    })
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