import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IconUpload, IconTrash, IconRefresh, IconDownload, IconCheck, IconX, IconAlertTriangle } from '../ui/icons'
import {
  listBlobs,
  listDocuments,
  uploadBlob,
  deleteBlob,
  downloadBlob,
  uploadFiles,
  clearIndexByFile,
  reindexBlob,
  reindexBlobFallback
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
  sas_url?: string | null
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

const keyFromIndexDoc = (d: IndexDocument) => {
  // filepath가 있으면 그것을 사용 (가장 정확함)
  if (d.filepath) {
    return normalizeKey(d.filepath)
  }
  
  // URL에서 파일명 추출
  const urlFilename = filenameFromUrl(d.url)
  if (urlFilename) {
    return normalizeKey(urlFilename)
  }
  
  // title 사용
  if (d.title) {
    return normalizeKey(d.title)
  }
  
  return ''
}

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


  // 키 매칭 문제 해결: 인덱스 키를 blob 키와 매칭
  const matchedKeys = new Set<string>()
  const finalIdxMap = new Map<string, IndexDocument[]>()
  
  // 각 인덱스 문서에 대해 가장 적합한 blob 키를 찾기
  idxs.forEach(d => {
    const idxKey = keyFromIndexDoc(d)
    if (!idxKey) return
    
    // 정확한 매칭 시도
    if (blobMap.has(idxKey)) {
      matchedKeys.add(idxKey)
      if (!finalIdxMap.has(idxKey)) finalIdxMap.set(idxKey, [])
      finalIdxMap.get(idxKey)!.push(d)
      return
    }
    
    // 부분 매칭 시도 (파일명만 비교)
    const idxFilename = idxKey.split('/').pop() || idxKey
    for (const blobKey of blobMap.keys()) {
      const blobFilename = blobKey.split('/').pop() || blobKey
      if (idxFilename === blobFilename) {
        matchedKeys.add(blobKey)
        if (!finalIdxMap.has(blobKey)) finalIdxMap.set(blobKey, [])
        finalIdxMap.get(blobKey)!.push(d)
        return
      }
    }
    
    // 매칭되지 않은 경우 원래 키 사용
    matchedKeys.add(idxKey)
    if (!finalIdxMap.has(idxKey)) finalIdxMap.set(idxKey, [])
    finalIdxMap.get(idxKey)!.push(d)
  })

  const allKeys = new Set<string>([
    ...Array.from(blobMap.keys()),
    ...Array.from(matchedKeys)
  ])

  return Array.from(allKeys)
    .map(k => {
      const blob = blobMap.get(k)
      const group = finalIdxMap.get(k) || []
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
  
  // Sync Status 검색 상태
  const [syncSearchQuery, setSyncSearchQuery] = useState('')
  const [filteredSyncRows, setFilteredSyncRows] = useState<SyncRow[]>([])
  const [activeTab, setActiveTab] = useState<'file-library' | 'documents' | 'knowledge-index' | 'sync-overview'>('file-library')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [language, setLanguage] = useState<'en' | 'ko'>('en')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Sync refresh state
  const [isSyncLoading, setIsSyncLoading] = useState(false)
  const [lastSyncRefreshed, setLastSyncRefreshed] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({})

  // Radar data
  const [radarData, setRadarData] = useState<DailyRow[]>([])
  const [selectedRadarDate, setSelectedRadarDate] = useState<string>('')
  const [isLoadingRadarData, setIsLoadingRadarData] = useState(false)
  const [includeSimulatedData, setIncludeSimulatedData] = useState(true)
  const [estimationMode, setEstimationMode] = useState<EstimationMode>('simple')

  const isRAGManagementPage = location.pathname === '/rag-management'

  useEffect(() => { window.scrollTo(0, 0) }, [])

  // Handle URL query parameters for tab navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search)
    const tab = urlParams.get('tab')
    if (tab === 'sync' || tab === 'sync-overview') {
      setActiveTab('sync-overview')
    }
  }, [location.search])

  // Sync Status 검색 기능
  useEffect(() => {
    if (!syncSearchQuery.trim()) {
      setFilteredSyncRows(syncRows)
    } else {
      const query = syncSearchQuery.toLowerCase()
      const filtered = syncRows.filter(row => 
        row.key.toLowerCase().includes(query) ||
        row.blob?.name?.toLowerCase().includes(query) ||
        row.indexDocs.some(doc => 
          doc.title?.toLowerCase().includes(query) ||
          doc.filepath?.toLowerCase().includes(query)
        )
      )
      setFilteredSyncRows(filtered)
    }
  }, [syncSearchQuery, syncRows])

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
      title: 'Knowledge Management',
      subtitle: 'Manage files and knowledge base for AI chatbot',
      uploadArea: 'Drag files here to upload or click to select',
      refresh: 'Refresh',
      fileLibrary: 'File Library',
      documents: 'Documents',
      knowledgeIndex: 'Knowledge Index',
      syncOverview: 'Sync Overview',
      fileName: 'File Name',
      path: 'Path',
      size: 'Size',
      modified: 'Modified',
      actions: 'Actions',
      indexAction: 'Index',
      syncAction: 'Sync (Reindex)',
      unsyncAction: 'Unsync (Remove from Index)',
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
      title: '지식 관리',
      subtitle: 'AI 챗봇을 위한 파일 및 지식 베이스를 관리합니다',
      uploadArea: '파일을 드래그하여 업로드하거나 클릭하여 선택하세요',
      refresh: '새로고침',
      fileLibrary: '파일 라이브러리',
      documents: '문서',
      knowledgeIndex: '지식 인덱스',
      syncOverview: '동기화 개요',
      fileName: '파일명',
      path: '경로',
      size: '크기',
      modified: '수정일',
      actions: '액션',
      indexAction: '인덱싱',
      syncAction: '싱크 (재인덱싱)',
      unsyncAction: '언싱크 (인덱스에서 제거)',
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
      if (activeTab === 'sync-overview') refreshSync()
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

  const handleReindex = async (filepath: string) => {
    try {
      setIsSyncing(p => ({ ...p, [filepath]: true }))
      
      // Step 1: Clear existing chunks
      const clearRes = await clearIndexByFile(filepath)
      if (!clearRes.ok) {
        throw new Error(`Failed to clear old chunks: ${clearRes.error?.message || 'Unknown error'}`)
      }
      
      // Step 2: Reindex the blob
      const res = await reindexBlob(filepath, 1200, 200, false)
      if (!res.ok) {
        // Fallback: download and replace to trigger indexing
        const fb = await reindexBlobFallback(filepath)
        if (!fb.ok) throw new Error(fb.error?.message || 'Reindex failed')
        await refreshSync()
        alert(`Reindexed: ${filepath} (using fallback method)`)
        return
      }
      
      // Step 3: Show success with chunk count
      console.debug('🔍 Reindex response structure:', res)
      
      // Read from correct path: result.ingest for reindex operations
      const route = res?.route
      const ingest = res?.ingest as any // Type assertion for ingest object
      const ok = res?.ok && (ingest?.ok ?? ingest?.success ?? true)
      
      if (ok && route === 'reindex_file') {
        const created = Number(ingest?.chunks_created ?? 0)
        const deleted = Number(ingest?.deleted ?? 0)
        const fileName = ingest?.name ?? filepath
        
        console.debug('📊 Parsed counts:', { created, deleted, fileName })
        
        await refreshSync()
        
        // Show correct message based on actual counts
        let message = `Reindexed: ${fileName}\n`
        if (created > 0) {
          message += `Created: ${created} new chunks`
        } else {
          message += `Created: 0 new chunks`
        }
        if (deleted > 0) {
          message += `\nDeleted: ${deleted} old chunks`
        }
        
        alert(message)
      } else {
        // Handle error case
        const error = ingest?.error || res?.error || 'Unknown error'
        throw new Error(`Reindex failed: ${error}`)
      }
      
    } catch (err) {
      console.error(err)
      alert(`Failed to reindex: ${filepath}\n\nError: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsSyncing(p => ({ ...p, [filepath]: false }))
    }
  }

  const handleUnsync = async (filepath: string) => {
    if (!confirm(`Remove "${filepath}" from index?`)) return
    try {
      setIsSyncing(p => ({ ...p, [filepath]: true }))
      const res = await clearIndexByFile(filepath)
      if (!res.ok) throw new Error(res.error?.message || 'Unsync failed')
      await refreshSync()
      alert(`Removed from index: ${filepath}`)
    } catch (err) {
      console.error(err)
      alert(`Failed to unsync: ${filepath}`)
    } finally {
      setIsSyncing(p => ({ ...p, [filepath]: false }))
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
            {language === 'en' ? (
              <p>
                📋 <strong>Note:</strong> Files are stored in the <strong>File Library</strong>, while the
                <strong> Knowledge Index</strong> holds their searchable content. These can differ.
                Check the <strong>Sync Overview</strong> tab to see if they're in sync.
              </p>
            ) : (
              <p>
                📋 <strong>안내:</strong> 파일은 <strong>파일 라이브러리</strong>에 저장되고,
                <strong> 지식 인덱스</strong>에는 검색 가능한 내용이 보관됩니다. 두 영역은 서로
                다를 수 있으며, 동기화 여부는 <strong>동기화 개요</strong> 탭에서 확인할 수
                있습니다.
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${activeTab === 'file-library' ? 'active' : ''}`} onClick={() => {
              setActiveTab('file-library')
              loadData() // File Library 탭 클릭 시 전체 데이터 새로고침
            }}>{currentT.fileLibrary}</button>
            <button className={`tab ${activeTab === 'knowledge-index' ? 'active' : ''}`} onClick={() => {
              setActiveTab('knowledge-index')
              loadData() // Knowledge Index 탭 클릭 시 전체 데이터 새로고침
            }}>{currentT.knowledgeIndex}</button>
            <button className={`tab ${activeTab === 'sync-overview' ? 'active' : ''}`} onClick={() => {
              setActiveTab('sync-overview')
              refreshSync() // Sync Overview 탭 클릭 시 자동 새로고침
            }}>{currentT.syncOverview}</button>
          </div>

          {/* Content */}
          <div className="content">
            {isLoading ? (
              <div className="loading">{currentT.loading}</div>
            ) : (
              <>
                {activeTab === 'file-library' && <BlobFiles language={language} onUploadComplete={loadData} syncRows={syncRows} onNavigateToSync={() => setActiveTab('sync-overview')} />}

                {activeTab === 'knowledge-index' && <IndexDocs language={language} />}

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

                {activeTab === 'sync-overview' && (
                  <>
                    {/* Search Controls */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      margin: '8px 0 12px',
                      padding: '12px 24px 0 12px',
                      gap: '16px'
                    }}>
                      {/* Search */}
                      <div style={{ flex: 1, maxWidth: '400px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder={language === 'en' ? 'Search by filename...' : '파일명으로 검색...'}
                            value={syncSearchQuery}
                            onChange={(e) => setSyncSearchQuery(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              paddingRight: '32px',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text)',
                              fontSize: '0.875rem',
                              transition: 'all 0.2s ease'
                            }}
                            disabled={isSyncLoading}
                          />
                          {syncSearchQuery && (
                            <button
                              onClick={() => setSyncSearchQuery('')}
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                transition: 'all 0.2s ease',
                                fontSize: '12px',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title={language === 'en' ? 'Clear search' : '검색 지우기'}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Status and Refresh */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                        {filteredSyncRows.map(row => {
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
                                    <button 
                                      onClick={() => handleReindex(row.key)} 
                                      title={currentT.syncAction}
                                      disabled={isSyncing[row.key]}
                                    >
                                      {isSyncing[row.key] ? '⏳' : <IconRefresh />}
                                    </button>
                                  )}
                                  {syncStatus.indexExists && (
                                    <button 
                                      onClick={() => {
                                        const parentId = row.indexDocs[0]?.parent_id || row.key
                                        handleUnsync(parentId)
                                      }} 
                                      title={currentT.unsyncAction}
                                      disabled={isSyncing[row.key]}
                                    >
                                      {isSyncing[row.key] ? '⏳' : <IconX />}
                                    </button>
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