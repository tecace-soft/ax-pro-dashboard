import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { IconUpload, IconTrash, IconRefresh, IconDownload, IconAlertTriangle, IconCheck, IconX } from '../../ui/icons'
import { listBlobs, deleteBlob, uploadBlobFile, replaceBlobFile, BlobItem, RAGApiError, checkSyncForBlobs } from '../../lib/ragApi'
import { fetchFilesFromSupabase, uploadFilesToSupabase, deleteFileFromSupabase } from '../../services/ragManagementN8N'
import './BlobFiles.css'

interface SyncRow {
  key: string
  blob?: any | null
  indexDocs: any[]
  indexCount: number
  status: 'synced' | 'needs_indexing' | 'orphaned'
}

interface BlobFilesProps {
  language?: 'en' | 'ko'
  onUploadComplete?: () => void // 업로드 완료 시 부모 컴포넌트 새로고침을 위한 콜백
  syncRows?: SyncRow[] // sync 상태 데이터
  onNavigateToSync?: () => void // Sync Status 탭으로 이동하는 콜백
}

export default function BlobFiles({ language = 'en', onUploadComplete, syncRows = [], onNavigateToSync }: BlobFilesProps) {
  const location = useLocation()
  const isN8NRoute = location.pathname === '/rag-n8n'
  
  const [blobs, setBlobs] = useState<BlobItem[]>([])
  const [syncStates, setSyncStates] = useState<Record<string, "synced" | "unsynced">>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  
  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredBlobs, setFilteredBlobs] = useState<BlobItem[]>([])

  // Language translations
  const t = {
    en: {
      title: 'File Library',
      subtitle: 'Manage files in your library (upload/delete). Knowledge indexing is handled in the next section.',
      uploadArea: 'Drag text files here to upload or click to select',
      supportedFormats: 'Supported formats: .txt, .md, .json, .csv, .xml, .html, .css, .js, .ts',
      fileName: 'File Name',
      size: 'Size',
      lastModified: 'Last Modified',
      contentType: 'Content Type',
      actions: 'Actions',
      upload: 'Upload',
      delete: 'Delete',
      download: 'Download',
      refresh: 'Refresh',
      loading: 'Loading...',
      uploading: 'Uploading...',
          confirmDelete: 'Are you sure you want to delete this file?',
          confirmReplace: 'This file already exists. Do you want to replace it?',
          deleteSuccess: 'File deleted successfully',
          deleteError: 'Failed to delete file',
          uploadSuccess: 'File uploaded successfully',
          uploadError: 'Failed to upload file',
          loadError: 'Failed to load files',
          noFiles: 'No files found',
          dragOver: 'Drop files here to upload',
          search: 'Search',
          searchPlaceholder: 'Search by filename...',
          clearSearch: 'Clear search'
    },
    ko: {
      title: '파일 라이브러리',
      subtitle: '파일 라이브러리의 파일을 관리합니다 (업로드/삭제). 지식 인덱싱은 다음 섹션에서 처리됩니다.',
      uploadArea: '텍스트 파일을 드래그하여 업로드하거나 클릭하여 선택하세요',
      supportedFormats: '지원 형식: .txt, .md, .json, .csv, .xml, .html, .css, .js, .ts',
      fileName: '파일명',
      size: '크기',
      lastModified: '수정일',
      contentType: '콘텐츠 타입',
      actions: '액션',
      upload: '업로드',
      delete: '삭제',
      download: '다운로드',
      refresh: '새로고침',
      loading: '로딩 중...',
      uploading: '업로드 중...',
          confirmDelete: '정말로 이 파일을 삭제하시겠습니까?',
          confirmReplace: '이 파일이 이미 존재합니다. 교체하시겠습니까?',
          deleteSuccess: '파일이 성공적으로 삭제되었습니다',
          deleteError: '파일 삭제에 실패했습니다',
          uploadSuccess: '파일이 성공적으로 업로드되었습니다',
          uploadError: '파일 업로드에 실패했습니다',
          loadError: '파일 목록을 불러오는데 실패했습니다',
          noFiles: '파일이 없습니다',
          dragOver: '업로드하려면 파일을 여기에 놓으세요',
          search: '검색',
          searchPlaceholder: '파일명으로 검색...',
          clearSearch: '검색 지우기'
    }
  }

  const currentT = t[language]

  // Load blobs on component mount
  useEffect(() => {
    loadBlobs()
  }, [])

  // 검색 기능
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBlobs(blobs)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = blobs.filter(blob => 
        blob.name.toLowerCase().includes(query) ||
        blob.content_type?.toLowerCase().includes(query)
      )
      setFilteredBlobs(filtered)
    }
  }, [searchQuery, blobs])

  const loadBlobs = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      if (isN8NRoute) {
        // Use Supabase for n8n route
        console.debug('🔄 Loading files from Supabase...')
        const response = await fetchFilesFromSupabase()
        
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch files')
        }
        
        // Convert RAGFile to BlobItem format
        const items: BlobItem[] = response.files.map(f => ({
          name: f.name,
          size: f.size,
          last_modified: f.lastModified,
          content_type: f.type,
          etag: f.id, // Use file ID as etag
          url: undefined,
          url_with_sas: undefined
        }))
        
        console.debug('📋 Loaded files:', items.length)
        setBlobs(items)
        
        // Set sync states based on syncStatus
        const syncMap: Record<string, "synced" | "unsynced"> = {}
        response.files.forEach(f => {
          syncMap[f.name] = f.syncStatus === 'synced' ? 'synced' : 'unsynced'
        })
        setSyncStates(syncMap)
      } else {
        // Use Azure for regular route
        console.debug('🔄 Loading blobs...')
        const items = await listBlobs()
        console.debug('📋 Loaded blobs:', items.length, 'items:', items.map(b => ({ name: b.name, etag: b.etag })))
        setBlobs(items)
        
        // ✅ parent_id로 한 방에 sync 상태 확인
        const names = items.map((b) => b.name) // blob name = parent_id
        const syncMap = await checkSyncForBlobs(names)
        setSyncStates(syncMap)
      }
    } catch (error) {
      console.error('Failed to load blobs:', error)
      setError(
        error instanceof RAGApiError 
          ? error.message 
          : currentT.loadError
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true)
    setError(null)
    
    const fileArray = Array.from(files)
    
    if (isN8NRoute) {
      // Use Supabase for n8n route
      try {
        const results = await uploadFilesToSupabase(fileArray)
        
        const successful = results.filter(r => r.success)
        const failed = results.filter(r => !r.success)
        
        if (successful.length > 0) {
          await loadBlobs()
          if (onUploadComplete) {
            onUploadComplete()
          }
          alert(`${currentT.uploadSuccess}: ${successful.map(r => r.fileName).join(', ')}`)
        }
        
        if (failed.length > 0) {
          alert(`${currentT.uploadError}: ${failed.map(r => `${r.fileName} (${r.error || r.message})`).join(', ')}`)
        }
      } catch (error) {
        console.error('Upload failed:', error)
        alert(`${currentT.uploadError}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsUploading(false)
      }
    } else {
      // Use Azure for regular route
      const results = []

      for (const file of fileArray) {
        try {
          setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
          
          // Always refresh the blob list first to get the most current state
          console.debug('🔄 Refreshing blob list before upload check...')
          await loadBlobs()
          
          // Check if file already exists in current state
          const existingBlob = blobs.find(b => b.name === file.name)
          console.debug('🔍 Checking existing blob:', { 
            fileName: file.name, 
            existingBlob: !!existingBlob, 
            etag: existingBlob?.etag,
            allBlobs: blobs.map(b => b.name)
          })
          
          if (existingBlob) {
            // Ask for confirmation before replacing
            const confirmMessage = `${currentT.confirmReplace}\n\nFile: ${file.name}`
            console.debug('🔄 File exists, asking for confirmation...')
            if (!confirm(confirmMessage)) {
              console.debug('❌ User cancelled replacement')
              results.push({ file: file.name, success: false, error: 'Cancelled by user' })
              setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
              continue
            }
            
            // Use replace for existing files (backend handles same-name conflicts)
            console.debug('✅ User confirmed, proceeding with replace...')
            await replaceBlobFile(file, existingBlob.etag)
            results.push({ file: file.name, success: true, action: 'replaced' })
          } else {
            // Use upload for new files
            console.debug('⬆️ File is new, proceeding with upload...')
            await uploadBlobFile(file)
            results.push({ file: file.name, success: true, action: 'uploaded' })
          }
          
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
          
          // Refresh the blob list after each successful upload
          console.debug('🔄 Refreshing blob list after upload...')
          await loadBlobs()
          
          // Notify parent component that upload is complete
          if (onUploadComplete) {
            onUploadComplete()
          }
          
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error)
          results.push({ 
            file: file.name, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      }

      // Show results
      const successful = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)

      if (successful.length > 0) {
        const uploaded = successful.filter(r => r.action === 'uploaded')
        const replaced = successful.filter(r => r.action === 'replaced')
        
        let message = ''
        if (uploaded.length > 0) {
          message += `${currentT.uploadSuccess}: ${uploaded.map(r => r.file).join(', ')}`
        }
        if (replaced.length > 0) {
          if (message) message += '\n'
          message += `Replaced: ${replaced.map(r => r.file).join(', ')}`
        }
        
        alert(message)
      }

      if (failed.length > 0) {
        alert(`${currentT.uploadError}: ${failed.map(r => `${r.file} (${r.error})`).join(', ')}`)
      }

      setUploadProgress({})
      setIsUploading(false)
    }
  }

  const handleDelete = async (blob: BlobItem) => {
    const confirmMessage = `${currentT.confirmDelete}\n\nFile: ${blob.name}`
    
    if (!confirm(confirmMessage)) return

    try {
      if (isN8NRoute) {
        // Use Supabase for n8n route
        const result = await deleteFileFromSupabase(blob.name)
        if (result.success) {
          alert(result.message)
          loadBlobs()
        } else {
          alert(result.message)
        }
      } else {
        // Use Azure for regular route
        await deleteBlob(blob.name)
        alert(`${currentT.deleteSuccess}: ${blob.name}`)
        loadBlobs()
      }
    } catch (error) {
      console.error('Failed to delete blob:', error)
      alert(`${currentT.deleteError}: ${blob.name}`)
    }
  }

  const handleDownload = async (blob: BlobItem) => {
    if (isN8NRoute) {
      // Use Supabase for n8n route - get signed URL
      try {
        const { supabaseN8N } = await import('../../services/supabaseN8N')
        const filePath = `files/${blob.name}`
        
        const { data: urlData, error: urlError } = await supabaseN8N.storage
          .from('knowledge-base')
          .createSignedUrl(filePath, 3600)
        
        if (urlError || !urlData) {
          alert(`Failed to get download URL: ${urlError?.message || 'Unknown error'}`)
          return
        }
        
        window.open(urlData.signedUrl, '_blank', 'noopener')
      } catch (e) {
        console.error('Failed to get download URL:', e)
        alert('Failed to download file')
      }
    } else {
      // Use Azure for regular route
      const url = (blob as any).url_with_sas || blob.url
      if (!url) {
        alert('Download URL not available for this file')
        return
      }

      // Open in a new tab/window for viewing; keep current page
      try {
        const w = window.open(url, '_blank', 'noopener')
        if (!w) {
          // Popup blocked fallback
          const a = document.createElement('a')
          a.href = url
          a.target = '_blank'
          a.rel = 'noopener'
          document.body.appendChild(a)
          a.click()
          a.remove()
        }
      } catch (e) {
        console.error('Open in new window failed:', e)
        window.open(url, '_blank')
      }
    }
  }

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
  }

  // Get sync status for a specific blob
  const getSyncStatus = (blobName: string) => {
    // 새로운 방식: parent_id로 직접 확인
    const syncState = syncStates[blobName]
    if (syncState) {
      return syncState === 'synced' ? 'synced' : 'needs_indexing'
    }
    
    // 기존 방식: syncRows에서 찾기 (fallback)
    const syncRow = syncRows.find(row => row.key === blobName)
    return syncRow ? syncRow.status : 'unknown'
  }

  // Get sync status icon
  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <IconCheck className="sync-icon synced" />
      case 'needs_indexing':
        return <IconAlertTriangle className="sync-icon needs-indexing" />
      case 'orphaned':
        return <IconX className="sync-icon orphaned" />
      default:
        return <span className="sync-icon unknown">?</span>
    }
  }

  // Handle sync status click
  const handleSyncStatusClick = () => {
    if (onNavigateToSync) {
      onNavigateToSync()
    }
  }

  return (
    <div className="blob-files">
      <div className="blob-header">
        <h2>{currentT.title}</h2>
        <p>{currentT.subtitle}</p>
      </div>

      {/* Upload Area */}
      <div className="upload-section">
        <div 
          className="upload-area"
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('drag-over')
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('drag-over')
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('drag-over')
            handleFileUpload(e.dataTransfer.files)
          }}
        >
          <IconUpload className="upload-icon" />
          <p>{currentT.uploadArea}</p>
          <p className="supported-formats">Supported formats: .txt, .md, .json, .csv, .xml, .html, .css, .js, .ts, .pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx</p>
          <input
            type="file"
            multiple
            accept=".txt,.md,.json,.csv,.xml,.html,.css,.js,.ts,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            className="file-input"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="controls-section">
        {/* Search */}
        <div className="search-controls">
          <div className="search-input-group">
            <input
              type="text"
              placeholder={currentT.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              disabled={isLoading}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="clear-search-btn"
                title={currentT.clearSearch}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        <button 
          onClick={loadBlobs} 
          className="refresh-btn"
          disabled={isLoading}
        >
          <IconRefresh />
          {currentT.refresh}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <IconAlertTriangle />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-message">
          {currentT.loading}
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="uploading-message">
          {currentT.uploading}
        </div>
      )}

      {/* Files Table */}
      {!isLoading && !error && (
        <div className="files-table">
          {blobs.length === 0 ? (
            <div className="no-files">
              <p>{currentT.noFiles}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{currentT.fileName}</th>
                  <th>{currentT.size}</th>
                  <th>{currentT.lastModified}</th>
                  <th>{currentT.contentType}</th>
                  <th>Sync Status</th>
                  <th>{currentT.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBlobs.map((blob) => {
                  const syncStatus = getSyncStatus(blob.name)
                  return (
                    <tr key={blob.name}>
                      <td className="file-name">{blob.name}</td>
                      <td>{formatFileSize(blob.size as any)}</td>
                      <td>{formatDate(blob.last_modified as any)}</td>
                      <td>{blob.content_type || 'Unknown'}</td>
                      <td>
                        <button 
                          onClick={handleSyncStatusClick}
                          className="sync-status-btn"
                          title={`Click to view sync details in Sync Status tab`}
                        >
                          {getSyncStatusIcon(syncStatus)}
                        </button>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {(blob as any).url_with_sas || blob.url ? (
                            <button 
                              onClick={() => handleDownload(blob)}
                              title={currentT.download}
                              className="action-btn download-btn"
                            >
                              <IconDownload />
                            </button>
                          ) : null}
                          <button 
                            onClick={() => handleDelete(blob)}
                            title={currentT.delete}
                            className="action-btn delete-btn"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
