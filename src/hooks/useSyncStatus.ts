import { useState, useEffect } from 'react'
import { listBlobs, listDocuments } from '../services/ragManagement'

export type SyncStatus = 'synced' | 'orphaned' | 'unknown'

export interface UseSyncStatusReturn {
  statusByParentId: Map<string, SyncStatus>
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useSyncStatus(): UseSyncStatusReturn {
  const [statusByParentId, setStatusByParentId] = useState<Map<string, SyncStatus>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const computeSyncStatus = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Get blobs
      const blobResponse = await listBlobs('')
      const blobs = blobResponse.ok ? (blobResponse.data?.items || []) : []
      const blobNames = new Set(blobs.map(blob => blob.name))

      // Get index documents
      const indexResponse = await listDocuments({ 
        top: 1000,
        select: 'chunk_id,parent_id,title,filepath,url'
      })
      const indexDocs = indexResponse.ok ? (indexResponse.data?.value || []) : []
      
      // Extract unique parent_ids from index
      const parentIds = new Set(
        indexDocs
          .map(doc => doc.parent_id)
          .filter((id): id is string => !!id)
      )

      // Compute sync status
      const statusMap = new Map<string, SyncStatus>()
      
      for (const parentId of parentIds) {
        if (blobNames.has(parentId)) {
          statusMap.set(parentId, 'synced')
        } else {
          statusMap.set(parentId, 'orphaned')
        }
      }

      setStatusByParentId(statusMap)
    } catch (err) {
      console.error('Failed to compute sync status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sync status')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    computeSyncStatus()
  }, [])

  return {
    statusByParentId,
    isLoading,
    error,
    refresh: computeSyncStatus
  }
}
