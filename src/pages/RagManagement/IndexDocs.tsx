// src/pages/RagManagement/IndexDocs.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IconRefresh, IconEye, IconAlertTriangle, IconCheck, IconX } from '../../ui/icons'
import { listIndexDocsRows, IndexDoc, IndexRow, RAGApiError, fetchChunkContentById } from '../../lib/ragApi'
import { fetchVectorDocuments, VectorDocument } from '../../services/ragManagementN8N'
import { useSyncStatus } from '../../hooks/useSyncStatus'
import SyncBadge from '../../components/SyncBadge'
import './IndexDocs.css'

interface IndexDocsProps {
  language?: 'en' | 'ko'
}

export default function IndexDocs({ language = 'en' }: IndexDocsProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isN8NRoute = location.pathname === '/rag-n8n'
  
  // 전체 수집본 & 현재 페이지 조각
  const [allDocs, setAllDocs] = useState<IndexRow[]>([])
  const [docs, setDocs] = useState<IndexRow[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<IndexRow | null>(null)
  
  // Sync status hook (for regular route)
  const { statusByParentId, isLoading: isSyncLoading } = useSyncStatus()
  
  // For n8n route: fetch files to compute sync status
  const [n8nFiles, setN8nFiles] = useState<string[]>([])
  useEffect(() => {
    if (isN8NRoute) {
      const loadFiles = async () => {
        try {
          const { fetchFilesFromSupabase } = await import('../../services/ragManagementN8N')
          const response = await fetchFilesFromSupabase()
          if (response.success) {
            setN8nFiles(response.files.map(f => f.name))
          }
        } catch (err) {
          console.error('Failed to load files for sync status:', err)
        }
      }
      loadFiles()
    }
  }, [isN8NRoute])

  // 페이지네이션 상태
  const [top, setTop] = useState(200)
  const [skip, setSkip] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  
  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredDocs, setFilteredDocs] = useState<IndexRow[]>([])

  // 다국어
  const t = {
    en: {
      headingTitle: 'Knowledge Index',
      subtitle: 'Documents indexed for AI chatbot knowledge queries',
      chunkId: 'Chunk ID',
      parentId: 'Parent ID',
      columnTitle: 'Title',
      filepath: 'File Path',
      content: 'Content Preview',
      actions: 'Actions',
      view: 'View',
      refresh: 'Refresh',
      loading: 'Loading...',
      loadError: 'Failed to load index documents',
      noDocs: 'No documents found in search index',
      pagination: 'Pagination',
      itemsPerPage: 'Items per page',
      page: 'Page',
      of: 'of',
      previous: 'Previous',
      next: 'Next',
      totalItems: 'Total items',
      viewContent: 'View Content',
      close: 'Close',
      contentPreview: 'Content Preview',
      fullContent: 'Full Content',
      search: 'Search',
      searchPlaceholder: 'Search by title, filepath, or content...',
      clearSearch: 'Clear search'
    },
    ko: {
      headingTitle: '지식 인덱스',
      subtitle: 'AI 챗봇 지식 쿼리를 위해 인덱싱된 문서들',
      chunkId: '청크 ID',
      parentId: '부모 ID',
      columnTitle: '제목',
      filepath: '파일 경로',
      content: '내용 미리보기',
      actions: '액션',
      view: '보기',
      refresh: '새로고침',
      loading: '로딩 중...',
      loadError: '인덱스 문서를 불러오는데 실패했습니다',
      noDocs: '검색 인덱스에 문서가 없습니다',
      pagination: '페이지네이션',
      itemsPerPage: '페이지당 항목',
      page: '페이지',
      of: '중',
      previous: '이전',
      next: '다음',
      totalItems: '총 항목',
      viewContent: '내용 보기',
      close: '닫기',
      contentPreview: '내용 미리보기',
      fullContent: '전체 내용',
      search: '검색',
      searchPlaceholder: '제목, 파일 경로, 또는 내용으로 검색...',
      clearSearch: '검색 지우기'
    }
  }
  const currentT = t[language]

  // 첫 마운트 시 전체 로딩
  useEffect(() => {
    loadAllIndexDocs()
  }, [])

  // 검색 기능
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDocs(allDocs)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = allDocs.filter(doc => 
        (doc.title?.toLowerCase().includes(query)) ||
        (doc.filepath?.toLowerCase().includes(query)) ||
        (doc.parent_id?.toLowerCase().includes(query)) ||
        (doc.chunk_id?.toLowerCase().includes(query)) ||
        (doc.content?.toLowerCase().includes(query))
      )
      setFilteredDocs(filtered)
    }
  }, [searchQuery, allDocs])

  // 페이지네이션 파라미터/필터된 목록 변경 시 화면 조각 갱신
  useEffect(() => {
    const page = filteredDocs.slice(skip, skip + top)
    setDocs(page)
    setTotalCount(filteredDocs.length)
  }, [top, skip, filteredDocs])

  // 전체 페이지를 끝까지 수집
  const loadAllIndexDocs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (isN8NRoute) {
        // Use Supabase for n8n route - group by fileName
        console.log('🔍 [IndexDocs] Loading ALL index docs from Supabase for n8n route…')
        const PAGE_SIZE = 100
        const HARD_CAP = 10000
        let allDocuments: any[] = []
        let pageSkip = 0

        while (pageSkip < HARD_CAP) {
          console.log(`🔍 [IndexDocs] Fetching page at offset ${pageSkip}...`)
          const response = await fetchVectorDocuments(PAGE_SIZE, pageSkip)
          console.log(`📦 [IndexDocs] Response:`, { 
            success: response.success, 
            count: response.documents?.length || 0,
            total: response.total,
            message: response.message 
          })
          
          if (!response.success) {
            console.error('❌ [IndexDocs] fetchVectorDocuments failed:', response.message)
            setError(response.message || 'Failed to fetch documents from Supabase')
            break
          }
          
          if (!response.documents || response.documents.length === 0) {
            console.log('ℹ️ [IndexDocs] No more documents to fetch')
            break
          }
          
          allDocuments = allDocuments.concat(response.documents)
          console.log(`📦 [IndexDocs] got ${response.documents.length} documents (acc: ${allDocuments.length}) at skip=${pageSkip}`)
          if (response.documents.length < PAGE_SIZE) break
          pageSkip += PAGE_SIZE
        }

        console.log(`📊 [IndexDocs] Total documents fetched: ${allDocuments.length}`)

        if (allDocuments.length === 0) {
          console.warn('⚠️ [IndexDocs] No documents found in Supabase')
          setAllDocs([])
          setFilteredDocs([])
          setDocs([])
          setTotalCount(0)
          return
        }

        // Group documents by fileName
        const groupedByFileName: Record<string, any[]> = {}
        allDocuments.forEach((doc) => {
          const fileName = doc.metadata?.fileName || 'Unknown'
          if (!groupedByFileName[fileName]) {
            groupedByFileName[fileName] = []
          }
          groupedByFileName[fileName].push(doc)
        })

        console.log(`📁 [IndexDocs] Grouped into ${Object.keys(groupedByFileName).length} files:`, Object.keys(groupedByFileName))

        // Convert grouped documents to IndexRow format
        // Each file becomes a parent row, chunks are children
        const rows: IndexRow[] = []
        Object.entries(groupedByFileName).forEach(([fileName, chunks]) => {
          // Add parent row for the file
          rows.push({
            chunk_id: `file_${fileName}`,
            parent_id: null,
            title: fileName,
            filepath: fileName,
            url: undefined,
            content: undefined,
            _contentLoaded: false,
            _contentLoading: false,
            _contentError: null,
            _isFileGroup: true,
            _chunkCount: chunks.length
          } as IndexRow & { _isFileGroup: boolean; _chunkCount: number })
          
          // Add child rows for each chunk
          chunks.forEach((chunk: VectorDocument) => {
            rows.push({
              chunk_id: chunk.id.toString(),
              parent_id: fileName,
              title: `${fileName} - Chunk ${chunk.metadata?.chunkIndex ?? '?'}`,
              filepath: fileName,
              url: undefined,
              content: undefined,
              _contentLoaded: false,
              _contentLoading: false,
              _contentError: null,
              _isFileGroup: false,
              metadata: chunk.metadata
            } as IndexRow & { _isFileGroup: boolean; metadata?: any })
          })
        })

        console.log(`✅ [IndexDocs] Created ${rows.length} rows (${Object.keys(groupedByFileName).length} file groups + ${allDocuments.length} chunks)`)
        setAllDocs(rows)
        setSkip(0)
        console.log(`✅ [IndexDocs] Loaded total ${allDocuments.length} chunks from ${Object.keys(groupedByFileName).length} files`)
      } else {
        // Use Azure for regular route
        console.log('🔍 Loading ALL index docs by paging…')
        const PAGE_SIZE = 100
        const HARD_CAP = 10000
        let acc: IndexRow[] = []
        let pageSkip = 0

        while (pageSkip < HARD_CAP) {
          const batch = await listIndexDocsRows({ top: PAGE_SIZE, skip: pageSkip })
          if (!Array.isArray(batch) || batch.length === 0) break
          
          const rows: IndexRow[] = batch.map(doc => ({
            ...doc,
            content: undefined,
            _contentLoaded: false,
            _contentLoading: false,
            _contentError: null,
          }))
          
          acc = acc.concat(rows)
          console.log(`📦 got ${rows.length} (acc: ${acc.length}) at skip=${pageSkip}`)
          if (batch.length < PAGE_SIZE) break
          pageSkip += PAGE_SIZE
        }

        setAllDocs(acc)
        setSkip(0)
        console.log(`✅ Loaded total ${acc.length} index docs`)
      }
    } catch (error) {
      console.error('Failed to load index docs:', error)
      setError(error instanceof RAGApiError ? error.message : currentT.loadError)
      setAllDocs([])
      setDocs([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Update row helper function
  const updateRow = (chunk_id: string, patch: Partial<IndexRow>) => {
    setAllDocs(prev => prev.map(r => (r.chunk_id === chunk_id ? { ...r, ...patch } : r)))
    setDocs(prev => prev.map(r => (r.chunk_id === chunk_id ? { ...r, ...patch } : r)))
    
    // selectedDoc도 함께 업데이트
    if (selectedDoc && selectedDoc.chunk_id === chunk_id) {
      setSelectedDoc(prev => prev ? { ...prev, ...patch } : null)
    }
  }

  // Ensure row content is loaded
  const ensureRowContent = async (row: IndexRow) => {
    if (row._contentLoaded || row._contentLoading) return
    
    updateRow(row.chunk_id, { _contentLoading: true, _contentError: null })
    
    try {
      if (isN8NRoute) {
        // Use Supabase for n8n route - fetch document by ID
        const { supabaseN8N } = await import('../../services/supabaseN8N')
        const { getSessionContext } = await import('../../services/ragManagementN8N')
        const { groupId } = await getSessionContext()
        
        let query = supabaseN8N
          .from('documents')
          .select('content')
          .eq('id', parseInt(row.chunk_id))
        
        if (groupId) {
          query = query.eq('metadata->>groupId', groupId)
        }
        
        const { data, error } = await query.single()
        
        if (error) {
          throw new Error(error.message)
        }
        
        const content = data?.content || ''
        updateRow(row.chunk_id, {
          content,
          _contentLoaded: true,
          _contentLoading: false,
        })
      } else {
        // Use Azure for regular route
        const content = await fetchChunkContentById(row.chunk_id)
        updateRow(row.chunk_id, {
          content,
          _contentLoaded: true,
          _contentLoading: false,
        })
      }
    } catch (e: any) {
      updateRow(row.chunk_id, {
        _contentLoading: false,
        _contentError: e?.message ?? "Failed to load content",
      })
    }
  }

  const handleViewContent = (doc: IndexRow) => {
    setSelectedDoc(doc)
  }

  // 모달이 열리면 자동으로 content 로드
  useEffect(() => {
    if (!selectedDoc) return

    let cancelled = false

    const loadContent = async () => {
      if (cancelled) return
      await ensureRowContent(selectedDoc)
    }

    loadContent()

    return () => {
      cancelled = true
    }
  }, [selectedDoc])

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedDoc) {
        setSelectedDoc(null)
      }
    }

    if (selectedDoc) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedDoc])

  const truncateContent = (content: string | null | undefined, maxLength: number = 100): string => {
    if (!content) return ''
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content
  }

  const formatChunkId = (chunkId: string | null | undefined): string => {
    if (!chunkId) return 'N/A'
    return chunkId.length > 30 ? chunkId.substring(0, 30) + '...' : chunkId
  }

  // Get sync status for a document
  const getSyncStatus = (parentId: string | null | undefined) => {
    if (!parentId) return 'unknown'
    
    if (isN8NRoute) {
      // For n8n route: check if fileName exists in storage files
      const fileName = parentId
      return n8nFiles.includes(fileName) ? 'synced' : 'unknown'
    } else {
      // For regular route: use the hook
      return statusByParentId.get(parentId) || 'unknown'
    }
  }

  // Render sync status badge
  const renderSyncStatus = (parentId: string | null | undefined) => {
    const status = getSyncStatus(parentId)
    
    const handleSyncClick = () => {
      // Navigate to Knowledge Management page with sync overview tab
      if (isN8NRoute) {
        navigate('/rag-n8n?tab=sync')
      } else {
        navigate('/rag-management?tab=sync')
      }
    }

    return (
      <SyncBadge
        status={status}
        onClick={handleSyncClick}
        disabled={isSyncLoading}
      />
    )
  }

  const handleRefresh = () => {
    loadAllIndexDocs()
  }

  // Grouped table component for n8n route
  const GroupedIndexTable = ({ 
    docs, 
    onViewContent, 
    renderSyncStatus, 
    formatChunkId,
    currentT 
  }: { 
    docs: IndexRow[]
    onViewContent: (doc: IndexRow) => void
    renderSyncStatus: (parentId: string | null | undefined) => JSX.Element
    formatChunkId: (chunkId: string | null | undefined) => string
    currentT: any
  }) => {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
    
    // Group docs by fileName (parent_id)
    const groupedDocs: Record<string, IndexRow[]> = {}
    const fileRows: IndexRow[] = []
    
    docs.forEach(doc => {
      if ((doc as any)._isFileGroup) {
        fileRows.push(doc)
      } else {
        const fileName = doc.parent_id || doc.filepath || 'Unknown'
        if (!groupedDocs[fileName]) {
          groupedDocs[fileName] = []
        }
        groupedDocs[fileName].push(doc)
      }
    })
    
    const toggleFile = (fileName: string) => {
      setExpandedFiles(prev => {
        const next = new Set(prev)
        if (next.has(fileName)) {
          next.delete(fileName)
        } else {
          next.add(fileName)
        }
        return next
      })
    }
    
    return (
      <table>
        <thead>
          <tr>
            <th style={{ width: '30px' }}></th>
            <th>{currentT.columnTitle}</th>
            <th>Chunks</th>
            <th>Sync</th>
            <th>{currentT.actions}</th>
          </tr>
        </thead>
        <tbody>
          {fileRows.map((fileRow) => {
            const fileName = fileRow.filepath || fileRow.title || ''
            const chunks = groupedDocs[fileName] || []
            const isExpanded = expandedFiles.has(fileName)
            const chunkCount = (fileRow as any)._chunkCount || chunks.length
            
            return (
              <>
                <tr key={fileRow.chunk_id} style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <td>
                    <button
                      onClick={() => toggleFile(fileName)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '14px'
                      }}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </td>
                  <td>
                    <strong>{fileName}</strong>
                  </td>
                  <td>{chunkCount} chunk{chunkCount !== 1 ? 's' : ''}</td>
                  <td>{renderSyncStatus(fileName)}</td>
                  <td></td>
                </tr>
                {isExpanded && chunks.map((chunk, idx) => (
                  <tr key={chunk.chunk_id} style={{ backgroundColor: 'var(--bg)' }}>
                    <td></td>
                    <td style={{ paddingLeft: '30px' }}>
                      Chunk {((chunk as any).metadata?.chunkIndex ?? idx + 1)}
                    </td>
                    <td className="chunk-id" title={chunk.chunk_id || ''}>
                      {formatChunkId(chunk.chunk_id)}
                    </td>
                    <td>{renderSyncStatus(fileName)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => onViewContent(chunk)}
                          title={currentT.view}
                          className="action-btn view-btn"
                        >
                          <IconEye />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="index-docs">
      <div className="index-header">
        <h2>{currentT.headingTitle}</h2>
        <p>{currentT.subtitle}</p>
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
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSkip(0) // 검색 시 첫 페이지로
              }}
              className="search-input"
              disabled={isLoading}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSkip(0)
                }}
                className="clear-search-btn"
                title={currentT.clearSearch}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        <div className="pagination-controls">
          <div className="pagination-info">
            <span>{currentT.totalItems}: {totalCount}</span>
            <span>
              {currentT.page} {totalCount === 0 ? 0 : Math.floor(skip / top) + 1} {currentT.of} {Math.max(1, Math.ceil(totalCount / top))}
            </span>
          </div>
          <div className="pagination-inputs">
            <label>
              {currentT.itemsPerPage}:
              <select
                value={top}
                onChange={(e) => {
                  setTop(Number(e.target.value))
                  setSkip(0) // 페이지 크기 바꾸면 첫 페이지로
                }}
                disabled={isLoading}
                className="pagination-select"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={150}>150</option>
                <option value={200}>200</option>
              </select>
            </label>
            <button
              onClick={() => setSkip(Math.max(0, skip - top))}
              disabled={isLoading || skip === 0}
              className="pagination-btn"
            >
              {currentT.previous}
            </button>
            <button
              onClick={() => setSkip(skip + top)}
              disabled={isLoading || skip + top >= totalCount}
              className="pagination-btn"
            >
              {currentT.next}
            </button>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="refresh-btn"
          disabled={isLoading}
        >
          <IconRefresh />
          {currentT.refresh}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-message">
          <IconAlertTriangle />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="loading-message">
          {currentT.loading}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <div className="docs-table">
          {docs.length === 0 ? (
            <div className="no-docs">
              <p>{currentT.noDocs}</p>
            </div>
          ) : isN8NRoute ? (
            // N8N Route: Grouped by fileName with expandable sections
            <GroupedIndexTable 
              docs={docs}
              onViewContent={handleViewContent}
              renderSyncStatus={renderSyncStatus}
              formatChunkId={formatChunkId}
              currentT={currentT}
            />
          ) : (
            // Regular Route: Original flat table
            <table>
              <thead>
                <tr>
                  <th>{currentT.columnTitle}</th>
                  <th>{currentT.parentId}</th>
                  <th>{currentT.chunkId}</th>
                  <th>URL</th>
                  <th>Sync</th>
                  <th>{currentT.actions}</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, index) => (
                  <tr key={doc.chunk_id || `doc-${index}`}>
                    <td title={doc.title || doc.filepath || ''}>
                      {doc.title || doc.filepath || 'N/A'}
                    </td>
                    <td title={doc.parent_id || ''}>
                      {doc.parent_id ? formatChunkId(doc.parent_id) : 'N/A'}
                    </td>
                    <td className="chunk-id" title={doc.chunk_id || ''}>
                      {formatChunkId(doc.chunk_id)}
                    </td>
                    <td>
                      {doc.url ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="url-link"
                          title="Open in new tab"
                          onClick={async (e) => {
                            try {
                              // Let the default behavior handle the link opening
                            } catch (error) {
                              e.preventDefault()
                              console.error('Failed to open URL:', error)
                              alert('링크를 열 수 없습니다. 파일이 삭제되었거나 접근 권한이 없을 수 있습니다.')
                            }
                          }}
                        >
                          🔗
                        </a>
                      ) : (
                        <span 
                          className="url-disabled" 
                          title="링크가 제공되지 않았습니다(스토리지 공개 액세스 불가)."
                        >
                          🔗
                        </span>
                      )}
                    </td>
                    <td>
                      {renderSyncStatus(doc.parent_id)}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleViewContent(doc)}
                          title={currentT.view}
                          className="action-btn view-btn"
                        >
                          <IconEye />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Content Modal */}
      {selectedDoc && (
        <div className="content-modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{currentT.contentPreview}</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedDoc(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="doc-info">
                <p><strong>{currentT.chunkId}:</strong> {selectedDoc.chunk_id || 'N/A'}</p>
                <p><strong>{currentT.parentId}:</strong> {selectedDoc.parent_id || 'N/A'}</p>
                <p><strong>{currentT.columnTitle}:</strong> {selectedDoc.title || 'N/A'}</p>
                <p><strong>{currentT.filepath}:</strong> {selectedDoc.filepath || 'N/A'}</p>
              </div>
              <div className="content-section">
                <h4>{currentT.fullContent}</h4>
                <div className="content-text">
                  {selectedDoc._contentLoading && (
                    <div className="content-loading">
                      <em>Loading content...</em>
                    </div>
                  )}
                  {selectedDoc._contentError && (
                    <div className="content-error">
                      <div className="error-message">
                        <IconAlertTriangle />
                        <span>{selectedDoc._contentError}</span>
                      </div>
                      <button 
                        className="retry-btn"
                        onClick={() => ensureRowContent(selectedDoc)}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {selectedDoc._contentLoaded && !selectedDoc._contentError && (
                    <pre className="content-pre">
                      {selectedDoc.content || "(empty)"}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}