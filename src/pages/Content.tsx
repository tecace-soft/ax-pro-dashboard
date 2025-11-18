import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { IconX } from '../ui/icons'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { fetchSessionRequests } from '../services/requests'
import { fetchRequestDetail } from '../services/requestDetails'
import { getChatData } from '../services/chatData'
import { fetchAllConversationsN8N, fetchSessionsN8N, fetchSessionRequestsN8N, fetchRequestDetailN8N } from '../services/conversationsN8N'
import { supabaseN8N } from '../services/supabaseN8N'
import { getAdminFeedbackBatch, getAllAdminFeedback, saveAdminFeedback, updateAdminFeedback, deleteAdminFeedback, updateAdminFeedbackPromptApply, saveManualAdminFeedback, bulkSaveAdminFeedback } from '../services/adminFeedback'
import { getAllAdminFeedbackN8N, saveAdminFeedbackN8N, updateAdminFeedbackN8N, deleteAdminFeedbackN8N, updateAdminFeedbackApplyN8N, AdminFeedbackDataN8N, saveManualAdminFeedbackN8N, bulkSaveAdminFeedbackN8N } from '../services/adminFeedbackN8N'
import { downloadAdminFeedbackTemplate, importAdminFeedback } from '../services/adminFeedbackImport'
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
	const requestDetailsRef = useRef<Record<string, any>>({})
	const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
	const [feedbackModal, setFeedbackModal] = useState<{
		isOpen: boolean, 
		type: 'positive' | 'negative' | null, 
		requestId: string | null, 
		mode: 'submit' | 'view' | 'edit',
		existingFeedback?: AdminFeedbackData | null,
		showThumbsButtons?: boolean
	}>({
		isOpen: false,
		type: null,
		requestId: null,
		mode: 'submit',
		existingFeedback: null,
		showThumbsButtons: true
	})
	const [userFeedbackModal, setUserFeedbackModal] = useState<{
		isOpen: boolean,
		userMessage: string,
		aiResponse: string,
		comments: string,
		reaction: string
	}>({
		isOpen: false,
		userMessage: '',
		aiResponse: '',
		comments: '',
		reaction: ''
	})
	const [feedbackText, setFeedbackText] = useState<string>('')
	const [adminFeedback, setAdminFeedback] = useState<Record<string, AdminFeedbackData>>({})
	const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
	const [expandedFeedbackForms, setExpandedFeedbackForms] = useState<Set<string>>(new Set())
	const [closingFeedbackForms, setClosingFeedbackForms] = useState<Set<string>>(new Set())
	const [feedbackFormData, setFeedbackFormData] = useState<Record<string, { text: string, preferredResponse: string, correctedMessage: string }>>({})
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
	const [adminFeedbackDisplayLimit, setAdminFeedbackDisplayLimit] = useState(10)
	const [editingAdminFeedback, setEditingAdminFeedback] = useState<Set<string>>(new Set())
	const [adminFeedbackEditData, setAdminFeedbackEditData] = useState<Record<string, { text: string, correctedResponse: string }>>({})
	const [submittingAdminFeedbackEdits, setSubmittingAdminFeedbackEdits] = useState<Set<string>>(new Set())
	const [conversationsLastRefreshed, setConversationsLastRefreshed] = useState<Date | null>(null)
	const [adminFeedbackLastRefreshed, setAdminFeedbackLastRefreshed] = useState<Date | null>(null)
	const [isRefreshingConversations, setIsRefreshingConversations] = useState(false)
	const [isRefreshingAdminFeedback, setIsRefreshingAdminFeedback] = useState(false)
	const [conversationsAutoRefresh, setConversationsAutoRefresh] = useState<number | null>(null) // Off by default
	const [adminFeedbackAutoRefresh, setAdminFeedbackAutoRefresh] = useState<number | null>(30) // 30 seconds default, null = off
	const [isBackgroundLoading, setIsBackgroundLoading] = useState(false)
	const [backgroundLoadProgress, setBackgroundLoadProgress] = useState<string>('')
	const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false)
	const [showUpdatePromptModal, setShowUpdatePromptModal] = useState(false)
	const [deleteAdminFeedbackModal, setDeleteAdminFeedbackModal] = useState<{
		isOpen: boolean,
		requestId: string | null,
		feedbackText: string
	}>({
		isOpen: false,
		requestId: null,
		feedbackText: ''
	})
	const [addAdminFeedbackModal, setAddAdminFeedbackModal] = useState({
		isOpen: false
	})
	const [manualFeedbackData, setManualFeedbackData] = useState({
		verdict: 'bad' as 'good' | 'bad',
		correctedMessage: '',
		correctedResponse: '',
		feedbackText: ''
	})
	const [isImporting, setIsImporting] = useState(false)
	const [importFileInput, setImportFileInput] = useState<HTMLInputElement | null>(null)


	// Function to trigger prompt refresh
	const triggerPromptRefresh = () => {
		setPromptRefreshTrigger(prev => prev + 1)
	}

	// Handle Update Prompt button click
	const handleUpdatePrompt = () => {
		setShowUpdatePromptModal(true)
	}

	const handleConfirmUpdatePrompt = async () => {
		setIsUpdatingPrompt(true)
		setShowUpdatePromptModal(false)
		
		try {
			await updatePromptWithFeedback()
			triggerPromptRefresh()
			
			// Show success message
			alert(language === 'ko' ? '프롬프트가 성공적으로 업데이트되었습니다.' : 'Prompt updated successfully.')
		} catch (error) {
			console.error('Failed to update prompt:', error)
			alert(language === 'ko' ? '프롬프트 업데이트 실패' : 'Failed to update prompt')
		} finally {
			setIsUpdatingPrompt(false)
		}
	}

	const handleCancelUpdatePrompt = () => {
		setShowUpdatePromptModal(false)
	}

	// Handle Add Admin Feedback
	const handleAddAdminFeedback = () => {
		setManualFeedbackData({
			verdict: 'bad',
			correctedMessage: '',
			correctedResponse: '',
			feedbackText: ''
		})
		setAddAdminFeedbackModal({ isOpen: true })
	}

	const handleSaveManualFeedback = async () => {
		// Check if either Supervisor Feedback OR Corrected Response is filled (same validation as submit button)
		const hasFeedbackText = manualFeedbackData.feedbackText.trim().length > 0
		const hasCorrectedResponse = manualFeedbackData.correctedResponse.trim().length > 0
		
		if (!hasFeedbackText && !hasCorrectedResponse) {
			alert(language === 'ko' ? 'Supervisor Feedback 또는 Corrected Response 중 하나를 입력해주세요.' : 'Please fill in either Supervisor Feedback or Corrected Response.')
			return
		}

		try {
			let savedFeedback: AdminFeedbackData | AdminFeedbackDataN8N
			if (isN8NRoute) {
				savedFeedback = await saveManualAdminFeedbackN8N(
					manualFeedbackData.verdict,
					manualFeedbackData.feedbackText,
					manualFeedbackData.correctedResponse,
					manualFeedbackData.correctedMessage
				)
				// Map to UI format
				// Use feedback ID as key since chat_id is null
				const feedbackKey = savedFeedback.id ? `feedback-${savedFeedback.id}` : `feedback-${Date.now()}`
				const mappedFeedback: AdminFeedbackData = {
					id: savedFeedback.id,
					request_id: feedbackKey, // Use generated key since chat_id is null
					feedback_verdict: savedFeedback.feedback_verdict || manualFeedbackData.verdict,
					feedback_text: savedFeedback.feedback_text || '',
					corrected_response: savedFeedback.corrected_response || null,
					prompt_apply: savedFeedback.apply !== undefined ? savedFeedback.apply : true,
					created_at: savedFeedback.created_at,
					updated_at: savedFeedback.updated_at || undefined
				}
				setAdminFeedback(prev => ({
					...prev,
					[feedbackKey]: mappedFeedback
				}))
			} else {
				const savedFeedbackLegacy: AdminFeedbackData = await saveManualAdminFeedback(
					manualFeedbackData.verdict,
					manualFeedbackData.feedbackText,
					'', // userMessage - not used for manual feedback
					'', // aiResponse - not used for manual feedback
					manualFeedbackData.correctedResponse
				)
				setAdminFeedback(prev => ({
					...prev,
					[savedFeedbackLegacy.request_id]: savedFeedbackLegacy
				}))
			}

			setAddAdminFeedbackModal({ isOpen: false })
			setManualFeedbackData({
				verdict: 'bad',
				correctedMessage: '',
				correctedResponse: '',
				feedbackText: ''
			})
			await refreshAdminFeedback()
			alert(language === 'ko' ? '피드백이 추가되었습니다.' : 'Feedback added successfully.')
		} catch (error) {
			console.error('Failed to save manual feedback:', error)
			alert(language === 'ko' ? '피드백 추가 실패' : 'Failed to add feedback')
		}
	}

	const handleCancelManualFeedback = () => {
		setAddAdminFeedbackModal({ isOpen: false })
		setManualFeedbackData({
			verdict: 'bad',
			correctedMessage: '',
			correctedResponse: '',
			feedbackText: ''
		})
	}

	// Handle Import Admin Feedback
	const handleDownloadTemplate = (format: 'csv' | 'excel') => {
		downloadAdminFeedbackTemplate(format)
	}

	const handleImportClick = () => {
		if (importFileInput) {
			importFileInput.click()
		}
	}

	const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		setIsImporting(true)
		try {
			const result = await importAdminFeedback(file, isN8NRoute)
			if (result.success > 0) {
				await refreshAdminFeedback()
				
				// Fetch chat data for imported feedback entries to populate requestDetails
				if (isN8NRoute) {
					// Get the newly imported feedback to get their chat_ids
					const allFeedbackN8N = await getAllAdminFeedbackN8N()
					const importedChatIds = Object.keys(allFeedbackN8N).filter(chatId => 
						chatId.startsWith('manual-')
					)
					
					// Fetch chat data for imported entries
					if (importedChatIds.length > 0) {
						const { data: chatData, error: chatError } = await supabaseN8N
							.from('chat')
							.select('chat_id, chat_message, response')
							.in('chat_id', importedChatIds)
						
						if (!chatError && chatData) {
							// Update requestDetails with imported chat data
							setRequestDetails(prev => {
								const updated = { ...prev }
								chatData.forEach((chat: any) => {
									updated[chat.chat_id] = {
										inputText: chat.chat_message || '',
										outputText: chat.response || ''
									}
								})
								return updated
							})
						}
					}
				} else {
					// For legacy route, fetch from chat_data
					const allFeedback = await getAllAdminFeedback()
					const importedRequestIds = Object.keys(allFeedback).filter(requestId => 
						requestId.startsWith('manual-')
					)
					
					// Fetch chat_data for imported entries
					if (importedRequestIds.length > 0 && authToken) {
						for (const requestId of importedRequestIds) {
							try {
								const detail = await fetchRequestDetail(authToken, requestId)
								if (detail) {
									setRequestDetails(prev => ({
										...prev,
										[requestId]: detail
									}))
								}
							} catch (error) {
								console.warn(`Could not fetch detail for ${requestId}:`, error)
							}
						}
					}
				}
				
				alert(language === 'ko' 
					? `${result.success}개의 피드백이 가져와졌습니다.` 
					: `${result.success} feedback entries imported successfully.`)
			}
			if (result.errors.length > 0) {
				alert(language === 'ko' 
					? `오류: ${result.errors.join(', ')}` 
					: `Errors: ${result.errors.join(', ')}`)
			}
		} catch (error: any) {
			console.error('Failed to import feedback:', error)
			alert(language === 'ko' ? '가져오기 실패' : 'Import failed')
		} finally {
			setIsImporting(false)
			if (importFileInput) {
				importFileInput.value = ''
			}
		}
	}

	const handleDeleteAdminFeedback = async (requestId: string) => {
		try {
			if (isN8NRoute) {
				await deleteAdminFeedbackN8N(requestId) // Can be chat_id or feedback-{id}
			} else {
				await deleteAdminFeedback(requestId)
			}
			
			// Update local state
			setAdminFeedback(prev => {
				const newState = { ...prev }
				delete newState[requestId]
				return newState
			})
			
			// Refresh admin feedback to ensure data is fresh
			await refreshAdminFeedback()
			
			// Update system prompt to reflect the deletion (only for standard route)
			if (!isN8NRoute) {
				await updatePromptWithFeedback()
				// Trigger prompt refresh in PromptControl component
				triggerPromptRefresh()
			}
			
			// Close modal
			setDeleteAdminFeedbackModal({
				isOpen: false,
				requestId: null,
				feedbackText: ''
			})
		} catch (error) {
			console.error('Failed to delete admin feedback:', error)
			alert(language === 'ko' ? '피드백 삭제 실패' : 'Failed to delete feedback')
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
	const refreshConversations = useCallback(async () => {
		setIsRefreshingConversations(true)
		try {
			await loadConversationsOptimized(true) // bypassCache = true
			setConversationsLastRefreshed(new Date())
		} catch (error) {
			console.error('Failed to refresh conversations:', error)
		} finally {
			setIsRefreshingConversations(false)
		}
	}, [startDate, endDate, isN8NRoute, authToken])

	const refreshAdminFeedback = useCallback(async () => {
		setIsRefreshingAdminFeedback(true)
		try {
			if (isN8NRoute) {
				const allFeedbackN8N = await getAllAdminFeedbackN8N(startDate, endDate)
				// Map n8n feedback format (chat_id, apply) to UI format (request_id, prompt_apply)
				// Preserve corrected_message field for editing
				const mappedFeedback: Record<string, AdminFeedbackData & { corrected_message?: string | null }> = {}
				Object.entries(allFeedbackN8N).forEach(([chatId, feedback]) => {
					mappedFeedback[chatId] = {
						id: feedback.id,
						request_id: chatId,
						feedback_verdict: feedback.feedback_verdict || 'good',
						feedback_text: feedback.feedback_text || '',
						corrected_response: feedback.corrected_response || null,
						corrected_message: feedback.corrected_message || null,
						prompt_apply: feedback.apply !== undefined ? feedback.apply : true,
						created_at: feedback.created_at,
						updated_at: feedback.updated_at || undefined
					}
				})
				setAdminFeedback(mappedFeedback)
			} else if (authToken) {
				const allFeedback = await getAllAdminFeedback(startDate, endDate)
				setAdminFeedback(allFeedback)
			}
			setAdminFeedbackLastRefreshed(new Date())
		} catch (error) {
			console.error('Failed to refresh admin feedback:', error)
		} finally {
			setIsRefreshingAdminFeedback(false)
		}
	}, [isN8NRoute, authToken, startDate, endDate])

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

				// Start background loading after initial load completes
				loadBackgroundConversations(startDate, endDate, sessionsList, sessionRequestsMap, requestDetailsMap)

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
				
				// Start background loading after initial load completes
				loadBackgroundConversations(startDate, endDate, sessions, sessionRequestsMap, requestDetailsMap)
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

	// Background loading: Load data outside the current date range and cache it
	const loadBackgroundConversations = async (
		currentStartDate: string,
		currentEndDate: string,
		currentSessions: any[],
		currentSessionRequests: Record<string, any[]>,
		currentRequestDetails: Record<string, any>
	) => {
		if (isBackgroundLoading) return // Already loading
		
		setIsBackgroundLoading(true)
		setBackgroundLoadProgress('Loading extended date range...')
		
		try {
			// Calculate extended date range: 30 days before and 30 days after
			const startDateObj = new Date(currentStartDate + 'T00:00:00')
			const endDateObj = new Date(currentEndDate + 'T23:59:59.999')
			
			// 30 days before start date
			const extendedStartDate = new Date(startDateObj)
			extendedStartDate.setDate(extendedStartDate.getDate() - 30)
			const bgStartDate = formatDate(extendedStartDate)
			
			// 30 days after end date
			const extendedEndDate = new Date(endDateObj)
			extendedEndDate.setDate(extendedEndDate.getDate() + 30)
			const bgEndDate = formatDate(extendedEndDate)
			
			// Load data for extended range (only outside current range)
			let bgSessions: any[] = []
			let bgSessionRequests: Record<string, any[]> = {}
			let bgRequestDetails: Record<string, any> = {}
			
			// Load data before current start date
			if (isN8NRoute) {
				setBackgroundLoadProgress('Loading earlier conversations...')
				const beforeRange = await fetchAllConversationsN8N(bgStartDate, currentStartDate)
				beforeRange.sessions.forEach(s => bgSessions.push(s))
				Object.assign(bgSessionRequests, beforeRange.sessionRequests)
				
				// Build requestDetails from the chat data
				Object.values(beforeRange.sessionRequests).forEach((requests) => {
					requests.forEach((request: any) => {
						const requestId = request.requestId || request.id
						if (requestId) {
							bgRequestDetails[requestId] = {
								inputText: request.chat_message || '',
								outputText: request.response || ''
							}
						}
					})
				})
				
				// Load data after current end date
				setBackgroundLoadProgress('Loading later conversations...')
				const afterRange = await fetchAllConversationsN8N(currentEndDate, bgEndDate)
				afterRange.sessions.forEach(s => bgSessions.push(s))
				Object.assign(bgSessionRequests, afterRange.sessionRequests)
				
				// Build requestDetails from the chat data
				Object.values(afterRange.sessionRequests).forEach((requests) => {
					requests.forEach((request: any) => {
						const requestId = request.requestId || request.id
						if (requestId) {
							bgRequestDetails[requestId] = {
								inputText: request.chat_message || '',
								outputText: request.response || ''
							}
						}
					})
				})
			} else if (authToken) {
				// Load data before current start date
				setBackgroundLoadProgress('Loading earlier conversations...')
				const beforeApiStartDate = getApiStartDate(bgStartDate)
				const beforeApiEndDate = getApiEndDate(currentStartDate)
				const beforeSessionsResponse = await fetchSessions(authToken, beforeApiStartDate, beforeApiEndDate)
				const beforeSessions = beforeSessionsResponse.sessions || []
				
				// Fetch session requests for before range
				const beforeRequestPromises = beforeSessions
					.filter(session => session.sessionId)
					.map(session => 
						fetchSessionRequests(authToken, session.sessionId, beforeApiStartDate, beforeApiEndDate)
							.catch(error => {
								console.error(`Failed to fetch requests for session ${session.sessionId}:`, error)
								return { requests: [] }
							})
					)
				
				const beforeRequestResponses = await Promise.all(beforeRequestPromises)
				const beforeSessionRequests: Record<string, any[]> = {}
				const beforeRequestIds: string[] = []
				
				beforeRequestResponses.forEach((response, index) => {
					const session = beforeSessions[index]
					if (session && session.sessionId) {
						beforeSessionRequests[session.sessionId] = response.requests || []
						response.requests?.forEach((req: any) => {
							const requestId = req.requestId || req.id
							if (requestId) {
								beforeRequestIds.push(requestId)
							}
						})
					}
				})
				
				// Load data after current end date
				setBackgroundLoadProgress('Loading later conversations...')
				const afterApiStartDate = getApiStartDate(currentEndDate)
				const afterApiEndDate = getApiEndDate(bgEndDate)
				const afterSessionsResponse = await fetchSessions(authToken, afterApiStartDate, afterApiEndDate)
				const afterSessions = afterSessionsResponse.sessions || []
				
				// Fetch session requests for after range
				const afterRequestPromises = afterSessions
					.filter(session => session.sessionId)
					.map(session => 
						fetchSessionRequests(authToken, session.sessionId, afterApiStartDate, afterApiEndDate)
							.catch(error => {
								console.error(`Failed to fetch requests for session ${session.sessionId}:`, error)
								return { requests: [] }
							})
					)
				
				const afterRequestResponses = await Promise.all(afterRequestPromises)
				const afterSessionRequests: Record<string, any[]> = {}
				const afterRequestIds: string[] = []
				
				afterRequestResponses.forEach((response, index) => {
					const session = afterSessions[index]
					if (session && session.sessionId) {
						afterSessionRequests[session.sessionId] = response.requests || []
						response.requests?.forEach((req: any) => {
							const requestId = req.requestId || req.id
							if (requestId) {
								afterRequestIds.push(requestId)
							}
						})
					}
				})
				
				// Combine before and after
				bgSessions = [...beforeSessions, ...afterSessions]
				bgSessionRequests = { ...beforeSessionRequests, ...afterSessionRequests }
				const allRequestIds = [...beforeRequestIds, ...afterRequestIds]
				
				// Fetch request details in batches
				setBackgroundLoadProgress(`Loading ${allRequestIds.length} request details...`)
				for (let i = 0; i < allRequestIds.length; i += 10) {
					const batch = allRequestIds.slice(i, i + 10)
					await Promise.all(batch.map(async (requestId) => {
						try {
							const detailResponse = await fetchRequestDetail(authToken, requestId)
							if (detailResponse && detailResponse.request) {
								bgRequestDetails[requestId] = detailResponse.request
							}
						} catch (error) {
							console.error(`Failed to fetch detail for ${requestId}:`, error)
						}
					}))
					
					if (i % 50 === 0) {
						setBackgroundLoadProgress(`Loading ${i}/${allRequestIds.length} request details...`)
					}
				}
			}
			
			// Merge background data with current data (background data takes precedence for overlapping dates)
			const mergedSessions = [...currentSessions]
			const mergedSessionRequests = { ...currentSessionRequests }
			const mergedRequestDetails = { ...currentRequestDetails }
			
			// Add new sessions that aren't already in currentSessions
			bgSessions.forEach(bgSession => {
				if (!mergedSessions.find(s => s.sessionId === bgSession.sessionId)) {
					mergedSessions.push(bgSession)
				}
			})
			
			// Merge session requests
			Object.entries(bgSessionRequests).forEach(([sessionId, requests]) => {
				if (!mergedSessionRequests[sessionId]) {
					mergedSessionRequests[sessionId] = []
				}
				requests.forEach((req: any) => {
					const requestId = req.requestId || req.id
					if (!mergedSessionRequests[sessionId].find((r: any) => (r.requestId || r.id) === requestId)) {
						mergedSessionRequests[sessionId].push(req)
					}
				})
			})
			
			// Merge request details
			Object.assign(mergedRequestDetails, bgRequestDetails)
			
			// Update state with merged data
			setSessions(mergedSessions)
			setSessionRequests(mergedSessionRequests)
			setRequestDetails(mergedRequestDetails)
			
			// Cache the extended range data
			const cacheKey = conversationsCache.generateKey(bgStartDate, bgEndDate)
			const cacheData: CacheData = {
				sessions: mergedSessions,
				sessionRequests: mergedSessionRequests,
				requestDetails: mergedRequestDetails,
				adminFeedback: {}
			}
			conversationsCache.set(cacheKey, cacheData)
			conversationsCache.setToStorage(cacheKey, cacheData)
			
			setBackgroundLoadProgress('Background loading complete!')
			setConversationsLastRefreshed(new Date())
			
			// Small delay before clearing progress message
			setTimeout(() => {
				setBackgroundLoadProgress('')
			}, 2000)
			
		} catch (error) {
			console.error('Background loading failed:', error)
			setBackgroundLoadProgress('Background loading failed')
			setTimeout(() => {
				setBackgroundLoadProgress('')
			}, 3000)
		} finally {
			setIsBackgroundLoading(false)
		}
	}

	// Auto-refresh Conversations based on selected interval
	useEffect(() => {
		if (conversationsAutoRefresh === null) return // Auto-refresh disabled
		
		const intervalId = setInterval(() => {
			if (!isLoadingSessions && !isRefreshingConversations) {
				refreshConversations()
			}
		}, conversationsAutoRefresh * 1000) // Convert seconds to milliseconds

		return () => {
			clearInterval(intervalId)
		}
	}, [refreshConversations, conversationsAutoRefresh, isLoadingSessions, isRefreshingConversations])

	// Auto-refresh Admin Feedback based on selected interval
	useEffect(() => {
		if (adminFeedbackAutoRefresh === null) return // Auto-refresh disabled
		
		const intervalId = setInterval(() => {
			if (!isRefreshingAdminFeedback) {
				refreshAdminFeedback()
			}
		}, adminFeedbackAutoRefresh * 1000) // Convert seconds to milliseconds

		return () => {
			clearInterval(intervalId)
		}
	}, [refreshAdminFeedback, isRefreshingAdminFeedback, adminFeedbackAutoRefresh])

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
					const allFeedbackN8N = await getAllAdminFeedbackN8N(startDate, endDate)
					if (!cancelled) {
						// Map n8n feedback format (chat_id, apply) to UI format (request_id, prompt_apply)
						// Preserve corrected_message field for editing
						const mappedFeedback: Record<string, AdminFeedbackData & { corrected_message?: string | null }> = {}
						Object.entries(allFeedbackN8N).forEach(([chatId, feedback]) => {
							mappedFeedback[chatId] = {
								id: feedback.id,
								request_id: chatId, // Use chat_id as request_id for UI compatibility
								feedback_verdict: feedback.feedback_verdict || 'good',
								feedback_text: feedback.feedback_text || '',
								corrected_response: feedback.corrected_response || null,
								corrected_message: feedback.corrected_message || null,
								prompt_apply: feedback.apply !== undefined ? feedback.apply : true, // Map apply to prompt_apply
								created_at: feedback.created_at,
								updated_at: feedback.updated_at || undefined
							}
						})
						setAdminFeedback(mappedFeedback)
						setAdminFeedbackLastRefreshed(new Date())
						
						// Load chat data for all feedback entries (for N8N route)
						// This ensures User Message, AI Response, and Session ID are available even if not in current date range
						// Only load chat data for entries that have a chat_id (skip entries with feedback-{id} keys)
						const chatIds = Object.keys(mappedFeedback).filter(key => !key.startsWith('feedback-'))
						const requestDetailsMap: Record<string, any> = {}
						const sessionRequestsMap: Record<string, any[]> = {}
						
						// Load chat data in batches to avoid overwhelming the API
						for (let i = 0; i < chatIds.length; i += 10) {
							if (cancelled) break
							const batch = chatIds.slice(i, i + 10)
							
							await Promise.all(batch.map(async (chatId) => {
								// Always try to fetch to ensure we have the data
								try {
									const trimmedChatId = chatId.trim() // Trim whitespace
									const detail = await fetchRequestDetailN8N(trimmedChatId)
									if (detail && detail.request) {
										// Store in requestDetails (use both trimmed and original as keys for lookup)
										requestDetailsMap[trimmedChatId] = {
											inputText: detail.request.inputText || '',
											outputText: detail.request.outputText || ''
										}
										// Also store with original chatId if different
										if (trimmedChatId !== chatId) {
											requestDetailsMap[chatId] = {
												inputText: detail.request.inputText || '',
												outputText: detail.request.outputText || ''
											}
										}
										
										// Store in sessionRequests for sessionId lookup
										if (detail.request.sessionId) {
											if (!sessionRequestsMap[detail.request.sessionId]) {
												sessionRequestsMap[detail.request.sessionId] = []
											}
											sessionRequestsMap[detail.request.sessionId].push({
												requestId: trimmedChatId,
												id: trimmedChatId
											})
										}
									}
								} catch (error) {
									console.warn(`Could not fetch detail for ${chatId}:`, error)
								}
							}))
						}
						
						if (!cancelled) {
							if (Object.keys(requestDetailsMap).length > 0) {
								setRequestDetails(prev => ({ ...prev, ...requestDetailsMap }))
							}
							if (Object.keys(sessionRequestsMap).length > 0) {
								setSessionRequests(prev => ({ ...prev, ...sessionRequestsMap }))
							}
						}
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
				const allFeedback = await getAllAdminFeedback(startDate, endDate)
				if (!cancelled) {
					setAdminFeedback(allFeedback)
					setAdminFeedbackLastRefreshed(new Date())
					
					// Load chat data for all feedback entries (for tecace route)
					// This ensures User Message, AI Response, and Session ID are available even if not in current date range
					const requestIds = Object.keys(allFeedback)
					const requestDetailsMap: Record<string, any> = {}
					const sessionRequestsMap: Record<string, any[]> = {}
					
					// Load chat data in batches to avoid overwhelming the API
					for (let i = 0; i < requestIds.length; i += 10) {
						if (cancelled) break
						const batch = requestIds.slice(i, i + 10)
						
						await Promise.all(batch.map(async (requestId) => {
							// Always try to fetch to ensure we have the data
							try {
								const chatData = await getChatData(requestId)
								if (chatData) {
									// Store in requestDetails
									requestDetailsMap[requestId] = {
										inputText: chatData.input_text || '',
										outputText: chatData.output_text || ''
									}
									
									// Store in sessionRequests for sessionId lookup
									if (chatData.session_id) {
										if (!sessionRequestsMap[chatData.session_id]) {
											sessionRequestsMap[chatData.session_id] = []
										}
										sessionRequestsMap[chatData.session_id].push({
											requestId: requestId,
											id: requestId
										})
									}
								} else {
									// Fallback to API if chat_data doesn't exist
									if (authToken) {
										try {
											const detail = await fetchRequestDetail(authToken, requestId)
											if (detail && detail.request) {
												requestDetailsMap[requestId] = detail.request
											}
										} catch (error) {
											console.warn(`Could not fetch detail for ${requestId}:`, error)
										}
									}
								}
							} catch (error) {
								console.warn(`Could not fetch chat data for ${requestId}:`, error)
							}
						}))
					}
					
					if (!cancelled) {
						if (Object.keys(requestDetailsMap).length > 0) {
							setRequestDetails(prev => ({ ...prev, ...requestDetailsMap }))
						}
						if (Object.keys(sessionRequestsMap).length > 0) {
							setSessionRequests(prev => ({ ...prev, ...sessionRequestsMap }))
						}
					}
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
	}, [authToken, startDate, endDate, isN8NRoute])

	// Keep requestDetailsRef in sync with requestDetails state
	useEffect(() => {
		requestDetailsRef.current = requestDetails
	}, [requestDetails])

	// Load missing chat data for admin feedback entries on-demand
	// This runs whenever adminFeedback changes, ensuring we always try to load missing data
	useEffect(() => {
		if (Object.keys(adminFeedback).length === 0) return
		
		let cancelled = false
		const requestIds = Object.keys(adminFeedback)
		
		async function loadMissingData() {
			// Use ref to get current requestDetails without dependency issues
			const currentRequestDetails = requestDetailsRef.current
			const missingIds: string[] = []
			
			// Find requestIds that don't have requestDetails or have empty/dash values
			requestIds.forEach(requestId => {
				const detail = currentRequestDetails[requestId]
				// Check if detail is missing, empty, or shows dash
				if (!detail || !detail.inputText || detail.inputText.trim() === '' || detail.inputText === '-' || 
				    !detail.outputText || detail.outputText.trim() === '' || detail.outputText === '-') {
					missingIds.push(requestId)
				}
			})
			
			if (missingIds.length === 0) return
			
			console.log('Loading missing data for admin feedback:', missingIds)
			
			const requestDetailsMap: Record<string, any> = {}
			const sessionRequestsMap: Record<string, any[]> = {}
			
			// Load in batches
			for (let i = 0; i < missingIds.length; i += 10) {
				if (cancelled) break
				const batch = missingIds.slice(i, i + 10)
				
				await Promise.all(batch.map(async (requestId) => {
					try {
						if (isN8NRoute) {
							// N8N route: Fetch from Supabase
							const trimmedRequestId = requestId.trim() // Trim whitespace
							const detail = await fetchRequestDetailN8N(trimmedRequestId)
							if (detail && detail.request) {
								// Store in requestDetails (use both trimmed and original as keys for lookup)
								requestDetailsMap[trimmedRequestId] = {
									inputText: detail.request.inputText || '',
									outputText: detail.request.outputText || ''
								}
								// Also store with original requestId if different
								if (trimmedRequestId !== requestId) {
									requestDetailsMap[requestId] = {
										inputText: detail.request.inputText || '',
										outputText: detail.request.outputText || ''
									}
								}
								
								if (detail.request.sessionId) {
									if (!sessionRequestsMap[detail.request.sessionId]) {
										sessionRequestsMap[detail.request.sessionId] = []
									}
									sessionRequestsMap[detail.request.sessionId].push({
										requestId: trimmedRequestId,
										id: trimmedRequestId
									})
								}
							}
						} else {
							// Tecace route: Try chat_data first, then API
							const chatData = await getChatData(requestId)
							if (chatData) {
								requestDetailsMap[requestId] = {
									inputText: chatData.input_text || '',
									outputText: chatData.output_text || ''
								}
								
								if (chatData.session_id) {
									if (!sessionRequestsMap[chatData.session_id]) {
										sessionRequestsMap[chatData.session_id] = []
									}
									sessionRequestsMap[chatData.session_id].push({
										requestId: requestId,
										id: requestId
									})
								}
							} else if (authToken) {
								// Fallback to API
								const detail = await fetchRequestDetail(authToken, requestId)
								if (detail && detail.request) {
									requestDetailsMap[requestId] = detail.request
								}
							}
						}
					} catch (error) {
						console.warn(`Could not fetch data for ${requestId}:`, error)
					}
				}))
			}
			
			if (!cancelled) {
				if (Object.keys(requestDetailsMap).length > 0) {
					console.log('Updating requestDetails with:', Object.keys(requestDetailsMap))
					setRequestDetails(prev => ({ ...prev, ...requestDetailsMap }))
				}
				if (Object.keys(sessionRequestsMap).length > 0) {
					setSessionRequests(prev => ({ ...prev, ...sessionRequestsMap }))
				}
			}
		}
		
		// Small delay to let initial adminFeedback load complete
		const timeoutId = setTimeout(() => {
			loadMissingData()
		}, 300)
		
		return () => {
			cancelled = true
			clearTimeout(timeoutId)
		}
	}, [adminFeedback, isN8NRoute, authToken])

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
		const trimmedRequestId = requestId.trim() // Trim whitespace
		const existingFeedback = adminFeedback[trimmedRequestId] || adminFeedback[requestId]
		const requestDetail = requestDetails[trimmedRequestId] || requestDetails[requestId] || {}
		const aiResponse = requestDetail.outputText || ''
		const userMessage = requestDetail.inputText || ''
		
		// Open modal popup with User Message and AI Response
		setFeedbackModal({
			isOpen: true,
			type: type,
			requestId: trimmedRequestId,
			mode: existingFeedback ? 'edit' : 'submit',
			existingFeedback: existingFeedback || null,
			showThumbsButtons: true
		})
		setFeedbackText(existingFeedback?.feedback_text || '')
		
		// Set corrected message - use existing if editing, otherwise default to User Message
		// Corrected response stays empty by default (only use existing if editing)
		const existingCorrectedMessage = (existingFeedback as any)?.corrected_message
		setFeedbackFormData(prev => ({
			...prev,
			[trimmedRequestId]: {
				text: existingFeedback?.feedback_text || '',
				preferredResponse: existingFeedback?.corrected_response || '',
				correctedMessage: existingCorrectedMessage || userMessage
			}
		}))
	}

	const handleMessageClick = (requestId: string, showThumbsButtons: boolean = true) => {
		const trimmedRequestId = requestId.trim() // Trim whitespace
		const existingFeedback = adminFeedback[trimmedRequestId] || adminFeedback[requestId]
		const requestDetail = requestDetails[trimmedRequestId] || requestDetails[requestId] || {}
		const aiResponse = requestDetail.outputText || ''
		const userMessage = requestDetail.inputText || ''
		
		// Open modal popup when clicking on User Message or AI Response
		setFeedbackModal({
			isOpen: true,
			type: existingFeedback?.feedback_verdict === 'good' ? 'positive' : existingFeedback?.feedback_verdict === 'bad' ? 'negative' : null,
			requestId: trimmedRequestId,
			mode: existingFeedback ? 'edit' : 'submit',
			existingFeedback: existingFeedback || null,
			showThumbsButtons: showThumbsButtons
		})
		setFeedbackText(existingFeedback?.feedback_text || '')
		
		// Set corrected message - use existing if editing, otherwise default to User Message
		// Corrected response stays empty by default (only use existing if editing)
		const existingCorrectedMessage = (existingFeedback as any)?.corrected_message
		setFeedbackFormData(prev => ({
			...prev,
			[trimmedRequestId]: {
				text: existingFeedback?.feedback_text || '',
				preferredResponse: existingFeedback?.corrected_response || '',
				correctedMessage: existingCorrectedMessage || userMessage
			}
		}))
	}


	const closeFeedbackModal = () => {
		setFeedbackModal({
			isOpen: false,
			type: null,
			requestId: null,
			mode: 'submit',
			existingFeedback: null,
			showThumbsButtons: true
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
				
				// Get sessionId and message data for ensuring chat exists
				const requestDetail = requestDetails[requestId] || {}
				const userMessage = requestDetail.inputText || ''
				const aiResponse = requestDetail.outputText || ''
				let sessionId = ''
				for (const [sId, requests] of Object.entries(sessionRequests)) {
					if (requests.some((r: any) => (r.requestId || r.id || r.chat_id) === requestId)) {
						sessionId = sId
						break
					}
				}
				
				const savedFeedbackN8N = await saveAdminFeedbackN8N(
					requestId, 
					'good', 
					'', 
					undefined, 
					undefined,
					sessionId || undefined,
					userMessage || undefined,
					aiResponse || undefined
				)
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
		const requestDetail = requestDetails[requestId] || {}
		const userMessage = requestDetail.inputText || ''
		setExpandedFeedbackForms(prev => new Set(prev).add(requestId))
		setFeedbackFormData(prev => ({
			...prev,
			[requestId]: { text: '', preferredResponse: '', correctedMessage: userMessage }
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
				
				// Get sessionId and message data for ensuring chat exists
				const requestDetail = requestDetails[requestId] || {}
				const userMessage = requestDetail.inputText || ''
				const aiResponse = requestDetail.outputText || ''
				let sessionId = ''
				for (const [sId, requests] of Object.entries(sessionRequests)) {
					if (requests.some((r: any) => (r.requestId || r.id || r.chat_id) === requestId)) {
						sessionId = sId
						break
					}
				}
				
				const savedFeedbackN8N = await saveAdminFeedbackN8N(
					requestId, // chat_id
					'bad', 
					formData.text,
					formData.preferredResponse.trim() || undefined,
					formData.correctedMessage?.trim() || undefined,
					sessionId || undefined,
					userMessage || undefined,
					aiResponse || undefined
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
				// Get sessionId and message data for ensuring chat exists
				const requestDetail = requestDetails[requestId] || {}
				const userMessage = requestDetail.inputText || ''
				const aiResponse = requestDetail.outputText || ''
				let sessionId = ''
				for (const [sId, requests] of Object.entries(sessionRequests)) {
					if (requests.some((r: any) => (r.requestId || r.id || r.chat_id) === requestId)) {
						sessionId = sId
						break
					}
				}
				
				const savedFeedbackN8N = await saveAdminFeedbackN8N(
					requestId, 
					'good', 
					'', 
					undefined, 
					undefined,
					sessionId || undefined,
					userMessage || undefined,
					aiResponse || undefined
				) // requestId is chat_id for n8n
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
				// Get sessionId and message data for ensuring chat exists
				const requestDetail = requestDetails[requestId] || {}
				const userMessage = requestDetail.inputText || ''
				const aiResponse = requestDetail.outputText || ''
				let sessionId = ''
				for (const [sId, requests] of Object.entries(sessionRequests)) {
					if (requests.some((r: any) => (r.requestId || r.id || r.chat_id) === requestId)) {
						sessionId = sId
						break
					}
				}
				
				const savedFeedbackN8N = await saveAdminFeedbackN8N(
					requestId, // chat_id
					verdict, 
					formData.text,
					formData.preferredResponse.trim() || undefined,
					formData.correctedMessage?.trim() || undefined,
					sessionId || undefined,
					userMessage || undefined,
					aiResponse || undefined
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
		if (!feedbackModal.requestId || !feedbackModal.type) {
			return
		}

		// Check if either Supervisor Feedback OR Corrected Response is filled
		const hasFeedbackText = feedbackText.trim().length > 0
		const preferredResponse = feedbackFormData[feedbackModal.requestId]?.preferredResponse || ''
		const hasPreferredResponse = preferredResponse.trim().length > 0
		
		if (!hasFeedbackText && !hasPreferredResponse) {
			alert(language === 'ko' ? 'Supervisor Feedback 또는 Corrected Response 중 하나를 입력해주세요.' : 'Please fill in either Supervisor Feedback or Corrected Response.')
			return
		}

		setIsSubmittingFeedback(true)
		
		try {
			const verdict = feedbackModal.type === 'positive' ? 'good' : 'bad'
			const requestId = feedbackModal.requestId!.trim() // Trim whitespace from requestId
			const preferredResponse = feedbackFormData[requestId]?.preferredResponse || feedbackModal.existingFeedback?.corrected_response || ''
			const correctedMessage = feedbackFormData[requestId]?.correctedMessage || ''
			
			if (isN8NRoute) {
				// Find sessionId and get userMessage/aiResponse for ensuring chat exists
				const requestDetail = requestDetails[requestId] || {}
				const userMessage = requestDetail.inputText || ''
				const aiResponse = requestDetail.outputText || ''
				
				// Find the session ID for this request
				let sessionId = ''
				for (const [sId, requests] of Object.entries(sessionRequests)) {
					if (requests.some((r: any) => (r.requestId || r.id || r.chat_id) === requestId)) {
						sessionId = sId
						break
					}
				}
				
				let savedFeedbackN8N: AdminFeedbackDataN8N
				if (feedbackModal.mode === 'edit' || feedbackModal.existingFeedback) {
					// Update existing feedback
					savedFeedbackN8N = await updateAdminFeedbackN8N(requestId, verdict, feedbackText, preferredResponse.trim() || undefined, correctedMessage.trim() || undefined)
				} else {
					// Save new feedback - ensure chat exists first
					savedFeedbackN8N = await saveAdminFeedbackN8N(
						requestId, 
						verdict, 
						feedbackText, 
						preferredResponse.trim() || undefined, 
						correctedMessage.trim() || undefined,
						sessionId || undefined,
						userMessage || undefined,
						aiResponse || undefined
					)
				}
				// Map n8n format to UI format, preserve corrected_message
				const savedFeedback: AdminFeedbackData & { corrected_message?: string | null } = {
					id: savedFeedbackN8N.id,
					request_id: requestId,
					feedback_verdict: savedFeedbackN8N.feedback_verdict || verdict,
					feedback_text: savedFeedbackN8N.feedback_text || '',
					corrected_response: savedFeedbackN8N.corrected_response || null,
					corrected_message: savedFeedbackN8N.corrected_message || null,
					prompt_apply: savedFeedbackN8N.apply !== undefined ? savedFeedbackN8N.apply : true,
					created_at: savedFeedbackN8N.created_at,
					updated_at: savedFeedbackN8N.updated_at || undefined
				}
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			} else {
				// Ensure chat data exists first (required for foreign key constraint)
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
				
				let savedFeedback: AdminFeedbackData
				if (feedbackModal.mode === 'edit' || feedbackModal.existingFeedback) {
					// Update existing feedback
					savedFeedback = await updateAdminFeedback(requestId, verdict, feedbackText, preferredResponse.trim() || undefined)
				} else {
					// Save new feedback
					savedFeedback = await saveAdminFeedback(requestId, verdict, feedbackText, preferredResponse.trim() || undefined)
				}
				setAdminFeedback(prev => ({
					...prev,
					[requestId]: savedFeedback
				}))
			}
			
			closeFeedbackModal()
			
			// Refresh admin feedback table
			await refreshAdminFeedback()
			
			// Update prompt with new/updated feedback (only for bad feedback)
			if (verdict === 'bad' && !isN8NRoute) {
				await updatePromptWithFeedback()
				
				// Trigger prompt refresh in PromptControl component
				triggerPromptRefresh()
			}
		} catch (error) {
			console.error('Failed to submit feedback:', error)
			alert(`Failed to submit feedback: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
					editData.correctedResponse.trim() || undefined,
					undefined // correctedMessage not available in table edit view
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
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<select
											value={conversationsAutoRefresh === null ? 'off' : conversationsAutoRefresh.toString()}
											onChange={(e) => {
												const value = e.target.value
												setConversationsAutoRefresh(value === 'off' ? null : parseInt(value))
											}}
											style={{
												padding: '6px 8px',
												borderRadius: '4px',
												border: '1px solid var(--border-color)',
												background: 'var(--bg-secondary)',
												color: 'var(--text-primary)',
												fontSize: '14px',
												cursor: 'pointer'
											}}
										>
											<option value="off">{language === 'ko' ? '자동 새로고침 끄기' : 'Auto-refresh Off'}</option>
											<option value="30">{language === 'ko' ? '30초' : '30 seconds'}</option>
											<option value="60">{language === 'ko' ? '1분' : '1 minute'}</option>
											<option value="300">{language === 'ko' ? '5분' : '5 minutes'}</option>
											<option value="600">{language === 'ko' ? '10분' : '10 minutes'}</option>
										</select>
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
								</div>
								{conversationsLastRefreshed && (
									<div className="last-refreshed">
										{t('lastRefreshed')} {conversationsLastRefreshed.toLocaleString()}
										{backgroundLoadProgress && (
											<span style={{ marginLeft: '10px', fontSize: '0.9em', opacity: 0.8 }}>
												• {backgroundLoadProgress}
											</span>
										)}
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
																<span className="admin-label">{t('feedback')}:</span>
																<div className="admin-actions">
																	{adminFb?.feedback_verdict === 'good' ? (
																		<svg fill="#22c55e" viewBox="0 0 24 24" width="20" height="20">
																			<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
																		</svg>
																	) : adminFb?.feedback_verdict === 'bad' ? (
																		<svg fill="#ef4444" viewBox="0 0 24 24" width="20" height="20">
																			<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
																		</svg>
																	) : (
																		<>
																			<button 
																				className="thumbs-btn thumbs-up"
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
																				className="thumbs-btn thumbs-down"
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
																		</>
																	)}
																	{adminFb && (
																		<button 
																			className="btn btn-sm edit-btn"
																			title="Edit"
																			onClick={(e) => {
																				e.preventDefault()
																				e.stopPropagation()
																				const requestDetail = requestDetails[conv.requestId] || {}
																				const userMessage = requestDetail.inputText || ''
																				setExpandedFeedbackForms(prev => new Set(prev).add(conv.requestId))
																				setFeedbackFormData(prev => ({
																					...prev,
																					[conv.requestId]: { 
																						text: adminFb.feedback_text || '', 
																						preferredResponse: adminFb.corrected_response || '',
																						correctedMessage: userMessage
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
														<th>{t('feedback')}</th>
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
																	<div 
																		className="message-text-truncated" 
																		style={{ cursor: 'pointer' }}
																		onClick={() => handleMessageClick(conv.requestId)}
																	>
																		{conv.userMessage || ''}
																	</div>
																</td>
																<td className="message-cell" title={conv.aiResponse || ''}>
																	<div 
																		className="message-text-truncated"
																		style={{ cursor: 'pointer' }}
																		onClick={() => handleMessageClick(conv.requestId)}
																	>
																		{conv.aiResponse || ''}
																	</div>
																</td>
																<td>
																	<div className="admin-actions">
																		{adminFb?.feedback_verdict === 'good' ? (
																			<svg fill="#22c55e" viewBox="0 0 24 24" width="20" height="20">
																				<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
																			</svg>
																		) : adminFb?.feedback_verdict === 'bad' ? (
																			<svg fill="#ef4444" viewBox="0 0 24 24" width="20" height="20">
																				<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
																			</svg>
																		) : (
																			<>
																				<button 
																					className="thumbs-btn thumbs-up"
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
																					className="thumbs-btn thumbs-down"
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
																			</>
																		)}
																		{adminFb && (
																			<button 
																				className="btn btn-sm edit-btn"
																				title="Edit"
																				onClick={(e) => {
																					e.preventDefault()
																					e.stopPropagation()
																					handleMessageClick(conv.requestId, true)
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
								const requestDetail = requestDetails[requestId] || {}
								const userMessage = requestDetail.inputText || ''
								const formData = feedbackFormData[requestId] || { text: '', preferredResponse: '', correctedMessage: userMessage }
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
										className="btn btn-primary"
										onClick={handleAddAdminFeedback}
										title={language === 'ko' ? '수동으로 피드백 추가' : 'Add Feedback Manually'}
									>
										{language === 'ko' ? '추가' : 'Add'}
									</button>
									<div className="import-control" style={{ position: 'relative' }}>
										<input
											type="file"
											accept=".csv,.xlsx,.xls"
											ref={(el) => setImportFileInput(el)}
											onChange={handleImportFileChange}
											style={{ display: 'none' }}
										/>
										<button 
											className="btn btn-primary"
											onClick={handleImportClick}
											disabled={isImporting}
											title={language === 'ko' ? '파일에서 가져오기' : 'Import from file'}
										>
											{isImporting ? (language === 'ko' ? '가져오는 중...' : 'Importing...') : (language === 'ko' ? '가져오기' : 'Import')}
										</button>
										<button 
											className="btn btn-secondary"
											onClick={() => handleDownloadTemplate('csv')}
											title={language === 'ko' ? 'CSV 템플릿 다운로드' : 'Download CSV template'}
											style={{ marginLeft: '4px' }}
										>
											{language === 'ko' ? '템플릿' : 'Template'}
										</button>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<select
											value={adminFeedbackAutoRefresh === null ? 'off' : adminFeedbackAutoRefresh.toString()}
											onChange={(e) => {
												const value = e.target.value
												setAdminFeedbackAutoRefresh(value === 'off' ? null : parseInt(value))
											}}
											style={{
												padding: '6px 8px',
												borderRadius: '4px',
												border: '1px solid var(--border-color)',
												background: 'var(--bg-secondary)',
												color: 'var(--text-primary)',
												fontSize: '14px',
												cursor: 'pointer'
											}}
										>
											<option value="off">{language === 'ko' ? '자동 새로고침 끄기' : 'Auto-refresh Off'}</option>
											<option value="30">{language === 'ko' ? '30초' : '30 seconds'}</option>
											<option value="60">{language === 'ko' ? '1분' : '1 minute'}</option>
											<option value="300">{language === 'ko' ? '5분' : '5 minutes'}</option>
											<option value="600">{language === 'ko' ? '10분' : '10 minutes'}</option>
										</select>
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
									{!isN8NRoute && (
										<button 
											className="btn btn-primary update-prompt-btn" 
											onClick={handleUpdatePrompt}
											disabled={isUpdatingPrompt}
										>
											{isUpdatingPrompt ? (language === 'ko' ? '업데이트 중...' : 'Updating...') : (language === 'ko' ? '프롬프트 업데이트' : 'Update Prompt')}
										</button>
									)}
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
																		feedbackText: ''
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
																	<div 
																		style={{ cursor: 'pointer' }}
																		onClick={() => handleMessageClick(requestId, false)}
																	>
																		{requestDetail.inputText || '-'}
																	</div>
																</div>
																<div className="admin-feedback-card-field">
																	<strong>{t('chatId')}:</strong>
																	{requestId.startsWith('feedback-') ? (
																		<span>-</span>
																	) : (
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
																	)}
																</div>
																<div className="admin-feedback-card-field">
																	<strong>{language === 'ko' ? '원본 AI 응답:' : 'Original AI Response:'}</strong>
																	<div 
																		style={{ cursor: 'pointer' }}
																		onClick={() => handleMessageClick(requestId, false)}
																	>
																		{requestDetail.outputText || '-'}
																	</div>
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
																			{feedback.feedback_text || '-'}
																		</div>
																	)}
																</div>
																<div className="admin-feedback-card-field">
																	<strong>{language === 'ko' ? '수정된 메시지:' : 'Corrected Message:'}</strong>
																	<div>
																		{(feedback as any).corrected_message || '-'}
																	</div>
																</div>
																<div className="admin-feedback-card-field">
																	<strong>{language === 'ko' ? '수정된 응답:' : 'Corrected Response:'}</strong>
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
														<th>{t('userMessage')}</th>
														<th>{t('aiResponse')}</th>
														<th>{t('feedback')}</th>
														<th>{language === 'ko' ? '수정된 메시지' : 'Corrected Message'}</th>
														<th>{language === 'ko' ? '수정된 응답' : 'Corrected Response'}</th>
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
																{requestId.startsWith('feedback-') ? (
																	<span>-</span>
																) : (
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
																)}
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
																<div 
																	className="message-text-truncated" 
																	title={requestDetail.inputText || ''} 
																	data-full-text={requestDetail.inputText || ''}
																	style={{ cursor: 'pointer' }}
																	onClick={() => handleMessageClick(requestId, false)}
																>
																	{requestDetail.inputText || '-'}
																</div>
															</td>
															<td className="message-cell">
																<div 
																	className="message-text-truncated" 
																	title={requestDetail.outputText || ''} 
																	data-full-text={requestDetail.outputText || ''}
																	style={{ cursor: 'pointer' }}
																	onClick={() => handleMessageClick(requestId, false)}
																>
																	{requestDetail.outputText || '-'}
																</div>
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
																		title={feedback.feedback_text || '-'}
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
																		{feedback.feedback_text || '-'}
																	</div>
																)}
															</td>
															<td className="feedback-cell">
																<div 
																	className="message-text-truncated" 
																	title={(feedback as any).corrected_message || '-'}
																	data-full-text={(feedback as any).corrected_message || ''}
																>
																	{(feedback as any).corrected_message || '-'}
																</div>
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
																		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
																			<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
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
													onClick={() => setAdminFeedbackDisplayLimit(prev => prev + 20)}
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
							startDate={startDate}
							endDate={endDate}
							onDateChange={onDateChange}
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
							onMessageClick={(chatId, userMessage, aiResponse, comments, reaction) => {
								setUserFeedbackModal({
									isOpen: true,
									userMessage: userMessage,
									aiResponse: aiResponse,
									comments: comments || '',
									reaction: reaction || ''
								})
							}}
						/>
					</div>

					{/* Prompt Control Section */}
					<div className="content-section">
						<PromptControl key={promptRefreshTrigger} />
					</div>
				</div>
			</main>

			{feedbackModal.isOpen && feedbackModal.requestId && (
				<div className="modal-backdrop" onClick={closeFeedbackModal}>
					<div className="modal card feedback-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', zIndex: 9999 }}>
						<div className="modal-header">
							<h2 className="h1 modal-title">{language === 'ko' ? '관리자 피드백' : 'Admin Feedback'}</h2>
							<button className="icon-btn" onClick={closeFeedbackModal}>
								<IconX />
							</button>
						</div>
						<div className="feedback-content" style={{ padding: '20px' }}>
							{/* User Message and AI Response Display */}
							<div style={{ marginBottom: '24px' }}>
								<div style={{ marginBottom: '16px' }}>
									<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
										{t('userMessage')}:
									</label>
									<div style={{ 
										padding: '12px', 
										background: 'rgba(9, 14, 34, 0.6)', 
										border: '1px solid rgba(59, 230, 255, 0.12)', 
										borderRadius: '8px',
										color: 'var(--text)',
										whiteSpace: 'pre-wrap',
										wordWrap: 'break-word',
										maxHeight: '200px',
										overflowY: 'auto'
									}}>
										{requestDetails[feedbackModal.requestId]?.inputText || '-'}
									</div>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
										{t('aiResponse')}:
									</label>
									<div style={{ 
										padding: '12px', 
										background: 'rgba(9, 14, 34, 0.6)', 
										border: '1px solid rgba(59, 230, 255, 0.12)', 
										borderRadius: '8px',
										color: 'var(--text)',
										whiteSpace: 'pre-wrap',
										wordWrap: 'break-word',
										maxHeight: '200px',
										overflowY: 'auto'
									}}>
										{requestDetails[feedbackModal.requestId]?.outputText || '-'}
									</div>
								</div>
							</div>

							{/* Rating (Thumbs Up/Down) Selection */}
							{feedbackModal.mode !== 'view' && feedbackModal.showThumbsButtons && (
								<div style={{ marginBottom: '24px' }}>
									<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
										{t('rating')}:
									</label>
									<div style={{ display: 'flex', gap: '12px' }}>
										<button
											className={`thumbs-btn thumbs-up ${feedbackModal.type === 'positive' ? 'submitted' : ''}`}
											onClick={() => {
												const existingFeedback = adminFeedback[feedbackModal.requestId!]
												if (existingFeedback && existingFeedback.feedback_verdict === 'bad') {
													// Show confirmation if switching from negative to positive
													setConfirmationModal({
														isOpen: true,
														type: 'switchToPositive',
														requestId: feedbackModal.requestId,
														onConfirm: () => {
															setFeedbackModal(prev => ({ ...prev, type: 'positive' }))
															setConfirmationModal({ isOpen: false, type: null, requestId: null, onConfirm: null })
														}
													})
												} else {
													setFeedbackModal(prev => ({ ...prev, type: 'positive' }))
												}
											}}
											style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
											title={language === 'ko' ? '좋음' : 'Good'}
										>
											<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
												<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
											</svg>
										</button>
										<button
											className={`thumbs-btn thumbs-down ${feedbackModal.type === 'negative' ? 'submitted' : ''}`}
											onClick={() => {
												const existingFeedback = adminFeedback[feedbackModal.requestId!]
												if (existingFeedback && existingFeedback.feedback_verdict === 'good') {
													// Show confirmation if switching from positive to negative
													setConfirmationModal({
														isOpen: true,
														type: 'switchToNegative',
														requestId: feedbackModal.requestId,
														onConfirm: () => {
															setFeedbackModal(prev => ({ ...prev, type: 'negative' }))
															setConfirmationModal({ isOpen: false, type: null, requestId: null, onConfirm: null })
														}
													})
												} else {
													setFeedbackModal(prev => ({ ...prev, type: 'negative' }))
												}
											}}
											style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
											title={language === 'ko' ? '나쁨' : 'Bad'}
										>
											<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
												<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
											</svg>
										</button>
									</div>
								</div>
							)}

							{feedbackModal.mode === 'view' ? (
								<>
									<p className="feedback-prompt">
										<strong>{language === 'ko' ? '기존 피드백' : 'Existing Feedback'}</strong> ({feedbackModal.existingFeedback?.feedback_verdict === 'good' ? (language === 'ko' ? '긍정' : 'Positive') : (language === 'ko' ? '부정' : 'Negative')})
									</p>
									<div className="feedback-display">
										<div className="feedback-section">
											<div className="feedback-section-title">{t('feedback')}:</div>
											<div className="feedback-text-display">
												{feedbackModal.existingFeedback?.feedback_text}
											</div>
										</div>
										{feedbackModal.existingFeedback?.corrected_response && (
											<div className="feedback-section">
												<div className="feedback-section-title">{t('corrected')}:</div>
												<div className="feedback-text-display">
													{feedbackModal.existingFeedback.corrected_response}
												</div>
											</div>
										)}
										<div className="feedback-meta">
											{language === 'ko' ? '제출됨: ' : 'Submitted: '}{feedbackModal.existingFeedback?.created_at ? new Date(feedbackModal.existingFeedback.created_at).toLocaleString() : 'Unknown'}
										</div>
									</div>
									<button 
										className="btn edit-feedback-btn" 
										onClick={editFeedback}
									>
										{language === 'ko' ? '수정' : 'Edit'}
									</button>
								</>
							) : (
								<>
									<p className="feedback-prompt">
										{feedbackModal.mode === 'edit' ? (
											<>
												<strong>{language === 'ko' ? '피드백 수정' : 'Edit Feedback'}</strong> ({feedbackModal.existingFeedback?.feedback_verdict === 'good' ? (language === 'ko' ? '긍정' : 'Positive') : (language === 'ko' ? '부정' : 'Negative')})
											</>
										) : (
											feedbackModal.type === 'positive' 
												? (language === 'ko' ? '이 응답의 긍정적인 점을 설명해주세요' : 'Please explain what was positive about this chat response')
												: (language === 'ko' ? '이 응답의 부정적인 점을 설명해주세요' : 'Please explain what was negative about this chat response')
										)}
									</p>
									<div style={{ marginBottom: '16px' }}>
										<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
											{language === 'ko' ? '수정된 메시지' : 'Corrected Message'}:
										</label>
										<textarea
											className="feedback-textarea"
											value={feedbackFormData[feedbackModal.requestId]?.correctedMessage || requestDetails[feedbackModal.requestId]?.inputText || ''}
											onChange={(e) => setFeedbackFormData(prev => ({
												...prev,
												[feedbackModal.requestId!]: {
													...prev[feedbackModal.requestId!],
													correctedMessage: e.target.value
												}
											}))}
											placeholder={language === 'ko' ? '수정된 메시지를 입력하세요...' : 'Enter the corrected message...'}
											rows={4}
											disabled={isSubmittingFeedback}
											style={{ width: '100%', resize: 'vertical' }}
										/>
									</div>
									<div style={{ marginBottom: '16px' }}>
										<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
											{language === 'ko' ? '수정된 응답' : 'Corrected Response'}:
										</label>
										<textarea
											className="feedback-textarea"
											value={feedbackFormData[feedbackModal.requestId]?.preferredResponse || ''}
											onChange={(e) => setFeedbackFormData(prev => ({
												...prev,
												[feedbackModal.requestId!]: {
													...prev[feedbackModal.requestId!],
													preferredResponse: e.target.value
												}
											}))}
											placeholder={language === 'ko' ? '수정된 응답을 입력하세요...' : 'Enter the corrected response...'}
											rows={4}
											disabled={isSubmittingFeedback}
											style={{ width: '100%', resize: 'vertical' }}
										/>
									</div>
									<div style={{ marginBottom: '16px' }}>
										<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
											{language === 'ko' ? '관리자 피드백' : 'Supervisor Feedback'}:
										</label>
										<textarea
											className="feedback-textarea"
											value={feedbackText}
											onChange={(e) => setFeedbackText(e.target.value)}
											placeholder={language === 'ko' ? '피드백을 입력하세요...' : 'Explain what was wrong with this response...'}
											rows={4}
											disabled={isSubmittingFeedback}
											style={{ width: '100%', resize: 'vertical' }}
										/>
									</div>
									<div className="feedback-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
										<button 
											className="btn btn-ghost" 
											onClick={closeFeedbackModal}
											disabled={isSubmittingFeedback}
										>
											{language === 'ko' ? '취소' : 'Cancel'}
										</button>
										{(() => {
											const hasFeedbackText = feedbackText.trim().length > 0
											const requestId = feedbackModal.requestId?.trim() || ''
											const preferredResponse = requestId ? (feedbackFormData[requestId]?.preferredResponse || '') : ''
											const hasPreferredResponse = preferredResponse.trim().length > 0
											const isDisabled = !feedbackModal.type || isSubmittingFeedback || (!hasFeedbackText && !hasPreferredResponse)
											const tooltipText = isDisabled 
												? (!feedbackModal.type 
													? (language === 'ko' ? '평가를 선택해주세요 (좋음/나쁨)' : 'Please select a rating (Good/Bad)')
													: (!hasFeedbackText && !hasPreferredResponse
														? (language === 'ko' ? 'Supervisor Feedback 또는 Corrected Response 중 하나를 입력해주세요' : 'Please fill in either Supervisor Feedback or Corrected Response')
														: ''))
												: ''
											
											return (
												<button 
													className="btn btn-primary" 
													onClick={(e) => {
														e.preventDefault()
														e.stopPropagation()
														if (!isDisabled) {
															submitFeedback()
														}
													}}
													disabled={isDisabled}
													title={tooltipText}
													style={{ 
														cursor: isDisabled ? 'not-allowed' : 'pointer',
														opacity: isDisabled ? 0.5 : 1,
														position: 'relative'
													}}
												>
													{isSubmittingFeedback ? (language === 'ko' ? '제출 중...' : 'Submitting...') : (language === 'ko' ? '제출' : 'Submit')}
												</button>
											)
										})()}
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{userFeedbackModal.isOpen && (
				<div className="modal-backdrop" onClick={() => setUserFeedbackModal({ isOpen: false, userMessage: '', aiResponse: '', comments: '', reaction: '' })}>
					<div className="modal card feedback-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
						<div className="modal-header">
							<h2 className="h1 modal-title">{language === 'ko' ? '사용자 피드백' : 'User Feedback'}</h2>
							<button className="icon-btn" onClick={() => setUserFeedbackModal({ isOpen: false, userMessage: '', aiResponse: '', comments: '', reaction: '' })}>
								<IconX />
							</button>
						</div>
						<div className="feedback-content" style={{ padding: '20px' }}>
							{/* Rating (Thumbs Up/Down) Display */}
							{userFeedbackModal.reaction && (
								<div style={{ marginBottom: '24px' }}>
									<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
										{t('rating')}:
									</label>
									<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
										{userFeedbackModal.reaction === 'positive' || userFeedbackModal.reaction === 'good' || userFeedbackModal.reaction === 'thumbs_up' ? (
											<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
												<svg fill="#22c55e" viewBox="0 0 24 24" width="32" height="32">
													<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
												</svg>
												<span style={{ color: 'var(--text)', fontWeight: 'bold' }}>{language === 'ko' ? '좋음' : 'Good'}</span>
											</div>
										) : (
											<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
												<svg fill="#ef4444" viewBox="0 0 24 24" width="32" height="32">
													<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
												</svg>
												<span style={{ color: 'var(--text)', fontWeight: 'bold' }}>{language === 'ko' ? '나쁨' : 'Bad'}</span>
											</div>
										)}
									</div>
								</div>
							)}

							{/* Comments Display */}
							{userFeedbackModal.comments && (
								<div style={{ marginBottom: '24px' }}>
									<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
										{t('comments')}:
									</label>
									<div style={{ 
										padding: '12px', 
										background: 'rgba(9, 14, 34, 0.6)', 
										border: '1px solid rgba(59, 230, 255, 0.12)', 
										borderRadius: '8px',
										color: 'var(--text)',
										whiteSpace: 'pre-wrap',
										wordWrap: 'break-word',
										maxHeight: '200px',
										overflowY: 'auto'
									}}>
										{userFeedbackModal.comments}
									</div>
								</div>
							)}

							{/* User Message and AI Response Display */}
							<div style={{ marginBottom: '24px' }}>
								<div style={{ marginBottom: '16px' }}>
									<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
										{t('userMessage')}:
									</label>
									<div style={{ 
										padding: '12px', 
										background: 'rgba(9, 14, 34, 0.6)', 
										border: '1px solid rgba(59, 230, 255, 0.12)', 
										borderRadius: '8px',
										color: 'var(--text)',
										whiteSpace: 'pre-wrap',
										wordWrap: 'break-word',
										maxHeight: '200px',
										overflowY: 'auto'
									}}>
										{userFeedbackModal.userMessage || '-'}
									</div>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
										{t('aiResponse')}:
									</label>
									<div style={{ 
										padding: '12px', 
										background: 'rgba(9, 14, 34, 0.6)', 
										border: '1px solid rgba(59, 230, 255, 0.12)', 
										borderRadius: '8px',
										color: 'var(--text)',
										whiteSpace: 'pre-wrap',
										wordWrap: 'break-word',
										maxHeight: '200px',
										overflowY: 'auto'
									}}>
										{userFeedbackModal.aiResponse || '-'}
									</div>
								</div>
							</div>
							<div className="feedback-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
								<button 
									className="btn btn-primary" 
									onClick={() => setUserFeedbackModal({ isOpen: false, userMessage: '', aiResponse: '', comments: '', reaction: '' })}
								>
									{language === 'ko' ? '닫기' : 'Close'}
								</button>
							</div>
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
						<div className="confirmation-content" style={{ padding: '24px', marginBottom: '32px' }}>
							<p style={{ marginBottom: '16px' }}>Are you certain you want to delete this admin feedback? This action cannot be undone.</p>
							{deleteAdminFeedbackModal.feedbackText && (
								<div className="feedback-preview">
									<strong>Feedback to be deleted:</strong>
									<div className="feedback-text-preview">
										{deleteAdminFeedbackModal.feedbackText}
									</div>
								</div>
							)}
						</div>
						<div className="feedback-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '0 24px 24px 24px' }}>
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
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									if (deleteAdminFeedbackModal.requestId) {
										handleDeleteAdminFeedback(deleteAdminFeedbackModal.requestId)
									}
								}}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{addAdminFeedbackModal.isOpen && (
				<div className="modal-backdrop" onClick={handleCancelManualFeedback}>
					<div className="modal card feedback-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', zIndex: 9999 }}>
						<div className="modal-header">
							<h2 className="h1 modal-title">{language === 'ko' ? '피드백 추가' : 'Add Feedback'}</h2>
							<button className="icon-btn" onClick={handleCancelManualFeedback}>
								<IconX />
							</button>
						</div>
						<div className="feedback-content" style={{ padding: '20px' }}>
							<div style={{ marginBottom: '16px' }}>
								<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
									{language === 'ko' ? '피드백 평가' : 'Feedback Verdict'}:
								</label>
								<div style={{ display: 'flex', gap: '12px' }}>
									<button
										className={`thumbs-btn thumbs-up ${manualFeedbackData.verdict === 'good' ? 'submitted' : ''}`}
										onClick={() => setManualFeedbackData(prev => ({ ...prev, verdict: 'good' }))}
										style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
										title={language === 'ko' ? '좋음' : 'Good'}
									>
										<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
											<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
										</svg>
									</button>
									<button
										className={`thumbs-btn thumbs-down ${manualFeedbackData.verdict === 'bad' ? 'submitted' : ''}`}
										onClick={() => setManualFeedbackData(prev => ({ ...prev, verdict: 'bad' }))}
										style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
										title={language === 'ko' ? '나쁨' : 'Bad'}
									>
										<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
											<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
										</svg>
									</button>
								</div>
							</div>
							<div style={{ marginBottom: '16px' }}>
								<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
									{language === 'ko' ? '수정된 메시지' : 'Corrected Message'}:
								</label>
								<textarea
									className="feedback-textarea"
									value={manualFeedbackData.correctedMessage}
									onChange={(e) => setManualFeedbackData(prev => ({ ...prev, correctedMessage: e.target.value }))}
									placeholder={language === 'ko' ? '수정된 메시지를 입력하세요...' : 'Enter the corrected message...'}
									rows={4}
									style={{ width: '100%', resize: 'vertical' }}
								/>
							</div>
							<div style={{ marginBottom: '16px' }}>
								<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
									{language === 'ko' ? '수정된 응답' : 'Corrected Response'}:
								</label>
								<textarea
									className="feedback-textarea"
									value={manualFeedbackData.correctedResponse}
									onChange={(e) => setManualFeedbackData(prev => ({ ...prev, correctedResponse: e.target.value }))}
									placeholder={language === 'ko' ? '수정된 응답을 입력하세요...' : 'Enter the corrected response...'}
									rows={4}
									style={{ width: '100%', resize: 'vertical' }}
								/>
							</div>
							<div style={{ marginBottom: '16px' }}>
								<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text)' }}>
									{language === 'ko' ? '관리자 피드백' : 'Supervisor Feedback'}:
								</label>
								<textarea
									className="feedback-textarea"
									value={manualFeedbackData.feedbackText}
									onChange={(e) => setManualFeedbackData(prev => ({ ...prev, feedbackText: e.target.value }))}
									placeholder={language === 'ko' ? '피드백을 입력하세요...' : 'Explain what was wrong with this response...'}
									rows={4}
									style={{ width: '100%', resize: 'vertical' }}
								/>
							</div>
							<div className="feedback-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
								<button className="btn btn-ghost" onClick={handleCancelManualFeedback}>
									{language === 'ko' ? '취소' : 'Cancel'}
								</button>
								{(() => {
									const hasFeedbackText = manualFeedbackData.feedbackText.trim().length > 0
									const hasCorrectedResponse = manualFeedbackData.correctedResponse.trim().length > 0
									const isDisabled = !manualFeedbackData.verdict || (!hasFeedbackText && !hasCorrectedResponse)
									const tooltipText = isDisabled 
										? (!manualFeedbackData.verdict 
											? (language === 'ko' ? '평가를 선택해주세요 (좋음/나쁨)' : 'Please select a rating (Good/Bad)')
											: (!hasFeedbackText && !hasCorrectedResponse
												? (language === 'ko' ? 'Supervisor Feedback 또는 Corrected Response 중 하나를 입력해주세요' : 'Please fill in either Supervisor Feedback or Corrected Response')
												: ''))
										: ''
									
									return (
										<button 
											className="btn btn-primary" 
											onClick={handleSaveManualFeedback}
											disabled={isDisabled}
											title={tooltipText}
											style={{ 
												cursor: isDisabled ? 'not-allowed' : 'pointer',
												opacity: isDisabled ? 0.5 : 1
											}}
										>
											{language === 'ko' ? '저장' : 'Save'}
										</button>
									)
								})()}
							</div>
						</div>
					</div>
				</div>
			)}
			{showUpdatePromptModal && (
				<div className="modal-backdrop" role="dialog" aria-modal="true">
					<div className="confirmation-modal card">
						<div className="confirmation-content">
							<p>
								{language === 'ko' 
									? '프롬프트를 업데이트하시겠습니까? 이 작업은 모든 적용된 피드백을 프롬프트에 반영합니다.' 
									: 'Are you sure you want to update the prompt? This will apply all feedback marked for prompt update.'}
							</p>
						</div>
						<button 
							className="btn btn-ghost confirmation-no-btn" 
							onClick={handleCancelUpdatePrompt}
						>
							{language === 'ko' ? '취소' : 'Cancel'}
						</button>
						<button 
							className="btn btn-primary confirmation-yes-btn" 
							onClick={handleConfirmUpdatePrompt}
							disabled={isUpdatingPrompt}
						>
							{language === 'ko' ? '업데이트' : 'Update'}
						</button>
					</div>
				</div>
			)}

		</div>
	)
}
