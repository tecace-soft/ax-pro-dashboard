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
  
  // Get OpenAI API key from environment
  const openaiApiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY || ''
  
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
      
      console.log(`✅ Successfully uploaded "${uniqueFileName}" to Supabase storage`)
      
      // 4. Upload to OpenAI Files API
      let openaiFileId: string | null = null
      
      if (openaiApiKey) {
        try {
          const formData = new FormData()
          formData.append('purpose', 'assistants')
          formData.append('file', file) // Use original file object
          
          const openaiResponse = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`
            },
            body: formData
          })
          
          if (openaiResponse.ok) {
            const openaiData = await openaiResponse.json()
            openaiFileId = openaiData.id
            console.log(`✅ Successfully uploaded "${uniqueFileName}" to OpenAI, file ID: ${openaiFileId}`)
          } else {
            const errorText = await openaiResponse.text()
            console.warn(`⚠️ OpenAI upload failed for "${uniqueFileName}": ${errorText}`)
          }
        } catch (openaiError) {
          console.warn(`⚠️ OpenAI upload failed for "${uniqueFileName}":`, openaiError)
        }
      } else {
        console.warn('⚠️ OpenAI API key not configured, skipping OpenAI upload')
      }
      
      // 5. Save file record to Supabase 'files' table
      const { error: dbError } = await supabaseN8N
        .from('files')
        .insert({
          file_name: uniqueFileName,
          openai_file_id: openaiFileId
        })
      
      if (dbError) {
        console.warn(`⚠️ Failed to save file record to database: ${dbError.message}`)
      } else {
        console.log(`✅ Saved file record to database: ${uniqueFileName}, OpenAI ID: ${openaiFileId || 'N/A'}`)
      }
      
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
    
    // Get all file records from files table to check is_indexed status
    const fileNames = filesList.map(f => f.name)
    const { data: fileRecords, error: fileRecordsError } = await supabaseN8N
      .from('files')
      .select('file_name, is_indexed')
      .in('file_name', fileNames)
    
    if (fileRecordsError) {
      console.warn('⚠️ Error fetching file records:', fileRecordsError.message)
    }
    
    // Create a map for quick lookup
    const indexedMap = new Map<string, boolean>()
    if (fileRecords) {
      fileRecords.forEach(record => {
        indexedMap.set(record.file_name, record.is_indexed === true)
      })
    }
    
    // Convert storage files to RAGFile format
    const filesWithIndexStatus = filesList.map((file) => {
      const isIndexed = indexedMap.get(file.name) || false
      
      console.log(`📊 File: ${file.name}, is_indexed: ${isIndexed}`)
      
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
    })
    
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
    // 0. Lookup OpenAI IDs before deleting Supabase data
    const { data: fileRecord, error: fileRecordError } = await supabaseN8N
      .from('files')
      .select('openai_file_id')
      .eq('file_name', fileName)
      .single()

    if (fileRecordError) {
      console.warn(`⚠️ Could not fetch files.openai_file_id for "${fileName}":`, fileRecordError.message)
    }

    const openaiFileId: string | null = fileRecord?.openai_file_id ?? null
    const vectorStoreId = 'vs_69bc2e1a89308191bbc3d8de688b6ba8'
    const openaiApiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY || ''

    // 1. Best-effort delete from OpenAI + vector store (do not block Supabase deletion)
    if (openaiApiKey && openaiFileId) {
      try {
        // Removes the file from the vector store (file_id here is expected by OpenAI to be the vector store file id)
        // If your DB stored a different id than OpenAI expects, this may fail; we log and continue.
        const vectorStoreDeleteUrl = `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${openaiFileId}`
        const vectorStoreResp = await fetch(vectorStoreDeleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (!vectorStoreResp.ok) {
          const errorText = await vectorStoreResp.text().catch(() => '')
          console.warn(`⚠️ OpenAI vector store file delete failed for "${fileName}":`, vectorStoreResp.status, errorText)

          // Fallback: list vector-store files and try to delete by the actual vector-store file id.
          // We match by common fields where OpenAI returns the original file id.
          try {
            const listUrl = `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files?limit=100`
            const listResp = await fetch(listUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
              }
            })

            if (listResp.ok) {
              const listData = await listResp.json()
              const dataArr: any[] = Array.isArray(listData?.data) ? listData.data : []

              const match = dataArr.find(vsf => {
                const id = (vsf?.id ?? '').toString()
                const attrs = vsf?.attributes ?? {}
                const attrsFileId =
                  (attrs?.file_id ?? attrs?.fileId ?? attrs?.openai_file_id ?? attrs?.openaiFileId ?? '').toString()
                return id === openaiFileId || attrsFileId === openaiFileId
              })

              const vectorStoreFileId = match?.id
              if (vectorStoreFileId) {
                const deleteByVectorStoreFileIdUrl = `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${vectorStoreFileId}`
                const delete2Resp = await fetch(deleteByVectorStoreFileIdUrl, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json'
                  }
                })

                if (!delete2Resp.ok) {
                  const errorText2 = await delete2Resp.text().catch(() => '')
                  console.warn(`⚠️ OpenAI vector store delete fallback failed for "${fileName}":`, delete2Resp.status, errorText2)
                } else {
                  console.log(`✅ Deleted from OpenAI vector store (fallback) for "${fileName}"`)
                }
              } else {
                console.warn(`⚠️ Could not find matching vector-store file for "${fileName}" using openai_file_id.`)
              }
            } else {
              const listErrorText = await listResp.text().catch(() => '')
              console.warn(`⚠️ OpenAI vector store file list failed:`, listResp.status, listErrorText)
            }
          } catch (fallbackErr) {
            console.warn(`⚠️ OpenAI vector store delete fallback threw for "${fileName}":`, fallbackErr)
          }
        } else {
          console.log(`✅ Deleted from OpenAI vector store for "${fileName}"`)
        }
      } catch (e) {
        console.warn(`⚠️ OpenAI vector store delete threw for "${fileName}":`, e)
      }

      try {
        const openaiFileDeleteUrl = `https://api.openai.com/v1/files/${openaiFileId}`
        const openaiResp = await fetch(openaiFileDeleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (!openaiResp.ok) {
          const errorText = await openaiResp.text().catch(() => '')
          console.warn(`⚠️ OpenAI file delete failed for "${fileName}":`, openaiResp.status, errorText)
        } else {
          console.log(`✅ Deleted OpenAI file for "${fileName}"`)
        }
      } catch (e) {
        console.warn(`⚠️ OpenAI file delete threw for "${fileName}":`, e)
      }
    }

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
    
    // 3. Delete from files table
    const { error: filesTableError } = await supabaseN8N
      .from('files')
      .delete()
      .eq('file_name', fileName)
    
    if (filesTableError) {
      console.warn(`Failed to delete file record from files table: ${filesTableError.message}`)
    } else {
      console.log(`✅ Deleted file record from files table: ${fileName}`)
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

// Task 5: Index file to OpenAI Vector Store
export async function indexFileToVector(fileName: string): Promise<{
  success: boolean
  message: string
  vectorStoreFileId?: string
}> {
  try {
    // 1. Get OpenAI file ID from files table
    const { data: fileRecord, error: fileError } = await supabaseN8N
      .from('files')
      .select('openai_file_id')
      .eq('file_name', fileName)
      .single()
    
    if (fileError || !fileRecord) {
      return {
        success: false,
        message: `File record not found in database: ${fileError?.message || 'Unknown error'}`
      }
    }
    
    const openaiFileId = fileRecord.openai_file_id
    
    if (!openaiFileId) {
      return {
        success: false,
        message: `No OpenAI file ID found for "${fileName}". The file may not have been uploaded to OpenAI.`
      }
    }
    
    // 2. Get OpenAI API key
    const openaiApiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY || ''
    
    if (!openaiApiKey) {
      return {
        success: false,
        message: 'OpenAI API key not configured'
      }
    }
    
    // 3. Call OpenAI Vector Store API
    const vectorStoreId = 'vs_69bc2e1a89308191bbc3d8de688b6ba8'
    const vectorStoreUrl = `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`
    
    console.log(`📤 Adding file to OpenAI Vector Store: ${openaiFileId}`)
    
    const response = await fetch(vectorStoreUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        file_id: openaiFileId
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ OpenAI Vector Store API error:', errorText)
      return {
        success: false,
        message: `OpenAI Vector Store API error: ${response.status} - ${errorText}`
      }
    }
    
    const responseData = await response.json()
    console.log('✅ OpenAI Vector Store response:', responseData)
    
    // 4. Check if response contains an id (successful)
    if (responseData.id) {
      // 5. Update files table to mark as indexed
      console.log(`📝 Updating is_indexed for file_name: "${fileName}"`)
      
      const { data: updateData, error: updateError } = await supabaseN8N
        .from('files')
        .update({
          is_indexed: true,
          indexed_date: new Date().toISOString()
        })
        .eq('file_name', fileName)
        .select()
      
      if (updateError) {
        console.error(`❌ Failed to update is_indexed flag: ${updateError.message}`)
        console.error('Update error details:', updateError)
      } else if (!updateData || updateData.length === 0) {
        console.warn(`⚠️ No rows updated for file_name: "${fileName}" - row may not exist or RLS policy blocking`)
        
        // Try to verify the row exists
        const { data: checkData, error: checkError } = await supabaseN8N
          .from('files')
          .select('*')
          .eq('file_name', fileName)
        
        console.log('Checking if row exists:', { checkData, checkError })
      } else {
        console.log(`✅ Updated is_indexed = true for "${fileName}"`, updateData)
      }
      
      return {
        success: true,
        message: `Successfully added "${fileName}" to vector store`,
        vectorStoreFileId: responseData.id
      }
    } else {
      return {
        success: false,
        message: `Unexpected response from OpenAI: ${JSON.stringify(responseData)}`
      }
    }
    
  } catch (error) {
    console.error('❌ indexFileToVector error:', error)
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

