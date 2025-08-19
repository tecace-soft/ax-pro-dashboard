import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconLogout, IconX } from '../ui/icons'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'

// Components - MetricsCards 제거
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import PerformanceRadar from '../components/PerformanceRadar'
import PerformanceTimeline from '../components/PerformanceTimeline'
import SystemStatus from '../components/SystemStatus'
import EnvironmentControls from '../components/EnvironmentControls'
import Content from './Content' // Content.tsx import 추가

import '../styles/dashboard.css'

function formatDate(d: Date): string {
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
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

	// Date filters: default to [today-7, today]
	const today = new Date()
	const sevenDaysAgo = new Date()
	sevenDaysAgo.setDate(today.getDate() - 7)
	const [startDate, setStartDate] = useState<string>(formatDate(sevenDaysAgo))
	const [endDate, setEndDate] = useState<string>(formatDate(today))

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

	// Custom Range 적용 함수
	const applyCustomRange = () => {
		if (customStartDate && customEndDate) {
			setStartDate(customStartDate)
			setEndDate(customEndDate)
			setShowCustomRangeModal(false)
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

	// Fetch sessions when token is available or dates change
	useEffect(() => {
		if (!authToken) return

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

	// 실제 메시지 활동 데이터 계산 - 간단하게 수정
	const getMessageActivityData = (days: number) => {
		const now = new Date()
		const filteredSessions = getFilteredSessions()
		
		// 각 날짜별 메시지 수 계산
		const dailyMessages = Array.from({ length: days }, (_, i) => {
			const targetDate = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
			const targetDateStr = targetDate.toDateString()
			
			let totalMessages = 0
			
			// 각 세션의 요청들을 확인
			filteredSessions.forEach(session => {
				const sessionId = session.sessionId || session.id
				const requests = sessionRequests[sessionId] || []
				
				requests.forEach(request => {
					// 다양한 날짜 필드 시도
					const requestDate = new Date(
						request.createdAt || 
						request.timestamp || 
						request.date || 
						session.createdAt || 
						Date.now()
					)
					
					if (requestDate.toDateString() === targetDateStr) {
						totalMessages++
					}
				})
			})
			
			return totalMessages
		}).reverse() // 최신 날짜가 오른쪽에 오도록
		
		return dailyMessages
	}

	const periods = [3, 7, 14, 30]

	// 선택된 기간의 메시지 데이터 (필터링 반영)
	const messageData = getMessageActivityData(selectedPeriod)
	const periodTotalMessages = messageData.reduce((sum, count) => sum + count, 0)
	const avgMessages = Math.round(periodTotalMessages / selectedPeriod)

	// startDate, endDate가 변경될 때마다 차트 업데이트
	useEffect(() => {
		// startDate나 endDate가 변경되면 차트가 자동으로 업데이트됩니다
	}, [startDate, endDate])

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

	return (
		<div className="dashboard-layout">
			<Header performanceScore={91} currentTime={currentTime} onSignOut={signOut} />
			
			<div className="dashboard-content">
				<Sidebar
					conversations={totalMessages} // 실제 데이터로 변경
					satisfaction={94.5}
					documents={156}
					activeFilters={activeFilters}
					onFilterChange={handleFilterChange}
					onSearch={handleSearch}
					isCollapsed={sidebarCollapsed}
					onToggleCollapse={toggleSidebar}
					onScrollToConversations={scrollToConversations} // 새로운 prop 전달
					onScrollToSection={scrollToSection} // 새로운 prop 전달
				/>
				
				<main className="dashboard-main">
					{/* MetricsCards 컴포넌트 완전 제거 */}
					
					<div className="dashboard-grid">
						<div className="grid-left">
							<div id="performance-radar" className="performance-section">
								<h2>Performance Radar</h2>
								<p className="section-subtitle">
									AI 응답 품질과 보안 성능을 6가지 핵심 지표로 실시간 모니터링하여 최적의 사용자 경험을 제공합니다
								</p>
								
								<PerformanceRadar
									relevance={85}
									tone={78}
									length={82}
									accuracy={92}
									toxicity={95}
									promptInjection={88}
								/>
							</div>

							{/* PerformanceTimeline 컴포넌트만 제거 - 이것이 class="performance-timeline" */}

							{/* Daily Message Activity - Filtered 텍스트 제거하고 Custom Range 모달 추가 */}
							<div id="daily-message-activity" className="message-activity-section">
								<div className="section-header">
									<h2>Daily Message Activity</h2>
									<div className="activity-summary">
										Total: {periodTotalMessages} messages | Avg: {avgMessages}/day
									</div>
								</div>
								
								<div className="period-filters">
									{periods.map(period => (
										<button
											key={period}
											className={`period-btn ${selectedPeriod === period ? 'active' : ''}`}
											onClick={() => setSelectedPeriod(period)}
										>
											Last {period} Days
										</button>
									))}
									<button 
										className="period-btn custom-range-btn"
										onClick={handleCustomRangeClick}
									>
										Custom Range
									</button>
								</div>
								
								<div className="activity-chart">
									{periodTotalMessages > 0 ? (
										<div className="bar-chart">
											{messageData.map((dayData, i) => {
												const maxValue = Math.max(...messageData)
												const height = maxValue > 0 ? (dayData / maxValue) * 100 : 0
												const date = new Date(Date.now() - ((selectedPeriod - 1 - i) * 24 * 60 * 60 * 1000))
												const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
												
												return (
													<div key={i} className="bar-item">
														<div className="bar" style={{ height: `${height}%` }}>
															<span className="bar-value">{dayData}</span>
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
							<div id="system-status">
								<SystemStatus
									coreSystems={87}
									security={75}
									network={84}
								/>
							</div>

							<div id="environment-controls">
								<EnvironmentControls />
							</div>
						</div>
					</div>

					{/* Content.tsx 모듈을 그대로 유지 */}
					<div className="content-module">
						<Content />
					</div>

					{/* 중복된 Recent Conversations와 Prompt Control 섹션들 제거 */}

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
		</div>
	)
} 