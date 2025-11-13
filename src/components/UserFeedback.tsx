import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchUserFeedback } from '../services/userFeedback'
import { UserFeedbackData } from '../services/supabase'
import { fetchUserFeedbackN8N, UserFeedbackDataN8N } from '../services/userFeedbackN8N'
import { useLanguage } from '../contexts/LanguageContext'
import * as XLSX from 'xlsx'

type UserFeedback = UserFeedbackData | UserFeedbackDataN8N

interface UserFeedbackProps {
	onChatIdClick?: (chatId: string) => void
	onUserIdClick?: (userId: string) => void
	onSessionIdClick?: (sessionId: string) => void
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

export default function UserFeedback({ onChatIdClick, onUserIdClick, onSessionIdClick }: UserFeedbackProps = {}) {
	const location = useLocation()
	const isN8NRoute = location.pathname === '/dashboard-n8n'
	const { language, t } = useLanguage()
	
	const [userFeedbacks, setUserFeedbacks] = useState<UserFeedback[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'positive' | 'negative'>('all')
	const [userFeedbackViewMode, setUserFeedbackViewMode] = useState<'grid' | 'table'>('table')
	const [userFeedbackSortBy, setUserFeedbackSortBy] = useState<'date' | 'userId' | 'chatId'>('date')
	const [userFeedbackSearch, setUserFeedbackSearch] = useState('')
	const [userFeedbackFontSize, setUserFeedbackFontSize] = useState<'small' | 'medium' | 'large'>('medium')
	const [userFeedbackDisplayLimit, setUserFeedbackDisplayLimit] = useState(10)
	const [userFeedbackLastRefreshed, setUserFeedbackLastRefreshed] = useState<Date | null>(null)
	const [isRefreshingUserFeedback, setIsRefreshingUserFeedback] = useState(false)
	const [userFeedbackExportFormat, setUserFeedbackExportFormat] = useState<'csv' | 'excel' | 'json'>('csv')
	const [isExportingUserFeedback, setIsExportingUserFeedback] = useState(false)

	useEffect(() => {
		loadUserFeedback()
	}, [isN8NRoute])

	const loadUserFeedback = async (bypassCache = false) => {
		setIsLoading(true)
		setError(null)
		
		try {
			if (isN8NRoute) {
				const data = await fetchUserFeedbackN8N()
				setUserFeedbacks(data)
			} else {
				const data = await fetchUserFeedback()
				setUserFeedbacks(data)
			}
			setUserFeedbackLastRefreshed(new Date())
		} catch (error) {
			console.error('Failed to load user feedback:', error)
			setError('Failed to load user feedback')
		} finally {
			setIsLoading(false)
		}
	}

	const refreshUserFeedback = async () => {
		setIsRefreshingUserFeedback(true)
		await loadUserFeedback(true)
		setIsRefreshingUserFeedback(false)
	}

	const isPositiveFeedback = (reaction: string): boolean => {
		const normalizedReaction = reaction.toLowerCase()
		return normalizedReaction.includes('thumbs_up') || normalizedReaction.includes('like') || normalizedReaction === 'positive'
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
		
		// TODO: Implement delete functionality
		console.log('Delete user feedback:', deleteUserFeedbackModal.feedbackId)
		
		// Close modal after deletion
		setDeleteUserFeedbackModal({ isOpen: false, feedbackId: null })
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
					<div className="refresh-control">
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
									const chatMessage = feedback.chat_message || ''
									const chatResponse = feedback.chat_response || ''
									
									return (
										<div key={feedbackId} className="user-feedback-card">
											<div className="user-feedback-card-header">
												<div className="user-feedback-card-rating">
													{isPositiveFeedback(reaction) ? (
														<svg fill="#22c55e" viewBox="0 0 24 24" width="24" height="24">
															<path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
														</svg>
													) : (
														<svg fill="#ef4444" viewBox="0 0 24 24" width="24" height="24">
															<path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
														</svg>
													)}
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
														<div>{feedbackText}</div>
													</div>
												)}
												{chatMessage && (
													<div className="user-feedback-card-field">
														<strong>{t('userMessage')}:</strong>
														<div>{chatMessage}</div>
													</div>
												)}
												{chatResponse && (
													<div className="user-feedback-card-field">
														<strong>{t('aiResponse')}:</strong>
														<div>{chatResponse}</div>
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
										<th>{t('reaction')}</th>
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
										const chatMessage = feedback.chat_message || ''
										const chatResponse = feedback.chat_response || ''
										
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
													{isPositiveFeedback(reaction) ? (
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
													<div className="message-text-truncated" title={feedbackText}>
														{feedbackText || '-'}
													</div>
												</td>
												<td className="message-cell">
													<div className="message-text-truncated" title={chatMessage}>
														{chatMessage || '-'}
													</div>
												</td>
												<td className="message-cell">
													<div className="message-text-truncated" title={chatResponse}>
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
				<div className="modal-backdrop" role="dialog" aria-modal="true">
					<div className="confirmation-modal card">
						<div className="confirmation-content">
							<p>
								{language === 'ko' 
									? '이 사용자 피드백을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.' 
									: 'Are you sure you want to delete this user feedback? This action cannot be undone.'}
							</p>
						</div>
						<button 
							className="btn btn-ghost confirmation-no-btn" 
							onClick={handleCancelDeleteUserFeedback}
						>
							{language === 'ko' ? '취소' : 'Cancel'}
						</button>
						<button 
							className="btn btn-primary confirmation-yes-btn" 
							onClick={handleDeleteUserFeedback}
						>
							{t('delete')}
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
