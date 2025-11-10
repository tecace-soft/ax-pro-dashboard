// RAG Management Service for N8N - Supabase Integration
// This service handles file storage in Supabase Storage and indexing via n8n webhook

import { supabaseN8N } from './supabaseN8N'

const STORAGE_BUCKET = 'knowledge-base'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_FILE_TYPES = ['pdf', 'docx', 'doc', 'txt', 'md', 'csv', 'xlsx', 'xls', 'pptx', 'ppt']

// Get group_id and user_id from session
// For now, we'll use a default group_id since the session system doesn't have group context yet
// This can be updated when group management is implemented
export async function getSessionContext(): Promise<{ groupId: string | null; userId: string | null }> {
  // TODO: Implement proper session context retrieval
  // For now, return null values - the functions will handle this
  const groupId = localStorage.getItem('n8n_group_id') || null
  const userId = localStorage.getItem('n8n_user_id') || 'n8n-user'
  return { groupId, userId }
}

// Sanitize filename to remove special characters
function sanitizeFileName(fileName: string): string {
  // Remove path separators and special characters
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .trim()
  
  // Ensure it has an extension
  if (!sanitized.includes('.')) {
    return sanitized
  }
  
  return sanitized
}

// Get unique filename by checking for duplicates
async function getUniqueFileName(fileName: string, groupId: string | null): Promise<string> {
  const sanitized = sanitizeFileName(fileName)
  const baseName = sanitized.substring(0, sanitized.lastIndexOf('.')) || sanitized
  const extension = sanitized.includes('.') ? sanitized.substring(sanitized.lastIndexOf('.')) : ''
  
  let uniqueName = sanitized
  let counter = 1
  
  while (true) {
    let query = supabaseN8N
      .from('files')
      .select('id')
      .eq('file_name', uniqueName)
    
    if (groupId) {
      query = query.eq('group_id', groupId)
    }
    
    const { data, error } = await query.limit(1).single()
    
    if (error && error.code === 'PGRST116') {
      // No duplicate found
      break
    }
    
    if (!error && data) {
      // Duplicate found, try next number
      uniqueName = `${baseName}(${counter})${extension}`
      counter++
    } else {
      // Other error, break and use current name
      break
    }
  }
  
  return uniqueName
}

export interface FileUploadResult {
  success: boolean
  message: string
  fileName: string
  error?: string
}

export interface RAGFile {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
  status: 'ready'
  lastModified: string
  syncStatus: 'synced' | 'pending'
}

export interface FileListResponse {
  success: boolean
  files: RAGFile[]
  total: number
  message?: string
}

export interface VectorDocument {
  id: number
  content: string
  metadata: {
    fileName?: string
    groupId?: string
    chunkIndex?: number
    source?: string
    [key: string]: any
  }
  embedding?: number[]
  created_at?: string
}

export interface DocumentListResponse {
  success: boolean
  documents: VectorDocument[]
  total: number
  message?: string
}

export interface IndexStatusResponse {
  success: boolean
  message: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  chunksCount?: number
  lastUpdated?: string
}

