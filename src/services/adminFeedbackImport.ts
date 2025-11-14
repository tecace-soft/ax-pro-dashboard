import * as XLSX from 'xlsx'
import { saveManualAdminFeedback, bulkSaveAdminFeedback } from './adminFeedback'
import { saveManualAdminFeedbackN8N, bulkSaveAdminFeedbackN8N } from './adminFeedbackN8N'

export interface AdminFeedbackTemplateRow {
  'User Message'?: string
  'AI Response'?: string
  'Feedback Verdict': 'good' | 'bad'
  'Feedback Text': string
  'Corrected Response'?: string
}

// Download template as CSV
export function downloadAdminFeedbackTemplate(format: 'csv' | 'excel' = 'csv'): void {
  const templateData: AdminFeedbackTemplateRow[] = [
    {
      'User Message': 'Example user question',
      'AI Response': 'Example AI response',
      'Feedback Verdict': 'bad',
      'Feedback Text': 'This response needs improvement',
      'Corrected Response': 'Improved AI response'
    }
  ]

  if (format === 'csv') {
    const headers = ['User Message', 'AI Response', 'Feedback Verdict', 'Feedback Text', 'Corrected Response']
    const csvContent = [
      headers.join(','),
      ...templateData.map(row => [
        `"${(row['User Message'] || '').replace(/"/g, '""')}"`,
        `"${(row['AI Response'] || '').replace(/"/g, '""')}"`,
        row['Feedback Verdict'],
        `"${(row['Feedback Text'] || '').replace(/"/g, '""')}"`,
        `"${(row['Corrected Response'] || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'admin-feedback-template.csv'
    link.click()
  } else {
    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Admin Feedback Template')
    XLSX.writeFile(workbook, 'admin-feedback-template.xlsx')
  }
}

// Parse CSV file with proper quote handling
async function parseCSV(file: File): Promise<AdminFeedbackTemplateRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        
        // Simple CSV parser that handles quoted fields
        function parseCSVLine(line: string): string[] {
          const result: string[] = []
          let current = ''
          let inQuotes = false
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i]
            const nextChar = line[i + 1]
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"'
                i++ // Skip next quote
              } else {
                // Toggle quote state
                inQuotes = !inQuotes
              }
            } else if (char === ',' && !inQuotes) {
              // End of field
              result.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          result.push(current.trim()) // Add last field
          return result
        }
        
        const lines = text.split('\n').filter(line => line.trim())
        if (lines.length < 2) {
          reject(new Error('CSV file must have at least a header row and one data row'))
          return
        }

        const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''))
        const data: AdminFeedbackTemplateRow[] = []

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'))
          if (values.length < headers.length) continue

          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })

          if (row['Feedback Verdict'] && row['Feedback Text']) {
            data.push({
              'User Message': row['User Message'] || '',
              'AI Response': row['AI Response'] || '',
              'Feedback Verdict': (row['Feedback Verdict'].toLowerCase() === 'good' ? 'good' : 'bad') as 'good' | 'bad',
              'Feedback Text': row['Feedback Text'] || '',
              'Corrected Response': row['Corrected Response'] || ''
            })
          }
        }

        resolve(data)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// Parse Excel file
async function parseExcel(file: File): Promise<AdminFeedbackTemplateRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

        const parsedData: AdminFeedbackTemplateRow[] = jsonData.map(row => ({
          'User Message': row['User Message'] || '',
          'AI Response': row['AI Response'] || '',
          'Feedback Verdict': (row['Feedback Verdict']?.toLowerCase() === 'good' ? 'good' : 'bad') as 'good' | 'bad',
          'Feedback Text': row['Feedback Text'] || '',
          'Corrected Response': row['Corrected Response'] || ''
        })).filter(row => row['Feedback Verdict'] && row['Feedback Text'])

        resolve(parsedData)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// Import admin feedback from file
export async function importAdminFeedback(
  file: File,
  isN8NRoute: boolean
): Promise<{ success: number; errors: string[] }> {
  try {
    const isCSV = file.name.endsWith('.csv')
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    if (!isCSV && !isExcel) {
      throw new Error('Unsupported file format. Please use CSV or Excel (.xlsx, .xls)')
    }

    const parsedData = isCSV ? await parseCSV(file) : await parseExcel(file)

    if (parsedData.length === 0) {
      throw new Error('No valid feedback data found in file')
    }

    const feedbacks = parsedData.map(row => ({
      verdict: row['Feedback Verdict'],
      text: row['Feedback Text'],
      userMessage: row['User Message'],
      aiResponse: row['AI Response'],
      correctedResponse: row['Corrected Response']
    }))

    let savedFeedbacks: any[] = []
    if (isN8NRoute) {
      savedFeedbacks = await bulkSaveAdminFeedbackN8N(feedbacks)
    } else {
      savedFeedbacks = await bulkSaveAdminFeedback(feedbacks)
    }

    return {
      success: savedFeedbacks.length,
      errors: []
    }
  } catch (error: any) {
    console.error('Error importing admin feedback:', error)
    return {
      success: 0,
      errors: [error.message || 'Failed to import feedback']
    }
  }
}

