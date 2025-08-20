import { useState, useEffect } from 'react'
import { IconX } from '../ui/icons'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'
import { getAdminFeedbackBatch, saveAdminFeedback, updateAdminFeedback, deleteAdminFeedback } from '../services/adminFeedback'
import { ensureChatDataExists } from '../services/chatData'
import { AdminFeedbackData } from '../services/supabase'

import PromptControl from '../components/PromptControl'
import UserFeedback from '../components/UserFeedback'
import '../styles/dashboard.css'
import '../styles/radar.css'
import '../styles/prompt.css'
import '../styles/userFeedback.css'
import '../styles/tabs.css'

function formatDate(d: Date): string {
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function formatSessionId(sessionId: string): string {
	if (sessionId.length <= 8) {
		return sessionId
	}
	return `...${sessionId.slice(-5)}`
}

function formatDateForAPI(d: Date, isEndDate: boolean = false): string {
	// API expects dates in Korea timezone (UTC+9) formatted as yyyy-MM-dd HH:mm:ss
	// Create a date object representing the selected date at midnight local time
	const localDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
	
	if (isEndDate) {
		// For end date, set to end of day (23:59:59) local time
		localDate.setHours(23, 59, 59, 999)
	} else {
		// For start date, set to beginning of day (00:00:00) local time
		localDate.setHours(0, 0, 0, 0)
	}
	
	// Convert to Korea time by adding the difference between Korea (UTC+9) and local timezone
	const koreaOffset = 9 * 60 // Korea is UTC+9 (540 minutes)
	const localOffset = localDate.getTimezoneOffset() // Local timezone offset in minutes
	const offsetDifference = koreaOffset + localOffset // Total offset to add
	
	const koreaTime = new Date(localDate.getTime() + (offsetDifference * 60 * 1000))
	
	// Format as Korea time
	const year = koreaTime.getFullYear()
	const month = String(koreaTime.getMonth() + 1).padStart(2, '0')
	const day = String(koreaTime.getDate()).padStart(2, '0')
	const hours = String(koreaTime.getHours()).padStart(2, '0')
	const minutes = String(koreaTime.getMinutes()).padStart(2, '0')
	const seconds = String(koreaTime.getSeconds()).padStart(2, '0')
	
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export default function Content() {
	const [authToken, setAuthToken] = useState<string | null>(null)
	const [sessions, setSessions] = useState<any[]>([])
	const [isLoadingSessions, setIsLoadingSessions] = useState(false)
	const [sessionRequests, setSessionRequests] = useState<Record<string, any[]>>({})
	const [requestDetails, setRequestDetails] = useState<Record<string, any>>({})
	const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
	const [feedbackModal, setFeedbackModal] = useState<{
		isOpen: boolean, 
		type: 'positive' | 'negative' | null, 
		requestId: string | null, 
		mode: 'submit' | 'view' | 'edit',
		existingFeedback?: AdminFeedbackData | null
	}>({
		isOpen: false,
		type: null,
		requestId: null,
		mode: 'submit',
		existingFeedback: null
	})
	const [feedbackText, setFeedbackText] = useState<string>('')
	const [adminFeedback, setAdminFeedback] = useState<Record<string, AdminFeedbackData>>({})
	const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
	const [expandedFeedbackForms, setExpandedFeedbackForms] = useState<Set<string>>(new Set())
	const [closingFeedbackForms, setClosingFeedbackForms] = useState<Set<string>>(new Set())
	const [feedbackFormData, setFeedbackFormData] = useState<Record<string, { text: string, preferredResponse: string }>>({})
	const [submittingFeedbackRequests, setSubmittingFeedbackRequests] = useState<Set<string>>(new Set())
	const [confirmationModal, setConfirmationModal] = useState<{
		isOpen: boolean,
		type: 'switchToPositive' | 'switchToNegative' | 'deleteNegative' | null,
		requestId: string | null,
		onConfirm: (() => void) | null
	}>({
		isOpen: false,
		type: null,
		requestId: null,
		onConfirm: null
	})

	// Date filters: default to [today-7, today]
	const today = new Date()
	const sevenDaysAgo = new Date()
	sevenDaysAgo.setDate(today.getDate() - 7)
	const [startDate, setStartDate] = useState<string>(formatDate(sevenDaysAgo))
	const [endDate, setEndDate] = useState<string>(formatDate(today))
	
	// Helper functions to format dates for API calls with proper UTC time
	const getApiStartDate = (startDateString: string): string => {
		const startDateObj = new Date(startDateString)
		return formatDateForAPI(startDateObj, false)
	}
	
	const getApiEndDate = (endDateString: string): string => {
		const endDateObj = new Date(endDateString)
		return formatDateForAPI(endDateObj, true)
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
			const apiStartDate = getApiStartDate(startDate)
			const apiEndDate = getApiEndDate(endDate)
			try {
				const response = await fetchSessions(authToken!, apiStartDate, apiEndDate)
				if (!cancelled) {
					setSessions(response.sessions || [])
					
					// Fetch requests for all sessions simultaneously
					const sessions = response.sessions || []
					const requestPromises = sessions
						.filter(session => session.sessionId)
						.map(session => 
							fetchSessionRequests(authToken!, session.sessionId, apiStartDate, apiEndDate)
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
						
						// Fetch admin feedback for all requests simultaneously
						try {
							const feedbackMap = await getAdminFeedbackBatch(allRequestIds)
							setAdminFeedback(feedbackMap)
						} catch (error) {
							console.error('Failed to fetch admin feedback:', error)
						}
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

	function toggleSessionExpansion(sessionId: string) {
		const newExpanded = new Set(expandedSessions)
		if (newExpanded.has(sessionId)) {
			newExpanded.delete(sessionId)
		} else {
			newExpanded.add(sessionId)
		}
		setExpandedSessions(newExpanded)
	}

	const handleFeedbackClick = async (type: 'positive' | 'negative', requestId: string) => {
		const existingFeedback = adminFeedback[requestId]
		
		if (existingFeedback) {
			if (type === 'positive' && existingFeedback.feedback_verdict === 'good') {
				// Green thumbs up clicked again - remove positive feedback
				await removePositiveFeedback(requestId)
			} else if (type === 'positive' && existingFeedback.feedback_verdict === 'bad') {
				// Red thumbs down exists, thumbs up clicked - show confirmation modal
				setConfirmationModal({
					isOpen: true,
					type: 'switchToPositive',
					requestId: requestId,
					onConfirm: () => switchToPositiveFeedback(requestId)
				})
			} else if (type === 'negative' && existingFeedback.feedback_verdict === 'good') {
				// Green thumbs up exists, thumbs down clicked - show confirmation modal
				setConfirmationModal({
					isOpen: true,
					type: 'switchToNegative',
					requestId: requestId,
					onConfirm: () => switchToNegativeFeedback(requestId)
				})
			} else if (type === 'negative' && existingFeedback.feedback_verdict === 'bad') {
				// Red thumbs down clicked again - show form with existing data for editing/deleting
				setExpandedFeedbackForms(prev => new Set(prev).add(requestId))
				setFeedbackFormData(prev => ({
					...prev,
					[requestId]: { 
						text: existingFeedback.feedback_text || '', 
						preferredResponse: existingFeedback.corrected_response || '' 
					}
				}))
			}
		} else if (type === 'positive') {
			// Auto-submit positive feedback with empty text
			await submitPositiveFeedback(requestId)
		} else {
			// Toggle inline form for negative feedback
			if (expandedFeedbackForms.has(requestId)) {
				// Close the form if it's already open
				closeFeedbackForm(requestId)
			} else {
				// Open the form
				setExpandedFeedbackForms(prev => new Set(prev).add(requestId))
				setFeedbackFormData(prev => ({
					...prev,
					[requestId]: { text: '', preferredResponse: '' }
				}))
			}
		}
	}

	const closeFeedbackModal = () => {
		setFeedbackModal({
			isOpen: false,
			type: null,
			requestId: null,
			mode: 'submit',
			existingFeedback: null
		})
		setFeedbackText('')
	}

	const editFeedback = () => {
		setFeedbackModal(prev => ({
			...prev,
			mode: 'edit'
		}))
	}

	const closeFeedbackForm = (requestId: string) => {
		// Start closing animation
		setClosingFeedbackForms(prev => new Set(prev).add(requestId))
		
		// After animation completes, remove from expanded forms
		setTimeout(() => {
			setExpandedFeedbackForms(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
			setClosingFeedbackForms(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
			setFeedbackFormData(prev => {
				const newData = { ...prev }
				delete newData[requestId]
				return newData
			})
		}, 300) // Match the animation duration
	}

	const removePositiveFeedback = async (requestId: string) => {
		setSubmittingFeedbackRequests(prev => new Set(prev).add(requestId))
		
		try {
			await deleteAdminFeedback(requestId)
			
			// Update local state
			setAdminFeedback(prev => {
				const newState = { ...prev }
				delete newState[requestId]
				return newState
			})
		} catch (error) {
			console.error('Failed to remove positive feedback:', error)
		} finally {
			setSubmittingFeedbackRequests(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
		}
	}

	const switchToPositiveFeedback = async (requestId: string) => {
		setSubmittingFeedbackRequests(prev => new Set(prev).add(requestId))
		
		try {
			// Delete existing negative feedback and save positive
			await deleteAdminFeedback(requestId)
			const savedFeedback = await saveAdminFeedback(requestId, 'good', '')
			
			// Update local state
			setAdminFeedback(prev => ({
				...prev,
				[requestId]: savedFeedback
			}))
			
			// Close confirmation modal
			setConfirmationModal({
				isOpen: false,
				type: null,
				requestId: null,
				onConfirm: null
			})
		} catch (error) {
			console.error('Failed to switch to positive feedback:', error)
		} finally {
			setSubmittingFeedbackRequests(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
		}
	}

	const switchToNegativeFeedback = async (requestId: string) => {
		// Close confirmation modal first
		setConfirmationModal({
			isOpen: false,
			type: null,
			requestId: null,
			onConfirm: null
		})
		
		// Open the negative feedback form for new input
		setExpandedFeedbackForms(prev => new Set(prev).add(requestId))
		setFeedbackFormData(prev => ({
			...prev,
			[requestId]: { text: '', preferredResponse: '' }
		}))
	}

	const deleteFeedback = async (requestId: string) => {
		setSubmittingFeedbackRequests(prev => new Set(prev).add(requestId))
		
		try {
			await deleteAdminFeedback(requestId)
			
			// Update local state
			setAdminFeedback(prev => {
				const newState = { ...prev }
				delete newState[requestId]
				return newState
			})
			
			// Close the form and modal
			closeFeedbackForm(requestId)
			setConfirmationModal({
				isOpen: false,
				type: null,
				requestId: null,
				onConfirm: null
			})
		} catch (error) {
			console.error('Failed to delete feedback:', error)
		} finally {
			setSubmittingFeedbackRequests(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
		}
	}

	const submitNegativeFeedbackOverride = async (requestId: string) => {
		const formData = feedbackFormData[requestId]
		if (!formData || !formData.text.trim()) {
			return
		}

		setSubmittingFeedbackRequests(prev => new Set(prev).add(requestId))
		
		try {
			// Delete existing positive feedback and save negative
			await deleteAdminFeedback(requestId)
			
			// Ensure chat data exists first
			const requestDetail = requestDetails[requestId]
			if (requestDetail) {
				// Find the session ID for this request
				let sessionId = ''
				for (const [sId, requests] of Object.entries(sessionRequests)) {
					if (requests.some(r => (r.requestId || r.id) === requestId)) {
						sessionId = sId
						break
					}
				}
				
				if (sessionId) {
					await ensureChatDataExists(
						requestId,
						sessionId,
						requestDetail.inputText || '',
						requestDetail.outputText || ''
					)
				}
			}
			
			// Save negative feedback
			const savedFeedback = await saveAdminFeedback(
				requestId, 
				'bad', 
				formData.text,
				formData.preferredResponse.trim() || undefined
			)
			
			// Update local state
			setAdminFeedback(prev => ({
				...prev,
				[requestId]: savedFeedback
			}))
			
			// Close the form and modal
			closeFeedbackForm(requestId)
			setConfirmationModal({
				isOpen: false,
				type: null,
				requestId: null,
				onConfirm: null
			})
		} catch (error) {
			console.error('Failed to submit negative feedback override:', error)
		} finally {
			setSubmittingFeedbackRequests(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
		}
	}

	const submitPositiveFeedback = async (requestId: string) => {
		setSubmittingFeedbackRequests(prev => new Set(prev).add(requestId))
		
		try {
			// Ensure chat data exists first
			const requestDetail = requestDetails[requestId]
			if (requestDetail) {
				// Find the session ID for this request
				let sessionId = ''
				for (const [sId, requests] of Object.entries(sessionRequests)) {
					if (requests.some(r => (r.requestId || r.id) === requestId)) {
						sessionId = sId
						break
					}
				}
				
				if (sessionId) {
					await ensureChatDataExists(
						requestId,
						sessionId,
						requestDetail.inputText || '',
						requestDetail.outputText || ''
					)
				}
			}
			
			// Save positive feedback with empty text (no corrected response for positive feedback)
			const savedFeedback = await saveAdminFeedback(requestId, 'good', '')
			
			// Update local state
			setAdminFeedback(prev => ({
				...prev,
				[requestId]: savedFeedback
			}))
			
		} catch (error) {
			console.error('Failed to submit positive feedback:', error)
		} finally {
			setSubmittingFeedbackRequests(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
		}
	}

	const submitInlineFeedback = async (requestId: string) => {
		const formData = feedbackFormData[requestId]
		if (!formData || !formData.text.trim()) {
			return
		}

		// Check if there's existing positive feedback
		const existingFeedback = adminFeedback[requestId]
		if (existingFeedback && existingFeedback.feedback_verdict === 'good') {
			// Show confirmation modal for switching to negative
			setConfirmationModal({
				isOpen: true,
				type: 'switchToNegative',
				requestId: requestId,
				onConfirm: () => submitNegativeFeedbackOverride(requestId)
			})
			return
		}

		setSubmittingFeedbackRequests(prev => new Set(prev).add(requestId))
		
		try {
			// Ensure chat data exists first
			const requestDetail = requestDetails[requestId]
			if (requestDetail) {
				// Find the session ID for this request
				let sessionId = ''
				for (const [sId, requests] of Object.entries(sessionRequests)) {
					if (requests.some(r => (r.requestId || r.id) === requestId)) {
						sessionId = sId
						break
					}
				}
				
				if (sessionId) {
					await ensureChatDataExists(
						requestId,
						sessionId,
						requestDetail.inputText || '',
						requestDetail.outputText || ''
					)
				}
			}
			
			// Save negative feedback with separate fields
			const savedFeedback = await saveAdminFeedback(
				requestId, 
				'bad', 
				formData.text,
				formData.preferredResponse.trim() || undefined
			)
			
			// Update local state
			setAdminFeedback(prev => ({
				...prev,
				[requestId]: savedFeedback
			}))
			
			// Close the inline form with animation
			closeFeedbackForm(requestId)
			
		} catch (error) {
			console.error('Failed to submit inline feedback:', error)
		} finally {
			setSubmittingFeedbackRequests(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
		}
	}

	const submitFeedback = async () => {
		if (!feedbackModal.requestId || !feedbackModal.type || !feedbackText.trim()) {
			return
		}

		setIsSubmittingFeedback(true)
		
		try {
			const verdict = feedbackModal.type === 'positive' ? 'good' : 'bad'
			
			// Ensure chat data exists first (required for foreign key constraint)
			const requestDetail = requestDetails[feedbackModal.requestId]
			if (requestDetail) {
				// Find the session ID for this request
				let sessionId = ''
				for (const [sId, requests] of Object.entries(sessionRequests)) {
					if (requests.some(r => (r.requestId || r.id) === feedbackModal.requestId)) {
						sessionId = sId
						break
					}
				}
				
				if (sessionId) {
					await ensureChatDataExists(
						feedbackModal.requestId,
						sessionId,
						requestDetail.inputText || '',
						requestDetail.outputText || ''
					)
				}
			}
			
			let savedFeedback: AdminFeedbackData
			if (feedbackModal.mode === 'edit' || feedbackModal.existingFeedback) {
				// Update existing feedback (preserve existing corrected_response if any)
				const existingCorrectedResponse = feedbackModal.existingFeedback?.corrected_response
				savedFeedback = await updateAdminFeedback(feedbackModal.requestId, verdict, feedbackText, existingCorrectedResponse || undefined)
			} else {
				// Save new feedback (modal doesn't have corrected response field)
				savedFeedback = await saveAdminFeedback(feedbackModal.requestId, verdict, feedbackText)
			}
			
			// Update local state
			setAdminFeedback(prev => ({
				...prev,
				[feedbackModal.requestId!]: savedFeedback
			}))
			
			closeFeedbackModal()
		} catch (error) {
			console.error('Failed to submit feedback:', error)
			// TODO: Show error message to user
		} finally {
			setIsSubmittingFeedback(false)
		}
	}

	return (
		<div className="screen">
			<main className="content">
				<div className="content-sections">
					{/* Recent Conversations Section */}
					<div className="content-section">
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
															<div className="session-datetime">
																{session.createdAt ? (
																	<>
																		<span className="session-date">
																			{new Date(session.createdAt).toLocaleDateString()}
																		</span>
																		<span className="session-time">
																			{new Date(session.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
																		</span>
																	</>
																) : (
																	<span className="session-date">No date</span>
																)}
															</div>
															<div className="session-messages">
																{requests.length === 1 ? '1 message' : `${requests.length} messages`}
															</div>
														</div>
														<div className="session-right">
															<div className="session-label">Session:</div>
															<div className="session-id" title={sessionId.length > 8 ? sessionId : undefined}>
																{formatSessionId(sessionId)}
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
																								{new Date(request.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
																							</div>
																						</>
																					) : (
																						<div className="request-date">No date available</div>
																					)}
																				</div>
																				<div className="request-actions">
																					<button 
																						className={`thumbs-btn thumbs-up ${adminFeedback[requestId]?.feedback_verdict === 'good' ? 'submitted' : ''} ${submittingFeedbackRequests.has(requestId) ? 'loading' : ''}`}
																						title="Thumbs Up"
																						onClick={() => handleFeedbackClick('positive', requestId)}
																						disabled={submittingFeedbackRequests.has(requestId)}
																					>
																						<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
																							<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
																						</svg>
																					</button>
																					<button 
																						className={`thumbs-btn thumbs-down ${adminFeedback[requestId]?.feedback_verdict === 'bad' ? 'submitted' : ''}`}
																						title="Thumbs Down"
																						onClick={() => handleFeedbackClick('negative', requestId)}
																					>
																						<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
																							<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
																						</svg>
																					</button>
																				</div>
																			</div>
																			
																			{/* Inline feedback form for negative feedback - positioned after header */}
																			{expandedFeedbackForms.has(requestId) && (
																				<div className={`inline-feedback-form ${closingFeedbackForms.has(requestId) ? 'closing' : ''}`}>
																					<div className="feedback-form-fields">
																						<div className="feedback-field">
																							<label htmlFor={`feedback-text-${requestId}`}>Supervisor Feedback:</label>
																							<textarea
																								id={`feedback-text-${requestId}`}
																								className="feedback-input"
																								value={feedbackFormData[requestId]?.text || ''}
																								onChange={(e) => setFeedbackFormData(prev => ({
																									...prev,
																									[requestId]: {
																										...prev[requestId],
																										text: e.target.value
																									}
																								}))}
																								placeholder="Explain what was wrong with this response..."
																								rows={3}
																							/>
																						</div>
																						<div className="feedback-field">
																							<label htmlFor={`preferred-response-${requestId}`}>Corrected Response:</label>
																							<textarea
																								id={`preferred-response-${requestId}`}
																								className="feedback-input"
																								value={feedbackFormData[requestId]?.preferredResponse || ''}
																								onChange={(e) => setFeedbackFormData(prev => ({
																									...prev,
																									[requestId]: {
																										...prev[requestId],
																										preferredResponse: e.target.value
																									}
																								}))}
																								placeholder="Enter the corrected response..."
																								rows={4}
																							/>
																						</div>
																					</div>
																					<div className="feedback-form-actions">
																						{adminFeedback[requestId]?.feedback_verdict === 'bad' ? (
																							<button 
																								className="btn btn-ghost delete-feedback-btn"
																								onClick={() => setConfirmationModal({
																									isOpen: true,
																									type: 'deleteNegative',
																									requestId: requestId,
																									onConfirm: () => deleteFeedback(requestId)
																								})}
																								disabled={submittingFeedbackRequests.has(requestId)}
																							>
																								Delete
																							</button>
																						) : (
																							<button 
																								className="btn btn-ghost cancel-feedback-btn"
																								onClick={() => closeFeedbackForm(requestId)}
																								disabled={submittingFeedbackRequests.has(requestId)}
																							>
																								Cancel
																							</button>
																						)}
																						<button 
																							className="btn submit-inline-feedback-btn"
																							onClick={() => submitInlineFeedback(requestId)}
																							disabled={!feedbackFormData[requestId]?.text?.trim() || submittingFeedbackRequests.has(requestId)}
																						>
																							{submittingFeedbackRequests.has(requestId) ? 'Submitting...' : 'Submit'}
																						</button>
																					</div>
																				</div>
																			)}
																			
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
					</div>

					{/* User Feedback Section */}
					<div className="content-section">
						<UserFeedback />
					</div>

					{/* Prompt Control Section */}
					<div className="content-section">
						<PromptControl />
					</div>
				</div>
			</main>

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
							{feedbackModal.mode === 'view' ? (
								<>
									<p className="feedback-prompt">
										<strong>Existing Feedback</strong> ({feedbackModal.existingFeedback?.feedback_verdict === 'good' ? 'Positive' : 'Negative'})
									</p>
									<div className="feedback-display">
										<div className="feedback-section">
											<div className="feedback-section-title">Feedback:</div>
											<div className="feedback-text-display">
												{feedbackModal.existingFeedback?.feedback_text}
											</div>
										</div>
										{feedbackModal.existingFeedback?.corrected_response && (
											<div className="feedback-section">
												<div className="feedback-section-title">Corrected Response:</div>
												<div className="feedback-text-display">
													{feedbackModal.existingFeedback.corrected_response}
												</div>
											</div>
										)}
										<div className="feedback-meta">
											Submitted: {feedbackModal.existingFeedback?.created_at ? new Date(feedbackModal.existingFeedback.created_at).toLocaleString() : 'Unknown'}
										</div>
									</div>
									<button 
										className="btn edit-feedback-btn" 
										onClick={editFeedback}
									>
										Edit
									</button>
								</>
							) : (
								<>
									<p className="feedback-prompt">
										{feedbackModal.mode === 'edit' ? (
											<>
												<strong>Edit Feedback</strong> ({feedbackModal.existingFeedback?.feedback_verdict === 'good' ? 'Positive' : 'Negative'})
											</>
										) : (
											feedbackModal.type === 'positive' 
												? 'Please explain what was positive about this chat response'
												: 'Please explain what was negative about this chat response'
										)}
									</p>
									<textarea
										className="feedback-textarea"
										value={feedbackText}
										onChange={(e) => setFeedbackText(e.target.value)}
										placeholder="Enter your feedback here..."
										rows={4}
										disabled={isSubmittingFeedback}
									/>
									<div className="feedback-actions">
										{feedbackModal.mode === 'edit' && (
											<button 
												className="btn btn-ghost cancel-edit-btn" 
												onClick={() => setFeedbackModal(prev => ({ ...prev, mode: 'view' }))}
												disabled={isSubmittingFeedback}
											>
												Cancel
											</button>
										)}
										<button 
											className="btn submit-feedback-btn" 
											onClick={submitFeedback}
											disabled={!feedbackText.trim() || isSubmittingFeedback}
										>
											{isSubmittingFeedback ? 'Updating...' : 'Update'}
										</button>
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{confirmationModal.isOpen && (
				<div className="modal-backdrop" onClick={() => setConfirmationModal({
					isOpen: false,
					type: null,
					requestId: null,
					onConfirm: null
				})}>
					<div className="confirmation-modal card" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h2 className="h1 modal-title">Confirm Action</h2>
							<button className="icon-btn" onClick={() => setConfirmationModal({
								isOpen: false,
								type: null,
								requestId: null,
								onConfirm: null
							})}>
								<IconX />
							</button>
						</div>
						<div className="confirmation-content">
							{confirmationModal.type === 'switchToPositive' && (
								<p>A negative feedback was already provided for this chat message/response. Are you sure you would like to change it to a positive review? This will remove the previously saved negative feedback.</p>
							)}
							{confirmationModal.type === 'switchToNegative' && (
								<p>A positive feedback was already provided for this chat message/response. Are you sure you would like to change it to a negative review? This will remove the previously saved positive feedback.</p>
							)}
							{confirmationModal.type === 'deleteNegative' && (
								<p>Are you certain you want to delete this negative feedback? This action cannot be undone.</p>
							)}
						</div>
						<button 
							className="btn btn-ghost confirmation-no-btn" 
							onClick={() => setConfirmationModal({
								isOpen: false,
								type: null,
								requestId: null,
								onConfirm: null
							})}
						>
							No
						</button>
						<button 
							className="btn btn-primary confirmation-yes-btn" 
							onClick={() => confirmationModal.onConfirm && confirmationModal.onConfirm()}
						>
							Yes
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
