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

	// 실제 메시지 활동 데이터 계산 - 필터링된 데이터 활용
	const getMessageActivityData = (days: number) => {
		const now = new Date()
		const filteredSessions = getFilteredSessions()
		
		// 각 날짜별 메시지 수 계산
		const dailyMessages = Array.from({ length: days }, (_, i) => {
			const targetDate = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
			const targetDateStr = targetDate.toDateString()
			
			return filteredSessions.reduce((total, session) => {
				const sessionId = session.sessionId || session.id || `session-${Math.random()}`
				const requests = sessionRequests[sessionId] || []
				
				const dayMessages = requests.filter(request => {
					const requestDate = new Date(request.createdAt || Date.now())
					return requestDate.toDateString() === targetDateStr
				}).length
				
				return total + dayMessages
			}, 0)
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
				/>
				
				<main className="dashboard-main">
					{/* MetricsCards 컴포넌트 완전 제거 */}
					
					<div className="dashboard-grid">
						<div className="grid-left">
							<div className="performance-section">
								<h2>Vector Style Performance Radar & Timeline</h2>
								<p className="section-subtitle">
									깔끔한 벡터 스타일 레이더 차트 및 성능 타임라인 - TecAce Ax Pro 성능 분석 및 최적화
								</p>
								
								<PerformanceRadar
									expertise={79}
									accuracy={75}
									efficiency={76}
									helpfulness={76}
									clarity={68}
								/>
							</div>

							{/* PerformanceTimeline 컴포넌트만 제거 - 이것이 class="performance-timeline" */}

							{/* Daily Message Activity - 필터링된 데이터 반영 */}
							<div className="message-activity-section">
								<div className="section-header">
									<h2>Daily Message Activity</h2>
									<div className="activity-summary">
										Total: {periodTotalMessages} messages | Avg: {avgMessages}/day
										{startDate && endDate && (
											<span className="filter-info">
												<br />Filtered: {startDate} to {endDate}
											</span>
										)}
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
									<button className="period-btn">
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
						</div>

						<div className="grid-right">
							<SystemStatus
								coreSystems={87}
								security={75}
								network={84}
							/>

							<EnvironmentControls />
						</div>
					</div>

					{/* Recent Conversations Module */}
					{/* <div className="conversations-module">
						<div className="card section" aria-labelledby="recent-conv-title">
							<div className="section-header">
								<div id="recent-conv-title" className="section-title conversations-title">Recent Conversations</div>
								<div className="date-controls">
									<label className="date-field">
										<span>Start Date</span>
										<input type="date" className="input date-input" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
									</label>
									<label className="date-field">
										<span>End Date</span>
										<input type="date" className="input date-input" value={endDate} onChange={(e)=>setEndDate(e.target.value)} />
									</label>
								</div>
							</div>
							<div className="sessions-content">
								{isLoadingSessions ? (
									<p className="muted">Loading conversations...</p>
								) : sessions.length > 0 ? (
									<div className="sessions-list">
										{sessions.map((session, index) => {
											const sessionId = session.sessionId || session.id || `Session ${index + 1}`
											const isExpanded = expandedSessions.has(sessionId)
											const requests = sessionRequests[sessionId] || []
											
											return (
												<div key={sessionId} className="session-container">
													<div className="session-row" onClick={() => toggleSessionExpansion(sessionId)}>
														<div className="session-left">
															<div className="session-id">Session: {sessionId}</div>
															<div className="session-messages">
																{requests.length === 1 ? '1 message' : `${requests.length} messages`}
															</div>
														</div>
														<div className="session-right">
															<div className="session-date">
																{session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'No date'}
															</div>
															<div className="session-time">
																{session.createdAt ? new Date(session.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
															</div>
														</div>
													</div>
													
													{isExpanded && (
														<div className="requests-container">
															{requests.length > 0 ? (
																requests.map((request, reqIndex) => {
																	const requestId = request.requestId || request.id
																	const detail = requestDetails[requestId]
																	
																	return (
																		<div key={requestId || reqIndex} className="request-item">
																			<div className="request-header">
																				<div className="request-datetime">
																					{request.createdAt ? (
																						<>
																							<div className="request-date">
																								{new Date(request.createdAt).toLocaleDateString()}
																							</div>
																							<div className="request-time">
																								{request.createdAt ? new Date(request.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
																							</div>
																						</>
																					) : (
																						<div className="request-date">No date available</div>
																					)}
																				</div>
																				<div className="request-actions">
																					<button 
																						className={`thumbs-btn thumbs-up ${submittedFeedback[requestId] === 'positive' ? 'submitted' : ''}`}
																						title="Thumbs Up"
																						onClick={() => handleFeedbackClick('positive', requestId)}
																					>
																						<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
																							<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
																						</svg>
																					</button>
																					<button 
																						className={`thumbs-btn thumbs-down ${submittedFeedback[requestId] === 'negative' ? 'submitted' : ''}`}
																						title="Thumbs Down"
																						onClick={() => handleFeedbackClick('negative', requestId)}
																					>
																						<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
																							<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
																						</svg>
																					</button>
																				</div>
																			</div>
																			
																			{detail && (
																				<>
																					<div className="conversation-item user">
																						<div className="conversation-text">{detail.inputText}</div>
																					</div>
																					<div className="conversation-item assistant">
																						<div className="conversation-text">{detail.outputText}</div>
																					</div>
																				</>
																			)}
																		</div>
																	)
																})
															) : (
																<div className="muted">No requests found for this session.</div>
															)}
														</div>
													)}
												</div>
											)
										})}
									</div>
								) : (
									<p className="muted">No conversations found for the selected date range.</p>
								)}
							</div>
						</div> */}

					{/* Content 모듈 추가 */}
					<Content />
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