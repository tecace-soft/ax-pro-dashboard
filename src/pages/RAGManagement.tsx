import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IconUpload, IconTrash, IconRefresh, IconDownload, IconCheck, IconX, IconAlertTriangle } from '../ui/icons'
import {
  listBlobs,
  listDocuments,
  uploadBlob,
  deleteBlob,
  downloadBlob,
  uploadFiles
} from '../services/ragManagement'
import { fetchDailyAggregatesWithMode, DailyRow, filterSimulatedData, EstimationMode } from '../services/dailyAggregates'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import BlobFiles from './RagManagement/BlobFiles'
import IndexDocs from './RagManagement/IndexDocs'
import '../styles/rag-management.css'

interface Document {
  name: string
  size: number
  last_modified: string
  url?: string
}

interface IndexDocument {
  chunk_id: string
  parent_id?: string | null
  title?: string | null
  filepath?: string | null
  url?: string
  content?: string
}

interface SyncStatus {
  blobExists: boolean
  indexExists: boolean
  status: 'synced' | 'needs_indexing' | 'orphaned'
}

/* ---------- Sync helpers & row type ---------- */
interface SyncRow {
  key: string;                  // unified file key
  blob?: Document | null;       // blob file (if exists)
  indexDocs: IndexDocument[];   // all index rows for the file
  indexCount: number;           // chunk count
  status: 'synced' | 'needs_indexing' | 'orphaned';
}

const filenameFromUrl = (url?: string) => {
  if (!url) return ''
  try {
    const u = new URL(url)
    return decodeURIComponent(u.pathname.split('/').pop() || '')
  } catch {
    const parts = (url || '').split('?')[0].split('/')
    return decodeURIComponent(parts.pop() || '')
  }
}

const normalizeKey = (s?: string | null) => (s || '').trim()

const keyFromIndexDoc = (d: IndexDocument) =>
  normalizeKey(d.filepath) ||
  normalizeKey(filenameFromUrl(d.url)) ||
  normalizeKey(d.title) ||
  ''

const computeSyncStatus = (blob: Document | undefined, idxDocs: IndexDocument[]): SyncStatus => {
  const blobExists = !!blob
  const indexExists = idxDocs.length > 0

  if (blobExists && indexExists) return { blobExists, indexExists, status: 'synced' }
  if (blobExists && !indexExists) return { blobExists, indexExists, status: 'needs_indexing' }
  if (!blobExists && indexExists) return { blobExists, indexExists, status: 'orphaned' }
  return { blobExists, indexExists, status: 'orphaned' }
}

