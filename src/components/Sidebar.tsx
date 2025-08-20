import { 
  IconSearch, 
  IconMessage, 
  IconHistory, 
  IconEdit, 
  IconDatabase, 
  IconMegaphone, 
  IconSettings,
  IconChevronRight,
  IconCamera,
  IconPalette,
  IconSave,
  IconX,
  IconUser
} from '../ui/icons'
import { useState } from 'react'

interface SidebarProps {
  conversations: number
  satisfaction: number
  documents: number
  activeFilters: string[]
  onFilterChange: (filter: string) => void
  onSearch: (query: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onScrollToConversations: () => void
  onScrollToSection: (sectionId: string) => void
  // 실제 데이터 검색을 위한 props 추가
  sessions: any[]
  sessionRequests: Record<string, any[]>
  requestDetails: Record<string, any>
}

export default function Sidebar({ 
  conversations, 
  satisfaction, 
  documents, 
  activeFilters, 
  onFilterChange, 
  onSearch,
  isCollapsed,
  onToggleCollapse,
  onScrollToConversations,
  onScrollToSection,
  sessions,
  sessionRequests,
  requestDetails
}: SidebarProps) {
  // 검색 관련 상태 추가
  const [searchQuery, setSearchQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'HR policies',
    'Leave management', 
    'Performance reviews',
    'Benefits enrollment'
  ])
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([])
  
  // 검색 범위 선택 상태 추가
  const [searchScope, setSearchScope] = useState<'all' | 'conversations' | 'feedback' | 'knowledge'>('all')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // 검색 범위 옵션
  const searchScopes = [
    { id: 'all', label: 'All Sources', icon: '🔍', description: 'Search everywhere' },
    { id: 'conversations', label: 'Recent Conversations', icon: '💬', description: 'Search chat history' },
    { id: 'feedback', label: 'User Feedback', icon: '📝', description: 'Search feedback data' },
    { id: 'knowledge', label: 'Knowledge Base', icon: '📚', description: 'Search documents & policies' }
  ]

  // 검색 실행 함수 - 범위별 검색
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const newSearch = searchQuery.trim()
      
      // 새로운 검색어를 recent searches에 추가
      if (!recentSearches.includes(newSearch)) {
        setRecentSearches(prev => [newSearch, ...prev.slice(0, 9)])
      }
      
      // 검색 시작
      setIsSearching(true)
      setShowSearchResults(true)
      
      try {
        const results = await searchInScope(newSearch, searchScope)
        setSearchResults(results)
      } catch (error) {
        console.error('Search failed:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
      
      setSearchQuery('')
    }
  }

  // 범위별 검색 함수
  const searchInScope = async (query: string, scope: string) => {
    const results: any[] = []
    
    switch (scope) {
      case 'conversations':
        // Recent Conversations에서만 검색
        return await searchConversations(query)
        
      case 'feedback':
        // User Feedback에서만 검색 (아직 구현되지 않음)
        return await searchFeedback(query)
        
      case 'knowledge':
        // Knowledge Base에서만 검색 (아직 구현되지 않음)
        return await searchKnowledge(query)
        
      case 'all':
      default:
        // 모든 소스에서 검색
        const [convResults, feedbackResults, knowledgeResults] = await Promise.all([
          searchConversations(query),
          searchFeedback(query),
          searchKnowledge(query)
        ])
        return [...convResults, ...feedbackResults, ...knowledgeResults]
    }
  }

  // Recent Conversations 검색
  const searchConversations = async (query: string) => {
    const results: any[] = []
    
    sessions.forEach(session => {
      const sessionId = session.sessionId || session.id
      const requests = sessionRequests[sessionId] || []
      
      requests.forEach(request => {
        const requestId = request.requestId || request.id
        const detail = requestDetails[requestId]
        
        const userMessage = detail?.userMessage || request.userMessage || request.message || ''
        const aiResponse = detail?.aiResponse || ''
        
        const queryLower = query.toLowerCase()
        const userMatch = userMessage.toLowerCase().includes(queryLower)
        const aiMatch = aiResponse.toLowerCase().includes(queryLower)
        
        if (userMatch || aiMatch) {
          results.push({
            id: `${sessionId}-${requestId}`,
            sessionId: sessionId,
            userMessage: userMessage,
            aiResponse: aiResponse,
            timestamp: request.createdAt ? new Date(request.createdAt).toLocaleString() : 'No timestamp',
            matchType: userMatch ? 'userMessage' : 'aiResponse',
            source: 'conversations',
            session: session,
            request: request
          })
        }
      })
    })
    
    return results
  }

