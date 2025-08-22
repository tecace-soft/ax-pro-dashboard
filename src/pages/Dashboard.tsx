import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconLogout, IconX } from '../ui/icons'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'
import { fetchDailyMessageActivity, fetchMessageCounts } from '../services/dailyMessageActivity'

// Components - MetricsCards 제거
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import PerformanceRadar from '../components/PerformanceRadar'
import PerformanceTimeline from '../components/PerformanceTimeline'
import SystemStatus from '../components/SystemStatus'
import EnvironmentControls from '../components/EnvironmentControls'
import Content from './Content' // Content.tsx import 추가

import '../styles/dashboard.css'
import '../styles/performance-radar.css'

// 로컬 시간 기준 날짜 포맷팅 함수 (모든 곳에서 통일 사용)
function formatDate(d: Date): string {
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

interface MessageCount {
  date: string
  count: number
}

interface DailyMessageResponse {
  messageCounts: MessageCount[]
  totalMessages: number
  averageMessages: number
  period: {
    startDate: string
    endDate: string
  }
}

// 캐시 키 생성 함수
const getCacheKey = (startDate: string, endDate: string) => {
  return `daily-messages-${startDate}-${endDate}`
}

// 캐시에서 데이터 가져오기
const getFromCache = (key: string): DailyMessageResponse | null => {
  try {
    const cached = localStorage.getItem(key)
    if (cached) {
      const data = JSON.parse(cached)
      // 캐시 만료 시간 확인 (24시간)
      if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        return data.data
      }
      // 만료된 캐시 삭제
      localStorage.removeItem(key)
    }
  } catch (error) {
    console.error('Cache read error:', error)
  }
  return null
}

// 캐시에 데이터 저장
const saveToCache = (key: string,  DailyMessageResponse) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
  } catch (error) {
    console.error('Cache save error:', error)
  }
}

// 더미 데이터 생성 (API 실패 시 사용)
const generateDummyData = (startDate: string, endDate: string): DailyMessageResponse => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  const messageCounts: MessageCount[] = []
  let totalMessages = 0
  
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000))
    const count = Math.floor(Math.random() * 20) + 1 // 1-20 랜덤
    messageCounts.push({
      date: formatDate(date),
      count
    })
    totalMessages += count
  }
  
  return {
    messageCounts,
    totalMessages,
    averageMessages: Math.round(totalMessages / days),
    period: { startDate, endDate }
  }
}

// 캐시 무효화 (필요시 사용)
export const invalidateCache = (startDate?: string, endDate?: string) => {
  if (startDate && endDate) {
    const key = getCacheKey(startDate, endDate)
    localStorage.removeItem(key)
  } else {
    // 모든 캐시 삭제
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('daily-messages-')) {
        localStorage.removeItem(key)
      }
    })
  }
}

