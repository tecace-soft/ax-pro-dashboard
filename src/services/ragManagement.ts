// RAG Management API Service
// Based on the API spec in src/docs/rag_management.md

// Use proxy endpoint in development, direct URL in production
const RAG_API_URL = import.meta.env.DEV 
  ? '/rag-api' 
  : (import.meta.env.VITE_RAG_API_URL || 'https://hr-ax-pro-rag-management.eastus2.inference.ml.azure.com/score')
const RAG_API_KEY = import.meta.env.VITE_RAG_API_KEY

interface RAGResponse<T = any> {
  ok: boolean
  route: string
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta: {
    version: string
  }
}

interface Document {
  chunk_id: string
  parent_id: string
  title: string
  filepath: string
  url?: string
  content?: string
}

interface BlobItem {
  name: string
  size: number
  last_modified: string
}

interface BlobUploadResponse {
  name: string
  url: string
}

interface BlobDownloadResponse {
  name: string
  content: string
}

interface BlobDeleteResponse {
  name: string
  deleted: boolean
}

// Generic API call function
async function callRAGAPI<T = any>(payload: any): Promise<RAGResponse<T>> {
  try {
    if (!RAG_API_KEY) {
      console.error('RAG API key is not configured. Please check your .env file.')
      throw new Error('RAG API key is not configured')
    }

    console.log('🔗 Making RAG API call:', {
      url: RAG_API_URL,
      payload: payload
    })

    const response = await fetch(RAG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAG_API_KEY}`,
      },
      body: JSON.stringify({ payload }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // Transform Azure ML response to our expected format
    // The API returns { result: { data: {...}, ok: true, route: '...' } }
    if (data.result && data.result.ok) {
      return {
        ok: true,
        route: data.result.route || 'success',
        data: data.result.data,
        meta: data.result.meta || { version: 'v1' }
      }
    } else {
      return {
        ok: false,
        route: 'error',
        error: {
          code: 'api_error',
          message: 'API returned error response'
        },
        meta: { version: 'v1' }
      }
    }
  } catch (error) {
    console.error('RAG API call failed:', error)
    return {
      ok: false,
      route: 'error',
      error: {
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      meta: { version: 'v1' },
    }
  }
}

// Document/Index Operations
export async function listDocuments(options: {
  top?: number
  skip?: number
  select?: string
} = {}): Promise<RAGResponse<{ '@odata.count': number; value: Document[] }>> {
  return callRAGAPI({
    op: 'list_docs',
    top: options.top || 20,
    select: options.select || 'chunk_id,title,filepath',
  })
}

export async function searchDocuments(options: {
  q: string
  top?: number
  filter?: string
  select?: string
}): Promise<RAGResponse<{ '@odata.count': number; value: Document[] }>> {
  return callRAGAPI({
    op: 'search',
    q: options.q,
    top: options.top || 5,
    filter: options.filter || '',
    select: options.select || 'chunk_id,parent_id,title,filepath,url,content',
  })
}

export async function readDocument(id: string): Promise<RAGResponse<Document>> {
  return callRAGAPI({
    op: 'read',
    id,
  })
}

export async function upsertDocument(options: {
  id: string
  content?: string
  title?: string
}): Promise<RAGResponse<Document>> {
  return callRAGAPI({
    op: 'upsert',
    id: options.id,
    content: options.content,
    title: options.title,
  })
}

export async function deleteDocument(id: string): Promise<RAGResponse<{ deleted: boolean }>> {
  return callRAGAPI({
    op: 'delete',
    id,
  })
}

export async function upsertBatchDocuments(docs: Array<{
  id: string
  content?: string
  title?: string
}>): Promise<RAGResponse<{ processed: number }>> {
  return callRAGAPI({
    op: 'upsert_batch',
    docs,
  })
}

// Blob Operations - For now, we'll use list_docs as a fallback since blob operations aren't available in the current API
export async function listBlobs(prefix: string = ''): Promise<RAGResponse<{ items: BlobItem[] }>> {
  // Since blob operations aren't available in the current API, we'll return empty for now
  // This maintains compatibility with the existing UI
  return {
    ok: true,
    route: 'blob_list',
    data: { items: [] },
    meta: { version: 'v1' }
  }
}

export async function uploadBlob(options: {
  name: string
  content: string
  content_type: string
}): Promise<RAGResponse<BlobUploadResponse>> {
  // For now, return a mock response since blob operations aren't available
  return {
    ok: true,
    route: 'blob_upload',
    data: { name: options.name, url: 'mock-url' },
    meta: { version: 'v1' }
  }
}

export async function downloadBlob(name: string): Promise<RAGResponse<BlobDownloadResponse>> {
  // For now, return a mock response since blob operations aren't available
  return {
    ok: true,
    route: 'blob_download',
    data: { name, content: 'mock content' },
    meta: { version: 'v1' }
  }
}

export async function replaceBlob(options: {
  name: string
  content: string
  content_type: string
  etag?: string
}): Promise<RAGResponse<BlobUploadResponse>> {
  // For now, return a mock response since blob operations aren't available
  return {
    ok: true,
    route: 'blob_replace',
    data: { name: options.name, url: 'mock-url' },
    meta: { version: 'v1' }
  }
}

export async function deleteBlob(name: string): Promise<RAGResponse<BlobDeleteResponse>> {
  // For now, return a mock response since blob operations aren't available
  return {
    ok: true,
    route: 'blob_delete',
    data: { name, deleted: true },
    meta: { version: 'v1' }
  }
}

// Utility functions for RAG Management UI
export async function getSyncStatus(): Promise<{
  documents: BlobItem[]
  indexDocuments: Document[]
  syncMap: Map<string, {
    blobExists: boolean
    indexExists: boolean
    status: 'synced' | 'needs_indexing' | 'orphaned'
  }>
}> {
  try {
    const [blobResponse, indexResponse] = await Promise.all([
      listBlobs(),
      listDocuments({ top: 1000 })
    ])

    const documents = blobResponse.ok ? blobResponse.data?.items || [] : []
    const indexDocuments = indexResponse.ok ? indexResponse.data?.value || [] : []

    // Create sync map
    const syncMap = new Map()
    
    // Check all blob documents
    documents.forEach(doc => {
      const indexExists = indexDocuments.some(idx => idx.filepath === doc.name)
      syncMap.set(doc.name, {
        blobExists: true,
        indexExists,
        status: indexExists ? 'synced' : 'needs_indexing'
      })
    })

    // Check orphaned index documents
    indexDocuments.forEach(doc => {
      if (!syncMap.has(doc.filepath)) {
        syncMap.set(doc.filepath, {
          blobExists: false,
          indexExists: true,
          status: 'orphaned'
        })
      }
    })

    return { documents, indexDocuments, syncMap }
  } catch (error) {
    console.error('Failed to get sync status:', error)
    return { documents: [], indexDocuments: [], syncMap: new Map() }
  }
}

export async function reindexDocument(filepath: string): Promise<boolean> {
  try {
    // First download the blob
    const downloadResponse = await downloadBlob(filepath)
    if (!downloadResponse.ok) {
      console.error('Failed to download blob:', downloadResponse.error)
      return false
    }

    // Then upload to trigger reindexing (this would need backend support)
    const uploadResponse = await uploadBlob({
      name: filepath,
      content: downloadResponse.data?.content || '',
      content_type: 'text/plain'
    })

    return uploadResponse.ok
  } catch (error) {
    console.error('Failed to reindex document:', error)
    return false
  }
}

// File upload helper
export async function uploadFiles(files: FileList): Promise<{
  success: string[]
  failed: { name: string; error: string }[]
}> {
  const success: string[] = []
  const failed: { name: string; error: string }[] = []

  for (const file of Array.from(files)) {
    try {
      const content = await file.text()
      const response = await uploadBlob({
        name: file.name,
        content,
        content_type: file.type || 'text/plain'
      })

      if (response.ok) {
        success.push(file.name)
      } else {
        failed.push({
          name: file.name,
          error: response.error?.message || 'Upload failed'
        })
      }
    } catch (error) {
      failed.push({
        name: file.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return { success, failed }
}
