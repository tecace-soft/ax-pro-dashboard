import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IconUpload, IconTrash, IconRefresh, IconDownload, IconCheck, IconX, IconAlertTriangle } from '../ui/icons'
import { 
  listBlobs, 
  listDocuments, 
  uploadBlob, 
  deleteBlob, 
  downloadBlob, 
  getSyncStatus,
  uploadFiles 
} from '../services/ragManagement'
import { fetchDailyAggregatesWithMode, DailyRow, filterSimulatedData, EstimationMode } from '../services/dailyAggregates'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import '../styles/rag-management.css'

interface Document {
  name: string
  size: number
  last_modified: string
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

export default function RAGManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const [documents, setDocuments] = useState<Document[]>([])
  const [indexDocuments, setIndexDocuments] = useState<IndexDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'documents' | 'index' | 'sync'>('documents')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [topCount, setTopCount] = useState(100)
  const [language, setLanguage] = useState<'en' | 'ko'>('en')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Radar data for performance calculation
  const [radarData, setRadarData] = useState<DailyRow[]>([])
  const [selectedRadarDate, setSelectedRadarDate] = useState<string>('')
  const [isLoadingRadarData, setIsLoadingRadarData] = useState(false)
  const [includeSimulatedData, setIncludeSimulatedData] = useState(true)
  const [estimationMode, setEstimationMode] = useState<EstimationMode>('simple')

  // 현재 페이지가 RAG Management인지 확인
  const isRAGManagementPage = location.pathname === '/rag-management'

