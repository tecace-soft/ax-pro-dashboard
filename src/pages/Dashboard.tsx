import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconLogout, IconX } from '../ui/icons'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'
import { fetchDailyMessageActivity, fetchMessageCounts } from '../services/dailyMessageActivity'
import { fetchDailyAggregates, fetchDailyAggregatesWithMode, DailyRow, filterSimulatedData, EstimationMode } from '../services/dailyAggregates'

// Components
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import PerformanceRadar from '../components/PerformanceRadar'
import PerformanceTimeline from '../components/PerformanceTimeline'

import Content from './Content'
import DailyMessageActivity from '../components/DailyMessageActivity'

import '../styles/dashboard.css'
import '../styles/performance-radar.css'
import '../styles/performance-timeline.css'

// 로컬 시간 기준 날짜 포맷팅 함수
function formatDate(d: Date): string {
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

// 로컬 날짜 키
function localDateKey(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

// 하루별 카운트 생성
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

	const dailyCounts: Record<string, number> = {};
	let total = 0;

	for (const sessionId in sessionRequests) {
		const requests = sessionRequests[sessionId] || [];
		requests.forEach(req => {
			if (req.timestamp) {
				const reqDate = new Date(req.timestamp);
				if (reqDate >= start && reqDate <= end) {
					const dateKey = localDateKey(reqDate);
					dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
					total++;
				}
			}
		});
	}

	const data: { date: string; count: number }[] = [];
	for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
		const dateKey = localDateKey(d);
		data.push({
			date: dateKey,
			count: dailyCounts[dateKey] || 0
		});
	}

	return { data, total };
}