// Task 1: Upload files to Supabase
export async function uploadFilesToSupabase(files: File[]): Promise<FileUploadResult[]> {
  const results: FileUploadResult[] = []
  const { groupId, userId } = await getSessionContext()
  
  if (!userId) {
    throw new Error('No user context available')
  }
  
  for (const file of files) {
    try {
      // 1. Validate file
      if (file.size > MAX_FILE_SIZE) {
        results.push({
          success: false,
          message: `File "${file.name}" exceeds maximum size of 50MB`,
          fileName: file.name,
          error: 'File too large'
        })
        continue
      }
      
      const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
      if (!ALLOWED_FILE_TYPES.includes(fileExt)) {
        results.push({
          success: false,
          message: `File type "${fileExt}" is not allowed`,
          fileName: file.name,
          error: 'Invalid file type'
        })
        continue
      }
      
      // 2. Get unique filename
      const uniqueFileName = await getUniqueFileName(file.name, groupId)
      
      // 3. Upload to Supabase Storage
      const filePath = `files/${uniqueFileName}`
      const { error: uploadError } = await supabaseN8N.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false
        })
      
      if (uploadError) {
        results.push({
          success: false,
          message: `Failed to upload "${file.name}": ${uploadError.message}`,
          fileName: file.name,
          error: uploadError.message
        })
        continue
      }
      
      // 4. File is now in storage - no database table needed
      console.log(`✅ Successfully uploaded "${uniqueFileName}" to storage`)
      
      results.push({
        success: true,
        message: `Successfully uploaded "${uniqueFileName}"`,
        fileName: uniqueFileName
      })
      
    } catch (error) {
      results.push({
        success: false,
        message: `Failed to upload "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        fileName: file.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  return results
}

// Task 2: Fetch files from Supabase Storage
export async function fetchFilesFromSupabase(): Promise<FileListResponse> {
  const { groupId } = await getSessionContext()
  
  console.log('🔍 Fetching files from Supabase Storage, groupId:', groupId)
  
  try {
    console.log('📦 Listing files from storage...')
    const { data: filesList, error: storageError } = await supabaseN8N.storage
      .from(STORAGE_BUCKET)
      .list('files', {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })
    
    if (storageError) {
      console.error('❌ Error listing files from storage:', storageError)
      return {
        success: false,
        files: [],
        total: 0,
        message: `Failed to list files from storage: ${storageError.message}`
      }
    }
    
    if (!filesList || filesList.length === 0) {
      console.log('ℹ️ No files found in storage')
      return {
        success: true,
        files: [],
        total: 0
      }
    }
    
    console.log('📋 Files found in storage:', filesList.length)
    
    // Convert storage files to RAGFile format
    const filesWithIndexStatus = await Promise.all(
      filesList.map(async (file) => {
        try {
          // Check if file is indexed in documents table
          let docQuery = supabaseN8N
            .from('documents')
            .select('id, created_at, metadata')
            .eq('metadata->>fileName', file.name)
          
          if (groupId) {
            docQuery = docQuery.eq('metadata->>groupId', groupId)
          }
          
          const { data: docsData } = await docQuery.limit(1)
          const isIndexed = docsData && docsData.length > 0
          
          return {
            id: file.id || file.name,
            name: file.name,
            size: file.metadata?.size || 0,
            type: file.metadata?.mimetype || 'application/octet-stream',
            uploadedAt: file.created_at || new Date().toISOString(),
            status: 'ready' as const,
            lastModified: file.updated_at || file.created_at || new Date().toISOString(),
            syncStatus: isIndexed ? 'synced' as const : 'pending' as const
          }
        } catch (fileError) {
          console.error(`Error processing storage file ${file.name}:`, fileError)
          return {
            id: file.id || file.name,
            name: file.name,
            size: file.metadata?.size || 0,
            type: file.metadata?.mimetype || 'application/octet-stream',
            uploadedAt: file.created_at || new Date().toISOString(),
            status: 'ready' as const,
            lastModified: file.updated_at || file.created_at || new Date().toISOString(),
            syncStatus: 'pending' as const
          }
        }
      })
    )
    
    console.log('✅ Successfully processed', filesWithIndexStatus.length, 'files from storage')
    
    return {
      success: true,
      files: filesWithIndexStatus,
      total: filesWithIndexStatus.length
    }
    
  } catch (error) {
    console.error('❌ Exception in fetchFilesFromSupabase:', error)
    return {
      success: false,
      files: [],
      total: 0,
      message: `Failed to fetch files from storage: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Task 3: Delete file from Supabase
export async function deleteFileFromSupabase(fileName: string): Promise<{ success: boolean; message: string }> {
  const { groupId } = await getSessionContext()
  
  try {
    // 1. Delete from Storage
    const filePath = `files/${fileName}`
    const { error: storageError } = await supabaseN8N.storage
      .from(STORAGE_BUCKET)
      .remove([filePath])
    
    if (storageError) {
      return {
        success: false,
        message: `Failed to delete file from storage: ${storageError.message}`
      }
    }
    
    // 2. Delete indexed documents
    let docQuery = supabaseN8N
      .from('documents')
      .delete()
      .eq('metadata->>fileName', fileName)
    
    if (groupId) {
      docQuery = docQuery.eq('metadata->>groupId', groupId)
    }
    
    const { error: docError } = await docQuery
    
    if (docError) {
      console.warn(`Failed to delete indexed documents: ${docError.message}`)
    }
    
    return {
      success: true,
      message: `Successfully deleted "${fileName}"`
    }
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Task 4: Fetch vector documents from Supabase
export async function fetchVectorDocuments(limit: number = 100, offset: number = 0): Promise<DocumentListResponse> {
  try {
    const { groupId } = await getSessionContext()
    
    console.log('🔍 [fetchVectorDocuments] Starting query:', { limit, offset, groupId })
    
    let query = supabaseN8N
      .from('documents')
      .select('id, content, metadata', { count: 'exact' })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Only filter by groupId if it exists - if no groupId, return all documents
    if (groupId) {
      console.log('🔍 [fetchVectorDocuments] Filtering by groupId:', groupId)
      query = query.eq('metadata->>groupId', groupId)
    } else {
      console.log('⚠️ [fetchVectorDocuments] No groupId found, fetching all documents')
    }
    
    const { data, error, count } = await query
    
    console.log('📦 [fetchVectorDocuments] Query result:', { 
      dataCount: data?.length || 0, 
      totalCount: count, 
      hasError: !!error,
      errorMessage: error?.message 
    })
    
    if (error) {
      console.error('❌ [fetchVectorDocuments] Query error:', error)
      return {
        success: false,
        documents: [],
        total: 0,
        message: `Failed to fetch documents: ${error.message}`
      }
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ [fetchVectorDocuments] No documents returned from query')
      return {
        success: true,
        documents: [],
        total: count || 0,
        message: 'No documents found'
      }
    }
    
    const documents: VectorDocument[] = (data || []).map((doc: any) => {
      const fileName = doc.metadata?.fileName || 'Unknown'
      console.log('📄 [fetchVectorDocuments] Document:', { id: doc.id, fileName, hasMetadata: !!doc.metadata })
      return {
        id: doc.id,
        content: doc.content || '',
        metadata: doc.metadata || {}
      }
    })
    
    console.log(`✅ [fetchVectorDocuments] Returning ${documents.length} documents`)
    
    return {
      success: true,
      documents,
      total: count || 0
    }
    
  } catch (error) {
    console.error('❌ [fetchVectorDocuments] Exception:', error)
    return {
      success: false,
      documents: [],
      total: 0,
      message: `Failed to fetch documents: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Task 5: Index file to vector via n8n webhook
export async function indexFileToVector(fileName: string): Promise<{
  success: boolean
  message: string
  workflowId?: string
  estimatedTime?: string
}> {
  const { groupId } = await getSessionContext()
  
  try {
    // 1. Get signed URL from Supabase Storage
    const filePath = `files/${fileName}`
    const { data: urlData, error: urlError } = await supabaseN8N.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 3600) // 1 hour expiry
    
    if (urlError || !urlData) {
      return {
        success: false,
        message: `Failed to get file URL: ${urlError?.message || 'Unknown error'}`
      }
    }
    
    let fullFileUrl = urlData.signedUrl
    
    // Convert relative URL to full URL if needed
    if (!fullFileUrl.startsWith('http')) {
      const supabaseUrl = 'https://kvijybrfxukdttijgmwy.supabase.co'
      if (fullFileUrl.startsWith('/object/')) {
        fullFileUrl = `${supabaseUrl}/storage/v1${fullFileUrl}`
      } else if (fullFileUrl.startsWith('/storage/')) {
        fullFileUrl = `${supabaseUrl}${fullFileUrl}`
      } else {
        fullFileUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${filePath}`
      }
    }
    
    // 2. Get webhook ID
    const UPLOAD_WEBHOOK_ID = (import.meta as any).env?.VITE_N8N_UPLOAD_WEBHOOK_ID || '31cc8349-fbf2-4f0d-b1dd-dd14070a9947'
    
    // 3. Determine dev/production mode
    const isDevMode = ((import.meta as any).env?.VITE_N8N_DEV_MODE === 'true') || 
                     localStorage.getItem('n8n-dev-mode') === 'true'
    
    // 4. Construct webhook URL
    const N8N_BASE_URL = 'https://n8n.srv978041.hstgr.cloud'
    const n8nWebhookUrl = isDevMode 
      ? `${N8N_BASE_URL}/webhook-test/${UPLOAD_WEBHOOK_ID}`
      : ((import.meta as any).env?.VITE_N8N_BASE_URL 
          ? `${(import.meta as any).env?.VITE_N8N_BASE_URL}/webhook/${UPLOAD_WEBHOOK_ID}`
          : `${N8N_BASE_URL}/webhook/${UPLOAD_WEBHOOK_ID}`)
    
    // 5. Construct payload (MUST be an array)
    const payload = [{
      fileUrl: fullFileUrl,
      fileName: fileName,
      source: 'supabase-storage',
      groupId: groupId,
    }]
    
    console.log('📤 Sending to n8n webhook:', n8nWebhookUrl)
    console.log('📦 Payload:', payload)
    
    // 6. Send POST request with dual fallback
    try {
      // First attempt: Use fetch with cors mode
      const fetchResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`)
      }
      
      const responseData = await fetchResponse.json().catch(() => ({}))
      const workflowId = responseData?.workflowId || responseData?.executionId
      const estimatedTime = responseData?.estimatedTime
      
      return {
        success: true,
        message: `File indexing initiated for "${fileName}"`,
        workflowId,
        estimatedTime
      }
    } catch (fetchError: any) {
      console.warn('CORS fetch failed, trying no-cors mode:', fetchError)
      
      // Fallback: Use fetch with no-cors (can't read response but usually works)
      try {
        const noCorsResponse = await fetch(n8nWebhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        
        // In no-cors mode, we can't read the response, but status 0 usually means success
        return {
          success: true,
          message: `File indexing initiated for "${fileName}" (no-cors mode)`
        }
      } catch (noCorsError) {
        return {
          success: false,
          message: `Failed to call indexing webhook: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
        }
      }
    }
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to index file: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Task 6: Check indexing status
export async function checkIndexingStatus(fileName: string): Promise<IndexStatusResponse> {
  const { groupId } = await getSessionContext()
  
  try {
    let query = supabaseN8N
      .from('documents')
      .select('id, metadata')
      .eq('metadata->>fileName', fileName)
      .order('id', { ascending: false })
    
    if (groupId) {
      query = query.eq('metadata->>groupId', groupId)
    }
    
    const { data, error } = await query
    
    if (error) {
      return {
        success: false,
        message: `Failed to check indexing status: ${error.message}`,
        status: 'failed'
      }
    }
    
    if (!data || data.length === 0) {
      return {
        success: true,
        message: 'File is not yet indexed',
        status: 'pending'
      }
    }
    
    return {
      success: true,
      message: `File is indexed with ${data.length} chunks`,
      status: 'completed',
      chunksCount: data.length
    }
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to check indexing status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'failed'
    }
  }
}

