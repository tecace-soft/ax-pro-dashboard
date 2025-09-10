import { useState, useEffect, useMemo } from 'react'
import { IconX } from '../ui/icons'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'
import { getAdminFeedbackBatch, getAllAdminFeedback, saveAdminFeedback, updateAdminFeedback, deleteAdminFeedback, updateAdminFeedbackPromptApply } from '../services/adminFeedback'
import { ensureChatDataExists } from '../services/chatData'
import { AdminFeedbackData } from '../services/supabase'
import { updatePromptWithFeedback } from '../services/promptUpdater'
import { downloadAdminFeedbackData } from '../services/adminFeedbackExport'
import { downloadConversationsData, ConversationExportData } from '../services/conversationsExport'
import { conversationsCache } from '../services/conversationsCache'

interface CacheData {
	sessions: any[]
	sessionRequests: Record<string, any[]>
	requestDetails: Record<string, any>
	adminFeedback: Record<string, any>
}

import PromptControl from '../components/PromptControl'
import UserFeedback from '../components/UserFeedback'
import '../styles/dashboard.css'
import '../styles/prompt.css'
import '../styles/userFeedback.css'

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

interface ContentProps {
	startDate: string
	endDate: string
	onDateChange: (start: string, end: string) => void
}

export default function Content({ startDate, endDate, onDateChange }: ContentProps) {
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

	// Add state to trigger prompt refresh
	const [promptRefreshTrigger, setPromptRefreshTrigger] = useState(0)
	const [adminFeedbackSortBy, setAdminFeedbackSortBy] = useState<'requestId' | 'date'>('date')
	const [adminFeedbackFilter, setAdminFeedbackFilter] = useState('')
	const [deleteAdminFeedbackModal, setDeleteAdminFeedbackModal] = useState<{
		isOpen: boolean,
		requestId: string | null,
		feedbackText: string
	}>({
		isOpen: false,
		requestId: null,
		feedbackText: ''
	})

	const [updatePromptSuccessModal, setUpdatePromptSuccessModal] = useState<{
		isOpen: boolean
	}>({
		isOpen: false
	})

	// Function to trigger prompt refresh
	const triggerPromptRefresh = () => {
		setPromptRefreshTrigger(prev => prev + 1)
	}

	const handleDeleteAdminFeedback = async (requestId: string) => {
		try {
			await deleteAdminFeedback(requestId)
			
			// Update local state
			setAdminFeedback(prev => {
				const newState = { ...prev }
				delete newState[requestId]
				return newState
			})
			
			// Update system prompt to reflect the deletion
			await updatePromptWithFeedback()
			
			// Trigger prompt refresh in PromptControl component
			triggerPromptRefresh()
			
			// Close modal
			setDeleteAdminFeedbackModal({
				isOpen: false,
				requestId: null,
				feedbackText: ''
			})
		} catch (error) {
			console.error('Failed to delete admin feedback:', error)
		}
	}

	const handleTogglePromptApply = async (requestId: string, currentValue: boolean) => {
		try {
			const newValue = !currentValue
			await updateAdminFeedbackPromptApply(requestId, newValue)
			setAdminFeedback(prev => ({
				...prev,
				[requestId]: {
					...prev[requestId],
					prompt_apply: newValue
				}
			}))
		} catch (error) {
			console.error('Failed to update prompt_apply:', error)
		}
	}

	// Date filters now come from props (Dashboard.tsx)
	
	// Helper functions to format dates for API calls with proper UTC time
	// Add 1 day to compensate for API being a day ahead
	const getApiStartDate = (startDateString: string): string => {
		const startDateObj = new Date(startDateString)
		startDateObj.setDate(startDateObj.getDate() + 1) // Add 1 day
		return formatDateForAPI(startDateObj, false)
	}
	
	const getApiEndDate = (endDateString: string): string => {
		const endDateObj = new Date(endDateString)
		endDateObj.setDate(endDateObj.getDate() + 1) // Add 1 day
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

	// 로딩 상태를 더 세분화
	const [loadingState, setLoadingState] = useState<{
		sessions: boolean
		requests: boolean
		details: boolean
		progress: number
		loadedDetails: number // 로딩된 메시지 수
		totalDetails: number // 전체 메시지 수
	}>({
		sessions: false,
		requests: false,
		details: false,
		progress: 0,
		loadedDetails: 0,
		totalDetails: 0
	})

	// 최적화된 데이터 로딩 함수
	const loadConversationsOptimized = async () => {
		if (!authToken) return

		const cacheKey = conversationsCache.generateKey(startDate, endDate)
		
		// 1. 캐시에서 데이터 확인
		const cachedData = conversationsCache.get<CacheData>(cacheKey) || 
			conversationsCache.getFromStorage<CacheData>(cacheKey)
		
		if (cachedData && cachedData.sessions && cachedData.sessionRequests && cachedData.requestDetails) {
			setSessions(cachedData.sessions)
			setSessionRequests(cachedData.sessionRequests)
			setRequestDetails(cachedData.requestDetails)
			// Admin feedback is loaded separately, not from cache
			return
		}

		// 2. 캐시에 없으면 API 호출
		setIsLoadingSessions(true)
		setLoadingState(prev => ({ ...prev, sessions: true, progress: 10 }))
		
		const apiStartDate = getApiStartDate(startDate)
		const apiEndDate = getApiEndDate(endDate)
		
		try {
			// 1. Sessions만 먼저 로드
			const sessionsResponse = await fetchSessions(authToken, apiStartDate, apiEndDate)
			const sessions = sessionsResponse.sessions || []
			setSessions(sessions)
			setLoadingState(prev => ({ ...prev, sessions: false, requests: true, progress: 30 }))
			
			// 2. Session Requests 병렬 로드
			const requestPromises = sessions
				.filter(session => session.sessionId)
				.map(session => 
					fetchSessionRequests(authToken, session.sessionId, apiStartDate, apiEndDate)
						.catch(error => {
							console.error(`Failed to fetch requests for session ${session.sessionId}:`, error)
							return { requests: [] }
						})
				)

			const requestResponses = await Promise.all(requestPromises)
			setLoadingState(prev => ({ ...prev, requests: false, details: true, progress: 50 }))
			
			// 3. Session Requests 저장 및 Request ID 수집
			const sessionRequestsMap: Record<string, any[]> = {}
			const allRequestIds: string[] = []
			
			requestResponses.forEach((requestResponse, index) => {
				const sessionId = sessions[index]?.sessionId
				if (requestResponse?.requests && sessionId) {
					sessionRequestsMap[sessionId] = requestResponse.requests
					requestResponse.requests.forEach((request: any) => {
						const requestId = request.requestId || request.id
						if (requestId) {
							allRequestIds.push(requestId)
						}
					})
				}
			})
			
			// 4. 세션 데이터를 먼저 표시 (사용자가 바로 볼 수 있게)
			setSessionRequests(sessionRequestsMap)
			setIsLoadingSessions(false) // 세션 로딩 완료
			setLoadingState(prev => ({ 
				...prev, 
				progress: 60, 
				totalDetails: allRequestIds.length,
				loadedDetails: 0
			}))

			// 5. Request Details를 개별적으로 로딩 (각각 완료되면 바로 표시)
			if (allRequestIds.length > 0) {
				const requestDetailsMap: Record<string, any> = {}
				let loadedCount = 0
				
				// 모든 Request Details를 병렬로 로딩
				const detailPromises = allRequestIds.map(async (requestId, index) => {
					try {
						const detailResponse = await fetchRequestDetail(authToken, requestId)
						if (detailResponse?.request) {
							requestDetailsMap[requestId] = detailResponse.request
							
							// 개별 메시지가 로딩되면 바로 상태 업데이트
							loadedCount++
							const progress = 60 + Math.round((loadedCount / allRequestIds.length) * 30)
							
							// 상태 업데이트 (배치로 처리하여 성능 최적화)
							if (loadedCount % 5 === 0 || loadedCount === allRequestIds.length) {
								setRequestDetails(prev => ({ ...prev, ...requestDetailsMap }))
								setLoadingState(prev => ({ 
									...prev, 
									progress,
									loadedDetails: loadedCount
								}))
							}
						}
					} catch (error) {
						console.error(`Failed to fetch detail for request ${requestId}:`, error)
						loadedCount++
						
						if (loadedCount % 5 === 0 || loadedCount === allRequestIds.length) {
							setRequestDetails(prev => ({ ...prev, ...requestDetailsMap }))
							setLoadingState(prev => ({ 
								...prev, 
								loadedDetails: loadedCount
							}))
						}
					}
				})
				
				// 모든 요청이 완료될 때까지 대기
				await Promise.all(detailPromises)
				
				// 최종 상태 업데이트
				setRequestDetails(requestDetailsMap)
				
				// 6. 캐시에 저장 (admin feedback is loaded separately now)
				setLoadingState(prev => ({ ...prev, progress: 90 }))
				const cacheData: CacheData = {
					sessions,
					sessionRequests: sessionRequestsMap,
					requestDetails: requestDetailsMap,
					adminFeedback: {} // Empty since admin feedback is loaded separately
				}
				
				conversationsCache.set(cacheKey, cacheData)
				conversationsCache.setToStorage(cacheKey, cacheData)
			}
			
			setLoadingState(prev => ({ ...prev, progress: 100 }))
			
		} catch (error) {
			console.error('Failed to load conversations:', error)
			setIsLoadingSessions(false)
		} finally {
			// 세션 로딩은 이미 완료되었으므로 여기서는 details만 리셋
			setLoadingState(prev => ({ ...prev, details: false, progress: 0, loadedDetails: 0, totalDetails: 0 }))
		}
	}

	// Fetch sessions when token is available or dates change
	useEffect(() => {
		if (!authToken) return

		let cancelled = false
		
		async function loadSessions() {
			loadConversationsOptimized()
		}
		
		loadSessions()
		
		return () => {
			cancelled = true
		}
	}, [authToken, startDate, endDate])

	// Load all admin feedback separately (not dependent on date range)
	useEffect(() => {
		if (!authToken) return

		let cancelled = false
		
		async function loadAllAdminFeedback() {
			try {
				const allFeedback = await getAllAdminFeedback()
				if (!cancelled) {
					setAdminFeedback(allFeedback)
				}
			} catch (error) {
				if (!cancelled) {
					console.error('Failed to load all admin feedback:', error)
				}
			}
		}
		
		loadAllAdminFeedback()
		
		return () => {
			cancelled = true
		}
	}, [authToken])

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
			
			// Update system prompt to reflect the deletion
			await updatePromptWithFeedback()
			
			// Trigger prompt refresh in PromptControl component
			triggerPromptRefresh()
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
			
			// Update system prompt to reflect the deletion of negative feedback
			await updatePromptWithFeedback()
			
			// Trigger prompt refresh in PromptControl component
			triggerPromptRefresh()
			
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
			
			// Update system prompt to reflect the deletion
			await updatePromptWithFeedback()
			
			// Trigger prompt refresh in PromptControl component
			triggerPromptRefresh()
			
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
			
			// Update prompt with new negative feedback
			await updatePromptWithFeedback()
			
			// Trigger prompt refresh in PromptControl component
			triggerPromptRefresh()
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
		if (!formData || (!formData.text.trim() && !formData.preferredResponse.trim())) {
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
			
			// Update prompt with new negative feedback
			await updatePromptWithFeedback()
			
			// Trigger prompt refresh in PromptControl component
			triggerPromptRefresh()
			
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
			
			// Update prompt with new/updated feedback (only for bad feedback)
			if (verdict === 'bad') {
				await updatePromptWithFeedback()
				
				// Trigger prompt refresh in PromptControl component
				triggerPromptRefresh()
			}
		} catch (error) {
			console.error('Failed to submit feedback:', error)
			// TODO: Show error message to user
		} finally {
			setIsSubmittingFeedback(false)
		}
	}

	// 총 메시지 수 계산 (Recent Conversations용)
	const totalMessages = useMemo(() => {
		let total = 0;
		if (sessions && sessionRequests) {
			sessions.forEach(session => {
				const sessionId = session?.sessionId || session?.id;
				const requests = sessionRequests[sessionId] || [];
				total += requests.length;
			});
		}
		return total;
	}, [sessions, sessionRequests]);

	// Filter and sort admin feedback
	const filteredAndSortedAdminFeedback = useMemo(() => {
		const negativeFeedback = Object.entries(adminFeedback)
			.filter(([requestId, feedback]) => feedback.feedback_verdict === 'bad')
			.filter(([requestId, feedback]) => {
				if (!adminFeedbackFilter.trim()) return true;
				const filterLower = adminFeedbackFilter.toLowerCase();
				return (
					requestId.toLowerCase().includes(filterLower) ||
					feedback.feedback_text?.toLowerCase().includes(filterLower) ||
					feedback.corrected_response?.toLowerCase().includes(filterLower) ||
					requestDetails[requestId]?.inputText?.toLowerCase().includes(filterLower) ||
					requestDetails[requestId]?.outputText?.toLowerCase().includes(filterLower)
				);
			})
			.sort(([requestIdA, feedbackA], [requestIdB, feedbackB]) => {
				if (adminFeedbackSortBy === 'requestId') {
					return requestIdA.localeCompare(requestIdB);
				} else {
					const dateA = new Date(feedbackA.created_at || 0).getTime();
					const dateB = new Date(feedbackB.created_at || 0).getTime();
					return dateB - dateA; // Most recent first
				}
			});
		
		return negativeFeedback;
	}, [adminFeedback, adminFeedbackFilter, adminFeedbackSortBy, requestDetails]);

	const [isExportingAdminFeedback, setIsExportingAdminFeedback] = useState(false)
	const [adminFeedbackExportFormat, setAdminFeedbackExportFormat] = useState<'csv' | 'excel' | 'json'>('csv')

	const handleAdminFeedbackExport = async () => {
		setIsExportingAdminFeedback(true)
		try {
			// Admin Feedback 데이터를 배열로 변환
			const adminFeedbackArray = Object.entries(adminFeedback).map(([requestId, feedback]) => ({
				...feedback,
				requestId,
				requestDetail: requestDetails[requestId] || null
			}))
			
			await downloadAdminFeedbackData(adminFeedbackArray, adminFeedbackExportFormat)
		} catch (error) {
			console.error('Admin feedback export failed:', error)
		} finally {
			setIsExportingAdminFeedback(false)
		}
	}

	const [isExportingConversations, setIsExportingConversations] = useState(false)
	const [conversationsExportFormat, setConversationsExportFormat] = useState<'csv' | 'excel' | 'json'>('csv')

	const handleConversationsExport = async () => {
		setIsExportingConversations(true)
		try {
			// Recent Conversations 데이터를 배열로 변환 (모든 데이터 포함)
			const conversationsData: ConversationExportData[] = []
			
			sessions.forEach(session => {
				const sessionId = session?.sessionId || session?.id
				const requests = sessionRequests[sessionId] || []
				
				requests.forEach(request => {
					const requestId = request.requestId || request.id
					const requestDetail = requestDetails[requestId] || {}
					const adminFeedbackData = adminFeedback[requestId]
					
					// 사용자 피드백 상태 확인 (좋아요/싫어요)
					let userFeedback: 'positive' | 'negative' | 'none' = 'none'
					if (adminFeedbackData?.feedback_verdict === 'good') {
						userFeedback = 'positive'
					} else if (adminFeedbackData?.feedback_verdict === 'bad') {
						userFeedback = 'negative'
					}
					
					conversationsData.push({
						// Session 정보
						sessionId: sessionId,
						sessionCreatedAt: session.createdAt || '',
						
						// Request 정보
						requestId: requestId,
						requestCreatedAt: request.createdAt || '',
						
						// 메시지 내용
						userMessage: requestDetail.inputText || '',
						aiResponse: requestDetail.outputText || '',
						
						// 피드백 정보
						userFeedback: userFeedback,
						adminFeedbackVerdict: adminFeedbackData?.feedback_verdict || 'none',
						supervisorFeedback: adminFeedbackData?.feedback_text || '',
						correctedResponse: adminFeedbackData?.corrected_response || '',
						promptApply: adminFeedbackData?.prompt_apply || false,
						
						// 메타데이터
						messageCount: requests.length,
						feedbackCreatedAt: adminFeedbackData?.created_at || '',
						feedbackUpdatedAt: adminFeedbackData?.updated_at || ''
					})
				})
			})
			
			await downloadConversationsData(conversationsData, conversationsExportFormat)
		} catch (error) {
			console.error('Conversations export failed:', error)
		} finally {
			setIsExportingConversations(false)
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
								<div id="recent-conv-title" className="section-title conversations-title">
									Recent Conversations 
									<span className="section-counter">({totalMessages} messages)</span>
								</div>
								<div className="date-controls">
									<label className="date-field">
										<span>Start Date</span>
										<input type="date" className="input date-input" value={startDate} onChange={(e)=>onDateChange(e.target.value, endDate)} />
									</label>
									<label className="date-field">
										<span>End Date</span>
										<input type="date" className="input date-input" value={endDate} onChange={(e)=>onDateChange(startDate, e.target.value)} />
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
																	const isLoadingDetail = loadingState.details && !detail
																	
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
																						disabled={submittingFeedbackRequests.has(requestId) || isLoadingDetail}
																					>
																						<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
																							<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
																						</svg>
																					</button>
																					<button 
																						className={`thumbs-btn thumbs-down ${adminFeedback[requestId]?.feedback_verdict === 'bad' ? 'submitted' : ''} ${submittingFeedbackRequests.has(requestId) ? 'loading' : ''}`}
																						title="Thumbs Down"
																						onClick={() => handleFeedbackClick('negative', requestId)}
																						disabled={submittingFeedbackRequests.has(requestId) || isLoadingDetail}
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
															disabled={(!feedbackFormData[requestId]?.text?.trim() && !feedbackFormData[requestId]?.preferredResponse?.trim()) || submittingFeedbackRequests.has(requestId)}
														>
															{submittingFeedbackRequests.has(requestId) ? 
																(adminFeedback[requestId]?.feedback_verdict === 'bad' ? 'Updating...' : 'Submitting...') : 
																(adminFeedback[requestId]?.feedback_verdict === 'bad' ? 'Update' : 'Submit')
															}
														</button>
																					</div>
																				</div>
																			)}
																			
																			{/* 메시지 내용 - 로딩 중이면 로딩 표시 */}
																			{isLoadingDetail ? (
																				<div className="request-content loading">
																					<div className="loading-message">
																						<div className="loading-spinner-small"></div>
																						<div className="loading-text">Loading message details...</div>
																					</div>
																				</div>
																			) : detail ? (
																				<div className="request-content">
																					{detail.inputText && (
																						<div className="chat-row">
																							<span className="chat-label user">User Message:</span>
																							<span className="chat-text">{detail.inputText}</span>
																						</div>
																					)}
																					{detail.outputText && (
																						<div className="chat-row">
																							<span className="chat-label ai">AI Response:</span>
																							<span className="chat-text">{detail.outputText}</span>
																						</div>
																					)}
																				</div>
																			) : (
																				<div className="request-content">
																					<div className="no-detail">No message details available</div>
																				</div>
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
							
							<div className="recent-conversations-actions">
								{/* 로딩 상태 표시 - 항상 왼쪽에 고정 */}
								{loadingState.details && (
									<div className="loading-indicator">
										<div className="loading-progress">
											<div className="progress-bar">
												<div 
													className="progress-fill" 
													style={{ width: `${loadingState.progress}%` }}
												/>
											</div>
											<div className="progress-text">{Math.round(loadingState.progress)}%</div>
										</div>
										<div className="loading-status">
											Loading message details... ({loadingState.loadedDetails}/{loadingState.totalDetails})
										</div>
									</div>
								)}
								
								{/* Export 버튼 - 항상 오른쪽에 고정 */}
								<div className="recent-conversations-export">
									<select 
										value={conversationsExportFormat} 
										onChange={(e) => setConversationsExportFormat(e.target.value as any)}
										className="input select-input export-format-select"
									>
										<option value="csv">CSV</option>
										<option value="excel">Excel</option>
										<option value="json">JSON</option>
									</select>
									<button 
										className="btn btn-primary export-btn" 
										onClick={handleConversationsExport}
										disabled={isExportingConversations || totalMessages === 0}
									>
										{isExportingConversations ? 'Exporting...' : 'Export'}
									</button>
								</div>
							</div>
						</div>
					</div>

					{/* Admin Feedback Section */}
					<div className="content-section">
						<div className="card section" aria-labelledby="admin-feedback-title">
							<div className="section-header">
								<div id="admin-feedback-title" className="section-title">
									Admin Feedback
									<span className="section-counter">({filteredAndSortedAdminFeedback.length} feedback entries)</span>
								</div>
								<div className="admin-feedback-header-controls">
									<div className="admin-feedback-sort">
										<label htmlFor="admin-feedback-sort-select">Sort by:</label>
										<select 
											id="admin-feedback-sort-select"
											className="input select-input"
											value={adminFeedbackSortBy}
											onChange={(e) => setAdminFeedbackSortBy(e.target.value as 'requestId' | 'date')}
										>
											<option value="date">Date/Time</option>
											<option value="requestId">Request ID</option>
										</select>
									</div>
									<div className="admin-feedback-filter">
										<label htmlFor="admin-feedback-filter-input">Search:</label>
										<input
											id="admin-feedback-filter-input"
											type="text"
											className="input"
											placeholder="Search feedback..."
											value={adminFeedbackFilter}
											onChange={(e) => setAdminFeedbackFilter(e.target.value)}
										/>
									</div>
								</div>
							</div>
							<div className="admin-feedback-content">
								{filteredAndSortedAdminFeedback.length === 0 ? (
									<p className="muted">
										{Object.keys(adminFeedback).filter(requestId => adminFeedback[requestId].feedback_verdict === 'bad').length === 0 
											? "No negative admin feedback found." 
											: "No feedback matches your filter criteria."
										}
									</p>
								) : (
									<div className="admin-feedback-list">
										{filteredAndSortedAdminFeedback.map(([requestId, feedback]) => {
											const requestDetail = requestDetails[requestId]
											return (
												<div key={requestId} className="admin-feedback-item">
													<div className="admin-feedback-content-wrapper">
														<div className="admin-feedback-header">
															<div className="admin-feedback-meta">
																<div className="admin-feedback-request-id">Request ID: {formatSessionId(requestId)}</div>
																<div className="admin-feedback-date">
																	{feedback.created_at ? new Date(feedback.created_at).toLocaleString() : 'Unknown date'}
																</div>
															</div>
														</div>
														
														<div className="admin-feedback-body">
															{feedback.feedback_text && (
																<div className="admin-feedback-text">
																	<span className="admin-feedback-label">Supervisor Feedback:</span>
																	<span className="admin-feedback-text-content">{feedback.feedback_text}</span>
																</div>
															)}
															
															{feedback.corrected_response && (
																<div className="admin-feedback-corrected">
																	<span className="admin-feedback-label">Corrected Response:</span>
																	<span className="admin-feedback-text-content">{feedback.corrected_response}</span>
																</div>
															)}
															
															{requestDetail && (feedback.feedback_text || feedback.corrected_response) && (
																<div className="admin-feedback-conversation">
																	{requestDetail.inputText && (
																		<div className="chat-row">
																			<span className="chat-label user">User Message:</span>
																			<span className="chat-text">{requestDetail.inputText}</span>
																		</div>
																	)}
																	{requestDetail.outputText && (
																		<div className="chat-row">
																			<span className="chat-label ai">AI Response:</span>
																			<span className="chat-text">{requestDetail.outputText}</span>
																		</div>
																	)}
																</div>
															)}
														</div>
													</div>
													<div className="admin-feedback-controls">
														<button 
															className="admin-feedback-delete-btn"
															title="Delete feedback"
															onClick={(e) => {
																e.preventDefault()
																e.stopPropagation()
																setDeleteAdminFeedbackModal({
																	isOpen: true,
																	requestId: requestId,
																	feedbackText: feedback.feedback_text || ''
																})
															}}
														>
															<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
																<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
															</svg>
														</button>
														
														<div className="admin-feedback-toggle">
															<button
																className={`toggle-btn ${feedback.prompt_apply !== false ? 'active' : ''}`}
																onClick={(e) => {
																	e.preventDefault()
																	e.stopPropagation()
																	handleTogglePromptApply(requestId, feedback.prompt_apply !== false)
																}}
																title={feedback.prompt_apply !== false ? 'Remove from prompt updates' : 'Include in prompt updates'}
															>
																<div className="toggle-slider"></div>
															</button>
															<label className="toggle-label">Apply to Prompt:</label>
														</div>
													</div>
												</div>
											)
										})}
									</div>
								)}
							</div>
							<div className="admin-feedback-actions">
								<div className="admin-feedback-export">
									<select 
										value={adminFeedbackExportFormat} 
										onChange={(e) => setAdminFeedbackExportFormat(e.target.value as any)}
										className="input select-input export-format-select"
									>
										<option value="csv">CSV</option>
										<option value="excel">Excel</option>
										<option value="json">JSON</option>
									</select>
									<button 
										className="btn btn-primary export-btn" 
										onClick={handleAdminFeedbackExport}
										disabled={isExportingAdminFeedback || filteredAndSortedAdminFeedback.length === 0}
									>
										{isExportingAdminFeedback ? 'Exporting...' : 'Export'}
									</button>
								</div>
								<button 
									className="btn btn-primary update-prompt-btn"
									onClick={async () => {
										try {
											await updatePromptWithFeedback()
											triggerPromptRefresh()
											setUpdatePromptSuccessModal({ isOpen: true })
										} catch (error) {
											console.error('Failed to update prompt:', error)
										}
									}}
								>
									Update Prompt
								</button>
							</div>
						</div>
					</div>

					{/* User Feedback Section */}
					<div className="content-section">
						<UserFeedback />
					</div>

					{/* Prompt Control Section */}
					<div className="content-section">
						<PromptControl key={promptRefreshTrigger} />
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

			{deleteAdminFeedbackModal.isOpen && (
				<div className="modal-backdrop" onClick={() => setDeleteAdminFeedbackModal({
					isOpen: false,
					requestId: null,
					feedbackText: ''
				})}>
					<div className="confirmation-modal card" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h2 className="h1 modal-title">Delete Admin Feedback</h2>
							<button className="icon-btn" onClick={() => setDeleteAdminFeedbackModal({
								isOpen: false,
								requestId: null,
								feedbackText: ''
							})}>
								<IconX />
							</button>
						</div>
						<div className="confirmation-content">
							<p>Are you certain you want to delete this admin feedback? This action cannot be undone.</p>
							{deleteAdminFeedbackModal.feedbackText && (
								<div className="feedback-preview">
									<strong>Feedback to be deleted:</strong>
									<div className="feedback-text-preview">
										{deleteAdminFeedbackModal.feedbackText}
									</div>
								</div>
							)}
						</div>
						<button 
							className="btn btn-ghost confirmation-no-btn" 
							onClick={() => setDeleteAdminFeedbackModal({
								isOpen: false,
								requestId: null,
								feedbackText: ''
							})}
						>
							Cancel
						</button>
						<button 
							className="btn btn-primary confirmation-yes-btn" 
							onClick={() => deleteAdminFeedbackModal.requestId && handleDeleteAdminFeedback(deleteAdminFeedbackModal.requestId)}
						>
							Delete
						</button>
					</div>
				</div>
			)}

			{updatePromptSuccessModal.isOpen && (
				<div className="modal-backdrop" onClick={() => setUpdatePromptSuccessModal({ isOpen: false })}>
					<div className="confirmation-modal card" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h2 className="h1 modal-title">Success</h2>
							<button className="icon-btn" onClick={() => setUpdatePromptSuccessModal({ isOpen: false })}>
								<IconX />
							</button>
						</div>
						<div className="confirmation-content">
							<p>System Prompt has been successfully updated. Please review in the Prompt Control section and click 'Save' if you would like to apply the prompt to the chatbot.</p>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