// 캐시 무효화 함수들
export const invalidateCache = {
	sessions: () => localStorage.removeItem('sessions-cache'),
	requests: (sessionId: string) => localStorage.removeItem(`requests-${sessionId}`),
	requestDetails: (requestId: string) => localStorage.removeItem(`detail-${requestId}`),
	all: () => {
		Object.keys(localStorage).forEach(key => {
			if (key.startsWith('sessions-') || key.startsWith('requests-') || key.startsWith('detail-')) {
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

	// Date filters
	const [startDate, setStartDate] = useState<string>('')
	const [endDate, setEndDate] = useState<string>('')

	// Mock data for new components
	const performanceData = Array.from({ length: 30 }, (_, i) => ({
		date: `월${13 + i}일`,
		score: Math.floor(Math.random() * 20) + 70
	}))

	// 사이드바 collapse 상태
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	
	// Custom Range 모달 상태
	const [showCustomRangeModal, setShowCustomRangeModal] = useState(false)
	const [customStartDate, setCustomStartDate] = useState('')
	const [customEndDate, setCustomEndDate] = useState('')

	// Google Sheets 데이터 상태
	const [radarData, setRadarData] = useState<DailyRow[]>([])
	const [selectedRadarDate, setSelectedRadarDate] = useState<string>('')
	const [isLoadingRadarData, setIsLoadingRadarData] = useState(false)
	const [includeSimulatedData, setIncludeSimulatedData] = useState(true)
	const [showDataControls, setShowDataControls] = useState(false)
	const [estimationMode, setEstimationMode] = useState<EstimationMode>('simple')

	// 스크롤 버튼 상태
	const [showScrollTop, setShowScrollTop] = useState(false)

	// 초기 날짜 설정
	useEffect(() => {
		const today = new Date()
		const sevenDaysAgo = new Date(today.getTime() - (6 * 24 * 60 * 60 * 1000))
		
		setStartDate(formatDate(sevenDaysAgo))
		setEndDate(formatDate(today))
	}, [])

	// 인증 토큰 로드
	useEffect(() => {
		const token = getAuthToken()
		if (!token) {
			navigate('/login')
			return
		}
		setAuthToken(token)
	}, [navigate])

	// 세션 데이터 로드
	useEffect(() => {
		if (!authToken || !startDate || !endDate) return;

		const sessionStartDate = new Date(startDate);
		sessionStartDate.setDate(sessionStartDate.getDate() - 14);
		const sessionStartDateStr = formatDate(sessionStartDate);

		const loadSessions = async () => {
			setIsLoadingSessions(true);
			try {
				const sessionData = await fetchSessions(authToken, sessionStartDateStr, endDate);
				setSessions(sessionData || []);
			} catch (error) {
				console.error('Failed to load sessions:', error);
				setSessions([]);
			} finally {
				setIsLoadingSessions(false);
			}
		};

		loadSessions();
	}, [authToken, startDate, endDate]);

	// 요청 데이터 로드
	useEffect(() => {
		if (!authToken || sessions.length === 0 || !startDate || !endDate) return;

		const loadRequests = async () => {
			const newSessionRequests: Record<string, any[]> = {};
			
			for (const session of sessions) {
				try {
					const requests = await fetchSessionRequests(authToken, session.session_id, startDate, endDate);
					newSessionRequests[session.session_id] = requests || [];
				} catch (error) {
					console.error(`Failed to load requests for session ${session.session_id}:`, error);
					newSessionRequests[session.session_id] = [];
				}
			}
			
			setSessionRequests(newSessionRequests);
		};

		loadRequests();
	}, [authToken, sessions, startDate, endDate]);

	// Google Sheets 데이터 로드
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

	// 스크롤 이벤트 리스너
	useEffect(() => {
		const handleScroll = () => {
			const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
			setShowScrollTop(scrollTop > 300);
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

	// 필터링된 레이더 데이터
	const filteredRadarData = filterSimulatedData(radarData, includeSimulatedData)
	const selectedRadarRow = filteredRadarData.find(row => row.Date === selectedRadarDate) || filteredRadarData[filteredRadarData.length - 1]

	// 시뮬레이션 데이터 통계
	const simulatedCount = radarData.filter(row => row.isSimulated).length
	const realCount = radarData.filter(row => !row.isSimulated).length

	// PerformanceRadar props 계산
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

	// 기타 핸들러 함수들
	const handleRangeChange = (start: string, end: string) => {
		setStartDate(start)
		setEndDate(end)
	}

	const closeFeedbackModal = () => {
		setFeedbackModal({ isOpen: false, type: null, requestId: null })
		setFeedbackText('')
	}

	const submitFeedback = () => {
		console.log('Submitting feedback:', feedbackText)
		closeFeedbackModal()
	}

	return (
		<div className="dashboard-layout">
			<Header 
				onSettingsClick={() => setIsSettingsOpen(true)}
				sidebarCollapsed={sidebarCollapsed}
				onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
			/>
			
			<div className="dashboard-content">
				<Sidebar 
					collapsed={sidebarCollapsed}
					onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				/>
				
				<main className="dashboard-main">
					<div className="dashboard-grid">
						<div className="grid-left">
							<div id="performance-radar" className="performance-section">
								{/* 히든 메뉴 토글 버튼 */}
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

								{/* 데이터 컨트롤 패널 */}
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
									
									{/* 데이터 타입 인디케이터 */}
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

								{/* 디버깅: 데이터 확인 */}
								<div style={{ color: 'white', fontSize: '12px', margin: '10px 0' }}>
									Debug: {filteredRadarData.length} items, selected: {selectedRadarDate}
								</div>

								{/* Performance Timeline 추가 */}
								<div className="timeline-section-wrapper">
									<PerformanceTimeline
										data={filteredRadarData}
										selectedDate={selectedRadarDate}
										onDateChange={setSelectedRadarDate}
										title="Performance Timeline"
										subtitle="시간별 추이"
									/>
								</div>
							</div>

							<DailyMessageActivity 
								startDate={startDate}
								endDate={endDate}
								sessions={sessions}
								sessionRequests={sessionRequests}
							/>
						</div>
					</div>

					<div className="content-module">
						<Content 
							startDate={startDate}
							endDate={endDate}
							onDateChange={handleRangeChange}
						/>
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
					className="scroll-top-btn"
					onClick={scrollToTop}
					style={{
						position: 'fixed',
						bottom: '20px',
						right: '20px',
						background: 'rgba(59, 230, 255, 0.8)',
						border: 'none',
						borderRadius: '50%',
						width: '50px',
						height: '50px',
						color: '#fff',
						fontSize: '20px',
						cursor: 'pointer',
						zIndex: 1000,
						boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
					}}
				>
					↑
				</button>
			)}
		</div>
	)
}