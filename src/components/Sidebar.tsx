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
  onScrollToConversations?: () => void // 새로운 prop 추가
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
  onScrollToConversations
}: SidebarProps) {
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

  const recentSearches = [
    'HR policies',
    'Leave management', 
    'Performance reviews',
    'Benefits enrollment'
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    onSearch(value)
  }

  const handleFilterClick = (filterKey: string) => {
    onFilterChange(filterKey)
  }

  const handleRecentSearchClick = (searchTerm: string) => {
    setSearchValue(searchTerm)
    onSearch(searchTerm)
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

          {/* Search */}
          <div className="search-section">
            <div className="search-input">
              <IconSearch size={16} />
              <input 
                type="text" 
                placeholder="Search knowledge base, conversations..."
                value={searchValue}
                onChange={handleSearchChange}
              />
            </div>
          </div>

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

          {/* Recent Searches */}
          <div className="recent-searches">
            <h4>Recent Searches</h4>
            <div className="search-tags">
              {recentSearches.map(search => (
                <button
                  key={search}
                  className="search-tag clickable"
                  onClick={() => handleRecentSearchClick(search)}
                >
                  {search}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="sidebar-nav">
            {menuItems.map(item => (
              <button
                key={item.label}
                className={`nav-item ${item.active ? 'active' : ''}`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </aside>
  )
}