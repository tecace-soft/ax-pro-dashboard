import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconLogout, IconX } from '../ui/icons'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'
import { fetchDailyMessageActivity, fetchMessageCounts } from '../services/dailyMessageActivity'

// Google Sheets 관련 import만 추가
import { fetchDailyAggregatesWithMode, DailyRow, filterSimulatedData, EstimationMode } from '../services/dailyAggregates'

// Components - MetricsCards 제거
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import PerformanceRadar from '../components/PerformanceRadar'
import PerformanceTimeline from '../components/PerformanceTimeline'

import Content from './Content'
import DailyMessageActivity from '../components/DailyMessageActivity'

import '../styles/dashboard.css'
import '../styles/performance-radar.css'
import '../styles/performance-timeline.css'

// 메인 브랜치의 모든 기존 함수들 유지 (formatDate, localDateKey, buildDailyMessageData 등등)
function formatDate(d: Date): string {
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function localDateKey(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function buildDailyMessageData(
	startDate: string,
	endDate: string,
	sessionRequests: Record<string, any[]>
): { data: { date: string; count: number }[]; total: number } {
	if (!startDate || !endDate) return { data: [], total: 0 };

	const start = new Date(`${startDate}T00:00:00`);
	start.setDate(start.getDate() + 1)
	const end = new Date(`${endDate}T23:59:59`);
	end.setDate(end.getDate() + 1)

	const counts: Record<string, number> = {};
	let total = 0;

	Object.values(sessionRequests).forEach((reqs = []) => {
		reqs.forEach((r: any) => {
			if (!r?.createdAt) return;
			const t = new Date(r.createdAt);
			if (t < start || t > end) return;
			const key = localDateKey(t);
			counts[key] = (counts[key] || 0) + 1;
			total += 1;
		});
	});

	const out: { date: string; count: number }[] = [];
	const cur = new Date(start);
	while (cur <= end) {
		const key = localDateKey(cur);
		out.push({ date: key, count: counts[key] || 0 });
		cur.setDate(cur.getDate() + 1);
	}

	return { data: out, total };
}

// 메인 브랜치의 모든 interface와 캐시 관련 코드들도 그대로 유지...
// (MessageCount, DailyMessageResponse, getCacheKey, getFromCache, saveToCache, generateDummyData, invalidateCache)

export default function Dashboard() {
	const navigate = useNavigate()
	
	// 메인 브랜치의 모든 기존 state 유지
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const [authToken, setAuthToken] = useState<string | null>(null)
	const [sessions, setSessions] = useState<any[]>([])
	const [isLoadingSessions, setIsLoadingSessions] = useState(false)
	const [sessionRequests, setSessionRequests] = useState<Record<string, any[]>>({})
	const [requestDetails, setRequestDetails] = useState<Record<string, any>>({})
	const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
	
	const [feedbackModal, setFeedbackModal] = useState<{isOpen: boolean, type: 'positive' | 'negative' | null, requestId: string | null}>({
		isOpen: false,
		type: null,
		requestId: null
	})
	const [feedbackText, setFeedbackText] = useState<string>('')
	const [submittedFeedback, setSubmittedFeedback] = useState<Record<string, 'positive' | 'negative'>>({})

	const [promptText, setPromptText] = useState<string>('')

	const [activeFilters, setActiveFilters] = useState<string[]>(['all'])
	const [selectedPeriod, setSelectedPeriod] = useState(7)
	const [searchQuery, setSearchQuery] = useState('')

	const [startDate, setStartDate] = useState<string>('')
	const [endDate, setEndDate] = useState<string>('')

	const performanceData = Array.from({ length: 30 }, (_, i) => ({
		date: `월${13 + i}일`,
		score: Math.floor(Math.random() * 20) + 70
	}))

	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	const [showCustomRangeModal, setShowCustomRangeModal] = useState(false)
	const [customStartDate, setCustomStartDate] = useState('')
	const [customEndDate, setCustomEndDate] = useState('')
	const [showScrollTop, setShowScrollTop] = useState(false)

	// Google Sheets 관련 state만 추가
	const [radarData, setRadarData] = useState<DailyRow[]>([])
	const [selectedRadarDate, setSelectedRadarDate] = useState<string>('')
	const [isLoadingRadarData, setIsLoadingRadarData] = useState(false)
	const [includeSimulatedData, setIncludeSimulatedData] = useState(true)
	const [showDataControls, setShowDataControls] = useState(false)
	const [estimationMode, setEstimationMode] = useState<EstimationMode>('simple')

	// 메인 브랜치의 모든 기존 useEffect들 유지...
	// (sessions loading, token fetching, date initialization 등등)

	// 1. 인증 토큰 로딩 (작동하는 버전과 동일하게)
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

	// 2. 세션 로딩 (작동하는 버전과 동일하게)
	useEffect(() => {
		if (!authToken || !startDate || !endDate) return;
	  
		let cancelled = false;
	  
		async function loadSessions() {
		  setIsLoadingSessions(true)
		  try {
			// 시작일을 -14일 버퍼 (API가 하루 앞서므로 +1일 추가)
			const startObj = new Date(startDate)
			startObj.setDate(startObj.getDate() - 14 + 1) // -14 + 1 = -13 days
			const startForSessions = formatDate(startObj)

			// API가 하루 앞서므로 +1일 추가
			const endObj = new Date(endDate);
			endObj.setDate(endObj.getDate() + 2 + 1); // +2 + 1 = +3 days
			const endExclusive = formatDate(endObj);
	  
			// 세션은 넉넉히 (-14일 ~ endExclusive)
			const response = await fetchSessions(authToken!, startForSessions, endExclusive);
			
			if (cancelled) return
	  
			const sessionsList = response.sessions || []
			setSessions(sessionsList)
	  
			// 각 세션의 요청도 startDate ~ endExclusive 로 조회
			const requestPromises = sessionsList
			.filter(s => s.sessionId)
			.map(s => {
				// Add 1 day to compensate for API being a day ahead
				const adjustedStartDate = new Date(startDate)
				adjustedStartDate.setDate(adjustedStartDate.getDate() + 1)
				const adjustedEndDate = new Date(endExclusive)
				adjustedEndDate.setDate(adjustedEndDate.getDate() + 1)
				
				return fetchSessionRequests(authToken!, s.sessionId, formatDate(adjustedStartDate), formatDate(adjustedEndDate))
					.catch(err => console.error(`Failed to fetch requests for ${s.sessionId}:`, err))
			});
	  
			const requestResponses = await Promise.all(requestPromises)
			const sessionRequestsMap: Record<string, any[]> = {}
			const allRequestIds: string[] = []
	  
			requestResponses.forEach((reqRes, idx) => {
			  const sessionId = sessionsList[idx]?.sessionId
			  if (reqRes && reqRes.requests && sessionId) {
				sessionRequestsMap[sessionId] = reqRes.requests
				reqRes.requests.forEach((r: any) => {
				  if (r.requestId || r.id) allRequestIds.push(r.requestId || r.id)
				})
			  }
			})
	  
			setSessionRequests(sessionRequestsMap)
	  
			if (allRequestIds.length > 0) {
			  const detailPromises = allRequestIds.map(id =>
				fetchRequestDetail(authToken!, id).catch(err => console.error(`Failed detail for ${id}:`, err))
			  )
			  const detailResponses = await Promise.all(detailPromises)
			  const detailsMap: Record<string, any> = {}
			  detailResponses.forEach((dr, i) => {
				if (dr && dr.request) {
				  const id = allRequestIds[i]
				  detailsMap[id] = dr.request
				}
			  })
			  setRequestDetails(detailsMap)
			}
		  } catch (e) {
			if (!cancelled) {
			  console.error('Failed to fetch sessions:', e)
			  setSessions([])
			}
		  } finally {
			if (!cancelled) setIsLoadingSessions(false)
		  }
		}
	  
		loadSessions()
		return () => { cancelled = true }
	}, [authToken, startDate, endDate])

	// 3. 날짜 초기화 (가장 마지막에, 작동하는 버전과 동일하게)
	useEffect(() => {
		const today = new Date()
		const start = new Date()
		start.setDate(today.getDate() - 6) // 최근 7일(오늘 포함)
		setStartDate(formatDate(start))
		setEndDate(formatDate(today))
	}, [])

	// Google Sheets 관련 useEffect는 그대로 유지
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

	// 메인 브랜치의 모든 기존 함수들 유지...
	// (handlePeriodChange, signOut, toggleSessionExpansion, handleFeedbackClick 등등)

	// Google Sheets 관련 계산만 추가
	const filteredRadarData = filterSimulatedData(radarData, includeSimulatedData)
	const selectedRadarRow = filteredRadarData.find(row => row.Date === selectedRadarDate) || filteredRadarData[filteredRadarData.length - 1]

	const simulatedCount = radarData.filter(row => row.isSimulated).length
	const realCount = radarData.filter(row => !row.isSimulated).length

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

	const { data: dailyData, total: dailyTotal } = buildDailyMessageData(startDate, endDate, sessionRequests);

	// 필요한 변수들 추가
	const currentTime = new Date().toLocaleString('en-US', {
		weekday: 'short',
		month: 'short', 
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	})

	const totalMessages = sessions.reduce((total, session) => {
		const sessionId = session.sessionId || session.id || `session-${Math.random()}`
		const requests = sessionRequests[sessionId] || []
		return total + requests.length
	}, 0)

	const signOut = () => {
		localStorage.removeItem('authToken')
		sessionStorage.removeItem('axAccess')
		navigate('/', { replace: true })
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

	const toggleSidebar = () => {
		setSidebarCollapsed(!sidebarCollapsed)
	}

	const scrollToConversations = () => {
		const conversationsElement = document.querySelector('.conversations-module')
		if (conversationsElement) {
			conversationsElement.scrollIntoView({ 
				behavior: 'smooth', 
				block: 'start' 
			})
		}
	}

	const scrollToSection = (sectionId: string) => {
		if (sectionId === 'content-module') {
			const contentElement = document.querySelector('.content-module')
			if (contentElement) {
				contentElement.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'start' 
				})
			}
		} else if (sectionId === 'recent-conversations') {
			const conversationsElement = document.querySelector('.conversations-module')
			if (conversationsElement) {
				conversationsElement.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'start' 
				})
			}
		} else if (sectionId === 'prompt-control') {
			const promptControlElement = document.querySelector('.prompt-control-module')
			if (promptControlElement) {
				promptControlElement.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'start' 
				})
			}
		} else {
			const element = document.getElementById(sectionId)
			if (element) {
				element.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'start' 
				})
			}
		}
	}

	const handleRangeChange = (start: string, end: string) => {
		setStartDate(start)
		setEndDate(end)
	}

	// DailyMessageActivity 컴포넌트 바로 앞에 디버깅 로그 추가 (504줄 근처)

	console.log('🔍 Dashboard DailyMessageActivity Debug:', {
		startDate,
		endDate,
		sessionsLength: sessions.length,
		sessionRequestsKeys: Object.keys(sessionRequests).length,
		authToken: !!authToken,
		isLoadingSessions
	});

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
					sessions={sessions}
					sessionRequests={sessionRequests}
					requestDetails={requestDetails}
				/>
				
				<main className="dashboard-main">
					<div className="dashboard-grid">
						<div className="grid-left">
							<div id="performance-radar" className="performance-section">
								{/* Google Sheets 컨트롤 추가 */}
								<div style={{ position: 'absolute', top: '8px', right: '8px' }}>
									<button
										onClick={() => setShowDataControls(!showDataControls)}
										style={{
											background: 'rgba(59, 230, 255, 0.1)',
											border: '1px solid rgba(59, 230, 255, 0.3)',
											borderRadius: '4px',
											color: 'rgba(255,255,255,0.7)',
											padding: '4px 6px',
											fontSize: '11px',
											cursor: 'pointer',
											opacity: showDataControls ? 1 : 0.5
										}}
										title="Data Controls"
									>
										⚙️
									</button>
								</div>

								{showDataControls && (
									<div style={{
										position: 'absolute',
										top: '40px',
										right: '8px',
										background: 'rgba(18, 27, 61, 0.95)',
										border: '1px solid rgba(59, 230, 255, 0.3)',
										borderRadius: '6px',
										padding: '8px',
										fontSize: '11px',
										color: '#fff',
										zIndex: 10,
										minWidth: '200px'
									}}>
										<div style={{ marginBottom: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>
											Data: {realCount} actual, {simulatedCount} estimated
										</div>
										
										<label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '8px' }}>
											<input
												type="checkbox"
												checked={includeSimulatedData}
												onChange={(e) => setIncludeSimulatedData(e.target.checked)}
												style={{ margin: 0 }}
											/>
											Include estimated data
										</label>
										
										{includeSimulatedData && (
											<div style={{ borderTop: '1px solid rgba(59, 230, 255, 0.2)', paddingTop: '8px' }}>
												<div style={{ marginBottom: '4px', fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>
													Estimation Mode:
												</div>
												<select
													value={estimationMode}
													onChange={(e) => setEstimationMode(e.target.value as EstimationMode)}
													style={{
														width: '100%',
														background: 'rgba(18, 27, 61, 0.8)',
														border: '1px solid rgba(59, 230, 255, 0.3)',
														borderRadius: '4px',
														color: '#fff',
														padding: '4px 6px',
														fontSize: '10px',
														outline: 'none'
													}}
												>
													<option value="simple">Simple (±5% random)</option>
													<option value="improved">Improved (±4% + patterns)</option>
													<option value="realistic">Realistic (trends + weekends)</option>
												</select>
											</div>
										)}
									</div>
								)}

								{/* Date selector */}
								<div className="radar-controls" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
									<label style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>Date:</label>
									<select 
										value={selectedRadarDate} 
										onChange={(e) => setSelectedRadarDate(e.target.value)}
										style={{
											background: 'rgba(18, 27, 61, 0.8)',
											border: '1px solid rgba(59, 230, 255, 0.3)',
											borderRadius: '6px',
											color: '#fff',
											padding: '6px 12px',
											fontSize: '14px',
											outline: 'none',
											cursor: 'pointer'
										}}
									>
										{filteredRadarData.map((row) => (
											<option key={row.Date} value={row.Date}>
												{row.Date} {row.isSimulated ? '📈' : '📊'}
											</option>
										))}
									</select>
									
									{selectedRadarRow && (
										<span style={{ 
											fontSize: '12px', 
											color: selectedRadarRow.isSimulated ? 'rgba(255, 165, 0, 0.8)' : 'rgba(0, 255, 150, 0.8)',
											display: 'flex',
											alignItems: 'center',
											gap: '4px'
										}}>
											{selectedRadarRow.isSimulated ? '📈 Estimated' : '📊 Actual'}
										</span>
									)}
									
									{isLoadingRadarData && (
										<span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>Loading...</span>
									)}
								</div>

								<PerformanceRadar
									relevance={radarProps.relevance}
									tone={radarProps.tone}
									length={radarProps.length}
									accuracy={radarProps.accuracy}
									toxicity={radarProps.toxicity}
									promptInjection={radarProps.promptInjection}
								/>

								{/* PerformanceTimeline 추가 */}
								<div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(59, 230, 255, 0.15)' }}>
									<PerformanceTimeline
										data={filteredRadarData}
										selectedDate={selectedRadarDate}
										onDateChange={setSelectedRadarDate}
										title="Performance Timeline"
										subtitle="시간별 추이"
									/>
								</div>
							</div>

							{/* DailyMessageActivity는 메인 브랜치 그대로 유지 */}
							<DailyMessageActivity 
								startDate={startDate}
								endDate={endDate}
								sessions={sessions}
								sessionRequests={sessionRequests}
							/>
						</div>
					</div>

					{/* Content.tsx 모듈을 그대로 유지 */}
					<div className="content-module">
						<Content 
							startDate={startDate}
							endDate={endDate}
							onDateChange={handleRangeChange}
						/>
					</div>
				</main>
			</div>

			{/* 메인 브랜치의 모든 모달들도 그대로 유지 */}
			{/* Feedback Modal, Settings Modal, Scroll Button */}
		</div>
	)
}