  // 페이지 로드 시 맨 위로 스크롤
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Load radar data for performance calculation
  useEffect(() => {
    const loadRadarData = async () => {
      setIsLoadingRadarData(true)
      try {
        const data = await fetchDailyAggregatesWithMode(estimationMode)
        setRadarData(data)
        if (data.length > 0) {
          setSelectedRadarDate(data[data.length - 1].Date)
        }
      } catch (error) {
        console.error('Failed to load radar data:', error)
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

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const scrollToSection = (sectionId: string) => {
    if (isRAGManagementPage) {
      // RAG Management 페이지에서는 Dashboard로 이동
      navigate(`/dashboard?section=${sectionId}`)
    } else {
      // Dashboard 페이지에서는 스크롤만 실행
      const element = document.getElementById(sectionId)
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }
    }
  }

  const handleFilterChange = (filter: string) => {
    console.log('Filter changed:', filter)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const scrollToConversations = () => {
    if (isRAGManagementPage) {
      // RAG Management 페이지에서는 Dashboard로 이동
      navigate('/dashboard?section=recent-conversations')
    } else {
      // Dashboard 페이지에서는 스크롤만 실행
      const conversationsElement = document.querySelector('.conversations-module')
      if (conversationsElement) {
        conversationsElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }
    }
  }

  // Language translations
  const t = {
    en: {
      title: 'RAG Management',
      subtitle: 'Manage documents and indexes for RAG-based chatbot',
      uploadArea: 'Drag files here to upload or click to select',
      searchPlaceholder: 'Search documents...',
      refresh: 'Refresh',
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
      blobStatus: {
        exists: '✅ Exists',
        notExists: '❌ Not Exists'
      }
    },
    ko: {
      title: 'RAG 관리',
      subtitle: 'RAG 기반 챗봇에 필요한 문서 및 인덱스를 관리합니다',
      uploadArea: '파일을 드래그하여 업로드하거나 클릭하여 선택하세요',
      searchPlaceholder: '문서 검색...',
      refresh: '새로고침',
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
      blobStatus: {
        exists: '✅ 있음',
        notExists: '❌ 없음'
      }
    }
  }

  const currentT = t[language]

  // Load documents and index data
  useEffect(() => {
    loadData()
  }, [topCount])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load blob documents
      const blobResponse = await listBlobs('')
      if (blobResponse.ok) {
        setDocuments(blobResponse.data?.items || [])
      }

      // Load index documents
      const indexResponse = await listDocuments({ 
        top: topCount,
        select: 'chunk_id,parent_id,title,filepath,url,content'
      })
      if (indexResponse.ok) {
        setIndexDocuments(indexResponse.data?.value || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Performance calculation (same as Dashboard)
  const filteredRadarData = filterSimulatedData(radarData, includeSimulatedData)
  const selectedRadarRow = filteredRadarData.find(row => row.Date === selectedRadarDate) || filteredRadarData[filteredRadarData.length - 1]

  const radarProps = selectedRadarRow ? {
    relevance: Math.round(selectedRadarRow["Answer Relevancy"] * 100),
    tone: Math.round(selectedRadarRow.Tone * 100),
    length: Math.round(selectedRadarRow.Length * 100),
    accuracy: Math.round(selectedRadarRow["Answer Correctness"] * 100),
    toxicity: Math.round(selectedRadarRow.Toxicity * 100),
    promptInjection: Math.round(selectedRadarRow["Prompt Injection"] * 100)
  } : {
    relevance: 85,
    tone: 78,
    length: 82,
    accuracy: 92,
    toxicity: 95,
    promptInjection: 88
  }

  // Calculate overall performance score
  const performanceScore = Math.round(
    (radarProps.relevance + radarProps.tone + radarProps.length + 
     radarProps.accuracy + radarProps.toxicity + radarProps.promptInjection) / 6
  )

  // Format radar date (M/D format)
  const formatRadarDate = (dateString: string) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-').map(Number)
    return `${month}/${day}`
  }

  const performanceDate = formatRadarDate(selectedRadarDate)

  const getSyncStatus = (doc: Document): SyncStatus => {
    const blobExists = documents.some(d => d.name === doc.name)
    const indexExists = indexDocuments.some(d => d.filepath === doc.name)
    
    if (blobExists && indexExists) return { blobExists: true, indexExists: true, status: 'synced' }
    if (blobExists && !indexExists) return { blobExists: true, indexExists: false, status: 'needs_indexing' }
    if (!blobExists && indexExists) return { blobExists: false, indexExists: true, status: 'orphaned' }
    return { blobExists: false, indexExists: false, status: 'orphaned' }
  }

  const handleFileUpload = async (files: FileList) => {
    setIsLoading(true)
    try {
      const { success, failed } = await uploadFiles(files)
      
      if (success.length > 0) {
        console.log('Successfully uploaded:', success)
        loadData() // Refresh data
      }
      
      if (failed.length > 0) {
        console.error('Failed uploads:', failed)
        alert(`Failed to upload: ${failed.map(f => f.name).join(', ')}`)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (filepath: string) => {
    if (!confirm(currentT.confirmDelete)) return
    
    try {
      const response = await deleteBlob(filepath)
      if (response.ok) {
        loadData() // Refresh data
      } else {
        alert(`${currentT.deleteFailed} ${response.error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
      alert(currentT.deleteError)
    }
  }

  const handleIndex = async (filepath: string) => {
    try {
      // This would trigger reindexing - implementation depends on backend
      console.log('Indexing file:', filepath)
      // For now, just refresh data
      loadData()
    } catch (error) {
      console.error('Failed to index file:', error)
    }
  }

  const handleDownload = async (filepath: string) => {
    try {
      const response = await downloadBlob(filepath)
      if (response.ok && response.data?.content) {
        const blob = new Blob([response.data.content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filepath
        a.click()
        URL.revokeObjectURL(url)
      } else {
        alert(`${currentT.downloadFailed} ${response.error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to download file:', error)
      alert(currentT.downloadError)
    }
  }

  const filteredDocuments = documents.filter(doc => 
    (doc.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

  const filteredIndexDocuments = indexDocuments.filter(doc => 
    (doc.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (doc.filepath?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

  const getStatusIcon = (status: SyncStatus) => {
    switch (status.status) {
      case 'synced':
        return <IconCheck className="status-icon synced" />
      case 'needs_indexing':
        return <IconAlertTriangle className="status-icon needs-indexing" />
      case 'orphaned':
        return <IconX className="status-icon orphaned" />
      default:
        return null
    }
  }

  const getStatusText = (status: SyncStatus) => {
    switch (status.status) {
      case 'synced':
        return currentT.status.synced
      case 'needs_indexing':
        return currentT.status.needsIndexing
      case 'orphaned':
        return currentT.status.orphaned
      default:
        return currentT.status.unknown
    }
  }

  const currentTime = new Date().toLocaleString('en-US', {
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
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
                <button 
                  className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
                <button 
                  className={`lang-btn ${language === 'ko' ? 'active' : ''}`}
                  onClick={() => setLanguage('ko')}
                >
                  KO
                </button>
              </div>
            </div>
          </div>

      {/* File Upload Area */}
      <div className="upload-section">
        <div 
          className="upload-area"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            handleFileUpload(e.dataTransfer.files)
          }}
        >
          <IconUpload className="upload-icon" />
          <p>{currentT.uploadArea}</p>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            className="file-input"
          />
        </div>
      </div>

      {/* Search and Controls */}
      <div className="controls-section">
        <div className="search-box">
          <input
            type="text"
            placeholder={currentT.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="view-controls">
          <select
            value={topCount}
            onChange={(e) => setTopCount(Number(e.target.value))}
            className="count-select"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>All</option>
          </select>
          <button onClick={loadData} className="refresh-btn">
            <IconRefresh />
            {currentT.refresh}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          {currentT.documents} ({documents.length})
        </button>
        <button
          className={`tab ${activeTab === 'index' ? 'active' : ''}`}
          onClick={() => setActiveTab('index')}
        >
          {currentT.index} ({indexDocuments.length})
        </button>
        <button
          className={`tab ${activeTab === 'sync' ? 'active' : ''}`}
          onClick={() => setActiveTab('sync')}
        >
          {currentT.sync}
        </button>
      </div>

      {/* Content */}
      <div className="content">
        {isLoading ? (
          <div className="loading">{currentT.loading}</div>
        ) : (
          <>
            {activeTab === 'documents' && (
              <div className="documents-table">
                <table>
                  <thead>
                    <tr>
                      <th>{currentT.fileName}</th>
                      <th>{currentT.path}</th>
                      <th>{currentT.size}</th>
                      <th>{currentT.modified}</th>
                      <th>{currentT.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.name}>
                        <td>{doc.name}</td>
                        <td>{doc.name}</td>
                        <td>{doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : '-'}</td>
                        <td>{doc.last_modified ? new Date(doc.last_modified).toLocaleDateString() : '-'}</td>
                        <td>
                          <div className="action-buttons">
                            <button onClick={() => handleIndex(doc.name)} title={currentT.indexAction}>
                              <IconRefresh />
                            </button>
                            <button onClick={() => handleDownload(doc.name)} title={currentT.downloadAction}>
                              <IconDownload />
                            </button>
                            <button onClick={() => handleDelete(doc.name)} title={currentT.deleteAction}>
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'index' && (
              <div className="index-table">
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
                    {filteredIndexDocuments.map((doc) => (
                      <tr key={doc.chunk_id}>
                        <td>{doc.title || 'N/A'}</td>
                        <td>{doc.filepath || 'N/A'}</td>
                        <td title={doc.chunk_id}>{doc.chunk_id}</td>
                        <td title={doc.parent_id || ''}>{doc.parent_id || 'N/A'}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              onClick={() => doc.filepath && handleDownload(doc.filepath)} 
                              title={currentT.downloadAction}
                              disabled={!doc.filepath}
                            >
                              <IconDownload />
                            </button>
                            <button 
                              onClick={() => doc.filepath && handleDelete(doc.filepath)} 
                              title={currentT.deleteAction}
                              disabled={!doc.filepath}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'sync' && (
              <div className="sync-table">
                <table>
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Blob Status</th>
                      <th>Index Status</th>
                      <th>Sync Status</th>
                      <th>{currentT.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set([...documents.map(d => d.name), ...indexDocuments.map(d => d.filepath)])).map((filepath) => {
                      const doc = documents.find(d => d.name === filepath)
                      const indexDoc = indexDocuments.find(d => d.filepath === filepath)
                      const syncStatus = getSyncStatus(doc || { name: filepath, size: 0, last_modified: '' } as Document)
                      
                      return (
                        <tr key={filepath}>
                          <td>{doc?.name || indexDoc?.title || filepath}</td>
                          <td>{syncStatus.blobExists ? currentT.blobStatus.exists : currentT.blobStatus.notExists}</td>
                          <td>{syncStatus.indexExists ? currentT.blobStatus.exists : currentT.blobStatus.notExists}</td>
                          <td>
                            <div className="sync-status">
                              {getStatusIcon(syncStatus)}
                              <span>{getStatusText(syncStatus)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              {syncStatus.status === 'needs_indexing' && (
                                <button onClick={() => handleIndex(filepath)} title={currentT.indexAction}>
                                  <IconRefresh />
                                </button>
                              )}
                              {syncStatus.blobExists && (
                                <button onClick={() => handleDownload(filepath)} title={currentT.downloadAction}>
                                  <IconDownload />
                                </button>
                              )}
                              {syncStatus.blobExists && (
                                <button onClick={() => handleDelete(filepath)} title={currentT.deleteAction}>
                                  <IconTrash />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
        </div>
      </div>
    </div>
  )
}
