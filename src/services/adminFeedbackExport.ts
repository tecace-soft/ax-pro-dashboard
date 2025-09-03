import { AdminFeedbackData } from './supabase'

export type ExportFormat = 'csv' | 'excel' | 'json' | 'docx'

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
    case 'docx':
      return downloadAsDOCX(adminFeedbacks)
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

// DOCX 다운로드 (RAG용 문서화)
async function downloadAsDOCX(data: AdminFeedbackWithDetails[]): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Admin Feedback Report",
          heading: HeadingLevel.TITLE,
        }),
        new Paragraph({
          text: `Generated on: ${new Date().toLocaleString()}`,
        }),
        new Paragraph({
          text: `Total feedback entries: ${data.length}`,
        }),
        new Paragraph({ text: "" }),
        ...data.flatMap((item, index) => [
          new Paragraph({
            text: `Feedback Entry ${index + 1}`,
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Request ID: ", bold: true }),
              new TextRun({ text: item.requestId }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Verdict: ", bold: true }),
              new TextRun({ text: item.feedback_verdict }),
            ],
          }),
          ...(item.feedback_text ? [new Paragraph({
            children: [
              new TextRun({ text: "Supervisor Feedback: ", bold: true }),
              new TextRun({ text: item.feedback_text }),
            ],
          })] : []),
          ...(item.corrected_response ? [new Paragraph({
            children: [
              new TextRun({ text: "Corrected Response: ", bold: true }),
              new TextRun({ text: item.corrected_response }),
            ],
          })] : []),
          ...(item.requestDetail?.inputText ? [new Paragraph({
            children: [
              new TextRun({ text: "User Message: ", bold: true }),
              new TextRun({ text: item.requestDetail.inputText }),
            ],
          })] : []),
          ...(item.requestDetail?.outputText ? [new Paragraph({
            children: [
              new TextRun({ text: "AI Response: ", bold: true }),
              new TextRun({ text: item.requestDetail.outputText }),
            ],
          })] : []),
          new Paragraph({
            children: [
              new TextRun({ text: "Apply to Prompt: ", bold: true }),
              new TextRun({ text: item.prompt_apply ? 'Yes' : 'No' }),
            ],
          }),
          new Paragraph({ text: "" }),
        ]),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  
  downloadBlob(blob, 'admin-feedback.docx')
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
