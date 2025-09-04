export type ExportFormat = 'csv' | 'excel' | 'json'

export interface ConversationExportData {
  // Session 정보
  sessionId: string
  sessionCreatedAt: string
  
  // Request 정보
  requestId: string
  requestCreatedAt: string
  
  // 메시지 내용
  userMessage: string
  aiResponse: string
  
  // 피드백 정보
  userFeedback: 'positive' | 'negative' | 'none'
  adminFeedbackVerdict: 'good' | 'bad' | 'none'
  supervisorFeedback: string
  correctedResponse: string
  promptApply: boolean
  
  // 메타데이터
  messageCount: number
  feedbackCreatedAt: string
  feedbackUpdatedAt: string
}

export async function downloadConversationsData(
  conversations: ConversationExportData[],
  format: ExportFormat
): Promise<void> {
  switch (format) {
    case 'csv':
      return downloadAsCSV(conversations)
    case 'excel':
      return downloadAsExcel(conversations)
    case 'json':
      return downloadAsJSON(conversations)
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

// CSV 다운로드
function downloadAsCSV(data: ConversationExportData[]): void {
  const headers = [
    'Session ID', 'Session Created At', 'Request ID', 'Request Created At', 
    'User Message', 'AI Response', 'User Feedback', 'Admin Feedback Verdict',
    'Supervisor Feedback', 'Corrected Response', 'Apply to Prompt',
    'Message Count', 'Feedback Created At', 'Feedback Updated At'
  ]
  
  const csvContent = [
    headers.join(','),
    ...data.map(item => [
      item.sessionId,
      item.sessionCreatedAt,
      item.requestId,
      item.requestCreatedAt,
      `"${item.userMessage.replace(/"/g, '""')}"`,
      `"${item.aiResponse.replace(/"/g, '""')}"`,
      item.userFeedback,
      item.adminFeedbackVerdict,
      `"${item.supervisorFeedback.replace(/"/g, '""')}"`,
      `"${item.correctedResponse.replace(/"/g, '""')}"`,
      item.promptApply ? 'Yes' : 'No',
      item.messageCount,
      item.feedbackCreatedAt,
      item.feedbackUpdatedAt
    ].join(','))
  ].join('\n')

  downloadFile(csvContent, 'recent-conversations-complete.csv', 'text/csv')
}

// JSON 다운로드
function downloadAsJSON(data: ConversationExportData[]): void {
  const jsonContent = JSON.stringify(data, null, 2)
  downloadFile(jsonContent, 'recent-conversations-complete.json', 'application/json')
}

// Excel 다운로드
async function downloadAsExcel(data: ConversationExportData[]): Promise<void> {
  const XLSX = await import('xlsx')
  
  // 데이터를 Excel 형식에 맞게 변환
  const excelData = data.map(item => ({
    'Session ID': item.sessionId,
    'Session Created At': item.sessionCreatedAt,
    'Request ID': item.requestId,
    'Request Created At': item.requestCreatedAt,
    'User Message': item.userMessage,
    'AI Response': item.aiResponse,
    'User Feedback': item.userFeedback,
    'Admin Feedback Verdict': item.adminFeedbackVerdict,
    'Supervisor Feedback': item.supervisorFeedback,
    'Corrected Response': item.correctedResponse,
    'Apply to Prompt': item.promptApply ? 'Yes' : 'No',
    'Message Count': item.messageCount,
    'Feedback Created At': item.feedbackCreatedAt,
    'Feedback Updated At': item.feedbackUpdatedAt
  }))
  
  const worksheet = XLSX.utils.json_to_sheet(excelData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Complete Conversations')
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  downloadBlob(blob, 'recent-conversations-complete.xlsx')
}

// 공통 다운로드 함수들
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  downloadBlob(blob, filename)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
