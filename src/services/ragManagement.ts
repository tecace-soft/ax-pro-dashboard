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
  ingest?: {
    chunks?: number
    chunks_created?: number
    deleted?: number
    parent_id?: string
    name: string
    upserted?: number
    success?: boolean
    message?: string
    route?: string
  }
  // New reindex response format
  deleted?: number
  chunks_created?: number
  // Search response format
  value?: any[]
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

    const response = await fetch(RAG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAG_API_KEY}`,
      },
      body: JSON.stringify({ payload }),
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const raw = await response.json()

    // Azure ML returns: { result: { ok, route, index?, blobs?, ingest? ... } }
    const res = raw?.result ?? {}
    const ok = !!res.ok
    const route = res.route || 'success'

    // normalize data field
    const normalized =
      res.data    ??   // rarely used
      res.index   ??   // list_docs, search, read...
      res.blobs   ??   // blob_list, blob_upload, ...
      res.ingest  ??   // reindex/ingest utils
      null

    if (ok) {
      return { ok: true, route, data: normalized as T, meta: res.meta || { version: 'v1' } }
    }

    return {
      ok: false,
      route,
      error: { code: 'api_error', message: res?.error?.message || 'API returned error response', details: res?.error },
      meta: res.meta || { version: 'v1' },
    }
  } catch (error) {
    console.error('RAG API call failed:', error)
    return {
      ok: false,
      route: 'error',
      error: { code: 'network_error', message: error instanceof Error ? error.message : 'Unknown error' },
      meta: { version: 'v1' },
    }
  }
}

// Document/Index Operations
export async function listDocuments(options: {
  top?: number; skip?: number; select?: string
} = {}): Promise<RAGResponse<{ '@odata.count': number; value: Document[] }>> {
  return callRAGAPI({
    op: 'list_docs',
    top: options.top ?? 20,
    skip: options.skip ?? 0,
    select: options.select ?? 'chunk_id,title,filepath,url,parent_id',
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

// Blob Operations - call backend ops if available
export async function listBlobs(prefix: string = ''): Promise<RAGResponse<{ items: BlobItem[] }>> {
  return callRAGAPI({
    op: 'blob_list',
    prefix,
  })
}

export async function uploadBlob(options: {
  name: string
  content: string // base64 string or text
  content_type: string
}): Promise<RAGResponse<BlobUploadResponse>> {
  return callRAGAPI({
    op: 'blob_upload',
    name: options.name,
    content: options.content,
    content_type: options.content_type,
    encoding: 'base64_or_text'
  })
}

export async function downloadBlob(name: string): Promise<RAGResponse<BlobDownloadResponse>> {
  return callRAGAPI({
    op: 'blob_download',
    name,
  })
}

export async function replaceBlob(options: {
  name: string
  content: string
  content_type: string
  etag?: string
}): Promise<RAGResponse<BlobUploadResponse>> {
  return callRAGAPI({
    op: 'blob_replace',
    name: options.name,
    content: options.content,
    content_type: options.content_type,
    etag: options.etag,
  })
}

export async function deleteBlob(name: string): Promise<RAGResponse<BlobDeleteResponse>> {
  return callRAGAPI({
    op: 'blob_delete',
    name,
  })
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

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result === 'string') {
          // result is a data URL like "data:application/pdf;base64,...."
          const base64 = result.split(',')[1] || ''
          resolve(base64)
        } else {
          reject(new Error('Unsupported file result type'))
        }
      }
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  for (const file of Array.from(files)) {
    try {
      // Use base64 for all file types to preserve binary integrity
      const content = await fileToBase64(file)
      const response = await uploadBlob({
        name: file.name,
        content,
        content_type: file.type || 'application/octet-stream'
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

// Sync/Unsync operations
export async function clearIndexByFile(name: string) {
  console.debug('🗑️ Calling clear_by_parent for:', name)
  const result = await callRAGAPI({
    op: 'clear_by_parent',
    name,
  })
  console.debug('📊 clear_by_parent response:', result)
  return result
}

export async function reindexBlob(name: string, chunkSize: number = 1200, overlap: number = 200, makeEmbeddings: boolean = false) {
  console.debug('🔄 Calling reindex for:', name, { chunkSize, overlap, makeEmbeddings })
  const result = await callRAGAPI({
    op: 'reindex',
    name,
    chunk_size: chunkSize,
    overlap: overlap,
    make_embeddings: makeEmbeddings,
  })
  console.debug('📊 reindex response:', result)
  return result
}

export async function reindexBlobFallback(name: string) {
  const dl = await downloadBlob(name)
  if (!dl.ok || !dl.data?.content) return dl
  const ext = name.split('.').pop()?.toLowerCase()
  const mime =
    ext === 'pdf' ? 'application/pdf' :
    ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
    ext === 'doc' ? 'application/msword' :
    ext === 'txt' ? 'text/plain; charset=utf-8' :
    'application/octet-stream'

  return replaceBlob({
    name,
    content: dl.data.content,
    content_type: mime,
  })
}

// Search operations
export async function searchDocuments(query: string, top: number = 10, select?: string) {
  console.debug('🔍 Calling search with query:', query, { top, select })
  
  const payload: any = {
    op: 'search',
    q: query,
    top: top,
  }
  
  // Use sanitizeSelect from ragApi.ts
  const { sanitizeSelect } = await import('../lib/ragApi')
  const safeSelect = sanitizeSelect(select)
  if (safeSelect) {
    payload.select = safeSelect
  }
  
  const result = await callRAGAPI(payload)
  console.debug('📊 search response:', result)
  return result
}
