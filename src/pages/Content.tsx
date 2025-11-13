import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { IconX } from '../ui/icons'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'
import { fetchAllConversationsN8N, fetchSessionsN8N, fetchSessionRequestsN8N, fetchRequestDetailN8N } from '../services/conversationsN8N'
import { getAdminFeedbackBatch, getAllAdminFeedback, saveAdminFeedback, updateAdminFeedback, deleteAdminFeedback, updateAdminFeedbackPromptApply } from '../services/adminFeedback'
import { getAllAdminFeedbackN8N, saveAdminFeedbackN8N, updateAdminFeedbackN8N, deleteAdminFeedbackN8N, updateAdminFeedbackApplyN8N, AdminFeedbackDataN8N } from '../services/adminFeedbackN8N'
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
	if (sessionId.length <= 6) {
		return sessionId
	}
	return sessionId.slice(-6)
}

function formatSessionIdNarrow(sessionId: string): string {
	if (sessionId.length <= 4) {
		return sessionId
	}
	return sessionId.slice(-4)
}

function formatDateNarrow(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const year = String(date.getFullYear())
	return `${month}/${day}/${year}...`
}

function formatChatId(chatId: string): string {
	if (chatId.length <= 4) {
		return chatId
	}
	return chatId.slice(-4)
}

