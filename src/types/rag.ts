// RAG API common types (discriminated by route)

export type BlobItem = {
  name: string
  size: number
  last_modified: string
  content_type?: string | null
  etag?: string | null
  url: string
}

export type BlobListPayload = {
  ok: true
  prefix: string | null
  count: number
  items: BlobItem[]
}

export type BlobsEnvelope = {
  ok: boolean
  route: 'blob_list'
  blobs: BlobListPayload | null
  index: null
  ingest?: unknown | null
}

export type IndexDoc = {
  '@search.score'?: number
  chunk_id: string
  parent_id?: string | null
  title?: string | null
  url?: string | null
  filepath?: string | null
  original_id?: string | null
}

export type IndexEnvelope = {
  ok: boolean
  route: 'list_docs'
  index: {
    '@odata.context'?: string
    '@odata.count'?: number
    value: IndexDoc[]
  } | null
  blobs: null
  ingest?: unknown | null
}

export type RagEnvelope = BlobsEnvelope | IndexEnvelope


