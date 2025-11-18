import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchUserFeedback } from '../services/userFeedback'
import { UserFeedbackData } from '../services/supabase'
import { fetchUserFeedbackN8N, deleteUserFeedbackN8N, UserFeedbackDataN8N } from '../services/userFeedbackN8N'
import { getChatData } from '../services/chatData'
import { fetchRequestDetailN8N } from '../services/conversationsN8N'
import { useLanguage } from '../contexts/LanguageContext'
import * as XLSX from 'xlsx'

type UserFeedback = UserFeedbackData | UserFeedbackDataN8N

interface UserFeedbackProps {
	onChatIdClick?: (chatId: string) => void
	onUserIdClick?: (userId: string) => void
	onSessionIdClick?: (sessionId: string) => void
	onMessageClick?: (chatId: string, userMessage: string, aiResponse: string, comments: string, reaction: string) => void
	startDate?: string
	endDate?: string
	onDateChange?: (startDate: string, endDate: string) => void
}

function formatUserId(userId: string): string {
	if (!userId) return ''
	if (userId.length <= 6) {
		return userId
	}
	return userId.slice(-6)
}

function formatUserIdNarrow(userId: string): string {
	if (!userId) return ''
	if (userId.length <= 4) {
		return userId
	}
	return userId.slice(-4)
}

function formatChatId(chatId: string): string {
	if (!chatId) return ''
	if (chatId.length <= 4) {
		return chatId
	}
	return chatId.slice(-4)
}

function formatChatIdNarrow(chatId: string): string {
	if (!chatId) return ''
	if (chatId.length <= 3) {
		return chatId
	}
	return chatId.slice(-3)
}

function formatDateNarrow(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const year = String(date.getFullYear())
	return `${month}/${day}/${year}...`
}