  // User Feedback 검색 (향후 구현)
  const searchFeedback = async (query: string) => {
    // TODO: User Feedback 데이터에서 검색 구현
    return []
  }

  // Knowledge Base 검색 (향후 구현)
  const searchKnowledge = async (query: string) => {
    // TODO: Knowledge Base 문서에서 검색 구현
    return []
  }

  // 검색어 클릭 시 재검색
  const handleSearchClick = async (searchTerm: string) => {
    setSearchQuery(searchTerm)
    setIsSearching(true)
    setShowSearchResults(true)
    
    try {
      const results = await searchInScope(searchTerm, searchScope)
      setSearchResults(results)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // 검색어 삭제 함수
  const removeSearch = (searchToRemove: string) => {
    setRecentSearches(prev => prev.filter(search => search !== searchToRemove))
  }

  const [searchValue, setSearchValue] = useState('')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({
    name: 'TecAce Ax Pro',
    role: 'Main AI Assistant for HR Support',
    performance: 85,
    avatar: localStorage.getItem('profileAvatar') || 'AI',
    initials: localStorage.getItem('profileInitials') || 'AI'
  })
  
  // Edit 모드용 임시 데이터
  const [editData, setEditData] = useState(profileData)

  const filters = [
    { key: 'all', label: 'All', count: documents },
    { key: 'policies', label: 'Policies', count: 45 },
    { key: 'benefits', label: 'Benefits', count: 32 },
    { key: 'training', label: 'Training', count: 28 },
    { key: 'payroll', label: 'Payroll', count: 21 }
  ]

  const menuItems = [
    { icon: IconMessage, label: 'Dashboard', active: true },
    { icon: IconMessage, label: 'Monitoring' },
    { icon: IconMessage, label: 'Radar Chart' },
    { icon: IconHistory, label: 'Conversation History' },
    { icon: IconEdit, label: 'Edit Avatar' },
    { icon: IconDatabase, label: 'Knowledge Management' },
    { icon: IconMegaphone, label: 'Announcement' },
    { icon: IconSettings, label: 'Settings' }
  ]

  const handleFilterClick = (filterKey: string) => {
    onFilterChange(filterKey)
  }

  const handleProfileEdit = () => {
    setIsEditingProfile(true)
    setEditData(profileData)
  }

  const handleProfileSave = () => {
    setProfileData(editData)
    localStorage.setItem('profileInitials', editData.initials)
    setIsEditingProfile(false)
  }

  const handleProfileCancel = () => {
    setEditData(profileData)
    setIsEditingProfile(false)
  }

  const handleProfileChange = (field: string, value: string | number) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleConversationsClick = () => {
    console.log('Conversations clicked!') // 디버깅용
    if (onScrollToConversations) {
      onScrollToConversations()
    }
  }

  const handlePhotoClick = () => {
    // 이미 업로드된 사진이 있으면 삭제 확인
    if (profileData.avatar !== 'AI') {
      const confirmDelete = confirm('프로필 사진을 삭제하시겠습니까?')
      if (confirmDelete) {
        setProfileData(prev => ({
          ...prev,
          avatar: 'AI'
        }))
        localStorage.removeItem('profileAvatar')
      }
    } else {
      // 사진이 없으면 파일 선택
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = handlePhotoUpload
      input.click()
    }
  }

  const handlePhotoUpload = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setProfileData(prev => ({
          ...prev,
          avatar: result
        }))
        localStorage.setItem('profileAvatar', result)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <aside className={`dashboard-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-toggle" onClick={onToggleCollapse}>
        <IconChevronRight className={`toggle-icon ${isCollapsed ? 'rotated' : ''}`} />
      </div>
      
      {!isCollapsed && (
        <>
          {/* AI Assistant Profile */}
          <div className="profile-section">
            <div className="profile-content">
              <div className="profile-avatar">
                {profileData.avatar === 'AI' || profileData.avatar === profileData.initials ? (
                  <div className="avatar-placeholder">
                    {isEditingProfile ? (
                      <input
                        type="text"
                        value={editData.initials}
                        onChange={(e) => setEditData(prev => ({ ...prev, initials: e.target.value.toUpperCase() }))}
                        className="initials-input"
                        maxLength={3}
                      />
                    ) : (
                      profileData.initials
                    )}
                  </div>
                ) : (
                  <img 
                    src={profileData.avatar} 
                    alt="Profile" 
                    className="profile-image"
                  />
                )}
                <div className="status-indicator active"></div>
              </div>

              <div className="profile-info">
                {isEditingProfile ? (
                  <>
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                      className="profile-name-input"
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={editData.role}
                      onChange={(e) => setEditData(prev => ({ ...prev, role: e.target.value }))}
                      className="profile-role-input"
                      placeholder="Role"
                    />
                  </>
                ) : (
                  <>
                    <h3 className="profile-name">{profileData.name}</h3>
                    <p className="profile-role">{profileData.role}</p>
                  </>
                )}
                
                <div className="profile-metrics">
                  <div className="profile-metric">
                    <span className="profile-metric-value">{profileData.performance}%</span>
                    <span className="profile-metric-label">Performance</span>
                  </div>
                  <div className="profile-metric-divider"></div>
                  <div className="profile-metric">
                    <span className="profile-status-badge active">Active</span>
                    <span className="profile-metric-label">Status</span>
                  </div>
                </div>
              </div>

              <div className="profile-actions">
                {isEditingProfile ? (
                  <>
                    <button className="btn-small save-btn" onClick={handleProfileSave}>
                      <IconSave size={12} />
                      Save
                    </button>
                    <button className="btn-small cancel-btn" onClick={handleProfileCancel}>
                      <IconX size={12} />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-small" onClick={handleProfileEdit}>
                      <IconEdit size={12} />
                      Edit
                    </button>
                    <button className="btn-small" onClick={handlePhotoClick}>
                      <IconCamera size={12} />
                      Photo
                    </button>
                    <button className="btn-small">
                      <IconPalette size={12} />
                      Style
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-item" onClick={handleConversationsClick}>
              <span className="stat-value">{conversations.toLocaleString()}</span>
              <span className="stat-label">Conversations</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{satisfaction}%</span>
              <span className="stat-label">Satisfaction</span>
            </div>
          </div>

          {/* Search Section - 범위 선택 UI 추가 */}
          <div className="search-section">
            {/* 검색 범위 선택 */}
            <div className="search-scope-selector">
              <label className="scope-label">Search in:</label>
              <div className="scope-options">
                {searchScopes.map((scope) => (
                  <button
                    key={scope.id}
                    className={`scope-option ${searchScope === scope.id ? 'active' : ''}`}
                    onClick={() => setSearchScope(scope.id as any)}
                    title={scope.description}
                  >
                    <span className="scope-icon">{scope.icon}</span>
                    <span className="scope-text">{scope.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 검색 입력 */}
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                className="search-input"
                placeholder={`Search in ${searchScopes.find(s => s.id === searchScope)?.label.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="recent-searches">
                <h4 className="recent-title">Recent Searches</h4>
                <div className="search-tags">
                  {recentSearches.map((search, index) => (
                    <div key={index} className="search-tag">
                      <span 
                        className="tag-text"
                        onClick={() => handleSearchClick(search)}
                      >
                        {search}
                      </span>
                      <button
                        className="tag-delete"
                        onClick={() => removeSearch(search)}
                        title="Remove search"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search Results Popup - 범위별 결과 표시 */}
          {showSearchResults && (
            <div className="search-results-popup">
              <div className="popup-header">
                <h3>
                  Search Results 
                  <span className="search-scope-badge">
                    {searchScopes.find(s => s.id === searchScope)?.icon} 
                    {searchScopes.find(s => s.id === searchScope)?.label}
                  </span>
                </h3>
                <button 
                  className="popup-close"
                  onClick={() => setShowSearchResults(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="popup-content">
                {isSearching ? (
                  <div className="search-loading">
                    <div className="loading-spinner"></div>
                    <p>Searching in {searchScopes.find(s => s.id === searchScope)?.label.toLowerCase()}...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="search-results-list">
                    {searchResults.map((result) => (
                      <div key={result.id} className="search-result-item">
                        <div className="result-header">
                          <span className="result-source">{result.source}</span>
                          <span className="result-session">Session: {result.sessionId}</span>
                          <span className="result-timestamp">{result.timestamp}</span>
                          <span className={`result-match ${result.matchType}`}>
                            {result.matchType === 'userMessage' ? 'User' : 'AI'}
                          </span>
                        </div>
                        <div className="result-content">
                          <div className="result-message">
                            <strong>Message:</strong> {result.userMessage}
                          </div>
                          {result.aiResponse && (
                            <div className="result-response">
                              <strong>Response:</strong> {result.aiResponse}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-results">
                    <p>No results found in {searchScopes.find(s => s.id === searchScope)?.label.toLowerCase()}.</p>
                    <p className="no-results-hint">Try adjusting your search terms or search in a different scope.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="filters-section">
            {filters.map(filter => (
              <button
                key={filter.key}
                className={`filter-btn ${activeFilters.includes(filter.key) ? 'active' : ''}`}
                onClick={() => handleFilterClick(filter.key)}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>

          {/* 사이드바 메뉴 항목들 */}
          <div className="sidebar-menu">
            <div className="menu-section">
              <h3 className="menu-title">Dashboard</h3>
              <ul className="menu-list">
                <li className="menu-item">
                  <button 
                    className="menu-button"
                    onClick={() => onScrollToSection('performance-radar')}
                  >
                    <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3v18h18" />
                      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                    </svg>
                    <span className="menu-text">Performance Radar</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button 
                    className="menu-button"
                    onClick={() => onScrollToSection('daily-message-activity')}
                  >
                    <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3v18h18" />
                      <path d="M9 9l3 3 3-3" />
                      <path d="M9 15l3-3 3 3" />
                    </svg>
                    <span className="menu-text">Daily Message Activity</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button 
                    className="menu-button"
                    onClick={() => onScrollToSection('system-status')}
                  >
                    <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v6m0 6v6" />
                      <path d="M3.6 3.6l4.2 4.2m8.4 8.4l4.2 4.2" />
                    </svg>
                    <span className="menu-text">System Status</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button 
                    className="menu-button"
                    onClick={() => onScrollToSection('environment-controls')}
                  >
                    <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span className="menu-text">Environment Controls</span>
                  </button>
                </li>
              </ul>
            </div>

            <div className="menu-section">
              <h3 className="menu-title">Content</h3>
              <ul className="menu-list">
                <li className="menu-item">
                  <button 
                    className="menu-button"
                    onClick={() => onScrollToSection('content-module')}
                  >
                    <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10,9 9,9 8,9" />
                    </svg>
                    <span className="menu-text">Content Module</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button 
                    className="menu-button"
                    onClick={() => onScrollToSection('recent-conversations')}
                  >
                    <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="menu-text">Recent Conversations</span>
                  </button>
                </li>
              </ul>
            </div>

            <div className="menu-section">
              <h3 className="menu-title">Settings</h3>
              <ul className="menu-list">
                <li className="menu-item">
                  <button 
                    className="menu-button"
                    onClick={() => onScrollToSection('prompt-control')}
                  >
                    <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v6m0 6v6" />
                      <path d="M3.6 3.6l4.2 4.2m8.4 8.4l4.2 4.2" />
                    </svg>
                    <span className="menu-text">Prompt Control</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}