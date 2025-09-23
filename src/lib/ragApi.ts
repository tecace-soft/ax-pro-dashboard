// RAG API Client for Blob Management
// Handles communication with the deployed Azure ML endpoint

// Use proxy endpoint in development, direct URL in production
const RAG_API_URL = import.meta.env.DEV 
  ? '/rag-api' 
  : (import.meta.env.VITE_RAG_API_URL || 'https://hr-ax-pro-rag-management.eastus2.inference.ml.azure.com/score')
const RAG_API_KEY = import.meta.env.VITE_RAG_API_KEY

export type BlobItem = {
  name: string
  size: number
  last_modified: string
  content_type: string | null
  etag: string
  url?: string         // with SAS (있을 수도 있음)
  url_with_sas?: string // 업로드 응답에서 제공될 수 있음
}

export type ListBlobsResponse = {
  ok: boolean
  route: 'blob_list'
  data: { 
    ok: boolean
    prefix: string | null
    count: number
    items: BlobItem[]
  }
}

export type UploadBlobResponse = {
  ok: boolean
  route: 'blob_upload'
  data: {
    status: number
    ok: boolean
    name: string
    size: number
    content_type: string | null
    url: string
    url_with_sas?: string
    etag: string
    last_modified: string
  }
}

export type DeleteBlobResponse = {
  ok: boolean
  route: 'blob_delete'
  data: {
    status: number
    deleted: boolean
    not_found: boolean
    blob_url: string
  }
}

export type IndexDoc = {
  "@search.score"?: number
  chunk_id: string
  parent_id?: string | null
  title?: string | null
  url?: string | null
  filepath?: string | null
  original_id?: string | null
}

export type ListIndexDocsResponse = {
  ok: boolean
  route: "list_docs"
  index: {
    "@odata.context"?: string
    value: IndexDoc[]
    "@odata.count"?: number
  } | null
  blobs?: unknown | null
  ingest?: unknown | null
}

export class RAGApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public raw?: any
  ) {
    super(message)
    this.name = 'RAGApiError'
  }
}

