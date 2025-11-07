import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { IconLogout, IconX } from '../ui/icons'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'
import { fetchSessionsN8N, fetchSessionRequestsN8N } from '../services/conversationsN8N'
import { fetchDailyMessageActivity, fetchMessageCounts } from '../services/dailyMessageActivity'

import { fetchDailyAggregatesWithMode, DailyRow, filterSimulatedData, EstimationMode } from '../services/dailyAggregates'

import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import PerformanceRadar from '../components/PerformanceRadar'
import PerformanceTimeline from '../components/PerformanceTimeline'

import Content from './Content'
import DailyMessageActivity from '../components/DailyMessageActivity'

import '../styles/dashboard.css'
import '../styles/performance-radar.css'
import '../styles/performance-timeline.css'

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

export default function DashboardN8N() {
	const navigate = useNavigate()
	const location = useLocation()
	const [searchParams] = useSearchParams()
	
	const isDashboardPage = location.pathname === '/dashboard-n8n'
	
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

	const [radarData, setRadarData] = useState<DailyRow[]>([])
	const [selectedRadarDate, setSelectedRadarDate] = useState<string>('')
	const [isLoadingRadarData, setIsLoadingRadarData] = useState(false)
	const [includeSimulatedData, setIncludeSimulatedData] = useState(true)
	const [estimationMode, setEstimationMode] = useState<EstimationMode>('simple')

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

	useEffect(() => {
		// N8N route: Use Supabase (no auth token needed)
		if (!startDate || !endDate) return;
	  
		let cancelled = false;
	  
		async function loadSessions() {
		  setIsLoadingSessions(true)
		  try {
			// Use Supabase functions for n8n route
			const response = await fetchSessionsN8N(startDate, endDate);
			
			if (cancelled) return
	  
			const sessionsList = response.sessions || []
			setSessions(sessionsList)
	  
			const requestPromises = sessionsList
			.filter(s => s.sessionId)
			.map(s => {
				return fetchSessionRequestsN8N(s.sessionId, startDate, endDate)
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
	  
			// Request details are loaded in Content.tsx, so we don't need to load them here
		  } catch (e) {
			if (!cancelled) {
			  console.error('Failed to fetch n8n sessions:', e)
			  setSessions([])
			}
		  } finally {
			if (!cancelled) setIsLoadingSessions(false)
		  }
		}
	  
		loadSessions()
		return () => { cancelled = true }
	}, [startDate, endDate])

	useEffect(() => {
		const today = new Date()
		const start = new Date()
		start.setDate(today.getDate() - 6)
		setStartDate(formatDate(start))
		setEndDate(formatDate(today))
	}, [])

	useEffect(() => {
		const section = searchParams.get('section')
		if (section) {
			setTimeout(() => {
				scrollToSection(section)
			}, 500)
		}
	}, [searchParams])

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

	const overallScore = Math.round(
		(radarProps.relevance + radarProps.tone + radarProps.length + 
		 radarProps.accuracy + radarProps.toxicity + radarProps.promptInjection) / 6
	)

	const formatRadarDate = (dateString: string) => {
		if (!dateString) return ''
		const [year, month, day] = dateString.split('-').map(Number)
		return `${month}/${day}`
	}

	const radarDate = formatRadarDate(selectedRadarDate)

	const { data: dailyData, total: dailyTotal } = buildDailyMessageData(startDate, endDate, sessionRequests);

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
		if (isDashboardPage) {
			const contentSections = document.querySelectorAll('.content-section')
			if (contentSections[0]) {
				contentSections[0].scrollIntoView({ 
					behavior: 'smooth', 
					block: 'start' 
				})
			}
		} else {
			navigate('/dashboard-n8n?section=recent-conversations')
		}
	}

	const scrollToSection = (sectionId: string) => {
		if (isDashboardPage) {
			const contentSections = document.querySelectorAll('.content-section')
			
			if (sectionId === 'performance-radar') {
				const performanceElement = document.querySelector('.performance-radar-section')
				if (performanceElement) {
					performanceElement.scrollIntoView({ 
						behavior: 'smooth', 
						block: 'start' 
					})
				}
			} else if (sectionId === 'daily-message-activity') {
				const dailyActivityElement = document.querySelector('.daily-message-section')
				if (dailyActivityElement) {
					dailyActivityElement.scrollIntoView({ 
						behavior: 'smooth', 
						block: 'start' 
					})
				}
			} else if (sectionId === 'recent-conversations') {
				if (contentSections[0]) {
					contentSections[0].scrollIntoView({ 
						behavior: 'smooth', 
						block: 'start' 
					})
				}
			} else if (sectionId === 'user-feedback') {
				if (contentSections[2]) {
					contentSections[2].scrollIntoView({ 
						behavior: 'smooth', 
						block: 'start' 
					})
				}
			} else if (sectionId === 'prompt-control') {
				if (contentSections[3]) {
					contentSections[3].scrollIntoView({ 
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
		} else {
			navigate(`/dashboard-n8n?section=${sectionId}`)
		}
	}

	const handleRangeChange = (start: string, end: string) => {
		setStartDate(start)
		setEndDate(end)
	}

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
			<Header performanceScore={overallScore} performanceDate={radarDate} currentTime={currentTime} onSignOut={signOut} />
			
			<div className="dashboard-content">
				<Sidebar
					conversations={totalMessages}
					satisfaction={94.5}
					documents={156}
					performanceScore={overallScore}
					performanceDate={radarDate}
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
							<PerformanceRadar
								relevance={radarProps.relevance}
								tone={radarProps.tone}
								length={radarProps.length}
								accuracy={radarProps.accuracy}
								toxicity={radarProps.toxicity}
								promptInjection={radarProps.promptInjection}
								timelineData={filteredRadarData}
								selectedDate={selectedRadarDate}
								onDateChange={setSelectedRadarDate}
								includeSimulatedData={includeSimulatedData}
								onIncludeSimulatedDataChange={setIncludeSimulatedData}
								estimationMode={estimationMode}
								onEstimationModeChange={setEstimationMode}
							/>

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
		</div>
	)
}

