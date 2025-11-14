import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchSystemPrompt, updateSystemPrompt } from '../services/prompt'
import { fetchSystemPromptN8N, fetchAllPromptsN8N, deletePromptN8N, saveSystemPromptN8N } from '../services/promptN8N'
import { PromptData } from '../services/supabaseN8N'
import { useLanguage } from '../contexts/LanguageContext'

export default function PromptControl() {
	const location = useLocation()
	const isN8NRoute = location.pathname === '/dashboard-n8n' || location.pathname === '/rag-n8n'
	const { language, t } = useLanguage()
	const [promptText, setPromptText] = useState('')
	const [currentPromptId, setCurrentPromptId] = useState<number | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [promptFontSize, setPromptFontSize] = useState<'small' | 'medium' | 'large'>('medium')
	const [isExpanded, setIsExpanded] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [promptHistory, setPromptHistory] = useState<PromptData[]>([])
	const [isLoadingHistory, setIsLoadingHistory] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [isResizing, setIsResizing] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [responseModal, setResponseModal] = useState<{
		isOpen: boolean
		message: string
		isSuccess: boolean
	}>({
		isOpen: false,
		message: '',
		isSuccess: false
	})
	const [deletePromptModal, setDeletePromptModal] = useState<{
		isOpen: boolean
		promptId: number | null
	}>({
		isOpen: false,
		promptId: null
	})

	useEffect(() => {
		async function loadSystemPrompt() {
			try {
				console.log('Attempting to fetch system prompt...', isN8NRoute ? '(N8N)' : '(Standard)')
				if (isN8NRoute) {
					const content = await fetchSystemPromptN8N()
					setPromptText(content)
					// Fetch the latest prompt to get the ID
					const allPrompts = await fetchAllPromptsN8N()
					if (allPrompts.length > 0) {
						setCurrentPromptId(allPrompts[0].id || null)
					}
				} else {
					const content = await fetchSystemPrompt()
					setPromptText(content)
				}
				setLastRefreshed(new Date())
			} catch (error) {
				console.error('Failed to load system prompt:', error)
				setPromptText('')
			} finally {
				setIsLoading(false)
			}
		}
		
		loadSystemPrompt()
	}, [isN8NRoute])

	const handleRefresh = async () => {
		setIsRefreshing(true)
		try {
			if (isN8NRoute) {
				const content = await fetchSystemPromptN8N()
				setPromptText(content)
				// Fetch the latest prompt to get the ID
				const allPrompts = await fetchAllPromptsN8N()
				if (allPrompts.length > 0) {
					setCurrentPromptId(allPrompts[0].id || null)
				}
			} else {
				const content = await fetchSystemPrompt()
				setPromptText(content)
			}
			setLastRefreshed(new Date())
		} catch (error) {
			console.error('Failed to refresh system prompt:', error)
		} finally {
			setIsRefreshing(false)
		}
	}

	const handleLoadHistory = async () => {
		if (!isN8NRoute) return
		
		setShowHistory(true)
		setIsLoadingHistory(true)
		try {
			const history = await fetchAllPromptsN8N()
			setPromptHistory(history)
		} catch (error) {
			console.error('Failed to load prompt history:', error)
		} finally {
			setIsLoadingHistory(false)
		}
	}

	const handleLoadPrompt = async (prompt: PromptData) => {
		if (!prompt.id) return
		
		setPromptText(prompt.prompt_text || '')
		setCurrentPromptId(prompt.id)
		setShowHistory(false)
	}

	const handleDeletePromptClick = (promptId: number) => {
		setDeletePromptModal({
			isOpen: true,
			promptId: promptId
		})
	}

	const handleDeletePrompt = async () => {
		if (!deletePromptModal.promptId) return
		
		try {
			await deletePromptN8N(deletePromptModal.promptId)
			if (currentPromptId === deletePromptModal.promptId) {
				setPromptText('')
				setCurrentPromptId(null)
			}
			// Reload history
			const history = await fetchAllPromptsN8N()
			setPromptHistory(history)
			setDeletePromptModal({ isOpen: false, promptId: null })
		} catch (error) {
			console.error('Failed to delete prompt:', error)
			setResponseModal({
				isOpen: true,
				message: language === 'ko' ? '프롬프트 삭제 실패' : 'Failed to delete prompt',
				isSuccess: false
			})
			setDeletePromptModal({ isOpen: false, promptId: null })
		}
	}

	const handleCancelDeletePrompt = () => {
		setDeletePromptModal({ isOpen: false, promptId: null })
	}

	// Handle Save (save to database/API and apply for legacy route)
	const handleSave = async () => {
		setIsSaving(true)
		try {
			if (isN8NRoute) {
				// Save to Supabase for N8N route (only save, no apply needed)
				await saveSystemPromptN8N(promptText)
				// Refresh to get the new prompt ID
				const allPrompts = await fetchAllPromptsN8N()
				if (allPrompts.length > 0) {
					setCurrentPromptId(allPrompts[0].id || null)
				}
				setResponseModal({
					isOpen: true,
					message: language === 'ko' ? '프롬프트가 저장되었습니다.' : 'Prompt saved successfully.',
					isSuccess: true
				})
			} else {
				// For legacy route: save to API and then apply (force reload)
				console.log('💾 Saving system prompt...')
				await updateSystemPrompt(promptText)
				console.log('✅ System prompt saved successfully')
				
				console.log('🔄 Force reloading chatbot...')
				const response = await fetch('/prompt-api/force-prompt-reload', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				})
				
				if (!response.ok) {
					setResponseModal({
						isOpen: true,
						message: `HTTP Error: ${response.status} ${response.statusText}`,
						isSuccess: false
					})
					return
				}
				
				const responseText = await response.text()
				let data
				try {
					data = JSON.parse(responseText)
				} catch (parseError) {
					setResponseModal({
						isOpen: true,
						message: language === 'ko' ? '서버 응답 파싱 실패' : 'Failed to parse server response',
						isSuccess: false
					})
					return
				}
				
				setResponseModal({
					isOpen: true,
					message: data.message || (language === 'ko' ? '프롬프트가 저장되고 적용되었습니다.' : 'Prompt saved and applied successfully.'),
					isSuccess: data.status === 'Complete prompt reload successful'
				})
			}
		} catch (error) {
			console.error('❌ Save operation failed:', error)
			setResponseModal({
				isOpen: true,
				message: error instanceof Error ? error.message : (language === 'ko' ? '저장 실패' : 'Save failed'),
				isSuccess: false
			})
		} finally {
			setIsSaving(false)
		}
	}

	const handleCloseResponseModal = () => {
		setResponseModal({
			isOpen: false,
			message: '',
			isSuccess: false
		})
	}

	const getPromptTitle = (prompt: PromptData): string => {
		// Try to extract title from prompt text (first line or JSON key)
		const text = prompt.prompt_text || ''
		const firstLine = text.split('\n')[0].trim()
		if (firstLine.length > 0 && firstLine.length < 100) {
			return firstLine
		}
		return language === 'ko' ? '프롬프트' : 'Prompt'
	}

	const formatDate = (dateString: string | undefined): string => {
		if (!dateString) return ''
		try {
			const date = new Date(dateString)
			return date.toLocaleString()
		} catch {
			return dateString
		}
	}

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault()
		setIsResizing(true)
		const startY = e.clientY
		const startHeight = textareaRef.current?.offsetHeight || 200

		const handleMouseMove = (e: MouseEvent) => {
			if (!textareaRef.current) return
			const deltaY = e.clientY - startY
			const newHeight = Math.max(200, startHeight + deltaY)
			textareaRef.current.style.height = `${newHeight}px`
		}

		const handleMouseUp = () => {
			setIsResizing(false)
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}

		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)
	}

	return (
		<div className="card section" aria-labelledby="prompt-control-title">
			<div className="section-header">
				<div id="prompt-control-title" className="section-title">
					{t('systemPromptControl')}
				</div>
				<div className="conversations-controls">
					<div className="font-size-control">
						<label>{t('fontSize')}</label>
						<div className="font-size-buttons">
							<button 
								className={`font-size-btn ${promptFontSize === 'small' ? 'active' : ''}`}
								onClick={() => setPromptFontSize('small')}
							>
								A
							</button>
							<button 
								className={`font-size-btn ${promptFontSize === 'medium' ? 'active' : ''}`}
								onClick={() => setPromptFontSize('medium')}
							>
								A
							</button>
							<button 
								className={`font-size-btn ${promptFontSize === 'large' ? 'active' : ''}`}
								onClick={() => setPromptFontSize('large')}
							>
								A
							</button>
						</div>
					</div>
					{isN8NRoute && (
						<button
							className="btn btn-ghost"
							onClick={handleLoadHistory}
							title={language === 'ko' ? '히스토리' : 'History'}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
								<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
								<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
							</svg>
							<span style={{ marginLeft: '6px' }}>{t('history')}</span>
						</button>
					)}
					<button
						className="btn btn-ghost"
						onClick={() => setIsExpanded(!isExpanded)}
						title={language === 'ko' ? '확장' : 'Expand'}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
							{isExpanded ? (
								<path d="M18 15l-6-6-6 6"/>
							) : (
								<path d="M6 9l6 6 6-6"/>
							)}
						</svg>
						<span style={{ marginLeft: '6px' }}>{t('expand')}</span>
					</button>
					<div className="refresh-control">
						{lastRefreshed && (
							<span className="last-refreshed">
								{t('lastRefreshed')} {lastRefreshed.toLocaleString()}
							</span>
						)}
						<button 
							className="refresh-btn"
							onClick={handleRefresh}
							disabled={isRefreshing}
							title={isN8NRoute ? (language === 'ko' ? 'Supabase에서 새로고침' : "Refresh prompt from Supabase") : (language === 'ko' ? 'API에서 새로고침' : "Refresh prompt from API")}
						>
							<svg 
								viewBox="0 0 24 24" 
								fill="none" 
								stroke="currentColor" 
								strokeWidth="2"
								className={isRefreshing ? 'spinning' : ''}
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
			</div>
			
			<div className="prompt-content">
				<div className="textarea-wrapper">
					<textarea
						ref={textareaRef}
						className={`prompt-textarea font-size-${promptFontSize} ${isExpanded ? 'expanded' : ''}`}
						placeholder={isLoading ? (language === 'ko' ? '시스템 프롬프트 로딩 중...' : "Loading system prompt...") : (language === 'ko' ? '프롬프트 지시사항을 입력하세요...' : "Enter your prompt instructions here...")}
						value={promptText}
						onChange={(e) => setPromptText(e.target.value)}
						readOnly={false}
						rows={isExpanded ? 20 : 8}
						disabled={isLoading}
						style={{ fontSize: promptFontSize === 'small' ? '12px' : promptFontSize === 'medium' ? '14px' : '16px' }}
					/>
					<div 
						className="resize-handle"
						onMouseDown={handleMouseDown}
						style={{ cursor: isResizing ? 'ns-resize' : 'ns-resize' }}
					></div>
				</div>
			</div>

			{showHistory && isN8NRoute && (
				<div className="prompt-history-section">
					<div className="prompt-history-header">
						<h3>{t('promptHistory')}</h3>
						<button
							className="icon-btn"
							onClick={() => setShowHistory(false)}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
								<path d="M18 6L6 18M6 6l12 12"/>
							</svg>
						</button>
					</div>
					{isLoadingHistory ? (
						<p className="muted">{language === 'ko' ? '로딩 중...' : 'Loading...'}</p>
					) : promptHistory.length === 0 ? (
						<p className="muted">{language === 'ko' ? '히스토리가 없습니다.' : 'No prompt history found.'}</p>
					) : (
						<div className="prompt-history-list">
							{promptHistory.map((prompt, index) => (
								<div key={prompt.id || index} className="prompt-history-item">
									<div className="prompt-history-item-header">
										<div className="prompt-history-item-info">
											{currentPromptId === prompt.id && (
												<span className="current-badge">
													<span className="current-dot"></span>
													{t('current')}
												</span>
											)}
											<span className="prompt-history-number">#{promptHistory.length - index}</span>
											<span className="prompt-history-title">{getPromptTitle(prompt)}</span>
										</div>
										<div className="prompt-history-item-actions">
											<span className="prompt-history-date">{formatDate(prompt.created_at)}</span>
											<button
												className="btn btn-sm btn-primary"
												onClick={() => handleLoadPrompt(prompt)}
											>
												{t('load')}
											</button>
											{currentPromptId !== prompt.id && (
												<button
													className="btn btn-sm btn-ghost"
													onClick={() => prompt.id && handleDeletePromptClick(prompt.id)}
												>
													{t('delete')}
												</button>
											)}
										</div>
									</div>
									<div className="prompt-history-preview">
										{prompt.prompt_text?.substring(0, 200)}...
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			<div className="prompt-actions">
				<button 
					className="btn btn-primary" 
					onClick={handleSave}
					disabled={isLoading || isSaving}
				>
					{isLoading ? (language === 'ko' ? '로딩 중...' : 'Loading...') : isSaving ? (language === 'ko' ? '저장 중...' : 'Saving...') : t('saveChanges')}
				</button>
			</div>


			{responseModal.isOpen && (
				<div className="modal-backdrop" role="dialog" aria-modal="true">
					<div className="confirmation-modal card">
						<div className="confirmation-content">
							<p>{responseModal.message}</p>
						</div>
						<button 
							className="btn btn-primary confirmation-yes-btn" 
							onClick={handleCloseResponseModal}
						>
							{language === 'ko' ? '닫기' : 'Close'}
						</button>
					</div>
				</div>
			)}

			{deletePromptModal.isOpen && (
				<div className="modal-backdrop" role="dialog" aria-modal="true">
					<div className="confirmation-modal card">
						<div className="confirmation-content">
							<p>
								{language === 'ko' 
									? '이 프롬프트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.' 
									: 'Are you sure you want to delete this prompt? This action cannot be undone.'}
							</p>
						</div>
						<button 
							className="btn btn-ghost confirmation-no-btn" 
							onClick={handleCancelDeletePrompt}
						>
							{language === 'ko' ? '취소' : 'Cancel'}
						</button>
						<button 
							className="btn btn-primary confirmation-yes-btn" 
							onClick={handleDeletePrompt}
						>
							{t('delete')}
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