export default function Dashboard() {
	const navigate = useNavigate()
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const [authToken, setAuthToken] = useState<string | null>(null)
	const [sessions, setSessions] = useState<any[]>([])
	const [isLoadingSessions, setIsLoadingSessions] = useState(false)
	const [sessionRequests, setSessionRequests] = useState<Record<string, any[]>>({})
	const [requestDetails, setRequestDetails] = useState<Record<string, any>>({})
	const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
	
	// Feedback modal state
	const [feedbackModal, setFeedbackModal] = useState<{isOpen: boolean, type: 'positive' | 'negative' | null, requestId: string | null}>({
		isOpen: false,
		type: null,
		requestId: null
	})
	const [feedbackText, setFeedbackText] = useState<string>('')
	const [submittedFeedback, setSubmittedFeedback] = useState<Record<string, 'positive' | 'negative'>>({})

	// Prompt Control state
	const [promptText, setPromptText] = useState<string>('')

	// New state for enhanced dashboard
	const [activeFilters, setActiveFilters] = useState<string[]>(['all'])
	const [selectedPeriod, setSelectedPeriod] = useState(7)
	const [searchQuery, setSearchQuery] = useState('')

	// Date filters: 초기값을 빈 문자열로 설정
	const [startDate, setStartDate] = useState<string>('')
	const [endDate, setEndDate] = useState<string>('')

	// Mock data for new components
	const performanceData = Array.from({ length: 30 }, (_, i) => ({
		date: `월${13 + i}일`,
		score: Math.floor(Math.random() * 20) + 70
	}))

	// 사이드바 collapse 상태 추가
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	
	// Custom Range 모달 상태 추가
	const [showCustomRangeModal, setShowCustomRangeModal] = useState(false)
	const [customStartDate, setCustomStartDate] = useState('')
	const [customEndDate, setCustomEndDate] = useState('')

	// Daily Message Activity 전용 상태
	const [dailyMessageData, setDailyMessageData] = useState<MessageCount[]>([])
	const [isLoadingDailyMessages, setIsLoadingDailyMessages] = useState(false)
	const [dailyMessageStats, setDailyMessageStats] = useState({
		total: 0,
		average: 0
	})

	// 초기 날짜 설정을 위한 useEffect (가장 먼저 실행)
	useEffect(() => {
		const today = new Date()
		const defaultStart = new Date()
		defaultStart.setDate(today.getDate() - 6) // 7일 (오늘 포함)
		
		const startStr = formatDate(defaultStart)
		const endStr = formatDate(today)
		
		console.log(`Setting initial dates: ${startStr} to ${endStr}`)
		
		setStartDate(startStr)
		setEndDate(endStr)
	}, [])

	// Daily Message Activity 데이터 가져오기
	const loadDailyMessages = async (start: string, end: string) => {
		if (!authToken) return
		
		console.log(`Loading daily messages: ${start} to ${end}`)
		
		setIsLoadingDailyMessages(true)
		try {
			const data = await fetchDailyMessageActivity(authToken, start, end)
			setDailyMessageData(data.messageCounts)
			setDailyMessageStats({
				total: data.totalMessages,
				average: data.averageMessages
			})
		} catch (error) {
			console.error('Failed to fetch daily messages:', error)
		} finally {
			setIsLoadingDailyMessages(false)
		}
	}

	// 기간 변경 시 데이터 새로 가져오기
	const handlePeriodChange = (days: number) => {
		setSelectedPeriod(days)
		
		const today = new Date()
		const startDate = new Date()
		
		// days=3이면 18,19,20일을 원한다면
		startDate.setDate(today.getDate() - (days - 1))
		
		const startStr = formatDate(startDate)
		const endStr = formatDate(today)
		
		console.log(`Period ${days} days: ${startStr} to ${endStr}`)
		
		setStartDate(startStr)
		setEndDate(endStr)
		
		loadDailyMessages(startStr, endStr)
	}

	// Custom Range 적용 시
	const applyCustomRange = async () => {
		if (customStartDate && customEndDate) {
			setStartDate(customStartDate)
			setEndDate(customEndDate)
			setShowCustomRangeModal(false)
			
			// Daily Message Activity 데이터 새로 가져오기
			await loadDailyMessages(customStartDate, customEndDate)
		}
	}

	// Fetch auth token on mount
	useEffect(() => {
		let cancelled = false
		
		async function fetchToken() {
			try {
				const token = await getAuthToken()
				if (!cancelled) {
					setAuthToken(token)
				}
			} catch (error) {
				if (!cancelled) {
					console.error('Failed to get auth token:', error)
				}
			}
		}
		
		fetchToken()
		
		return () => {
			cancelled = true
		}
	}, [])

	// authToken과 날짜가 설정되면 데이터 로드
	useEffect(() => {
		if (authToken && startDate && endDate) {
			console.log(`Loading  ${startDate} to ${endDate}`)
			loadDailyMessages(startDate, endDate)
		}
	}, [authToken, startDate, endDate])

	// Fetch sessions when token is available or dates change
	useEffect(() => {
		if (!authToken || !startDate || !endDate) return

		let cancelled = false
		
		async function loadSessions() {
			setIsLoadingSessions(true)
			try {
				const response = await fetchSessions(authToken!, startDate, endDate)
				if (!cancelled) {
					setSessions(response.sessions || [])
					
					// Fetch requests for all sessions simultaneously
					const sessions = response.sessions || []
					const requestPromises = sessions
						.filter(session => session.sessionId)
						.map(session => 
							fetchSessionRequests(authToken!, session.sessionId, startDate, endDate)
								.catch(error => console.error(`Failed to fetch requests for session ${session.sessionId}:`, error))
						)

					const requestResponses = await Promise.all(requestPromises)
					
					// Store session requests and collect all request IDs
					const sessionRequestsMap: Record<string, any[]> = {}
					const allRequestIds: string[] = []
					
					requestResponses.forEach((requestResponse, index) => {
						const sessionId = sessions[index]?.sessionId
						if (requestResponse && requestResponse.requests && sessionId) {
							sessionRequestsMap[sessionId] = requestResponse.requests
							requestResponse.requests.forEach((request: any) => {
								if (request.requestId || request.id) {
									allRequestIds.push(request.requestId || request.id)
								}
							})
						}
					})
					
					setSessionRequests(sessionRequestsMap)

					// Fetch details for all requests simultaneously
					if (allRequestIds.length > 0) {
						const detailPromises = allRequestIds.map(requestId => 
							fetchRequestDetail(authToken!, requestId)
								.catch(error => console.error(`Failed to fetch detail for request ${requestId}:`, error))
						)
						
						const detailResponses = await Promise.all(detailPromises)
						
						// Store request details
						const requestDetailsMap: Record<string, any> = {}
						detailResponses.forEach((detailResponse, index) => {
							if (detailResponse && detailResponse.request) {
								const requestId = allRequestIds[index]
								requestDetailsMap[requestId] = detailResponse.request
							}
						})
						
						setRequestDetails(requestDetailsMap)
					}
				}
			} catch (error) {
				if (!cancelled) {
					console.error('Failed to fetch sessions:', error)
					setSessions([])
				}
			} finally {
				if (!cancelled) {
					setIsLoadingSessions(false)
				}
			}
		}
		
		loadSessions()
		
		return () => {
			cancelled = true
		}
	}, [authToken, startDate, endDate])

	// Sign out function
	const signOut = () => {
		// Clear auth token
		localStorage.removeItem('authToken')
		sessionStorage.removeItem('axAccess')
		
		// Navigate to login page
		navigate('/', { replace: true })
	}

	function toggleSessionExpansion(sessionId: string) {
		const newExpanded = new Set(expandedSessions)
		if (newExpanded.has(sessionId)) {
			newExpanded.delete(sessionId)
		} else {
			newExpanded.add(sessionId)
		}
		setExpandedSessions(newExpanded)
	}

	// Feedback functions
	const handleFeedbackClick = (type: 'positive' | 'negative', requestId: string) => {
		setFeedbackModal({
			isOpen: true,
			type: type,
			requestId: requestId
		})
		setFeedbackText('')
	}

	const closeFeedbackModal = () => {
		setFeedbackModal({
			isOpen: false,
			type: null,
			requestId: null
		})
		setFeedbackText('')
	}

	const submitFeedback = () => {
		// TODO: Implement feedback submission
		console.log('Feedback submitted:', {
			type: feedbackModal.type,
			requestId: feedbackModal.requestId,
			text: feedbackText
		})
		
		// Mark this request as having feedback submitted
		if (feedbackModal.requestId && feedbackModal.type) {
			setSubmittedFeedback(prev => ({
				...prev,
				[feedbackModal.requestId!]: feedbackModal.type!
			}))
		}
		
		closeFeedbackModal()
	}

	const handleFilterChange = (filter: string) => {
		setActiveFilters(prev => 
			filter === 'all' ? ['all'] : 
			prev.includes(filter) ? prev.filter(f => f !== filter) : 
			[...prev.filter(f => f !== 'all'), filter]
		)
	}

	const handleSearch = (query: string) => {
		setSearchQuery(query)
	}

	const currentTime = new Date().toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	})

	// 사이드바 toggle 함수 추가
	const toggleSidebar = () => {
		setSidebarCollapsed(!sidebarCollapsed)
	}

	// 실제 메시지 수 계산
	const totalMessages = sessions.reduce((total, session) => {
		const sessionId = session.sessionId || session.id || `session-${Math.random()}`
		const requests = sessionRequests[sessionId] || []
		return total + requests.length
	}, 0)

	// Recent Conversations로 스크롤하는 함수
	const scrollToConversations = () => {
		const conversationsElement = document.querySelector('.conversations-module')
		if (conversationsElement) {
			conversationsElement.scrollIntoView({ 
				behavior: 'smooth', 
				block: 'start' 
			})
		}
	}

	// 필터링된 세션 데이터를 가져오는 함수
	const getFilteredSessions = () => {
		// Content 모듈의 필터링 로직과 동일하게 적용
		if (!startDate || !endDate) return sessions
		
		const start = new Date(startDate)
		const end = new Date(endDate)
		
		return sessions.filter(session => {
			const sessionDate = new Date(session.createdAt || Date.now())
			return sessionDate >= start && sessionDate <= end
		})
	}

	const periods = [
		{ label: 'Last 7 days', days: 7 },
		{ label: 'Last 3 days', days: 3 },
		{ label: 'Last 30 days', days: 30 },
		{ label: 'Custom Range', days: 0 }
	]

	// Custom Range 버튼 클릭 핸들러 추가
	const handleCustomRangeClick = () => {
		setCustomStartDate(startDate)
		setCustomEndDate(endDate)
		setShowCustomRangeModal(true)
	}

	// 섹션별 스크롤 함수 - Content.tsx 모듈과 연동
	const scrollToSection = (sectionId: string) => {
		// Content.tsx 모듈 내부의 요소들을 찾아서 스크롤
		if (sectionId === 'content-module') {
			// Content 모듈 전체로 스크롤
			const contentElement = document.querySelector('.content-module')
			if (contentElement) {
				contentElement.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'start' 
				})
			}
		} else if (sectionId === 'recent-conversations') {
			// Content 모듈 내의 Recent Conversations 섹션으로 스크롤
			const conversationsElement = document.querySelector('.conversations-module')
			if (conversationsElement) {
				conversationsElement.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'start' 
				})
			}
		} else if (sectionId === 'prompt-control') {
			// Content 모듈 내의 Prompt Control 섹션으로 스크롤
			const promptControlElement = document.querySelector('.prompt-control-module')
			if (promptControlElement) {
				promptControlElement.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'start' 
				})
			}
		} else {
			// Dashboard.tsx 내의 다른 섹션들
			const element = document.getElementById(sectionId)
			if (element) {
				element.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'start' 
				})
			}
		}
	}

	// 스크롤 버튼 상태 추가
	const [showScrollTop, setShowScrollTop] = useState(false);

	// 스크롤 이벤트 리스너 추가
	useEffect(() => {
	  const handleScroll = () => {
		const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
		setShowScrollTop(scrollTop > 300); // 300px 이상 스크롤 시 버튼 표시
	  };

	  window.addEventListener('scroll', handleScroll);
	  return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	// 맨 위로 스크롤 함수
	const scrollToTop = () => {
	  window.scrollTo({
		top: 0,
		behavior: 'smooth'
	  });
	};

	return (
		<div className="dashboard-layout">
			<Header performanceScore={87} currentTime={currentTime} onSignOut={signOut} />
			
			<div className="dashboard-content">
				<Sidebar
					conversations={totalMessages}
					satisfaction={94.5}
					documents={156}
					activeFilters={activeFilters}
					onFilterChange={handleFilterChange}
					onSearch={handleSearch}
					isCollapsed={sidebarCollapsed}
					onToggleCollapse={toggleSidebar}
					onScrollToConversations={scrollToConversations}
					onScrollToSection={scrollToSection}
					// 실제 데이터 전달
					sessions={sessions}
					sessionRequests={sessionRequests}
					requestDetails={requestDetails}
				/>
				
				<main className="dashboard-main">
					<div className="dashboard-grid">
						<div className="grid-left">
						<div id="performance-radar" className="performance-section">
							{/* 통일된 타이틀/서브타이틀 (CSS에서 panel-title / panel-subtitle로 통일 스타일 적용) */}

							<PerformanceRadar
								relevance={85}
								tone={78}
								length={82}
								accuracy={92}
								toxicity={95}
								promptInjection={88}
							/>
							</div>

							{/* Daily Message Activity - Performance Radar와 동일한 스타일 */}
							<div id="daily-message-activity" className="daily-message-section">
							<div className="daily-message-header">
								<h2 className="daily-message-title panel-title">Daily Message Activity</h2>
								<p className="daily-message-summary panel-subtitle">
									Total: {dailyMessageStats.total} messages | Avg: {dailyMessageStats.average}/day
								</p>
							</div>
								
								<div className="daily-message-content">
									<div className="period-filters">
										{periods.map(period => (
											<button
												key={period.label}
												className={`period-btn ${selectedPeriod === period.days ? 'active' : ''}`}
												onClick={() => period.days > 0 ? handlePeriodChange(period.days) : handleCustomRangeClick()}
											>
												{period.label}
											</button>
										))}
									</div>
									
									<div className="activity-chart">
										{isLoadingDailyMessages ? (
											<div className="loading-state">
												<div className="loading-spinner"></div>
												<p>Loading message data...</p>
											</div>
										) : dailyMessageData.length > 0 ? (
											<div className="bar-chart">
												{dailyMessageData.map((dayData, i) => {
													const maxValue = Math.max(...dailyMessageData.map(d => d.count))
													const height = maxValue > 0 ? (dayData.count / maxValue) * 100 : 0
													const date = new Date(dayData.date)
													const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
													
													return (
														<div key={i} className="bar-item">
															<div className="bar" style={{ height: `${height}%` }}>
																<span className="bar-value">{dayData.count}</span>
															</div>
															<span className="bar-label">{dayLabel}</span>
														</div>
													)
												})}
											</div>
										) : (
											<div className="no-data">
												<div className="no-data-icon">📈</div>
												<p>No message data available for selected period</p>
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Custom Range 모달 */}
							{showCustomRangeModal && (
								<div className="custom-range-modal">
									<div className="modal-content">
										<div className="modal-header">
											<h3>Select Custom Date Range</h3>
											<button 
												className="modal-close"
												onClick={() => setShowCustomRangeModal(false)}
											>
												×
											</button>
										</div>
										<div className="modal-body">
											<div className="date-inputs">
												<label className="date-field">
													<span>Start Date</span>
													<input 
														type="date" 
														value={customStartDate}
														onChange={(e) => setCustomStartDate(e.target.value)}
													/>
												</label>
												<label className="date-field">
													<span>End Date</span>
													<input 
														type="date" 
														value={customEndDate}
														onChange={(e) => setCustomEndDate(e.target.value)}
													/>
												</label>
											</div>
										</div>
										<div className="modal-footer">
											<button 
												className="btn-cancel"
												onClick={() => setShowCustomRangeModal(false)}
											>
												Cancel
											</button>
											<button 
												className="btn-apply"
												onClick={applyCustomRange}
												disabled={!customStartDate || !customEndDate}
											>
												Apply
											</button>
										</div>
									</div>
								</div>
							)}
						</div>

						<div className="grid-right">
							{/* System Status 주석 처리 */}
							{/* <div id="system-status">
								<SystemStatus
									coreSystems={87}
									security={75}
									network={84}
								/>
							</div> */}

							{/* Environment Controls 주석 처리 */}
							{/* <div id="environment-controls">
								<EnvironmentControls />
							</div> */}
						</div>
					</div>

					{/* Content.tsx 모듈을 그대로 유지 */}
					<div className="content-module">
						<Content />
					</div>

				</main>
			</div>

			{/* Feedback Modal */}
			{feedbackModal.isOpen && (
				<div className="modal-backdrop" onClick={closeFeedbackModal}>
					<div className="modal card feedback-modal" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h2 className="h1 modal-title">HR Feedback</h2>
							<button className="icon-btn" onClick={closeFeedbackModal}>
								<IconX />
							</button>
						</div>
						<div className="feedback-content">
							<p className="feedback-prompt">
								{feedbackModal.type === 'positive' 
									? 'Please explain what was positive about this chat response'
									: 'Please explain what was negative about this chat response'
								}
							</p>
							<textarea
								className="feedback-textarea"
								value={feedbackText}
								onChange={(e) => setFeedbackText(e.target.value)}
								placeholder="Enter your feedback here..."
								rows={4}
							/>
							<button 
								className="btn submit-feedback-btn" 
								onClick={submitFeedback}
								disabled={!feedbackText.trim()}
							>
								Submit
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Settings Modal */}
			{isSettingsOpen && (
				<div className="modal-backdrop" role="dialog" aria-modal="true">
					<div className="modal card">
						<div className="modal-header">
							<h2 className="h1 modal-title">Settings</h2>
							<button className="icon-btn" aria-label="Close settings" title="Close" onClick={() => setIsSettingsOpen(false)}>
								<IconX />
							</button>
						</div>
						<div className="muted">Settings content will go here.</div>
					</div>
				</div>
			)}

			{/* 스크롤 버튼 */}
			{showScrollTop && (
			  <button 
				className="scroll-to-top-btn"
				onClick={scrollToTop}
				aria-label="Scroll to top"
				title="Scroll to top"
			  >
				<svg 
				  className="scroll-icon" 
				  viewBox="0 0 24 24" 
				  fill="none" 
				  stroke="currentColor" 
				  strokeWidth="2"
				>
				  <path d="M18 15l-6-6-6 6"/>
				</svg>
			  </button>
			)}
		</div>
	)
}
