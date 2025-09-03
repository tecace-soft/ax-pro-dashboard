import { AdminFeedbackData } from './supabase'

export type ExportFormat = 'csv' | 'excel' | 'json'

export interface AdminFeedbackWithDetails extends AdminFeedbackData {
  requestId: string
  requestDetail?: {
    inputText?: string
    outputText?: string
    createdAt?: string
  } | null
}

export async function downloadAdminFeedbackData(
  adminFeedbacks: AdminFeedbackWithDetails[],
  format: ExportFormat
): Promise<void> {
  switch (format) {
    case 'csv':
      return downloadAsCSV(adminFeedbacks)
    case 'excel':
      return downloadAsExcel(adminFeedbacks)
    case 'json':
      return downloadAsJSON(adminFeedbacks)
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

// CSV 다운로드
function downloadAsCSV(data: AdminFeedbackWithDetails[]): void {
  const headers = [
    'Request ID', 'Feedback Verdict', 'Feedback Text', 'Corrected Response', 
    'User Message', 'AI Response', 'Created At', 'Updated At', 'Prompt Apply'
  ]
  
  const csvContent = [
    headers.join(','),
    ...data.map(item => [
      item.requestId,
      item.feedback_verdict,
      `"${(item.feedback_text || '').replace(/"/g, '""')}"`,
      `"${(item.corrected_response || '').replace(/"/g, '""')}"`,
      `"${(item.requestDetail?.inputText || '').replace(/"/g, '""')}"`,
      `"${(item.requestDetail?.outputText || '').replace(/"/g, '""')}"`,
      item.created_at || '',
      item.updated_at || '',
      item.prompt_apply ? 'Yes' : 'No'
    ].join(','))
  ].join('\n')

  downloadFile(csvContent, 'admin-feedback.csv', 'text/csv')
}

// JSON 다운로드
function downloadAsJSON(data: AdminFeedbackWithDetails[]): void {
  const jsonContent = JSON.stringify(data, null, 2)
  downloadFile(jsonContent, 'admin-feedback.json', 'application/json')
}

// Excel 다운로드
async function downloadAsExcel(data: AdminFeedbackWithDetails[]): Promise<void> {
  const XLSX = await import('xlsx')
  
  // 데이터를 Excel 형식에 맞게 변환
  const excelData = data.map(item => ({
    'Request ID': item.requestId,
    'Feedback Verdict': item.feedback_verdict,
    'Feedback Text': item.feedback_text || '',
    'Corrected Response': item.corrected_response || '',
    'User Message': item.requestDetail?.inputText || '',
    'AI Response': item.requestDetail?.outputText || '',
    'Created At': item.created_at || '',
    'Updated At': item.updated_at || '',
    'Prompt Apply': item.prompt_apply ? 'Yes' : 'No'
  }))
  
  const worksheet = XLSX.utils.json_to_sheet(excelData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Admin Feedback')
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  downloadBlob(blob, 'admin-feedback.xlsx')
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