export default function UserFeedback({ onChatIdClick, onUserIdClick, onSessionIdClick, onMessageClick, startDate, endDate, onDateChange }: UserFeedbackProps = {}) {
	const location = useLocation()
	const isN8NRoute = location.pathname === '/dashboard-n8n'
	const { language, t } = useLanguage()
	
	const [userFeedbacks, setUserFeedbacks] = useState<UserFeedback[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [chatDataMap, setChatDataMap] = useState<Record<string, { inputText: string, outputText: string }>>({})
	const chatDataMapRef = useRef<Record<string, { inputText: string, outputText: string }>>({})
	const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'positive' | 'negative'>('all')
	const [userFeedbackViewMode, setUserFeedbackViewMode] = useState<'grid' | 'table'>('table')
	const [userFeedbackSortBy, setUserFeedbackSortBy] = useState<'date' | 'userId' | 'chatId'>('date')
	const [userFeedbackSearch, setUserFeedbackSearch] = useState('')
	const [userFeedbackFontSize, setUserFeedbackFontSize] = useState<'small' | 'medium' | 'large'>('medium')
	const [userFeedbackDisplayLimit, setUserFeedbackDisplayLimit] = useState(10)
	const [userFeedbackLastRefreshed, setUserFeedbackLastRefreshed] = useState<Date | null>(null)
	const [isRefreshingUserFeedback, setIsRefreshingUserFeedback] = useState(false)
	const [userFeedbackAutoRefresh, setUserFeedbackAutoRefresh] = useState<number | null>(30) // 30 seconds default, null = off
	const [userFeedbackExportFormat, setUserFeedbackExportFormat] = useState<'csv' | 'excel' | 'json'>('csv')
	const [isExportingUserFeedback, setIsExportingUserFeedback] = useState(false)

	useEffect(() => {
		loadUserFeedback()
	}, [isN8NRoute, startDate, endDate])

	const loadUserFeedback = async (bypassCache = false) => {
		setIsLoading(true)
		setError(null)
		
		try {
			if (isN8NRoute) {
				const data = await fetchUserFeedbackN8N(startDate, endDate)
				setUserFeedbacks(data)
				
				// For N8N route: Load chat data for entries missing chat_message/chat_response
				const chatDataMap: Record<string, { inputText: string, outputText: string }> = {}
				const chatIdsToFetch = data
					.filter(fb => !fb.chat_message || !fb.chat_response)
					.map(fb => {
						// Try to get chat_id from raw_data.reply_to_id first, then chat_id, then request_id
						const replyToId = fb.raw_data?.reply_to_id
						return replyToId || fb.chat_id || fb.request_id || ''
					})
					.filter(id => id)
				
				// Load chat data in batches
				for (let i = 0; i < chatIdsToFetch.length; i += 10) {
					const batch = chatIdsToFetch.slice(i, i + 10)
					await Promise.all(batch.map(async (chatId) => {
						try {
							const detail = await fetchRequestDetailN8N(chatId)
							if (detail && detail.request) {
								// fetchRequestDetailN8N returns inputText and outputText
								const inputText = detail.request.inputText || ''
								const outputText = detail.request.outputText || ''
								
								// Store with the chatId used for fetching
								chatDataMap[chatId] = {
									inputText,
									outputText
								}
								
								// Also store with all possible keys from the feedback entry to ensure lookup works
								const feedback = data.find(fb => {
									const replyToId = fb.raw_data?.reply_to_id
									return replyToId === chatId || fb.chat_id === chatId || fb.request_id === chatId
								})
								if (feedback) {
									// Store with reply_to_id if it exists
									if (feedback.raw_data?.reply_to_id && feedback.raw_data.reply_to_id !== chatId) {
										chatDataMap[feedback.raw_data.reply_to_id] = { inputText, outputText }
									}
									// Store with chat_id if it exists and is different
									if (feedback.chat_id && feedback.chat_id !== chatId) {
										chatDataMap[feedback.chat_id] = { inputText, outputText }
									}
									// Store with request_id if it exists and is different
									if (feedback.request_id && feedback.request_id !== chatId) {
										chatDataMap[feedback.request_id] = { inputText, outputText }
									}
								}
							}
						} catch (error) {
							console.warn(`Could not fetch chat detail for ${chatId}:`, error)
						}
					}))
				}
				
				if (Object.keys(chatDataMap).length > 0) {
					setChatDataMap(prev => ({ ...prev, ...chatDataMap }))
				}
			} else {
				const data = await fetchUserFeedback(startDate, endDate)
				setUserFeedbacks(data)
				
				// For tecace route: Load chat_data for entries missing chat_message/chat_response
				const chatDataMap: Record<string, { inputText: string, outputText: string }> = {}
				const requestIdsToFetch = data
					.filter(fb => !fb.chat_message || !fb.chat_response)
					.map(fb => fb.request_id || fb.chat_id || '')
					.filter(id => id)
				
				// Load chat data in batches
				for (let i = 0; i < requestIdsToFetch.length; i += 10) {
					const batch = requestIdsToFetch.slice(i, i + 10)
					await Promise.all(batch.map(async (requestId) => {
						try {
							const chatData = await getChatData(requestId)
							if (chatData) {
								chatDataMap[requestId] = {
									inputText: chatData.input_text || '',
									outputText: chatData.output_text || ''
								}
							}
						} catch (error) {
							console.warn(`Could not fetch chat data for ${requestId}:`, error)
						}
					}))
				}
				
				if (Object.keys(chatDataMap).length > 0) {
					setChatDataMap(prev => ({ ...prev, ...chatDataMap }))
				}
			}
			setUserFeedbackLastRefreshed(new Date())
		} catch (error) {
			console.error('Failed to load user feedback:', error)
			setError('Failed to load user feedback')
		} finally {
			setIsLoading(false)
		}
	}

	const refreshUserFeedback = useCallback(async () => {
		setIsRefreshingUserFeedback(true)
		await loadUserFeedback(true)
		setIsRefreshingUserFeedback(false)
	}, [startDate, endDate, isN8NRoute])

	// Load missing chat data for user feedback entries on-demand (similar to Admin Feedback)
	useEffect(() => {
		if (userFeedbacks.length === 0) return
		
		let cancelled = false
		
		async function loadMissingChatData() {
			// Find feedback entries that are missing chat_message/chat_response
			const missingEntries = userFeedbacks.filter(fb => {
				const hasMessage = fb.chat_message && fb.chat_message.trim() !== '' && fb.chat_message !== '-'
				const hasResponse = fb.chat_response && fb.chat_response.trim() !== '' && fb.chat_response !== '-'
				if (hasMessage && hasResponse) return false
				
				// Check if we already have it in chatDataMap (use ref to avoid dependency issues)
				const replyToId = fb.raw_data?.reply_to_id
				const requestId = replyToId || fb.chat_id || fb.request_id || ''
				const chatData = chatDataMapRef.current[requestId]
				return !chatData || !chatData.inputText || !chatData.outputText
			})
			
			if (missingEntries.length === 0) return
			
			const newChatDataMap: Record<string, { inputText: string, outputText: string }> = {}
			
			// Load in batches
			for (let i = 0; i < missingEntries.length; i += 10) {
				if (cancelled) break
				const batch = missingEntries.slice(i, i + 10)
				
				await Promise.all(batch.map(async (feedback) => {
					try {
						const replyToId = feedback.raw_data?.reply_to_id
						const chatId = replyToId || feedback.chat_id || feedback.request_id || ''
						if (!chatId) return
						
						if (isN8NRoute) {
							const detail = await fetchRequestDetailN8N(chatId)
							if (detail && detail.request) {
								const inputText = detail.request.inputText || ''
								const outputText = detail.request.outputText || ''
								
								// Store with all possible keys
								newChatDataMap[chatId] = { inputText, outputText }
								if (replyToId && replyToId !== chatId) {
									newChatDataMap[replyToId] = { inputText, outputText }
								}
								if (feedback.chat_id && feedback.chat_id !== chatId) {
									newChatDataMap[feedback.chat_id] = { inputText, outputText }
								}
								if (feedback.request_id && feedback.request_id !== chatId) {
									newChatDataMap[feedback.request_id] = { inputText, outputText }
								}
							}
						} else {
							const chatData = await getChatData(chatId)
							if (chatData) {
								const inputText = chatData.input_text || ''
								const outputText = chatData.output_text || ''
								
								// Store with all possible keys
								newChatDataMap[chatId] = { inputText, outputText }
								if (feedback.chat_id && feedback.chat_id !== chatId) {
									newChatDataMap[feedback.chat_id] = { inputText, outputText }
								}
								if (feedback.request_id && feedback.request_id !== chatId) {
									newChatDataMap[feedback.request_id] = { inputText, outputText }
								}
							}
						}
					} catch (error) {
						console.warn(`Could not fetch chat data for user feedback:`, error)
					}
				}))
			}
			
			if (!cancelled && Object.keys(newChatDataMap).length > 0) {
				setChatDataMap(prev => ({ ...prev, ...newChatDataMap }))
			}
		}
		
		// Small delay to let initial load complete
		const timeoutId = setTimeout(() => {
			loadMissingChatData()
		}, 500)
		
		return () => {
			cancelled = true
			clearTimeout(timeoutId)
		}
	}, [userFeedbacks, isN8NRoute])

	// Keep chatDataMapRef in sync with chatDataMap
	useEffect(() => {
		chatDataMapRef.current = chatDataMap
	}, [chatDataMap])

	// Auto-refresh User Feedback based on selected interval
	useEffect(() => {
		if (userFeedbackAutoRefresh === null) return // Auto-refresh disabled
		
		const intervalId = setInterval(() => {
			if (!isLoading && !isRefreshingUserFeedback) {
				refreshUserFeedback()
			}
		}, userFeedbackAutoRefresh * 1000) // Convert seconds to milliseconds

		return () => {
			clearInterval(intervalId)
		}
	}, [refreshUserFeedback, isLoading, isRefreshingUserFeedback, userFeedbackAutoRefresh])

	const isPositiveFeedback = (reaction: string | null | undefined): boolean => {
		if (!reaction) return false
		const normalizedReaction = reaction.toLowerCase().trim()
		return normalizedReaction.includes('thumbs_up') || normalizedReaction.includes('like') || normalizedReaction === 'positive'
	}
	
	const hasReaction = (reaction: string | null | undefined): boolean => {
		if (!reaction) return false
		const normalizedReaction = reaction.toLowerCase().trim()
		return normalizedReaction.includes('thumbs_up') || normalizedReaction.includes('thumbs_down') || 
		       normalizedReaction.includes('like') || normalizedReaction.includes('dislike') || 
		       normalizedReaction === 'positive' || normalizedReaction === 'negative'
	}

	const filteredAndSortedUserFeedback = useMemo(() => {
		let filtered = userFeedbacks

		// Filter by type (all/positive/negative)
		if (feedbackFilter === 'positive') {
			filtered = filtered.filter(fb => isPositiveFeedback(fb.reaction || ''))
		} else if (feedbackFilter === 'negative') {
			filtered = filtered.filter(fb => !isPositiveFeedback(fb.reaction || ''))
		}

		// Filter by search
		if (userFeedbackSearch.trim()) {
			const searchLower = userFeedbackSearch.toLowerCase()
			filtered = filtered.filter(fb => {
				const userId = (fb.user_id || '').toLowerCase()
				const chatId = ((fb.chat_id || fb.request_id || '')).toLowerCase()
				const feedbackText = (fb.feedback_text || '').toLowerCase()
				const chatMessage = (fb.chat_message || '').toLowerCase()
				const chatResponse = (fb.chat_response || '').toLowerCase()
				const userName = (fb.user_name || '').toLowerCase()
				
				return userId.includes(searchLower) ||
					chatId.includes(searchLower) ||
					feedbackText.includes(searchLower) ||
					chatMessage.includes(searchLower) ||
					chatResponse.includes(searchLower) ||
					userName.includes(searchLower)
			})
		}

		// Sort
		filtered = [...filtered].sort((a, b) => {
			if (userFeedbackSortBy === 'date') {
				const dateA = new Date(a.created_at || a.timestamp || 0).getTime()
				const dateB = new Date(b.created_at || b.timestamp || 0).getTime()
				return dateB - dateA // Most recent first
			} else if (userFeedbackSortBy === 'userId') {
				const userIdA = (a.user_id || '').toLowerCase()
				const userIdB = (b.user_id || '').toLowerCase()
				return userIdA.localeCompare(userIdB)
			} else if (userFeedbackSortBy === 'chatId') {
				const chatIdA = ((a.chat_id || a.request_id || '')).toLowerCase()
				const chatIdB = ((b.chat_id || b.request_id || '')).toLowerCase()
				return chatIdA.localeCompare(chatIdB)
			}
			return 0
		})

		return filtered
	}, [userFeedbacks, feedbackFilter, userFeedbackSearch, userFeedbackSortBy])

	const positiveCount = useMemo(() => {
		return userFeedbacks.filter(fb => isPositiveFeedback(fb.reaction || '')).length
	}, [userFeedbacks])

	const negativeCount = useMemo(() => {
		return userFeedbacks.filter(fb => !isPositiveFeedback(fb.reaction || '')).length
	}, [userFeedbacks])

	// Check if any feedback has a userId (to conditionally show/hide User ID column)
	const hasAnyUserId = useMemo(() => {
		return userFeedbacks.some(fb => fb.user_id && fb.user_id.trim() !== '')
	}, [userFeedbacks])

	const handleUserFeedbackExport = async () => {
		setIsExportingUserFeedback(true)
		try {
			const data = filteredAndSortedUserFeedback.map(fb => ({
				Date: fb.created_at || fb.timestamp || '',
				'User ID': fb.user_id || '',
				'Chat ID': fb.chat_id || fb.request_id || '',
				Reaction: fb.reaction || '',
				Comments: fb.feedback_text || '',
				'User Message': fb.chat_message || '',
				'AI Response': fb.chat_response || '',
				'User Name': fb.user_name || ''
			}))

			if (userFeedbackExportFormat === 'csv') {
				const csv = [
					Object.keys(data[0] || {}).join(','),
					...data.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
				].join('\n')
				const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
				const link = document.createElement('a')
				link.href = URL.createObjectURL(blob)
				link.download = `user-feedback-${new Date().toISOString().split('T')[0]}.csv`
				link.click()
			} else if (userFeedbackExportFormat === 'excel') {
				const ws = XLSX.utils.json_to_sheet(data)
				const wb = XLSX.utils.book_new()
				XLSX.utils.book_append_sheet(wb, ws, 'User Feedback')
				XLSX.writeFile(wb, `user-feedback-${new Date().toISOString().split('T')[0]}.xlsx`)
			} else if (userFeedbackExportFormat === 'json') {
				const json = JSON.stringify(data, null, 2)
				const blob = new Blob([json], { type: 'application/json' })
				const link = document.createElement('a')
				link.href = URL.createObjectURL(blob)
				link.download = `user-feedback-${new Date().toISOString().split('T')[0]}.json`
				link.click()
			}
		} catch (error) {
			console.error('Export failed:', error)
			alert(language === 'ko' ? '내보내기 실패' : 'Export failed')
		} finally {
			setIsExportingUserFeedback(false)
		}
	}

	const [deleteUserFeedbackModal, setDeleteUserFeedbackModal] = useState<{
		isOpen: boolean
		feedbackId: string | number | null
	}>({
		isOpen: false,
		feedbackId: null
	})

	const handleDeleteUserFeedbackClick = (feedbackId: string | number) => {
		setDeleteUserFeedbackModal({
			isOpen: true,
			feedbackId: feedbackId
		})
	}

	const handleDeleteUserFeedback = async () => {
		if (!deleteUserFeedbackModal.feedbackId) return
		
		try {
			if (isN8NRoute) {
				await deleteUserFeedbackN8N(deleteUserFeedbackModal.feedbackId)
			} else {
				// TODO: Implement delete for standard route if needed
				console.warn('Delete user feedback not implemented for standard route')
			}
			
			// Update local state - remove deleted feedback
			setUserFeedbacks(prev => prev.filter(fb => {
				const fbId = (fb as UserFeedbackDataN8N).id || (fb as UserFeedbackData).id
				// Compare as numbers to handle string/number mismatch
				const modalId = typeof deleteUserFeedbackModal.feedbackId === 'string' 
					? parseInt(deleteUserFeedbackModal.feedbackId) 
					: deleteUserFeedbackModal.feedbackId
				return fbId !== modalId
			}))
			
			// Reload user feedback to ensure data is fresh
			await loadUserFeedback(true)
			
			// Close modal after deletion
			setDeleteUserFeedbackModal({ isOpen: false, feedbackId: null })
		} catch (error) {
			console.error('Failed to delete user feedback:', error)
			alert(language === 'ko' ? '피드백 삭제 실패' : 'Failed to delete feedback')
		}
	}

	const handleCancelDeleteUserFeedback = () => {
		setDeleteUserFeedbackModal({ isOpen: false, feedbackId: null })
	}

	return (
		<div className="card section" aria-labelledby="user-feedback-title">
			<div className="section-header">
				<div id="user-feedback-title" className="section-title">
					{t('userFeedback')} ({filteredAndSortedUserFeedback.length} {t('feedbackItems')})
				</div>
				{startDate && endDate && onDateChange && (
					<div className="date-controls">
						<label className="date-field">
							<span>Start Date</span>
							<input type="date" className="input date-input" value={startDate} onChange={(e)=>onDateChange(e.target.value, endDate || '')} />
						</label>
						<label className="date-field">
							<span>End Date</span>
							<input type="date" className="input date-input" value={endDate} onChange={(e)=>onDateChange(startDate || '', e.target.value)} />
						</label>
					</div>
				)}
				<div className="conversations-controls">
					<div className="sort-control">
						<label>{t('sort')}</label>
						<select 
							className="input select-input"
							value={userFeedbackSortBy}
							onChange={(e) => setUserFeedbackSortBy(e.target.value as 'date' | 'userId' | 'chatId')}
						>
							<option value="date">{t('dateTimeNewest')}</option>
							<option value="userId">{t('userId')}</option>
							<option value="chatId">{t('chatId')}</option>
						</select>
					</div>
					<div className="search-control">
						<label>{t('search')}</label>
						<div className="search-input-wrapper">
							<input
								type="text"
								className="input"
								placeholder={t('searchFeedback')}
								value={userFeedbackSearch}
								onChange={(e) => setUserFeedbackSearch(e.target.value)}
							/>
							{userFeedbackSearch && (
								<button
									className="search-clear-btn"
									onClick={() => setUserFeedbackSearch('')}
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
							className={`view-btn ${userFeedbackViewMode === 'grid' ? 'active' : ''}`}
							onClick={() => setUserFeedbackViewMode('grid')}
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
							className={`view-btn ${userFeedbackViewMode === 'table' ? 'active' : ''}`}
							onClick={() => setUserFeedbackViewMode('table')}
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
								className={`font-size-btn ${userFeedbackFontSize === 'small' ? 'active' : ''}`}
								onClick={() => setUserFeedbackFontSize('small')}
							>
								A
							</button>
							<button 
								className={`font-size-btn ${userFeedbackFontSize === 'medium' ? 'active' : ''}`}
								onClick={() => setUserFeedbackFontSize('medium')}
							>
								A
							</button>
							<button 
								className={`font-size-btn ${userFeedbackFontSize === 'large' ? 'active' : ''}`}
								onClick={() => setUserFeedbackFontSize('large')}
							>
								A
							</button>
						</div>
					</div>
					<div className="export-control">
						<select 
							value={userFeedbackExportFormat} 
							onChange={(e) => setUserFeedbackExportFormat(e.target.value as any)}
							className="input select-input"
						>
							<option value="csv">CSV</option>
							<option value="excel">Excel</option>
							<option value="json">JSON</option>
						</select>
						<button 
							className="btn btn-primary"
							onClick={handleUserFeedbackExport}
							disabled={isExportingUserFeedback || filteredAndSortedUserFeedback.length === 0}
						>
							{isExportingUserFeedback ? (language === 'ko' ? '내보내는 중...' : 'Exporting...') : t('export')}
						</button>
					</div>
					<div className="refresh-control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<select
							value={userFeedbackAutoRefresh === null ? 'off' : userFeedbackAutoRefresh.toString()}
							onChange={(e) => {
								const value = e.target.value
								setUserFeedbackAutoRefresh(value === 'off' ? null : parseInt(value))
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
							onClick={refreshUserFeedback}
							disabled={isRefreshingUserFeedback}
							title={language === 'ko' ? '새로고침' : 'Refresh'}
						>
							<svg 
								viewBox="0 0 24 24" 
								fill="none" 
								stroke="currentColor" 
								strokeWidth="2"
								className={isRefreshingUserFeedback ? 'spinning' : ''}
							>
								<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
								<path d="M21 3v5h-5"/>
								<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
								<path d="M3 21v-5h5"/>
							</svg>
							<span className="refresh-btn-text">{language === 'ko' ? '새로고침' : 'Refresh'}</span>
						</button>
					</div>
				</div>
				{userFeedbackLastRefreshed && (
					<div className="last-refreshed">
						{t('lastRefreshed')} {userFeedbackLastRefreshed.toLocaleString()}
					</div>
				)}
				<div className="user-feedback-filters">
					<button
						className={`feedback-filter-btn ${feedbackFilter === 'all' ? 'active' : ''}`}
						onClick={() => setFeedbackFilter('all')}
					>
						{t('total')} ({userFeedbacks.length})
					</button>
					<button
						className={`feedback-filter-btn ${feedbackFilter === 'positive' ? 'active' : ''}`}
						onClick={() => setFeedbackFilter('positive')}
					>
						{t('good')} ({positiveCount})
					</button>
					<button
						className={`feedback-filter-btn ${feedbackFilter === 'negative' ? 'active' : ''}`}
						onClick={() => setFeedbackFilter('negative')}
					>
						{t('bad')} ({negativeCount})
					</button>
				</div>
			</div>
			<div className={`user-feedback-table-container font-size-${userFeedbackFontSize}`}>
				{isLoading ? (
					<p className="muted">{language === 'ko' ? '사용자 피드백 로딩 중...' : 'Loading user feedback...'}</p>
				) : error ? (
					<p className="muted">{error}</p>
				) : filteredAndSortedUserFeedback.length === 0 ? (
					<p className="muted">
						{userFeedbacks.length === 0 
							? (language === 'ko' ? '피드백이 없습니다.' : 'No user feedback found.') 
							: (language === 'ko' ? '필터 조건에 맞는 피드백이 없습니다.' : 'No feedback matches your filter criteria.')
						}
					</p>
				) : (
					<>
						{userFeedbackViewMode === 'grid' ? (
							<div className="user-feedback-grid">
								{filteredAndSortedUserFeedback.slice(0, userFeedbackDisplayLimit).map((feedback) => {
									const feedbackId = feedback.id || feedback.request_id || `feedback-${Math.random()}`
									const date = feedback.created_at || feedback.timestamp ? new Date(feedback.created_at || feedback.timestamp || '') : null
									const userId = feedback.user_id || ''
									const chatId = feedback.chat_id || feedback.request_id || ''
									const reaction = feedback.reaction || ''
									const feedbackText = feedback.feedback_text || ''
									// For both routes: Use chat_data/chat table if chat_message/chat_response is missing
									const replyToId = feedback.raw_data?.reply_to_id
									const requestId = replyToId || feedback.chat_id || feedback.request_id || ''
									const chatData = chatDataMap[requestId]
									const chatMessage = feedback.chat_message || chatData?.inputText || ''
									const chatResponse = feedback.chat_response || chatData?.outputText || ''
									
									return (
										<div key={feedbackId} className="user-feedback-card">
											<div className="user-feedback-card-header">
												<div className="user-feedback-card-rating">
													{hasReaction(reaction) ? (
														isPositiveFeedback(reaction) ? (
															<svg fill="#22c55e" viewBox="0 0 24 24" width="24" height="24">
																<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
															</svg>
														) : (
															<svg fill="#ef4444" viewBox="0 0 24 24" width="24" height="24">
																<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
															</svg>
														)
													) : null}
													<span>{feedback.user_name || 'Unknown User'}</span>
												</div>
												<div className="user-feedback-card-actions">
													{date && <span className="user-feedback-card-date">{date.toLocaleString()}</span>}
													<button
														className="user-feedback-delete-btn"
														onClick={(e) => {
															e.preventDefault()
															e.stopPropagation()
															handleDeleteUserFeedbackClick(feedbackId)
														}}
														title={t('delete')}
													>
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
															<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
														</svg>
													</button>
												</div>
											</div>
											<div className="user-feedback-card-body">
												{hasAnyUserId && userId && (
													<div className="user-feedback-card-field">
														<strong>{t('userId')}:</strong>
														<button
															className="user-id-link"
															onClick={() => {
																if (onUserIdClick) {
																	onUserIdClick(userId)
																}
																setUserFeedbackSearch(userId)
															}}
															title={userId}
														>
															{formatUserId(userId)}
														</button>
													</div>
												)}
												{chatId && (
													<div className="user-feedback-card-field">
														<strong>{t('chatId')}:</strong>
														<button
															className="chat-id-link"
															onClick={() => {
																if (onChatIdClick) {
																	onChatIdClick(chatId)
																}
																setUserFeedbackSearch(chatId)
															}}
															title={chatId}
														>
															{chatId}
														</button>
													</div>
												)}
												{feedbackText && (
													<div className="user-feedback-card-field">
														<strong>{t('comments')}:</strong>
														<div 
															style={{ cursor: 'pointer' }}
															onClick={() => {
																if (onMessageClick) {
																	onMessageClick(chatId, chatMessage, chatResponse, feedbackText, reaction)
																}
															}}
														>
															{feedbackText}
														</div>
													</div>
												)}
												{chatMessage && (
													<div className="user-feedback-card-field">
														<strong>{t('userMessage')}:</strong>
														<div 
															style={{ cursor: 'pointer' }}
															onClick={() => {
																if (onMessageClick) {
																	onMessageClick(chatId, chatMessage, chatResponse, feedbackText, reaction)
																}
															}}
														>
															{chatMessage}
														</div>
													</div>
												)}
												{chatResponse && (
													<div className="user-feedback-card-field">
														<strong>{t('aiResponse')}:</strong>
														<div 
															style={{ cursor: 'pointer' }}
															onClick={() => {
																if (onMessageClick) {
																	onMessageClick(chatId, chatMessage, chatResponse, feedbackText, reaction)
																}
															}}
														>
															{chatResponse}
														</div>
													</div>
												)}
											</div>
										</div>
									)
								})}
							</div>
						) : (
							<table className={`user-feedback-table ${hasAnyUserId ? 'has-user-id' : 'no-user-id'}`}>
								<thead>
									<tr>
										<th>{t('date')}</th>
										{hasAnyUserId && <th>{t('userId')}</th>}
										<th>{t('chatId')}</th>
										<th>{t('rating')}</th>
										<th>{t('comments')}</th>
										<th>{t('userMessage')}</th>
										<th>{t('aiResponse')}</th>
										<th>{t('delete')}</th>
									</tr>
								</thead>
								<tbody>
									{filteredAndSortedUserFeedback.slice(0, userFeedbackDisplayLimit).map((feedback) => {
										const feedbackId = feedback.id || feedback.request_id || `feedback-${Math.random()}`
										const date = feedback.created_at || feedback.timestamp ? new Date(feedback.created_at || feedback.timestamp || '') : null
										const userId = feedback.user_id || ''
										const chatId = feedback.chat_id || feedback.request_id || ''
										const reaction = feedback.reaction || ''
										const feedbackText = feedback.feedback_text || ''
										// For both routes: Use chat_data/chat table if chat_message/chat_response is missing
										const replyToId = feedback.raw_data?.reply_to_id
										const requestId = replyToId || feedback.chat_id || feedback.request_id || ''
										const chatData = chatDataMap[requestId]
										const chatMessage = feedback.chat_message || chatData?.inputText || ''
										const chatResponse = feedback.chat_response || chatData?.outputText || ''
										
										return (
											<tr key={feedbackId}>
												<td className="date-cell">
													{date ? (
														<span className="date-display" title={date.toLocaleString()}>
															{date.toLocaleString()}
														</span>
													) : (
														<span>Unknown date</span>
													)}
												</td>
												{hasAnyUserId && (
													<td>
														{userId ? (
															<button
																className="user-id-link"
																onClick={() => {
																	if (onUserIdClick) {
																		onUserIdClick(userId)
																	}
																	setUserFeedbackSearch(userId)
																}}
																title={userId}
															>
																<span className="user-id-display">{formatUserId(userId)}</span>
															</button>
														) : (
															<span>-</span>
														)}
													</td>
												)}
												<td>
													{chatId ? (
														<button
															className="chat-id-link"
															onClick={() => {
																if (onChatIdClick) {
																	onChatIdClick(chatId)
																}
																setUserFeedbackSearch(chatId)
															}}
															title={chatId}
														>
															<span className="chat-id-display">{formatChatId(chatId)}</span>
														</button>
													) : (
														<span>-</span>
													)}
												</td>
												<td>
													{hasReaction(reaction) ? (
														isPositiveFeedback(reaction) ? (
															<svg fill="#22c55e" viewBox="0 0 24 24" width="20" height="20">
																<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
															</svg>
														) : (
															<svg fill="#ef4444" viewBox="0 0 24 24" width="20" height="20">
																<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
															</svg>
														)
													) : (
														<span>-</span>
													)}
												</td>
												<td className="message-cell">
													<div 
														className="message-text-truncated" 
														title={feedbackText}
														style={{ cursor: 'pointer' }}
														onClick={() => {
															if (onMessageClick) {
																onMessageClick(chatId, chatMessage, chatResponse, feedbackText, reaction)
															}
														}}
													>
														{feedbackText || '-'}
													</div>
												</td>
												<td className="message-cell">
													<div 
														className="message-text-truncated" 
														title={chatMessage}
														style={{ cursor: 'pointer' }}
														onClick={() => {
															if (onMessageClick) {
																onMessageClick(chatId, chatMessage, chatResponse, feedbackText, reaction)
															}
														}}
													>
														{chatMessage || '-'}
													</div>
												</td>
												<td className="message-cell">
													<div 
														className="message-text-truncated" 
														title={chatResponse}
														style={{ cursor: 'pointer' }}
														onClick={() => {
															if (onMessageClick) {
																onMessageClick(chatId, chatMessage, chatResponse, feedbackText, reaction)
															}
														}}
													>
														{chatResponse || '-'}
													</div>
												</td>
												<td>
													<button
														className="user-feedback-delete-btn"
														onClick={(e) => {
															e.preventDefault()
															e.stopPropagation()
															handleDeleteUserFeedbackClick(feedbackId)
														}}
														title={t('delete')}
													>
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
															<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
														</svg>
													</button>
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						)}
						{filteredAndSortedUserFeedback.length > userFeedbackDisplayLimit && (
							<div className="load-more-container">
								<button 
									className="btn btn-primary load-more-btn"
									onClick={() => setUserFeedbackDisplayLimit(prev => prev + 20)}
								>
									{t('loadMore')} ({filteredAndSortedUserFeedback.length - userFeedbackDisplayLimit} {t('remaining')})
								</button>
							</div>
						)}
					</>
				)}
			</div>

			{deleteUserFeedbackModal.isOpen && (
				<div className="modal-backdrop" onClick={handleCancelDeleteUserFeedback} role="dialog" aria-modal="true">
					<div className="confirmation-modal card" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h2 className="h1 modal-title">{language === 'ko' ? '사용자 피드백 삭제' : 'Delete User Feedback'}</h2>
							<button className="icon-btn" onClick={handleCancelDeleteUserFeedback}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
							</button>
						</div>
						<div className="confirmation-content" style={{ padding: '24px', marginBottom: '32px' }}>
							<p style={{ marginBottom: '0' }}>
								{language === 'ko' 
									? '이 사용자 피드백을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.' 
									: 'Are you sure you want to delete this user feedback? This action cannot be undone.'}
							</p>
						</div>
						<div className="feedback-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '0 24px 24px 24px' }}>
							<button 
								className="btn btn-ghost confirmation-no-btn" 
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									handleCancelDeleteUserFeedback()
								}}
							>
								{language === 'ko' ? '취소' : 'Cancel'}
							</button>
							<button 
								className="btn btn-primary confirmation-yes-btn" 
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									handleDeleteUserFeedback()
								}}
							>
								{t('delete')}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
