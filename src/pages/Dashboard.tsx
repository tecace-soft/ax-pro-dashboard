import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconGear, IconLogout, IconX } from '../ui/icons'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'
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

	// Date filters: default to [today-7, today]
	const today = new Date()
	const sevenDaysAgo = new Date()
	sevenDaysAgo.setDate(today.getDate() - 7)
	const [startDate, setStartDate] = useState<string>(formatDate(sevenDaysAgo))
	const [endDate, setEndDate] = useState<string>(formatDate(today))

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

	function signOut() {
		sessionStorage.removeItem('axAccess')
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

	return (
		<div className="screen">
			<header className="topbar">
				<div className="brand">TecAce Ax Pro</div>
				<div className="header-actions">
					<button className="icon-btn" aria-label="Open settings" title="Settings" onClick={() => setIsSettingsOpen(true)}>
						<IconGear />
					</button>
					<button className="icon-btn" aria-label="Sign out" title="Sign out" onClick={signOut}>
						<IconLogout />
					</button>
				</div>
			</header>
			<main className="content">
				<div className="card">
					<h1 className="h1">Dashboard</h1>
					<p className="muted">This is a placeholder. We will build HR insights here.</p>
				</div>

				<div className="card section" aria-labelledby="recent-conv-title">
					<div className="section-header">
						<div id="recent-conv-title" className="section-title">Recent Conversations</div>
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
													<div className="session-id">{sessionId}</div>
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
																		<div className="request-id">Request: {requestId}</div>
																		<div className="request-time">
																			{request.createdAt ? new Date(request.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
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
				</div>
			</main>

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