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
  content?: string | null
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

async function callRAGAPI<T = any>(payload: Record<string, unknown>): Promise<T> {
  if (!RAG_API_KEY) {
    throw new RAGApiError('RAG API key is not configured. Please check your .env file.', 'NO_API_KEY')
  }

  // Special logging for upload operations
  if (payload.op === 'blob_upload' && payload.content) {
    const contentLength = typeof payload.content === 'string' ? payload.content.length : 0
    console.debug('📤 Upload payload validation:', {
      name: payload.name,
      contentType: payload.content_type,
      contentLength,
      contentPreview: typeof payload.content === 'string' ? payload.content.slice(0, 100) : 'N/A',
      isDataUrl: typeof payload.content === 'string' && payload.content.startsWith('data:')
    })
    
    if (contentLength === 0) {
      throw new RAGApiError('Upload content is empty - this will result in 0-byte file', 'UPLOAD_ERROR')
    }
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

  const json = await response.json().catch(() => null)
  if (!json?.result) {
    throw new RAGApiError('Missing result in response', 'INVALID_RESPONSE', response.status, json)
  }

  const { route, blobs, index } = json.result
  console.debug('✅ RAG API response:', { route, hasBlobs: !!blobs, hasIndex: !!index })

  // Route-based parsing
  if (route?.startsWith('blob_')) {
    return blobs as T
  }
  if (route === 'list_docs') {
    return index as T
  }
  
  // Fallback for other routes
  return json.result as T
}

// Blob Operations
export async function listBlobsEnvelope(prefix: string = ''): Promise<ListBlobsResponse> {
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

  // Prefer new schema: data.items
  const rawItems = env.data?.items ?? env.blobs?.items ?? env.items ?? (Array.isArray(env.data) ? env.data : [])
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
    count: env.data?.count ?? env.blobs?.count ?? items.length,
    prefix: env.data?.prefix ?? env.blobs?.prefix ?? (prefix ?? null),
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

// Upload any file: text => UTF-8; binary => base64
export async function uploadAnyFile(file: File): Promise<{ success: boolean; error?: string }> {
  try {
    const rawType = (file.type || '').toLowerCase()
    const isText = rawType.startsWith('text/') || rawType.includes('json') || rawType.includes('csv') || rawType.includes('xml')

    if (isText) {
      const content = await file.text()
      const baseType = rawType || 'text/plain'
      const typeWithCharset = baseType.includes('charset=') ? baseType : `${baseType}; charset=utf-8`
      await uploadBlob({ name: file.name, content, contentType: typeWithCharset })
      return { success: true }
    }

    // Binary: send as data URL in content (backend can auto-detect)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })

    const payload = {
      op: 'blob_upload',
      name: file.name,
      content: dataUrl, // "data:...;base64,..."
      content_type: rawType || 'application/octet-stream',
      length: file.size,
    }

    const response = await callRAGAPI(payload)
    if (response?.ok === false) {
      throw new Error(response?.error?.message || 'Upload failed')
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Replace existing blob with new content (backend handles same-name conflicts)
export async function replaceBlobFile(file: File, etag?: string): Promise<any> {
  console.debug('🔄 replaceBlobFile()', { name: file.name, type: file.type, size: file.size, etag })
  const type = file.type || ''
  const isText = type.startsWith('text/') || ['application/json', 'application/xml', 'text/markdown'].includes(type)

  if (!isText) {
    // Binary files: use Data URL (backend auto-detects)
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(fr.error || new Error('readAsDataURL failed'))
      fr.readAsDataURL(file)
    })
    
    console.debug('📦 Binary file - dataUrl length:', dataUrl.length, 'preview:', dataUrl.slice(0, 64))
    
    const payload: any = {
      op: 'blob_replace',
      name: file.name,
      content: dataUrl,
      content_type: type || 'application/octet-stream'
    }
    if (etag) payload.etag = etag
    
    return callRAGAPI(payload)
  }

  // Text files: read as text (backend auto-adds UTF-8)
  const text = await file.text()
  console.debug('📝 Text file - content length:', text.length, 'preview:', text.slice(0, 100))
  
  const payload: any = {
    op: 'blob_replace',
    name: file.name,
    content: text,
    content_type: type || 'text/plain'
  }
  if (etag) payload.etag = etag
  
  return callRAGAPI(payload)
}

// Upload with simplified content handling (backend auto-detects)
export async function uploadBlobFile(file: File): Promise<any> {
  console.debug('⬆️ uploadBlobFile()', { name: file.name, type: file.type, size: file.size })
  const type = file.type || ''
  const isText = type.startsWith('text/') || ['application/json', 'application/xml', 'text/markdown'].includes(type)

  if (!isText) {
    // Binary files: use Data URL (backend auto-detects)
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(fr.error || new Error('readAsDataURL failed'))
      fr.readAsDataURL(file)
    })
    
    console.debug('📦 Binary file - dataUrl length:', dataUrl.length, 'preview:', dataUrl.slice(0, 64))
    
    return callRAGAPI({
      op: 'blob_upload',
      name: file.name,
      content: dataUrl,
      content_type: type || 'application/octet-stream'
    })
  }

  // Text files: read as text (backend auto-adds UTF-8)
  const text = await file.text()
  console.debug('📝 Text file - content length:', text.length, 'preview:', text.slice(0, 100))
  
  return callRAGAPI({
    op: 'blob_upload',
    name: file.name,
    content: text,
    content_type: type || 'text/plain'
  })
}

// List blobs - returns items array directly
export async function listBlobs(prefix: string = '', top: number = 100): Promise<BlobItem[]> {
  const res: any = await callRAGAPI({ op: 'blob_list', prefix, top })
  
  // New API returns blob payload directly
  if (!res || !res.items) {
    throw new RAGApiError('Unexpected response shape for blob_list', 'INVALID_RESPONSE', undefined, res)
  }
  
  const items: any[] = res.items ?? []
  console.debug('📃 blobs:', { count: res.count, itemsPreview: items.slice(0, 3) })
  
  return items.map((b: any) => ({
    name: b.name,
    size: b.size,
    last_modified: b.last_modified,
    content_type: b.content_type,
    etag: b.etag,
    url: b.url,
  }))
}

// List index docs - returns value array directly
export async function listIndexDocsRows({ top = 50, skip = 0, select = 'chunk_id,parent_id,title,url,filepath,content' }: { top?: number; skip?: number; select?: string } = {}) {
  const res: any = await callRAGAPI({ op: 'list_docs', top, skip, select })
  
  // New API returns index payload directly
  if (!res || !res.value) {
    throw new RAGApiError('Unexpected response shape for list_docs', 'INVALID_RESPONSE', undefined, res)
  }
  
  const rows: any[] = res.value ?? []
  console.debug('🔎 index rows:', rows.length)
  
  return rows.map((v: any) => ({
    chunk_id: v.chunk_id,
    parent_id: v.parent_id,
    title: v.title,
    url: v.url,
    filepath: v.filepath,
    content: v.content,
    original_id: v.original_id,
  }))
}