const buildSyncRows = (blobs: Document[], idxs: IndexDocument[]): SyncRow[] => {
  const blobMap = new Map<string, Document>()
  blobs.forEach(b => blobMap.set(normalizeKey(b.name), b))

  const idxMap = new Map<string, IndexDocument[]>()
  idxs.forEach(d => {
    const k = keyFromIndexDoc(d)
    if (!k) return
    if (!idxMap.has(k)) idxMap.set(k, [])
    idxMap.get(k)!.push(d)
  })

  const allKeys = new Set<string>([
    ...Array.from(blobMap.keys()),
    ...Array.from(idxMap.keys())
  ])

  return Array.from(allKeys)
    .map(k => {
      const blob = blobMap.get(k)
      const group = idxMap.get(k) || []
      const status = computeSyncStatus(blob, group).status
      return { key: k, blob: blob ?? null, indexDocs: group, indexCount: group.length, status }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}
/* -------------------------------------------- */

export default function RAGManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const [documents, setDocuments] = useState<Document[]>([])
  const [indexDocuments, setIndexDocuments] = useState<IndexDocument[]>([])
  const [syncRows, setSyncRows] = useState<SyncRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'blob-files' | 'documents' | 'index' | 'sync'>('blob-files')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [language, setLanguage] = useState<'en' | 'ko'>('en')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Sync refresh state
  const [isSyncLoading, setIsSyncLoading] = useState(false)
  const [lastSyncRefreshed, setLastSyncRefreshed] = useState<Date | null>(null)

  // Radar data
  const [radarData, setRadarData] = useState<DailyRow[]>([])
  const [selectedRadarDate, setSelectedRadarDate] = useState<string>('')
  const [isLoadingRadarData, setIsLoadingRadarData] = useState(false)
  const [includeSimulatedData, setIncludeSimulatedData] = useState(true)
  const [estimationMode, setEstimationMode] = useState<EstimationMode>('simple')

  const isRAGManagementPage = location.pathname === '/rag-management'

  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    const loadRadarData = async () => {
      setIsLoadingRadarData(true)
      try {
        const data = await fetchDailyAggregatesWithMode(estimationMode)
        setRadarData(data)
        if (data.length > 0) setSelectedRadarDate(data[data.length - 1].Date)
      } catch (e) {
        console.error('Failed to load radar data:', e)
      } finally {
        setIsLoadingRadarData(false)
      }
    }
    loadRadarData()
  }, [estimationMode])

  const signOut = () => {
    localStorage.removeItem('authToken')
    sessionStorage.removeItem('axAccess')
    navigate('/', { replace: true })
  }

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed)

  const scrollToSection = (sectionId: string) => {
    if (isRAGManagementPage) {
      navigate(`/dashboard?section=${sectionId}`)
    } else {
      const el = document.getElementById(sectionId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleFilterChange = (filter: string) => console.log('Filter changed:', filter)
  const handleSearch = (_query: string) => {}

  const scrollToConversations = () => {
    if (isRAGManagementPage) {
      navigate('/dashboard?section=recent-conversations')
    } else {
      document.querySelector('.conversations-module')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const t = {
    en: {
      title: 'RAG Management',
      subtitle: 'Manage documents and indexes for RAG-based chatbot',
      uploadArea: 'Drag files here to upload or click to select',
      refresh: 'Refresh',
      blobFiles: 'Blob Files',
      documents: 'Documents',
      index: 'Index',
      sync: 'Sync Status',
      fileName: 'File Name',
      path: 'Path',
      size: 'Size',
      modified: 'Modified',
      actions: 'Actions',
      indexAction: 'Index',
      downloadAction: 'Download',
      deleteAction: 'Delete',
      loading: 'Loading...',
      confirmDelete: 'Are you sure you want to delete this file?',
      uploadSuccess: 'Successfully uploaded:',
      uploadFailed: 'Failed to upload:',
      deleteFailed: 'Failed to delete file:',
      downloadFailed: 'Failed to download file:',
      uploadError: 'Upload failed. Please try again.',
      deleteError: 'Failed to delete file. Please try again.',
      downloadError: 'Failed to download file. Please try again.',
      status: {
        synced: 'Synced',
        needsIndexing: 'Needs Indexing',
        orphaned: 'Orphaned Index',
        unknown: 'Unknown'
      },
      blobStatus: { exists: '✅ Exists', notExists: '❌ Not Exists' }
    },
    ko: {
      title: 'RAG 관리',
      subtitle: 'RAG 기반 챗봇에 필요한 문서 및 인덱스를 관리합니다',
      uploadArea: '파일을 드래그하여 업로드하거나 클릭하여 선택하세요',
      refresh: '새로고침',
      blobFiles: 'Blob 파일',
      documents: '문서',
      index: '인덱스',
      sync: '싱크 상태',
      fileName: '파일명',
      path: '경로',
      size: '크기',
      modified: '수정일',
      actions: '액션',
      indexAction: '인덱싱',
      downloadAction: '다운로드',
      deleteAction: '삭제',
      loading: '로딩 중...',
      confirmDelete: '정말로 이 파일을 삭제하시겠습니까?',
      uploadSuccess: '성공적으로 업로드됨:',
      uploadFailed: '업로드 실패:',
      deleteFailed: '파일 삭제 실패:',
      downloadFailed: '파일 다운로드 실패:',
      uploadError: '업로드에 실패했습니다. 다시 시도해주세요.',
      deleteError: '파일 삭제에 실패했습니다. 다시 시도해주세요.',
      downloadError: '파일 다운로드에 실패했습니다. 다시 시도해주세요.',
      status: {
        synced: '정상',
        needsIndexing: '인덱싱 필요',
        orphaned: '고아 인덱스',
        unknown: '알 수 없음'
      },
      blobStatus: { exists: '✅ 있음', notExists: '❌ 없음' }
    }
  }
  const currentT = t[language]

  useEffect(() => { loadData() }, [])

  // Auto-refresh sync when window regains focus on sync tab
  useEffect(() => {
    const onFocus = () => {
      if (activeTab === 'sync') refreshSync()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [activeTab])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // blobs
      const blobResponse = await listBlobs('')
      const blobs: Document[] = blobResponse.ok ? (blobResponse.data?.items || []) : []

      // index (metadata rows)
      const indexResponse = await listDocuments({ top: 100, select: 'chunk_id,parent_id,title,filepath,url' })
      const idxs: IndexDocument[] = indexResponse.ok ? (indexResponse.data?.value || []) : []

      setDocuments(blobs)
      setIndexDocuments(idxs)
      setSyncRows(buildSyncRows(blobs, idxs))
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshSync = async () => {
    setIsSyncLoading(true)
    try {
      const blobResponse = await listBlobs('')
      const blobs = blobResponse.ok ? (blobResponse.data?.items || []) : []

      const indexResponse = await listDocuments({ 
        top: 1000,        // 한 번에 많이 당겨와도 되고
        select: 'chunk_id,parent_id,title,filepath,url'
      })
      const idxs = indexResponse.ok ? (indexResponse.data?.value || []) : []

      setDocuments(blobs)
      setIndexDocuments(idxs)
      setSyncRows(buildSyncRows(blobs, idxs))
      setLastSyncRefreshed(new Date())
    } catch (e) {
      console.error('Sync refresh failed:', e)
    } finally {
      setIsSyncLoading(false)
    }
  }

  // --- Performance cards (unchanged) ---
  const filteredRadarData = filterSimulatedData(radarData, includeSimulatedData)
  const selectedRadarRow = filteredRadarData.find(row => row.Date === selectedRadarDate) || filteredRadarData[filteredRadarData.length - 1]
  const radarProps = selectedRadarRow ? {
    relevance: Math.round(selectedRadarRow["Answer Relevancy"] * 100),
    tone: Math.round(selectedRadarRow.Tone * 100),
    length: Math.round(selectedRadarRow.Length * 100),
    accuracy: Math.round(selectedRadarRow["Answer Correctness"] * 100),
    toxicity: Math.round(selectedRadarRow.Toxicity * 100),
    promptInjection: Math.round(selectedRadarRow["Prompt Injection"] * 100)
  } : { relevance: 85, tone: 78, length: 82, accuracy: 92, toxicity: 95, promptInjection: 88 }

  const performanceScore = Math.round(
    (radarProps.relevance + radarProps.tone + radarProps.length + radarProps.accuracy + radarProps.toxicity + radarProps.promptInjection) / 6
  )

  const formatRadarDate = (dateString: string) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-').map(Number)
    return `${month}/${day}`
  }
  const performanceDate = formatRadarDate(selectedRadarDate)

  const handleFileUpload = async (files: FileList) => {
    setIsLoading(true)
    try {
      const { success, failed } = await uploadFiles(files)
      if (success.length > 0) loadData()
      if (failed.length > 0) alert(`Failed to upload: ${failed.map(f => f.name).join(', ')}`)
    } catch (e) {
      console.error('Upload failed:', e)
      alert('Upload failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (filepath: string) => {
    const fileName = filepath.split('/').pop() || filepath
    if (!confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`)) return
    try {
      const res = await deleteBlob(filepath)
      if (res.ok) {
        loadData()
        alert(`Successfully deleted: ${fileName}`)
      } else {
        alert(`Failed to delete file: ${res.error?.message || 'Unknown error'}`)
      }
    } catch (e) {
      console.error('Failed to delete file:', e)
      alert('Failed to delete file. Please try again.')
    }
  }

  const handleIndex = async (filepath: string) => {
    try {
      console.log('Indexing file:', filepath)
      // TODO: wire to reindex backend
      loadData()
    } catch (e) {
      console.error('Failed to index file:', e)
    }
  }

  const handleDownload = async (filepath: string) => {
    try {
      const fileName = filepath.split('/').pop() || filepath
      if (indexDocuments.some(doc => doc.filepath === filepath)) {
        alert(`Cannot download "${fileName}" directly.\n\nThis document is indexed but the original file content is not available for download.`)
        return
      }
      const res = await downloadBlob(filepath)
      if (res.ok && res.data?.content) {
        const ext = fileName.split('.').pop()?.toLowerCase()
        let mimeType = 'application/octet-stream'
        if (ext === 'txt') mimeType = 'text/plain'
        if (ext === 'pdf') mimeType = 'application/pdf'
        if (ext === 'doc') mimeType = 'application/msword'
        if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        const blob = new Blob([res.data.content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
        alert(`Downloaded: ${fileName}`)
      } else {
        alert(`Failed to download file: ${res.error?.message || 'Unknown error'}`)
      }
    } catch (e) {
      console.error('Failed to download file:', e)
      alert('Failed to download file. Please try again.')
    }
  }

  const getStatusIcon = (status: SyncStatus) => {
    switch (status.status) {
      case 'synced': return <IconCheck className="status-icon synced" />
      case 'needs_indexing': return <IconAlertTriangle className="status-icon needs-indexing" />
      case 'orphaned': return <IconX className="status-icon orphaned" />
      default: return null
    }
  }

  const getStatusText = (status: SyncStatus) => {
    switch (status.status) {
      case 'synced': return currentT.status.synced
      case 'needs_indexing': return currentT.status.needsIndexing
      case 'orphaned': return currentT.status.orphaned
      default: return currentT.status.unknown
    }
  }

  const currentTime = new Date().toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })

  return (
    <div className="rag-management-layout">
      <Header performanceScore={performanceScore} performanceDate={performanceDate} currentTime={currentTime} onSignOut={signOut} />
      <div className="rag-content">
        <Sidebar
          conversations={0}
          satisfaction={94.5}
          documents={documents.length}
          performanceScore={performanceScore}
          performanceDate={performanceDate}
          activeFilters={[]}
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onScrollToConversations={scrollToConversations}
          onScrollToSection={scrollToSection}
          sessions={[]}
          sessionRequests={{}}
          requestDetails={{}}
        />

        <div className={`rag-management ${sidebarCollapsed ? 'with-sidebar collapsed' : 'with-sidebar'}`}>
          <div className="rag-header">
            <div className="header-content">
              <div>
                <h1>{currentT.title}</h1>
                <p>{currentT.subtitle}</p>
              </div>
              <div className="language-toggle">
                <button className={`lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>EN</button>
                <button className={`lang-btn ${language === 'ko' ? 'active' : ''}`} onClick={() => setLanguage('ko')}>KO</button>
              </div>
            </div>
          </div>

          {/* Guidance Banner */}
          <div className="guidance-banner">
            <p>📋 <strong>Note:</strong> Document Files = Blob File Storage / Index = Search Index. They may differ, and sync status will be shown under Sync Status tab.</p>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${activeTab === 'blob-files' ? 'active' : ''}`} onClick={() => setActiveTab('blob-files')}>Document Files</button>
            <button className={`tab ${activeTab === 'index' ? 'active' : ''}`} onClick={() => setActiveTab('index')}>{currentT.index} (Search Service)</button>
            <button className={`tab ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => setActiveTab('sync')}>{currentT.sync}</button>
          </div>

          {/* Content */}
          <div className="content">
            {isLoading ? (
              <div className="loading">{currentT.loading}</div>
            ) : (
              <>
                {activeTab === 'blob-files' && <BlobFiles language={language} />}

                {activeTab === 'index' && <IndexDocs language={language} />}

                {activeTab === 'documents' && (
                  <div className="documents-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>File Path</th>
                          <th>Chunk ID</th>
                          <th>Parent ID</th>
                          <th>{currentT.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indexDocuments.map((doc) => (
                          <tr key={doc.chunk_id}>
                            <td>{doc.title || 'N/A'}</td>
                            <td>{doc.filepath || 'N/A'}</td>
                            <td title={doc.chunk_id}>{doc.chunk_id}</td>
                            <td title={doc.parent_id || ''}>{doc.parent_id || 'N/A'}</td>
                            <td>
                              <div className="action-buttons">
                                <button onClick={() => doc.filepath && handleDownload(doc.filepath)} title="Download (metadata only)" disabled={!doc.filepath}><IconDownload /></button>
                                <button onClick={() => doc.filepath && handleDelete(doc.filepath)} title="Delete from index" disabled={!doc.filepath}><IconTrash /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'sync' && (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      margin: '8px 0 12px'
                    }}>
                      <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                        {lastSyncRefreshed
                          ? `Last updated: ${lastSyncRefreshed.toLocaleString()}`
                          : '—'}
                      </div>
                      <button
                        onClick={refreshSync}
                        disabled={isSyncLoading}
                        className="pagination-btn"
                        title={currentT.refresh}
                        style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
                      >
                        <IconRefresh />
                        {isSyncLoading ? currentT.loading : currentT.refresh}
                      </button>
                    </div>
                    <div className="sync-table">
                    <table>
                      <thead>
                        <tr>
                          <th>{currentT.fileName}</th>
                          <th>Blob Status / Last Modified</th>
                          <th>Index Status / Chunks</th>
                          <th>Sync Status</th>
                          <th>{currentT.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncRows.map(row => {
                          const blob = row.blob || undefined
                          const syncStatus: SyncStatus = computeSyncStatus(blob, row.indexDocs)
                          return (
                            <tr key={row.key}>
                              <td title={row.key}>{blob?.name || row.key}</td>
                              <td>
                                {syncStatus.blobExists
                                  ? `✅ ${blob?.last_modified ? new Date(blob.last_modified).toLocaleString() : ''}`
                                  : '❌ Not Exists'}
                              </td>
                              <td>
                                {syncStatus.indexExists
                                  ? `✅ ${row.indexCount} chunk${row.indexCount !== 1 ? 's' : ''}`
                                  : '❌ Not Exists'}
                              </td>
                              <td>
                                <div className="sync-status">
                                  {getStatusIcon(syncStatus)}
                                  <span>{(() => {
                                    switch (syncStatus.status) {
                                      case 'synced': return currentT.status.synced
                                      case 'needs_indexing': return currentT.status.needsIndexing
                                      case 'orphaned': return currentT.status.orphaned
                                      default: return currentT.status.unknown
                                    }
                                  })()}</span>
                                </div>
                              </td>
                              <td>
                                <div className="action-buttons">
                                  {syncStatus.status === 'needs_indexing' && (
                                    <button onClick={() => handleIndex(row.key)} title={currentT.indexAction}><IconRefresh /></button>
                                  )}
                                  {syncStatus.blobExists && row.blob?.url && (
                                    <button onClick={() => window.open(row.blob!.url as string, '_blank')} title={currentT.downloadAction}><IconDownload /></button>
                                  )}
                                  {syncStatus.blobExists && (
                                    <button onClick={() => handleDelete(row.key)} title={currentT.deleteAction}><IconTrash /></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}