async function callRAGAPI<T = any>(payload: any): Promise<T> {
  if (!RAG_API_KEY) {
    throw new RAGApiError('RAG API key is not configured. Please check your .env file.', 'NO_API_KEY')
  }

  console.debug('🔗 Making RAG API call:', { url: RAG_API_URL, payload })

  const response = await fetch(RAG_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RAG_API_KEY}`,
    },
    body: JSON.stringify({ payload }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new RAGApiError(`HTTP ${response.status}`, 'HTTP_ERROR', response.status, text)
  }

  const data: any = await response.json().catch(() => null)
  if (!data || typeof data !== 'object') {
    throw new RAGApiError('Unexpected response shape', 'INVALID_RESPONSE', response.status, data)
  }

  // New envelope already: { ok, route, index|blobs|null }
  if (typeof data.route === 'string') {
    return data as T
  }

  // Managed endpoint wrapper: { result: <object|string> }
  if (Object.prototype.hasOwnProperty.call(data, 'result')) {
    const inner = (typeof data.result === 'string') ? (() => { try { return JSON.parse(data.result) } catch { return data.result } })() : data.result
    if (inner && typeof inner === 'object') {
      return inner as T
    }
  }

  throw new RAGApiError('Unexpected response shape (no route/result)', 'INVALID_RESPONSE', response.status, data)
}

// Blob Operations
export async function listBlobs(prefix: string = ''): Promise<ListBlobsResponse> {
  const env = await callRAGAPI({ op: 'blob_list', prefix })
  if (env?.route === 'blob_list') return env as ListBlobsResponse
  // legacy shape acceptance
  if (env?.data?.items) {
    return env as ListBlobsResponse
  }
  throw new RAGApiError('blob_list: empty or malformed response', 'INVALID_RESPONSE', undefined, env)
}

export async function uploadBlob({
  name,
  content,
  contentType = 'text/plain; charset=utf-8'
}: {
  name: string
  content: string
  contentType?: string
}): Promise<UploadBlobResponse> {
  return callRAGAPI({
    op: 'blob_upload',
    name,
    content,
    content_type: contentType,
  })
}

export async function deleteBlob(name: string): Promise<DeleteBlobResponse> {
  return callRAGAPI({
    op: 'blob_delete',
    name,
  })
}

// Utility function to check if file is supported for text upload
export function isTextFile(file: File): boolean {
  const textTypes = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'application/typescript'
  ]
  
  return textTypes.includes(file.type) || 
         file.name.endsWith('.txt') || 
         file.name.endsWith('.md') || 
         file.name.endsWith('.json') || 
         file.name.endsWith('.csv') ||
         file.name.endsWith('.xml') ||
         file.name.endsWith('.html') ||
         file.name.endsWith('.css') ||
         file.name.endsWith('.js') ||
         file.name.endsWith('.ts')
}

// Index Operations
export async function listIndexDocs({
  select = 'chunk_id,parent_id,title,url,filepath',
  top = 50,
  skip = 0
}: {
  select?: string
  top?: number
  skip?: number
} = {}): Promise<ListIndexDocsResponse> {
  const response = await callRAGAPI({
    op: 'list_docs',
    select,
    top,
    skip,
  })

  // Basic empty guard
  if (!response) {
    throw new RAGApiError('Empty response from list_docs', 'INVALID_RESPONSE')
  }

  // 1) Preferred new envelope
  if (response.route === 'list_docs' && response.index && Array.isArray(response.index.value)) {
    return response as ListIndexDocsResponse
  }
  // 2) Legacy: { ok, route: 'list_docs', data: { value: [...] } }
  if (response.route === 'list_docs' && response.data?.value && Array.isArray(response.data.value)) {
    return { ok: true, route: 'list_docs', index: { value: response.data.value }, blobs: null } as ListIndexDocsResponse
  }
  // 3) Raw Azure Search payload: { value: [...] }
  if (!response.route && Array.isArray(response.value)) {
    return { ok: true, route: 'list_docs', index: { value: response.value }, blobs: null } as ListIndexDocsResponse
  }

  // If route is present but not list_docs, surface mismatch for easier backend diagnosis
  if (response.route && response.route !== 'list_docs') {
    throw new RAGApiError(`Route mismatch: ${response.route}`, 'INVALID_RESPONSE', undefined, response)
  }

  throw new RAGApiError('list_docs: malformed or missing index.value', 'INVALID_RESPONSE', undefined, response)
}

// File upload helper for text files
export async function uploadTextFile(file: File): Promise<{
  success: boolean
  error?: string
  data?: UploadBlobResponse
}> {
  try {
    if (!isTextFile(file)) {
      return {
        success: false,
        error: `Unsupported file type: ${file.type}. Only text files are supported in this version.`
      }
    }

    const content = await file.text()
    const data = await uploadBlob({
      name: file.name,
      content,
      contentType: file.type || 'text/plain; charset=utf-8'
    })

    return { success: true, data }
  } catch (error) {
    console.error('Failed to upload text file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function listBlobsUnified(prefix: string | null = null): Promise<{ ok: true; count: number; prefix: string | null; items: BlobItem[] }> {
  const env = await callRAGAPI<{ route?: string; data?: any; blobs?: any; items?: any[] }>({
    op: 'blob_list',
    prefix: prefix ?? '',
    top: 100,
  })

  if (env.route !== 'blob_list') {
    throw new RAGApiError(`Route mismatch: ${env['route']}`, 'INVALID_RESPONSE', undefined, env)
  }

  const rawItems = env.blobs?.items ?? env.data?.items ?? env.items ?? (Array.isArray(env.data) ? env.data : [])
  if (!Array.isArray(rawItems)) {
    throw new RAGApiError('blob_list: Unexpected response shape', 'INVALID_RESPONSE', undefined, env)
  }

  const items: BlobItem[] = rawItems.map((v: any) => ({
    name: v.name,
    size: v.size,
    last_modified: v.last_modified,
    content_type: v.content_type,
    etag: v.etag,
    url: v.url,
  }))

  return {
    ok: true,
    count: env.blobs?.count ?? env.data?.count ?? items.length,
    prefix: env.blobs?.prefix ?? env.data?.prefix ?? (prefix ?? null),
    items,
  }
}

export async function listIndexDocsUnified({
  top = 50,
  skip = 0,
  select = 'chunk_id,parent_id,title,url,filepath,content',
}: { top?: number; skip?: number; select?: string } = {}): Promise<{
  ok: true
  items: IndexDoc[]
  total: number
  context?: string
}> {
  const env = await callRAGAPI<{ route?: string; index?: any; data?: any; value?: any[] }>({
    op: 'list_docs',
    top,
    skip,
    select,
  })

  if (env.route !== 'list_docs') {
    throw new RAGApiError(`Route mismatch: ${env['route']}`, 'INVALID_RESPONSE', undefined, env)
  }

  const value: any[] = env.index?.value ?? env.data?.value ?? env.value ?? []
  if (!Array.isArray(value)) {
    throw new RAGApiError('list_docs: Unexpected response shape', 'INVALID_RESPONSE', undefined, env)
  }

  const items: IndexDoc[] = value.map((v: any) => ({
    chunk_id: v.chunk_id,
    parent_id: v.parent_id,
    title: v.title,
    url: v.url,
    filepath: v.filepath,
    original_id: v.original_id ?? null,
    ['@search.score']: v['@search.score'],
  }))

  return {
    ok: true,
    items,
    total: env.index?.['@odata.count'] ?? items.length,
    context: env.index?.['@odata.context'],
  }
}