function formatChatIdNarrow(chatId: string): string {
	if (chatId.length <= 3) {
		return chatId
	}
	return chatId.slice(-3)
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
	const location = useLocation()
	const isN8NRoute = location.pathname === '/dashboard-n8n' || location.pathname === '/rag-n8n'
	const { language, setLanguage, t } = useLanguage()
	const { theme } = useTheme()
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
	const [feedbackFormType, setFeedbackFormType] = useState<Record<string, 'positive' | 'negative'>>({})
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
	const [adminFeedbackViewMode, setAdminFeedbackViewMode] = useState<'grid' | 'table'>('table')
	const [adminFeedbackSortBy, setAdminFeedbackSortBy] = useState<'requestId' | 'date'>('date')
	const [adminFeedbackFilter, setAdminFeedbackFilter] = useState('')
	const [adminFeedbackTypeFilter, setAdminFeedbackTypeFilter] = useState<'all' | 'good' | 'bad'>('all')
	const [adminFeedbackFontSize, setAdminFeedbackFontSize] = useState<'small' | 'medium' | 'large'>('medium')
	const [adminFeedbackDisplayLimit, setAdminFeedbackDisplayLimit] = useState(25)
	const [editingAdminFeedback, setEditingAdminFeedback] = useState<Set<string>>(new Set())
	const [adminFeedbackEditData, setAdminFeedbackEditData] = useState<Record<string, { text: string, correctedResponse: string }>>({})
	const [submittingAdminFeedbackEdits, setSubmittingAdminFeedbackEdits] = useState<Set<string>>(new Set())
	const [conversationsLastRefreshed, setConversationsLastRefreshed] = useState<Date | null>(null)
	const [adminFeedbackLastRefreshed, setAdminFeedbackLastRefreshed] = useState<Date | null>(null)
	const [isRefreshingConversations, setIsRefreshingConversations] = useState(false)
	const [isRefreshingAdminFeedback, setIsRefreshingAdminFeedback] = useState(false)
	const [deleteAdminFeedbackModal, setDeleteAdminFeedbackModal] = useState<{
		isOpen: boolean,
		requestId: string | null,
		feedbackText: string
	}>({
		isOpen: false,
		requestId: null,
		feedbackText: ''
	})


	// Function to trigger prompt refresh
	const triggerPromptRefresh = () => {
		setPromptRefreshTrigger(prev => prev + 1)
	}

	const handleDeleteAdminFeedback = async (requestId: string) => {
		try {
			if (isN8NRoute) {
				await deleteAdminFeedbackN8N(requestId) // requestId is chat_id for n8n
			} else {
				await deleteAdminFeedback(requestId)
			}
			
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
			if (isN8NRoute) {
				await updateAdminFeedbackApplyN8N(requestId, newValue) // requestId is chat_id for n8n
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: {
						...prev[requestId],
						prompt_apply: newValue // Map apply to prompt_apply for UI
					}
				}))
			} else {
				await updateAdminFeedbackPromptApply(requestId, newValue)
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: {
						...prev[requestId],
						prompt_apply: newValue
					}
				}))
			}
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

	// Refresh functions
	const refreshConversations = async () => {
		setIsRefreshingConversations(true)
		try {
			await loadConversationsOptimized(true) // bypassCache = true
			setConversationsLastRefreshed(new Date())
		} catch (error) {
			console.error('Failed to refresh conversations:', error)
		} finally {
			setIsRefreshingConversations(false)
		}
	}

	const refreshAdminFeedback = async () => {
		setIsRefreshingAdminFeedback(true)
		try {
			if (isN8NRoute) {
				const allFeedbackN8N = await getAllAdminFeedbackN8N()
				// Map n8n feedback format (chat_id, apply) to UI format (request_id, prompt_apply)
				const mappedFeedback: Record<string, AdminFeedbackData> = {}
				Object.entries(allFeedbackN8N).forEach(([chatId, feedback]) => {
					mappedFeedback[chatId] = {
						id: feedback.id,
						request_id: chatId,
						feedback_verdict: feedback.feedback_verdict || 'good',
						feedback_text: feedback.feedback_text || '',
						corrected_response: feedback.corrected_response || null,
						prompt_apply: feedback.apply !== undefined ? feedback.apply : true,
						created_at: feedback.created_at,
						updated_at: feedback.updated_at || undefined
					}
				})
				setAdminFeedback(mappedFeedback)
			} else if (authToken) {
				const allFeedback = await getAllAdminFeedback()
				setAdminFeedback(allFeedback)
			}
			setAdminFeedbackLastRefreshed(new Date())
		} catch (error) {
			console.error('Failed to refresh admin feedback:', error)
		} finally {
			setIsRefreshingAdminFeedback(false)
		}
	}

	// 최적화된 데이터 로딩 함수
	const loadConversationsOptimized = async (bypassCache: boolean = false) => {
		if (isN8NRoute) {
			// N8N route: Use Supabase - fetch all chats, group by session_id, order by session.created_at
			if (!startDate || !endDate) return

			setIsLoadingSessions(true)
			setLoadingState(prev => ({ ...prev, sessions: true, progress: 10 }))

			try {
				// Fetch all chats, group by session_id, and order by session.created_at
				const { sessions: sessionsList, sessionRequests: sessionRequestsMap } = await fetchAllConversationsN8N(startDate, endDate)
				
				setSessions(sessionsList)
				setLoadingState(prev => ({ ...prev, sessions: false, requests: false, progress: 50 }))

				// Build requestDetails from the chat data (chat_message and response are already in sessionRequests)
				const requestDetailsMap: Record<string, any> = {}
				const allRequestIds: string[] = []

				Object.values(sessionRequestsMap).forEach((requests) => {
					requests.forEach((request: any) => {
						const requestId = request.requestId || request.id
						if (requestId) {
							allRequestIds.push(requestId)
							// Store chat_message and response directly in requestDetails
							requestDetailsMap[requestId] = {
								inputText: request.chat_message || '',
								outputText: request.response || ''
							}
						}
					})
				})

				// Set the data
				setSessionRequests(sessionRequestsMap)
				setRequestDetails(requestDetailsMap)
				setIsLoadingSessions(false)
				setConversationsLastRefreshed(new Date())
				setLoadingState(prev => ({
					...prev,
					progress: 100,
					totalDetails: allRequestIds.length,
					loadedDetails: allRequestIds.length,
					details: false
				}))

			} catch (error) {
				console.error('Failed to load n8n conversations:', error)
				setIsLoadingSessions(false)
			} finally {
				setLoadingState(prev => ({ ...prev, details: false, progress: 0, loadedDetails: 0, totalDetails: 0 }))
			}
			return
		}

		// Standard route: Use API (original logic)
		if (!authToken) return

		const cacheKey = conversationsCache.generateKey(startDate, endDate)
		
		// 1. 캐시에서 데이터 확인 (bypassCache가 true면 캐시 무시)
		if (!bypassCache) {
			const cachedData = conversationsCache.get<CacheData>(cacheKey) || 
				conversationsCache.getFromStorage<CacheData>(cacheKey)
			
			if (cachedData && cachedData.sessions && cachedData.sessionRequests && cachedData.requestDetails) {
				setSessions(cachedData.sessions)
				setSessionRequests(cachedData.sessionRequests)
				setRequestDetails(cachedData.requestDetails)
				setConversationsLastRefreshed(new Date())
				// Admin feedback is loaded separately, not from cache
				return
			}
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
			setConversationsLastRefreshed(new Date())
			
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
		if (isN8NRoute) {
			// N8N route: No auth token needed, just dates
			if (!startDate || !endDate) return
			loadConversationsOptimized()
			return
		}

		// Standard route: Need auth token
		if (!authToken) return

		let cancelled = false
		
		async function loadSessions() {
			loadConversationsOptimized()
		}
		
		loadSessions()
		
		return () => {
			cancelled = true
		}
	}, [authToken, startDate, endDate, isN8NRoute])

	// Load all admin feedback separately (not dependent on date range)
	useEffect(() => {
		if (isN8NRoute) {
			// N8N route: Load from n8n Supabase (no auth token needed)
			let cancelled = false
			
			async function loadAllAdminFeedbackN8N() {
				try {
					const allFeedbackN8N = await getAllAdminFeedbackN8N()
					if (!cancelled) {
						// Map n8n feedback format (chat_id, apply) to UI format (request_id, prompt_apply)
						const mappedFeedback: Record<string, AdminFeedbackData> = {}
						Object.entries(allFeedbackN8N).forEach(([chatId, feedback]) => {
							mappedFeedback[chatId] = {
								id: feedback.id,
								request_id: chatId, // Use chat_id as request_id for UI compatibility
								feedback_verdict: feedback.feedback_verdict || 'good',
								feedback_text: feedback.feedback_text || '',
								corrected_response: feedback.corrected_response || null,
								prompt_apply: feedback.apply !== undefined ? feedback.apply : true, // Map apply to prompt_apply
								created_at: feedback.created_at,
								updated_at: feedback.updated_at || undefined
							}
						})
						setAdminFeedback(mappedFeedback)
						setAdminFeedbackLastRefreshed(new Date())
					}
				} catch (error) {
					if (!cancelled) {
						console.error('Failed to load n8n admin feedback:', error)
					}
				}
			}
			
			loadAllAdminFeedbackN8N()
			
			return () => {
				cancelled = true
			}
		}

		// Standard route: Need auth token
		if (!authToken) return

		let cancelled = false
		
		async function loadAllAdminFeedback() {
			try {
				const allFeedback = await getAllAdminFeedback()
				if (!cancelled) {
					setAdminFeedback(allFeedback)
					setAdminFeedbackLastRefreshed(new Date())
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
	}, [authToken, isN8NRoute])

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
		
		// Always show popup for feedback (both positive and negative)
		const requestDetail = requestDetails[requestId] || {}
		const aiResponse = requestDetail.outputText || ''
		
		if (expandedFeedbackForms.has(requestId)) {
			// Close the form if it's already open
			closeFeedbackForm(requestId)
		} else {
			// Open the form with AI Response as default corrected response
			setExpandedFeedbackForms(prev => new Set(prev).add(requestId))
			setFeedbackFormType(prev => ({
				...prev,
				[requestId]: type
			}))
			setFeedbackFormData(prev => ({
				...prev,
				[requestId]: { 
					text: existingFeedback?.feedback_text || '', 
					preferredResponse: existingFeedback?.corrected_response || aiResponse
				}
			}))
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
			setFeedbackFormType(prev => {
				const newState = { ...prev }
				delete newState[requestId]
				return newState
			})
		}, 300) // Match the animation duration
	}

	const removePositiveFeedback = async (requestId: string) => {
		// Optimistically remove feedback from state immediately
		const previousFeedback = adminFeedback[requestId]
		setAdminFeedback(prev => {
			const newState = { ...prev }
			delete newState[requestId]
			return newState
		})
		
		try {
			if (isN8NRoute) {
				await deleteAdminFeedbackN8N(requestId) // requestId is chat_id for n8n
			} else {
				await deleteAdminFeedback(requestId)
			}
			
			// Update system prompt to reflect the deletion
			await updatePromptWithFeedback()
			
			// Trigger prompt refresh in PromptControl component
			triggerPromptRefresh()
		} catch (error) {
			console.error('Failed to remove positive feedback:', error)
			// Revert optimistic update on error
			if (previousFeedback) {
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: previousFeedback
				}))
			}
		}
	}

	const switchToPositiveFeedback = async (requestId: string) => {
		setSubmittingFeedbackRequests(prev => new Set(prev).add(requestId))
		
		try {
			// Delete existing negative feedback and save positive
			if (isN8NRoute) {
				await deleteAdminFeedbackN8N(requestId) // requestId is chat_id for n8n
				const savedFeedbackN8N = await saveAdminFeedbackN8N(requestId, 'good', '')
				// Map n8n format to UI format
				const savedFeedback: AdminFeedbackData = {
					id: savedFeedbackN8N.id,
					request_id: requestId,
					feedback_verdict: savedFeedbackN8N.feedback_verdict || 'good',
					feedback_text: savedFeedbackN8N.feedback_text || '',
					corrected_response: savedFeedbackN8N.corrected_response || null,
					prompt_apply: savedFeedbackN8N.apply !== undefined ? savedFeedbackN8N.apply : true,
					created_at: savedFeedbackN8N.created_at,
					updated_at: savedFeedbackN8N.updated_at || undefined
				}
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			} else {
				await deleteAdminFeedback(requestId)
				const savedFeedback = await saveAdminFeedback(requestId, 'good', '')
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			}
			
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
			if (isN8NRoute) {
				await deleteAdminFeedbackN8N(requestId) // requestId is chat_id for n8n
			} else {
				await deleteAdminFeedback(requestId)
			}
			
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
			if (isN8NRoute) {
				await deleteAdminFeedbackN8N(requestId) // requestId is chat_id for n8n
				// For n8n, chat data already exists in Supabase, no need to ensure it exists
				const savedFeedbackN8N = await saveAdminFeedbackN8N(
					requestId, // chat_id
					'bad', 
					formData.text,
					formData.preferredResponse.trim() || undefined
				)
				// Map n8n format to UI format
				const savedFeedback: AdminFeedbackData = {
					id: savedFeedbackN8N.id,
					request_id: requestId,
					feedback_verdict: savedFeedbackN8N.feedback_verdict || 'bad',
					feedback_text: savedFeedbackN8N.feedback_text || '',
					corrected_response: savedFeedbackN8N.corrected_response || null,
					prompt_apply: savedFeedbackN8N.apply !== undefined ? savedFeedbackN8N.apply : true,
					created_at: savedFeedbackN8N.created_at,
					updated_at: savedFeedbackN8N.updated_at || undefined
				}
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			} else {
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
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			}
			
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
		// Don't set loading state immediately - optimistic update already happened
		// Only set loading if there's an error and we need to revert
		
		try {
			if (isN8NRoute) {
				// For n8n, chat data already exists in Supabase, no need to ensure it exists
				const savedFeedbackN8N = await saveAdminFeedbackN8N(requestId, 'good', '') // requestId is chat_id for n8n
				// Map n8n format to UI format
				const savedFeedback: AdminFeedbackData = {
					id: savedFeedbackN8N.id,
					request_id: requestId,
					feedback_verdict: savedFeedbackN8N.feedback_verdict || 'good',
					feedback_text: savedFeedbackN8N.feedback_text || '',
					corrected_response: savedFeedbackN8N.corrected_response || null,
					prompt_apply: savedFeedbackN8N.apply !== undefined ? savedFeedbackN8N.apply : true,
					created_at: savedFeedbackN8N.created_at,
					updated_at: savedFeedbackN8N.updated_at || undefined
				}
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			} else {
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
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			}
			
		} catch (error) {
			console.error('Failed to submit positive feedback:', error)
			// Revert optimistic update on error - already handled in handleFeedbackClick
		}
	}

	const submitInlineFeedback = async (requestId: string) => {
		const formData = feedbackFormData[requestId]
		const feedbackType = feedbackFormType[requestId] || 'negative'
		const verdict = feedbackType === 'positive' ? 'good' : 'bad'
		
		if (!formData || (!formData.text.trim() && !formData.preferredResponse.trim())) {
			return
		}

		setSubmittingFeedbackRequests(prev => new Set(prev).add(requestId))
		
		try {
			if (isN8NRoute) {
				// For n8n, chat data already exists in Supabase, no need to ensure it exists
				const savedFeedbackN8N = await saveAdminFeedbackN8N(
					requestId, // chat_id
					verdict, 
					formData.text,
					formData.preferredResponse.trim() || undefined
				)
				// Map n8n format to UI format
				const savedFeedback: AdminFeedbackData = {
					id: savedFeedbackN8N.id,
					request_id: requestId,
					feedback_verdict: savedFeedbackN8N.feedback_verdict || 'bad',
					feedback_text: savedFeedbackN8N.feedback_text || '',
					corrected_response: savedFeedbackN8N.corrected_response || null,
					prompt_apply: savedFeedbackN8N.apply !== undefined ? savedFeedbackN8N.apply : true,
					created_at: savedFeedbackN8N.created_at,
					updated_at: savedFeedbackN8N.updated_at || undefined
				}
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			} else {
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
				
				// Save feedback with separate fields
				const savedFeedback = await saveAdminFeedback(
					requestId, 
					verdict, 
					formData.text,
					formData.preferredResponse.trim() || undefined
				)
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			}
			
			// Close the inline form with animation
			closeFeedbackForm(requestId)
			
			// Update prompt with new feedback (only for bad feedback)
			if (verdict === 'bad') {
				await updatePromptWithFeedback()
			}
			
			// Trigger prompt refresh in PromptControl component
			triggerPromptRefresh()
			
			// Refresh admin feedback table
			await refreshAdminFeedback()
			
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
			
			if (isN8NRoute) {
				// For n8n, chat data already exists in Supabase, no need to ensure it exists
				let savedFeedbackN8N: AdminFeedbackDataN8N
				if (feedbackModal.mode === 'edit' || feedbackModal.existingFeedback) {
					// Update existing feedback (preserve existing corrected_response if any)
					const existingCorrectedResponse = feedbackModal.existingFeedback?.corrected_response
					savedFeedbackN8N = await updateAdminFeedbackN8N(feedbackModal.requestId, verdict, feedbackText, existingCorrectedResponse || undefined)
				} else {
					// Save new feedback (modal doesn't have corrected response field)
					savedFeedbackN8N = await saveAdminFeedbackN8N(feedbackModal.requestId, verdict, feedbackText)
				}
				// Map n8n format to UI format
				const savedFeedback: AdminFeedbackData = {
					id: savedFeedbackN8N.id,
					request_id: feedbackModal.requestId,
					feedback_verdict: savedFeedbackN8N.feedback_verdict || verdict,
					feedback_text: savedFeedbackN8N.feedback_text || '',
					corrected_response: savedFeedbackN8N.corrected_response || null,
					prompt_apply: savedFeedbackN8N.apply !== undefined ? savedFeedbackN8N.apply : true,
					created_at: savedFeedbackN8N.created_at,
					updated_at: savedFeedbackN8N.updated_at || undefined
				}
				setAdminFeedback(prev => ({
					...prev,
					[feedbackModal.requestId!]: savedFeedback
				}))
			} else {
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
				setAdminFeedback(prev => ({
					...prev,
					[feedbackModal.requestId!]: savedFeedback
				}))
			}
			
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

	// Submit inline edit for admin feedback table
	const submitAdminFeedbackEdit = async (requestId: string) => {
		const editData = adminFeedbackEditData[requestId]
		if (!editData) return

		setSubmittingAdminFeedbackEdits(prev => new Set(prev).add(requestId))

		try {
			const existingFeedback = adminFeedback[requestId]
			if (!existingFeedback) return

			if (isN8NRoute) {
				const updatedFeedbackN8N = await updateAdminFeedbackN8N(
					requestId,
					existingFeedback.feedback_verdict,
					editData.text,
					editData.correctedResponse.trim() || undefined
				)
				const updatedFeedback: AdminFeedbackData = {
					id: updatedFeedbackN8N.id,
					request_id: requestId,
					feedback_verdict: updatedFeedbackN8N.feedback_verdict || existingFeedback.feedback_verdict,
					feedback_text: updatedFeedbackN8N.feedback_text || '',
					corrected_response: updatedFeedbackN8N.corrected_response || null,
					prompt_apply: updatedFeedbackN8N.apply !== undefined ? updatedFeedbackN8N.apply : existingFeedback.prompt_apply,
					created_at: updatedFeedbackN8N.created_at,
					updated_at: updatedFeedbackN8N.updated_at || undefined
				}
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: updatedFeedback
				}))
			} else {
				const updatedFeedback = await updateAdminFeedback(
					requestId,
					existingFeedback.feedback_verdict,
					editData.text,
					editData.correctedResponse.trim() || undefined
				)
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: updatedFeedback
				}))
			}

			// Update prompt if it's bad feedback
			if (existingFeedback.feedback_verdict === 'bad') {
				await updatePromptWithFeedback()
				triggerPromptRefresh()
			}

			// Close edit mode
			setEditingAdminFeedback(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
			
			// Refresh admin feedback table
			await refreshAdminFeedback()
		} catch (error) {
			console.error('Failed to update admin feedback:', error)
		} finally {
			setSubmittingAdminFeedbackEdits(prev => {
				const newSet = new Set(prev)
				newSet.delete(requestId)
				return newSet
			})
		}
	}

	// Scroll to conversation in Recent Conversations section
	const scrollToConversation = (requestId: string) => {
		// Find the conversation row in the table
		const row = document.querySelector(`tr[data-request-id="${requestId}"]`)
		if (row) {
			row.scrollIntoView({ behavior: 'smooth', block: 'center' })
			// Highlight the row temporarily
			row.classList.add('highlight-row')
			setTimeout(() => {
				row.classList.remove('highlight-row')
			}, 2000)
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

	// Table view controls for Recent Conversations - declare before useMemo
	const [conversationsViewMode, setConversationsViewMode] = useState<'grid' | 'table'>('table')
	const [conversationsSortBy, setConversationsSortBy] = useState<'date' | 'session'>('date')
	const [conversationsSearch, setConversationsSearch] = useState('')
	const [conversationsFontSize, setConversationsFontSize] = useState<'small' | 'medium' | 'large'>('medium')
	const [conversationsDisplayLimit, setConversationsDisplayLimit] = useState(10)

	// Flatten conversations for table view
	const flattenedConversations = useMemo(() => {
		const conversations: Array<{
			date: string
			userId: string
			sessionId: string
			requestId: string
			userMessage: string
			aiResponse: string
			userFeedback: 'positive' | 'negative' | null
			adminFeedback: AdminFeedbackData | null
			timestamp: number
		}> = []

		sessions.forEach(session => {
			const sessionId = session?.sessionId || session?.id
			const requests = sessionRequests[sessionId] || []
			
			requests.forEach((request: any) => {
				const requestId = request.requestId || request.id
				const detail = requestDetails[requestId] || {}
				const feedback = adminFeedback[requestId]
				
				// Get user feedback from user feedback service (we'll need to fetch this separately)
				// For now, we'll use admin feedback as a proxy
				const userFb = feedback?.feedback_verdict === 'good' ? 'positive' : 
				              feedback?.feedback_verdict === 'bad' ? 'negative' : null
				
				const timestamp = request.createdAt ? new Date(request.createdAt).getTime() : 0
				
				conversations.push({
					date: request.createdAt || '',
					userId: request.user_id || '', // Use user_id from request if available
					sessionId: sessionId,
					requestId: requestId,
					userMessage: detail.inputText || '',
					aiResponse: detail.outputText || '',
					userFeedback: userFb,
					adminFeedback: feedback || null,
					timestamp: timestamp
				})
			})
		})

		// Sort by date (newest first) or session
		conversations.sort((a, b) => {
			if (conversationsSortBy === 'date') {
				return b.timestamp - a.timestamp
			} else {
				return a.sessionId.localeCompare(b.sessionId)
			}
		})

		// Filter by search
		if (conversationsSearch.trim()) {
			const searchLower = conversationsSearch.toLowerCase()
			return conversations.filter(conv => 
				conv.userMessage.toLowerCase().includes(searchLower) ||
				conv.aiResponse.toLowerCase().includes(searchLower) ||
				conv.sessionId.toLowerCase().includes(searchLower) ||
				conv.requestId.toLowerCase().includes(searchLower)
			)
		}

		return conversations
	}, [sessions, sessionRequests, requestDetails, adminFeedback, conversationsSortBy, conversationsSearch])

	// Check if any conversation has a userId (to conditionally show/hide User ID column)
	const hasAnyUserId = useMemo(() => {
		return flattenedConversations.some(conv => conv.userId && conv.userId.trim() !== '')
	}, [flattenedConversations])

	// Filter and sort admin feedback - show ALL feedback
	const filteredAndSortedAdminFeedback = useMemo(() => {
		const allFeedback = Object.entries(adminFeedback)
			.filter(([requestId, feedback]) => {
				// Filter by type (all/good/bad)
				if (adminFeedbackTypeFilter === 'good' && feedback.feedback_verdict !== 'good') {
					return false;
				}
				if (adminFeedbackTypeFilter === 'bad' && feedback.feedback_verdict !== 'bad') {
					return false;
				}
				
				// Filter by search text
				if (!adminFeedbackFilter.trim()) return true;
				const filterLower = adminFeedbackFilter.toLowerCase();
				
				// Check if requestId matches
				if (requestId.toLowerCase().includes(filterLower)) return true;
				
				// Check if feedback text matches
				if (feedback.feedback_text?.toLowerCase().includes(filterLower)) return true;
				
				// Check if corrected response matches
				if (feedback.corrected_response?.toLowerCase().includes(filterLower)) return true;
				
				// Check if request detail text matches
				const requestDetail = requestDetails[requestId] || {};
				if (requestDetail.inputText?.toLowerCase().includes(filterLower)) return true;
				if (requestDetail.outputText?.toLowerCase().includes(filterLower)) return true;
				
				// Check if sessionId matches - find which session this requestId belongs to
				for (const [sessionId, requests] of Object.entries(sessionRequests)) {
					if (requests.some(r => (r.requestId || r.id) === requestId)) {
						if (sessionId.toLowerCase().includes(filterLower)) return true;
						break;
					}
				}
				
				return false;
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
		
		return allFeedback;
	}, [adminFeedback, adminFeedbackFilter, adminFeedbackTypeFilter, adminFeedbackSortBy, requestDetails, sessionRequests]);

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
			// Export filtered and sorted conversations (use flattenedConversations)
			const conversationsData: ConversationExportData[] = flattenedConversations.map(conv => {
				const adminFeedbackData = conv.adminFeedback
				
				// 사용자 피드백 상태 확인 (좋아요/싫어요)
				let userFeedback: 'positive' | 'negative' | 'none' = 'none'
				if (adminFeedbackData?.feedback_verdict === 'good') {
					userFeedback = 'positive'
				} else if (adminFeedbackData?.feedback_verdict === 'bad') {
					userFeedback = 'negative'
				}
				
				// Find session info
				const session = sessions.find(s => (s.sessionId || s.id) === conv.sessionId)
				const requests = sessionRequests[conv.sessionId] || []
				
				return {
					// Session 정보
					sessionId: conv.sessionId,
					sessionCreatedAt: session?.createdAt || '',
					
					// Request 정보
					requestId: conv.requestId,
					requestCreatedAt: conv.date || '',
					
					// 메시지 내용
					userMessage: conv.userMessage || '',
					aiResponse: conv.aiResponse || '',
					
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
				}
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
									{language === 'ko' ? '최근 대화' : 'Recent Conversations'}
									<span className="section-counter">({flattenedConversations.length})</span>
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
								<div className="conversations-controls">
									<div className="view-toggle">
										<button 
											className={`view-btn ${conversationsViewMode === 'grid' ? 'active' : ''}`}
											onClick={() => setConversationsViewMode('grid')}
											title="Grid View"
										>
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<rect x="3" y="3" width="7" height="7"/>
												<rect x="14" y="3" width="7" height="7"/>
												<rect x="3" y="14" width="7" height="7"/>
												<rect x="14" y="14" width="7" height="7"/>
											</svg>
										</button>
										<button 
											className={`view-btn ${conversationsViewMode === 'table' ? 'active' : ''}`}
											onClick={() => setConversationsViewMode('table')}
											title="Table View"
										>
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<line x1="3" y1="6" x2="21" y2="6"/>
												<line x1="3" y1="12" x2="21" y2="12"/>
												<line x1="3" y1="18" x2="21" y2="18"/>
											</svg>
										</button>
									</div>
									<div className="sort-control">
										<label>{t('sort')}</label>
										<select 
											className="input select-input"
											value={conversationsSortBy}
											onChange={(e) => setConversationsSortBy(e.target.value as 'date' | 'session')}
										>
											<option value="date">{t('dateTimeNewest')}</option>
											<option value="session">{t('sessionIdSort')}</option>
										</select>
									</div>
									<div className="search-control">
										<label>{t('search')}</label>
										<div className="search-input-wrapper">
											<input
												type="text"
												className="input"
												placeholder={t('conversationSearch')}
												value={conversationsSearch}
												onChange={(e) => setConversationsSearch(e.target.value)}
											/>
											{conversationsSearch && (
												<button
													className="search-clear-btn"
													onClick={() => setConversationsSearch('')}
													title={language === 'ko' ? '지우기' : 'Clear'}
												>
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
														<path d="M18 6L6 18M6 6l12 12"/>
													</svg>
												</button>
											)}
										</div>
									</div>
									<div className="font-size-control">
										<label>{t('fontSize')}</label>
										<div className="font-size-buttons">
											<button 
												className={`font-size-btn ${conversationsFontSize === 'small' ? 'active' : ''}`}
												onClick={() => setConversationsFontSize('small')}
											>
												A
											</button>
											<button 
												className={`font-size-btn ${conversationsFontSize === 'medium' ? 'active' : ''}`}
												onClick={() => setConversationsFontSize('medium')}
											>
												A
											</button>
											<button 
												className={`font-size-btn ${conversationsFontSize === 'large' ? 'active' : ''}`}
												onClick={() => setConversationsFontSize('large')}
											>
												A
											</button>
										</div>
									</div>
									<div className="export-control">
										<select 
											value={conversationsExportFormat} 
											onChange={(e) => setConversationsExportFormat(e.target.value as any)}
											className="input select-input"
										>
											<option value="csv">CSV</option>
											<option value="excel">Excel</option>
											<option value="json">JSON</option>
										</select>
									</div>
									<button 
										className="btn btn-primary export-btn" 
										onClick={handleConversationsExport}
										disabled={isExportingConversations || flattenedConversations.length === 0}
									>
										{isExportingConversations ? (language === 'ko' ? '내보내는 중...' : 'Exporting...') : t('export')}
									</button>
									<button 
										className="refresh-btn"
										onClick={refreshConversations}
										disabled={isRefreshingConversations}
										title={isRefreshingConversations ? (language === 'ko' ? '새로고침 중...' : 'Refreshing...') : (language === 'ko' ? '새로고침' : 'Refresh')}
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isRefreshingConversations ? 'spinning' : ''}>
											<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
											<path d="M21 3v5h-5"/>
											<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
											<path d="M3 21v-5h5"/>
										</svg>
										<span className="refresh-btn-text">{language === 'ko' ? '새로고침' : 'Refresh'}</span>
									</button>
								</div>
								{conversationsLastRefreshed && (
									<div className="last-refreshed">
										{t('lastRefreshed')} {conversationsLastRefreshed.toLocaleString()}
									</div>
								)}
							</div>
							
							<div className={`conversations-table-container font-size-${conversationsFontSize}`}>
								{isLoadingSessions ? (
									<p className="muted">Loading conversations...</p>
								) : flattenedConversations.length > 0 ? (
									<>
										{conversationsViewMode === 'grid' ? (
											<div className="conversations-grid">
												{flattenedConversations.slice(0, conversationsDisplayLimit).map((conv) => {
													const date = conv.date ? new Date(conv.date) : null
													const adminFb = conv.adminFeedback
													
													return (
														<div key={conv.requestId} className="conversation-card">
															<div className="conversation-card-header">
																<div className="conversation-card-info">
																	<span><strong>{t('chatId')}:</strong> {conv.requestId || ''}</span>
																	<span><strong>Session:</strong> {formatSessionId(conv.sessionId)}</span>
																	{date && <span>{date.toLocaleString()}</span>}
																</div>
															</div>
															<div className="conversation-card-body">
																<div className="conversation-message">
																	<strong>{t('userMessage')}:</strong> {conv.userMessage || ''}
																</div>
																<div className="conversation-response">
																	<strong>{t('aiResponse')}:</strong> {conv.aiResponse || ''}
																</div>
															</div>
															<div className="conversation-card-footer">
																<span className="admin-label">{t('adminFeedback')}:</span>
																<div className="admin-actions">
																	<button 
																		className={`thumbs-btn thumbs-up ${adminFb?.feedback_verdict === 'good' ? 'submitted' : ''}`}
																		title="Good"
																		onClick={(e) => {
																			e.preventDefault()
																			e.stopPropagation()
																			handleFeedbackClick('positive', conv.requestId)
																		}}
																	>
																		<svg fill="currentColor" viewBox="0 0 24 24" width="18" height="18">
																			<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
																		</svg>
																	</button>
																	<button 
																		className={`thumbs-btn thumbs-down ${adminFb?.feedback_verdict === 'bad' ? 'submitted' : ''}`}
																		title="Bad"
																		onClick={(e) => {
																			e.preventDefault()
																			e.stopPropagation()
																			handleFeedbackClick('negative', conv.requestId)
																		}}
																	>
																		<svg fill="currentColor" viewBox="0 0 24 24" width="18" height="18">
																			<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
																		</svg>
																	</button>
																	{adminFb && (
																		<button 
																			className="btn btn-sm edit-btn"
																			title="Edit"
																			onClick={(e) => {
																				e.preventDefault()
																				e.stopPropagation()
																				setExpandedFeedbackForms(prev => new Set(prev).add(conv.requestId))
																				setFeedbackFormData(prev => ({
																					...prev,
																					[conv.requestId]: { 
																						text: adminFb.feedback_text || '', 
																						preferredResponse: adminFb.corrected_response || '' 
																					}
																				}))
																			}}
																		>
																			Edit
																		</button>
																	)}
																</div>
															</div>
														</div>
													)
												})}
											</div>
										) : (
											<table className={`conversations-table ${hasAnyUserId ? 'has-user-id' : 'no-user-id'}`}>
												<thead>
													<tr>
														<th>{t('date')}</th>
														<th>{t('chatId')}</th>
														{hasAnyUserId && <th>{t('userId')}</th>}
														<th>{t('sessionId')}</th>
														<th>{t('userMessage')}</th>
														<th>{t('aiResponse')}</th>
														<th>{t('adminFeedback')}</th>
													</tr>
												</thead>
												<tbody>
													{flattenedConversations.slice(0, conversationsDisplayLimit).map((conv) => {
														const date = conv.date ? new Date(conv.date) : null
														const adminFb = conv.adminFeedback
														
														return (
															<tr key={conv.requestId} data-request-id={conv.requestId}>
																<td className="date-cell">
																	{date ? (
																		<span className="date-display" title={date.toLocaleString()}>
																			{date.toLocaleString()}
																		</span>
																	) : ''}
																</td>
																<td className="chat-id-cell">
																	<button 
																		className="chat-id-link"
																		onClick={() => {
																			setConversationsSearch(conv.requestId)
																			setAdminFeedbackFilter(conv.requestId)
																		}}
																		title={conv.requestId}
																	>
																		<span className="chat-id-display">{formatChatId(conv.requestId || '')}</span>
																	</button>
																</td>
																{hasAnyUserId && <td>{conv.userId || ''}</td>}
																<td className="session-id-cell">
																	<button 
																		className="session-id-link"
																		onClick={() => {
																			setConversationsSearch(conv.sessionId)
																			setAdminFeedbackFilter(conv.sessionId)
																		}}
																		title={conv.sessionId}
																	>
																		<span className="session-id-display">{formatSessionId(conv.sessionId)}</span>
																	</button>
																</td>
																<td className="message-cell" title={conv.userMessage || ''}>
																	<div className="message-text-truncated">{conv.userMessage || ''}</div>
																</td>
																<td className="message-cell" title={conv.aiResponse || ''}>
																	<div className="message-text-truncated">{conv.aiResponse || ''}</div>
																</td>
																<td>
																	<div className="admin-actions">
																		<button 
																			className={`thumbs-btn thumbs-up ${adminFb?.feedback_verdict === 'good' ? 'submitted' : ''}`}
																			title="Thumbs Up"
																			onClick={(e) => {
																				e.preventDefault()
																				e.stopPropagation()
																				handleFeedbackClick('positive', conv.requestId)
																			}}
																		>
																			<svg fill="currentColor" viewBox="0 0 24 24" width="18" height="18">
																				<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
																			</svg>
																		</button>
																		<button 
																			className={`thumbs-btn thumbs-down ${adminFb?.feedback_verdict === 'bad' ? 'submitted' : ''}`}
																			title="Thumbs Down"
																			onClick={(e) => {
																				e.preventDefault()
																				e.stopPropagation()
																				handleFeedbackClick('negative', conv.requestId)
																			}}
																		>
																			<svg fill="currentColor" viewBox="0 0 24 24" width="18" height="18">
																				<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
																			</svg>
																		</button>
																		{adminFb && (
																			<button 
																				className="btn btn-sm edit-btn"
																				title="Edit"
																				onClick={(e) => {
																					e.preventDefault()
																					e.stopPropagation()
																					setExpandedFeedbackForms(prev => new Set(prev).add(conv.requestId))
																					setFeedbackFormData(prev => ({
																						...prev,
																						[conv.requestId]: { 
																							text: adminFb.feedback_text || '', 
																							preferredResponse: adminFb.corrected_response || '' 
																						}
																					}))
																				}}
																			>
																				Edit
																			</button>
																		)}
																	</div>
																</td>
															</tr>
														)
													})}
												</tbody>
											</table>
										)}
										{flattenedConversations.length > conversationsDisplayLimit && (
											<div className="load-more-container">
												<button 
													className="btn btn-primary load-more-btn"
													onClick={() => setConversationsDisplayLimit(prev => prev + 20)}
												>
													{t('loadMore')} ({flattenedConversations.length - conversationsDisplayLimit} {t('remaining')})
												</button>
											</div>
										)}
									</>
								) : (
									<p className="muted">No conversations found for the selected date range.</p>
								)}
							</div>
							
							{/* Inline feedback form modal - appears when Edit is clicked or thumbs down is clicked */}
							{expandedFeedbackForms.size > 0 && Array.from(expandedFeedbackForms).map(requestId => {
								const formData = feedbackFormData[requestId] || { text: '', preferredResponse: '' }
								const existingFeedback = adminFeedback[requestId]
								
								return (
									<div key={requestId} className={`inline-feedback-form-modal ${closingFeedbackForms.has(requestId) ? 'closing' : ''}`}>
										<div className="modal-backdrop" onClick={() => closeFeedbackForm(requestId)}></div>
										<div className="inline-feedback-form card" onClick={(e) => e.stopPropagation()}>
											<div className="feedback-form-header">
												<h3>Admin Feedback</h3>
												<button className="icon-btn" onClick={() => closeFeedbackForm(requestId)}>
													<IconX />
												</button>
											</div>
											<div className="feedback-form-fields">
												<div className="feedback-field">
													<label htmlFor={`feedback-text-${requestId}`}>Supervisor Feedback:</label>
													<textarea
														id={`feedback-text-${requestId}`}
														className="feedback-input"
														value={formData.text}
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
														value={formData.preferredResponse}
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
												{existingFeedback?.feedback_verdict === 'bad' ? (
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
													disabled={(!formData.text?.trim() && !formData.preferredResponse?.trim()) || submittingFeedbackRequests.has(requestId)}
												>
													{submittingFeedbackRequests.has(requestId) ? 
														(existingFeedback?.feedback_verdict === 'bad' ? 'Updating...' : 'Submitting...') : 
														(existingFeedback?.feedback_verdict === 'bad' ? 'Update' : 'Submit')
													}
												</button>
											</div>
										</div>
									</div>
								)
							})}
						</div>
					</div>

					{/* Admin Feedback Section */}
					<div className="content-section">
						<div className="card section" aria-labelledby="admin-feedback-title">
							<div className="section-header">
								<div id="admin-feedback-title" className="section-title">
									{language === 'ko' ? '관리자 피드백' : 'Administrator Feedback'} ({filteredAndSortedAdminFeedback.length} {t('feedbackItems')})
								</div>
								<div className="conversations-controls">
									<div className="sort-control">
										<label>{t('sort')}</label>
										<select 
											className="input select-input"
											value={adminFeedbackSortBy}
											onChange={(e) => setAdminFeedbackSortBy(e.target.value as 'requestId' | 'date')}
										>
											<option value="date">{t('dateTimeNewest')}</option>
											<option value="requestId">Request ID</option>
										</select>
									</div>
									<div className="search-control">
										<label>{t('search')}</label>
										<div className="search-input-wrapper">
											<input
												type="text"
												className="input"
												placeholder={t('searchFeedback')}
												value={adminFeedbackFilter}
												onChange={(e) => setAdminFeedbackFilter(e.target.value)}
											/>
											{adminFeedbackFilter && (
												<button
													className="search-clear-btn"
													onClick={() => setAdminFeedbackFilter('')}
													title={language === 'ko' ? '지우기' : 'Clear'}
												>
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
														<path d="M18 6L6 18M6 6l12 12"/>
													</svg>
												</button>
											)}
										</div>
									</div>
									<div className="view-toggle">
										<button 
											className={`view-btn ${adminFeedbackViewMode === 'grid' ? 'active' : ''}`}
											onClick={() => setAdminFeedbackViewMode('grid')}
											title="Grid View"
										>
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<rect x="3" y="3" width="7" height="7"/>
												<rect x="14" y="3" width="7" height="7"/>
												<rect x="3" y="14" width="7" height="7"/>
												<rect x="14" y="14" width="7" height="7"/>
											</svg>
										</button>
										<button 
											className={`view-btn ${adminFeedbackViewMode === 'table' ? 'active' : ''}`}
											onClick={() => setAdminFeedbackViewMode('table')}
											title="Table View"
										>
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<line x1="3" y1="6" x2="21" y2="6"/>
												<line x1="3" y1="12" x2="21" y2="12"/>
												<line x1="3" y1="18" x2="21" y2="18"/>
											</svg>
										</button>
									</div>
									<div className="font-size-control">
										<label>{t('fontSize')}</label>
										<div className="font-size-buttons">
											<button 
												className={`font-size-btn ${adminFeedbackFontSize === 'small' ? 'active' : ''}`}
												onClick={() => setAdminFeedbackFontSize('small')}
											>
												A
											</button>
											<button 
												className={`font-size-btn ${adminFeedbackFontSize === 'medium' ? 'active' : ''}`}
												onClick={() => setAdminFeedbackFontSize('medium')}
											>
												A
											</button>
											<button 
												className={`font-size-btn ${adminFeedbackFontSize === 'large' ? 'active' : ''}`}
												onClick={() => setAdminFeedbackFontSize('large')}
											>
												A
											</button>
										</div>
									</div>
									<div className="export-control">
										<select 
											value={adminFeedbackExportFormat} 
											onChange={(e) => setAdminFeedbackExportFormat(e.target.value as any)}
											className="input select-input"
										>
											<option value="csv">CSV</option>
											<option value="excel">Excel</option>
											<option value="json">JSON</option>
										</select>
									</div>
									<button 
										className="btn btn-primary export-btn" 
										onClick={handleAdminFeedbackExport}
										disabled={isExportingAdminFeedback || filteredAndSortedAdminFeedback.length === 0}
									>
										{isExportingAdminFeedback ? (language === 'ko' ? '내보내는 중...' : 'Exporting...') : t('export')}
									</button>
									<button 
										className="refresh-btn"
										onClick={refreshAdminFeedback}
										disabled={isRefreshingAdminFeedback}
										title={isRefreshingAdminFeedback ? (language === 'ko' ? '새로고침 중...' : 'Refreshing...') : (language === 'ko' ? '새로고침' : 'Refresh')}
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isRefreshingAdminFeedback ? 'spinning' : ''}>
											<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
											<path d="M21 3v5h-5"/>
											<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
											<path d="M3 21v-5h5"/>
										</svg>
										<span className="refresh-btn-text">{language === 'ko' ? '새로고침' : 'Refresh'}</span>
									</button>
								</div>
								{adminFeedbackLastRefreshed && (
									<div className="last-refreshed">
										{t('lastRefreshed')} {adminFeedbackLastRefreshed.toLocaleString()}
									</div>
								)}
								<div className="admin-feedback-filters">
									<button
										className={`feedback-filter-btn ${adminFeedbackTypeFilter === 'all' ? 'active' : ''}`}
										onClick={() => setAdminFeedbackTypeFilter('all')}
									>
										{t('total')} ({Object.keys(adminFeedback).length})
									</button>
									<button
										className={`feedback-filter-btn ${adminFeedbackTypeFilter === 'good' ? 'active' : ''}`}
										onClick={() => setAdminFeedbackTypeFilter('good')}
									>
										{t('good')} ({Object.values(adminFeedback).filter(f => f.feedback_verdict === 'good').length})
									</button>
									<button
										className={`feedback-filter-btn ${adminFeedbackTypeFilter === 'bad' ? 'active' : ''}`}
										onClick={() => setAdminFeedbackTypeFilter('bad')}
									>
										{t('bad')} ({Object.values(adminFeedback).filter(f => f.feedback_verdict === 'bad').length})
									</button>
								</div>
							</div>
							<div className={`admin-feedback-table-container font-size-${adminFeedbackFontSize}`}>
								{filteredAndSortedAdminFeedback.length === 0 ? (
									<p className="muted">
										{Object.keys(adminFeedback).length === 0 
											? (language === 'ko' ? '피드백이 없습니다.' : 'No admin feedback found.') 
											: (language === 'ko' ? '필터 조건에 맞는 피드백이 없습니다.' : 'No feedback matches your filter criteria.')
										}
									</p>
								) : (
									<>
										{adminFeedbackViewMode === 'grid' ? (
											<div className="admin-feedback-grid">
												{filteredAndSortedAdminFeedback.slice(0, adminFeedbackDisplayLimit).map(([requestId, feedback]) => {
													const date = feedback.created_at ? new Date(feedback.created_at) : null
													const requestDetail = requestDetails[requestId] || {}
													const isEditing = editingAdminFeedback.has(requestId)
													const editData = adminFeedbackEditData[requestId] || { text: feedback.feedback_text || '', correctedResponse: feedback.corrected_response || '' }
													
													// Find sessionId for this requestId
													let sessionId = ''
													for (const [sId, requests] of Object.entries(sessionRequests)) {
														if (requests.some(r => (r.requestId || r.id) === requestId)) {
															sessionId = sId
															break
														}
													}
													
													return (
														<div key={requestId} className="admin-feedback-card">
															<div className="admin-feedback-card-header">
																<div className="admin-feedback-card-rating">
																	{feedback.feedback_verdict === 'good' ? (
																		<svg fill="#22c55e" viewBox="0 0 24 24" width="24" height="24">
																			<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
																		</svg>
																	) : (
																		<svg fill="#ef4444" viewBox="0 0 24 24" width="24" height="24">
																			<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
																		</svg>
																	)}
																	<span>{language === 'ko' ? '사용자: Unknown' : 'User: Unknown'}</span>
																</div>
																<div className="admin-feedback-card-actions">
																	{date && <span className="admin-feedback-card-date">{date.toLocaleString()}</span>}
																	<div className="admin-feedback-card-toggle">
																		<span>{language === 'ko' ? '프롬프트에 적용:' : 'Apply to Prompt:'}</span>
																		<button
																			className={`toggle-btn ${feedback.prompt_apply !== false ? 'active' : ''}`}
																			onClick={(e) => {
																				e.preventDefault()
																				e.stopPropagation()
																				handleTogglePromptApply(requestId, feedback.prompt_apply !== false)
																			}}
																		>
																			<span className="toggle-slider"></span>
																		</button>
																	</div>
																	<button
																		className="admin-feedback-delete-btn"
																		onClick={(e) => {
																			e.preventDefault()
																			e.stopPropagation()
																			setDeleteAdminFeedbackModal({
																				isOpen: true,
																				requestId: requestId,
																				onConfirm: () => handleDeleteAdminFeedback(requestId)
																			})
																		}}
																		title={t('delete')}
																	>
																		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
																			<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
																		</svg>
																	</button>
																</div>
															</div>
															<div className="admin-feedback-card-body">
																<div className="admin-feedback-card-field">
																	<strong>{t('userMessage')}:</strong>
																	<div>{requestDetail.inputText || '-'}</div>
																</div>
																<div className="admin-feedback-card-field">
																	<strong>{t('chatId')}:</strong>
																	<button
																		className="chat-id-link"
																		onClick={() => {
																			setConversationsSearch(requestId)
																			setAdminFeedbackFilter(requestId)
																			scrollToConversation(requestId)
																		}}
																		title={requestId}
																	>
																		{requestId}
																	</button>
																</div>
																<div className="admin-feedback-card-field">
																	<strong>{language === 'ko' ? '원본 AI 응답:' : 'Original AI Response:'}</strong>
																	<div>{requestDetail.outputText || '-'}</div>
																</div>
																<div className="admin-feedback-card-field">
																	<strong>{t('feedback')}:</strong>
																	{isEditing ? (
																		<textarea
																			className="feedback-edit-input"
																			value={editData.text}
																			onChange={(e) => setAdminFeedbackEditData(prev => ({
																				...prev,
																				[requestId]: {
																					...prev[requestId],
																					text: e.target.value
																				}
																			}))}
																			rows={2}
																		/>
																	) : (
																		<div 
																			onClick={() => {
																				setEditingAdminFeedback(prev => new Set(prev).add(requestId))
																				setAdminFeedbackEditData(prev => ({
																					...prev,
																					[requestId]: {
																						text: feedback.feedback_text || '',
																						correctedResponse: feedback.corrected_response || ''
																					}
																				}))
																			}}
																			style={{ cursor: 'pointer' }}
																		>
																			{feedback.feedback_text || ''}
																		</div>
																	)}
																</div>
																<div className="admin-feedback-card-field">
																	<strong>{language === 'ko' ? '수정된 응답:' : 'Modified Response:'}</strong>
																	{isEditing ? (
																		<textarea
																			className="feedback-edit-input"
																			value={editData.correctedResponse}
																			onChange={(e) => setAdminFeedbackEditData(prev => ({
																				...prev,
																				[requestId]: {
																					...prev[requestId],
																					correctedResponse: e.target.value
																				}
																			}))}
																			rows={3}
																		/>
																	) : (
																		<div 
																			onClick={() => {
																				setEditingAdminFeedback(prev => new Set(prev).add(requestId))
																				setAdminFeedbackEditData(prev => ({
																					...prev,
																					[requestId]: {
																						text: feedback.feedback_text || '',
																						correctedResponse: feedback.corrected_response || ''
																					}
																				}))
																			}}
																			style={{ cursor: 'pointer' }}
																		>
																			{feedback.corrected_response || '-'}
																		</div>
																	)}
																</div>
																{isEditing && (
																	<div className="admin-feedback-edit-actions">
																		<button
																			className="btn btn-sm btn-primary"
																			onClick={() => submitAdminFeedbackEdit(requestId)}
																			disabled={submittingAdminFeedbackEdits.has(requestId)}
																		>
																			{submittingAdminFeedbackEdits.has(requestId) ? 'Saving...' : 'Save'}
																		</button>
																		<button
																			className="btn btn-sm btn-ghost"
																			onClick={() => {
																				setEditingAdminFeedback(prev => {
																					const newSet = new Set(prev)
																					newSet.delete(requestId)
																					return newSet
																				})
																			}}
																			disabled={submittingAdminFeedbackEdits.has(requestId)}
																		>
																			Cancel
																		</button>
																	</div>
																)}
															</div>
														</div>
													)
												})}
											</div>
										) : (
											<table className="admin-feedback-table">
												<thead>
													<tr>
														<th>{t('date')}</th>
														<th>{t('chatId')}</th>
														<th>{t('sessionId')}</th>
														<th>{t('rating')}</th>
														<th>{t('message')}</th>
														<th>{t('response')}</th>
														<th>{t('feedback')}</th>
														<th>{t('corrected')}</th>
														<th>{t('applied')}</th>
														<th>{t('delete')}</th>
													</tr>
												</thead>
												<tbody>
												{filteredAndSortedAdminFeedback.slice(0, adminFeedbackDisplayLimit).map(([requestId, feedback]) => {
													const date = feedback.created_at ? new Date(feedback.created_at) : null
													const requestDetail = requestDetails[requestId] || {}
													const isEditing = editingAdminFeedback.has(requestId)
													const editData = adminFeedbackEditData[requestId] || { text: feedback.feedback_text || '', correctedResponse: feedback.corrected_response || '' }
													
													// Find sessionId for this requestId
													let sessionId = ''
													for (const [sId, requests] of Object.entries(sessionRequests)) {
														if (requests.some(r => (r.requestId || r.id) === requestId)) {
															sessionId = sId
															break
														}
													}
													
													return (
														<tr key={requestId}>
															<td className="date-cell">
																{date ? (
																	<span className="date-display" title={date.toLocaleString()}>
																		{date.toLocaleString()}
																	</span>
																) : (
																	<span>Unknown date</span>
																)}
															</td>
															<td>
																<button
																	className="chat-id-link"
																	onClick={() => {
																		setConversationsSearch(requestId)
																		setAdminFeedbackFilter(requestId)
																		scrollToConversation(requestId)
																	}}
																	title={requestId}
																>
																	<span className="chat-id-display">{formatChatId(requestId)}</span>
																</button>
															</td>
															<td>
																{sessionId ? (
																	<button
																		className="session-id-link"
																		onClick={() => {
																			setConversationsSearch(sessionId)
																			setAdminFeedbackFilter(sessionId)
																		}}
																		title={sessionId}
																	>
																		<span className="session-id-display">{formatSessionId(sessionId)}</span>
																	</button>
																) : (
																	<span>-</span>
																)}
															</td>
															<td>
																{feedback.feedback_verdict === 'good' ? (
																	<svg fill="#22c55e" viewBox="0 0 24 24" width="20" height="20">
																		<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
																	</svg>
																) : (
																	<svg fill="#ef4444" viewBox="0 0 24 24" width="20" height="20">
																		<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
																	</svg>
																)}
															</td>
															<td className="message-cell">
																<div className="message-text-truncated" title={requestDetail.inputText || ''} data-full-text={requestDetail.inputText || ''}>{requestDetail.inputText || '-'}</div>
															</td>
															<td className="message-cell">
																<div className="message-text-truncated" title={requestDetail.outputText || ''} data-full-text={requestDetail.outputText || ''}>{requestDetail.outputText || '-'}</div>
															</td>
															<td className="feedback-cell">
																{isEditing ? (
																	<textarea
																		className="feedback-edit-input"
																		value={editData.text}
																		onChange={(e) => setAdminFeedbackEditData(prev => ({
																			...prev,
																			[requestId]: {
																				...prev[requestId],
																				text: e.target.value
																			}
																		}))}
																		rows={2}
																	/>
																) : (
																	<div 
																		className="message-text-truncated" 
																		title={feedback.feedback_text || ''}
																		data-full-text={feedback.feedback_text || ''}
																		onClick={() => {
																			setEditingAdminFeedback(prev => new Set(prev).add(requestId))
																			setAdminFeedbackEditData(prev => ({
																				...prev,
																				[requestId]: {
																					text: feedback.feedback_text || '',
																					correctedResponse: feedback.corrected_response || ''
																				}
																			}))
																		}}
																		style={{ cursor: 'pointer' }}
																	>
																		{feedback.feedback_text || ''}
																	</div>
																)}
															</td>
															<td className="feedback-cell">
																{isEditing ? (
																	<textarea
																		className="feedback-edit-input"
																		value={editData.correctedResponse}
																		onChange={(e) => setAdminFeedbackEditData(prev => ({
																			...prev,
																			[requestId]: {
																				...prev[requestId],
																				correctedResponse: e.target.value
																			}
																		}))}
																		rows={3}
																	/>
																) : (
																	<div 
																		className="message-text-truncated" 
																		title={feedback.corrected_response || ''}
																		data-full-text={feedback.corrected_response || ''}
																		onClick={() => {
																			setEditingAdminFeedback(prev => new Set(prev).add(requestId))
																			setAdminFeedbackEditData(prev => ({
																				...prev,
																				[requestId]: {
																					text: feedback.feedback_text || '',
																					correctedResponse: feedback.corrected_response || ''
																				}
																			}))
																		}}
																		style={{ cursor: 'pointer' }}
																	>
																		{feedback.corrected_response || '-'}
																	</div>
																)}
															</td>
															<td>
																{isEditing ? (
																	<div className="admin-feedback-edit-actions">
																		<button
																			className="btn btn-sm btn-primary"
																			onClick={() => submitAdminFeedbackEdit(requestId)}
																			disabled={submittingAdminFeedbackEdits.has(requestId)}
																		>
																			{submittingAdminFeedbackEdits.has(requestId) ? 'Saving...' : 'Save'}
																		</button>
																		<button
																			className="btn btn-sm btn-ghost"
																			onClick={() => {
																				setEditingAdminFeedback(prev => {
																					const newSet = new Set(prev)
																					newSet.delete(requestId)
																					return newSet
																				})
																			}}
																			disabled={submittingAdminFeedbackEdits.has(requestId)}
																		>
																			Cancel
																		</button>
																	</div>
																) : (
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
																)}
															</td>
															<td>
																{!isEditing && (
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
																		<svg fill="currentColor" viewBox="0 0 24 24" width="18" height="18">
																			<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
																		</svg>
																	</button>
																)}
															</td>
														</tr>
													)
												})}
											</tbody>
										</table>
										)}
										{filteredAndSortedAdminFeedback.length > adminFeedbackDisplayLimit && (
											<div className="load-more-container">
												<button 
													className="btn btn-primary load-more-btn"
													onClick={() => setAdminFeedbackDisplayLimit(prev => prev + 25)}
												>
													{t('loadMore')} ({filteredAndSortedAdminFeedback.length - adminFeedbackDisplayLimit} {t('remaining')})
												</button>
											</div>
										)}
									</>
								)}
							</div>
						</div>
					</div>

					{/* User Feedback Section */}
					<div className="content-section">
						<UserFeedback 
							onChatIdClick={(chatId) => {
								setConversationsSearch(chatId)
								setAdminFeedbackFilter(chatId)
								scrollToConversation(chatId)
							}}
							onUserIdClick={(userId) => {
								setConversationsSearch(userId)
								setAdminFeedbackFilter(userId)
							}}
							onSessionIdClick={(sessionId) => {
								setConversationsSearch(sessionId)
								setAdminFeedbackFilter(sessionId)
							}}
						/>
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

		</div>
	)
}
