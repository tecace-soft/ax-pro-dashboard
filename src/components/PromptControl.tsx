import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchSystemPrompt, updateSystemPrompt } from '../services/prompt'
import { fetchSystemPromptN8N, fetchAllPromptsN8N, deletePromptN8N, saveSystemPromptN8N } from '../services/promptN8N'
import { PromptData } from '../services/supabaseN8N'
import { useLanguage } from '../contexts/LanguageContext'
import { getAllAdminFeedback } from '../services/adminFeedback'
import { getAllAdminFeedbackN8N } from '../services/adminFeedbackN8N'
import { AdminFeedbackData } from '../services/supabase'
import { AdminFeedbackDataN8N } from '../services/adminFeedbackN8N'
import { fetchRequestDetailN8N } from '../services/conversationsN8N'
import { getChatData } from '../services/chatData'

export default function PromptControl() {
	const location = useLocation()
	const isN8NRoute = location.pathname === '/dashboard-n8n' || location.pathname === '/rag-n8n'
	const { language, t } = useLanguage()
	const [promptText, setPromptText] = useState('')
	const [correctedResponsesText, setCorrectedResponsesText] = useState('')
	const [feedbackTextsText, setFeedbackTextsText] = useState('')
	const [adminFeedback, setAdminFeedback] = useState<Record<string, AdminFeedbackData | AdminFeedbackDataN8N>>({})
	const [isLoadingAdminFeedback, setIsLoadingAdminFeedback] = useState(false)
	
	// FAQ items structure: { question: string, answer: string, metadata?: any }[]
	const [faqItems, setFaqItems] = useState<Array<{ question: string, answer: string, metadata?: Array<{ date: string, feedbackId: string, chatId?: string }> }>>([])
	// Feedback items structure: { text: string, metadata?: any }[]
	const [feedbackItems, setFeedbackItems] = useState<Array<{ text: string, metadata?: Array<{ date: string, feedbackId: string, chatId?: string }> }>>([])
	// Collapsed states for FAQ and Feedback sections
	const [isFaqCollapsed, setIsFaqCollapsed] = useState(true)
	const [isFeedbackCollapsed, setIsFeedbackCollapsed] = useState(true)
	// Modal state for showing item details
	const [detailModal, setDetailModal] = useState<{
		isOpen: boolean
		type: 'faq' | 'feedback' | null
		index: number | null
	}>({
		isOpen: false,
		type: null,
		index: null
	})
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
	const correctedResponsesRef = useRef<HTMLTextAreaElement>(null)
	const feedbackTextsRef = useRef<HTMLTextAreaElement>(null)
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

	// Load admin feedback data
	useEffect(() => {
		async function loadAdminFeedback() {
			setIsLoadingAdminFeedback(true)
			try {
				let allFeedback: Record<string, AdminFeedbackData | AdminFeedbackDataN8N> = {}
				if (isN8NRoute) {
					// Load all admin feedback (no date filter to get all)
					allFeedback = await getAllAdminFeedbackN8N()
				} else {
					// Load all admin feedback (no date filter to get all)
					allFeedback = await getAllAdminFeedback()
				}
				setAdminFeedback(allFeedback)
				
				// Build FAQ format: Q1, Q2... from User Message + Corrected Message, Answer from Corrected Response
				const faqItems: string[] = []
				let qNumber = 1
				
				// Load chat data for each feedback to get user messages
				const chatDataMap: Record<string, { inputText: string }> = {}
				const feedbackKeys = Object.keys(allFeedback).filter(key => !key.startsWith('feedback-'))
				
				// Load chat data in batches
				for (let i = 0; i < feedbackKeys.length; i += 10) {
					const batch = feedbackKeys.slice(i, i + 10)
					await Promise.all(batch.map(async (key) => {
						try {
							if (isN8NRoute) {
								const detail = await fetchRequestDetailN8N(key)
								if (detail && detail.request) {
									chatDataMap[key] = { inputText: detail.request.inputText || '' }
								}
							} else {
								const chatData = await getChatData(key)
								if (chatData) {
									chatDataMap[key] = { inputText: chatData.input_text || '' }
								}
							}
						} catch (error) {
							console.warn(`Could not fetch chat data for ${key}:`, error)
						}
					}))
				}
				
				// Build FAQ items array (with deduplication and metadata)
				const faqItemsArray: Array<{ question: string, answer: string, metadata?: Array<{ date: string, feedbackId: string, chatId?: string }> }> = []
				const faqMap = new Map<string, { question: string, answer: string, metadata: Array<{ date: string, feedbackId: string, chatId?: string }> }>()
				
				Object.entries(allFeedback).forEach(([key, feedback]) => {
					// Get user message (corrected_message or original inputText)
					const correctedMessage = (feedback as any).corrected_message?.trim() || ''
					const userMessage = chatDataMap[key]?.inputText?.trim() || ''
					const question = correctedMessage || userMessage
					
					// Get corrected response for answer
					const answer = feedback.corrected_response?.trim() || ''
					
					if (question && answer) {
						// Create a unique key for this Q&A pair
						const faqKey = `${question}|${answer}`
						const metadata = {
							date: feedback.created_at ? new Date(feedback.created_at).toLocaleString() : 'N/A',
							feedbackId: feedback.id?.toString() || key,
							chatId: key.startsWith('feedback-') ? undefined : key
						}
						
						if (faqMap.has(faqKey)) {
							// Add metadata to existing entry
							faqMap.get(faqKey)!.metadata.push(metadata)
						} else {
							faqMap.set(faqKey, { question, answer, metadata: [metadata] })
						}
					}
				})
				
				faqItemsArray.push(...Array.from(faqMap.values()))
				
				// Build feedback texts array (with deduplication and metadata)
				const feedbackItemsArray: Array<{ text: string, metadata?: Array<{ date: string, feedbackId: string, chatId?: string }> }> = []
				const feedbackMap = new Map<string, { text: string, metadata: Array<{ date: string, feedbackId: string, chatId?: string }> }>()
				
				Object.entries(allFeedback).forEach(([key, feedback]) => {
					if (feedback.feedback_text && feedback.feedback_text.trim() !== '') {
						const feedbackText = feedback.feedback_text.trim()
						const metadata = {
							date: feedback.created_at ? new Date(feedback.created_at).toLocaleString() : 'N/A',
							feedbackId: feedback.id?.toString() || key,
							chatId: key.startsWith('feedback-') ? undefined : key
						}
						
						if (feedbackMap.has(feedbackText)) {
							// Add metadata to existing entry
							feedbackMap.get(feedbackText)!.metadata.push(metadata)
						} else {
							feedbackMap.set(feedbackText, { text: feedbackText, metadata: [metadata] })
						}
					}
				})
				
				feedbackItemsArray.push(...Array.from(feedbackMap.values()))
				
				setFaqItems(faqItemsArray)
				setFeedbackItems(feedbackItemsArray)
			} catch (error) {
				console.error('Failed to load admin feedback:', error)
			} finally {
				setIsLoadingAdminFeedback(false)
			}
		}
		
		loadAdminFeedback()
	}, [isN8NRoute])

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
			
			// Refresh admin feedback data
			setIsLoadingAdminFeedback(true)
			try {
				let allFeedback: Record<string, AdminFeedbackData | AdminFeedbackDataN8N> = {}
				if (isN8NRoute) {
					allFeedback = await getAllAdminFeedbackN8N()
				} else {
					allFeedback = await getAllAdminFeedback()
				}
				setAdminFeedback(allFeedback)
				
				// Build FAQ format: Q1, Q2... from User Message + Corrected Message, Answer from Corrected Response
				const faqItems: string[] = []
				let qNumber = 1
				
				// Load chat data for each feedback to get user messages
				const chatDataMap: Record<string, { inputText: string }> = {}
				const feedbackKeys = Object.keys(allFeedback).filter(key => !key.startsWith('feedback-'))
				
				// Load chat data in batches
				for (let i = 0; i < feedbackKeys.length; i += 10) {
					const batch = feedbackKeys.slice(i, i + 10)
					await Promise.all(batch.map(async (key) => {
						try {
							if (isN8NRoute) {
								const detail = await fetchRequestDetailN8N(key)
								if (detail && detail.request) {
									chatDataMap[key] = { inputText: detail.request.inputText || '' }
								}
							} else {
								const chatData = await getChatData(key)
								if (chatData) {
									chatDataMap[key] = { inputText: chatData.input_text || '' }
								}
							}
						} catch (error) {
							console.warn(`Could not fetch chat data for ${key}:`, error)
						}
					}))
				}
				
				// Build FAQ items array (with deduplication and metadata)
				const faqItemsArray: Array<{ question: string, answer: string, metadata?: Array<{ date: string, feedbackId: string, chatId?: string }> }> = []
				const faqMap = new Map<string, { question: string, answer: string, metadata: Array<{ date: string, feedbackId: string, chatId?: string }> }>()
				
				Object.entries(allFeedback).forEach(([key, feedback]) => {
					// Get user message (corrected_message or original inputText)
					const correctedMessage = (feedback as any).corrected_message?.trim() || ''
					const userMessage = chatDataMap[key]?.inputText?.trim() || ''
					const question = correctedMessage || userMessage
					
					// Get corrected response for answer
					const answer = feedback.corrected_response?.trim() || ''
					
					if (question && answer) {
						// Create a unique key for this Q&A pair
						const faqKey = `${question}|${answer}`
						const metadata = {
							date: feedback.created_at ? new Date(feedback.created_at).toLocaleString() : 'N/A',
							feedbackId: feedback.id?.toString() || key,
							chatId: key.startsWith('feedback-') ? undefined : key
						}
						
						if (faqMap.has(faqKey)) {
							// Add metadata to existing entry
							faqMap.get(faqKey)!.metadata.push(metadata)
						} else {
							faqMap.set(faqKey, { question, answer, metadata: [metadata] })
						}
					}
				})
				
				faqItemsArray.push(...Array.from(faqMap.values()))
				
				// Build feedback texts array (with deduplication and metadata)
				const feedbackItemsArray: Array<{ text: string, metadata?: Array<{ date: string, feedbackId: string, chatId?: string }> }> = []
				const feedbackMap = new Map<string, { text: string, metadata: Array<{ date: string, feedbackId: string, chatId?: string }> }>()
				
				Object.entries(allFeedback).forEach(([key, feedback]) => {
					if (feedback.feedback_text && feedback.feedback_text.trim() !== '') {
						const feedbackText = feedback.feedback_text.trim()
						const metadata = {
							date: feedback.created_at ? new Date(feedback.created_at).toLocaleString() : 'N/A',
							feedbackId: feedback.id?.toString() || key,
							chatId: key.startsWith('feedback-') ? undefined : key
						}
						
						if (feedbackMap.has(feedbackText)) {
							// Add metadata to existing entry
							feedbackMap.get(feedbackText)!.metadata.push(metadata)
						} else {
							feedbackMap.set(feedbackText, { text: feedbackText, metadata: [metadata] })
						}
					}
				})
				
				feedbackItemsArray.push(...Array.from(feedbackMap.values()))
				
				setFaqItems(faqItemsArray)
				setFeedbackItems(feedbackItemsArray)
			} catch (error) {
				console.error('Failed to refresh admin feedback:', error)
			} finally {
				setIsLoadingAdminFeedback(false)
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

	// Combine all sections into one prompt text for saving
	const getCombinedPromptText = (): string => {
		const sections: string[] = []
		
		// 1. Prompt
		if (promptText.trim()) {
			sections.push(promptText.trim())
		}
		
		// 2. FAQ section from faqItems
		if (faqItems.length > 0) {
			const faqHeader = '🟦 [FAQ(High Priority FAQ)]\n\n'
			const faqContent = faqItems.map((item, idx) => `Q${idx + 1}. ${item.question}\n답변: ${item.answer}`).join('\n\n')
			sections.push(faqHeader + faqContent)
		}
		
		// 3. Feedback section from feedbackItems
		if (feedbackItems.length > 0) {
			const feedbackContent = feedbackItems.map((item, idx) => `F${idx + 1}. ${item}`).join('\n\n')
			sections.push(feedbackContent)
		}
		
		return sections.join('\n\n')
	}

	// Handle Save (save to database/API and apply for legacy route)
	const handleSave = async () => {
		setIsSaving(true)
		try {
			const combinedText = getCombinedPromptText()
			
			if (isN8NRoute) {
				// Save to Supabase for N8N route (only save, no apply needed)
				await saveSystemPromptN8N(combinedText)
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
				await updateSystemPrompt(combinedText)
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
				{/* Section 1: Prompt */}
				<div className="textarea-wrapper">
					<label className="prompt-section-label">
						{language === 'ko' ? '1. 프롬프트' : '1. Prompt'}
					</label>
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

				{/* Section 2: All Corrected Responses (FAQ) */}
				<div className="faq-section-wrapper">
					<div className="section-header-with-toggle">
						<label className="prompt-section-label">
							{language === 'ko' ? '2. 모든 수정된 응답 (Admin Feedback)' : '2. All Corrected Responses (Admin Feedback)'}
							<span style={{ marginLeft: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
								({faqItems.length} {language === 'ko' ? '개' : 'items'})
							</span>
							{isLoadingAdminFeedback && <span style={{ marginLeft: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>({language === 'ko' ? '로딩 중...' : 'Loading...'})</span>}
						</label>
						<button
							className="collapse-toggle-btn"
							onClick={() => setIsFaqCollapsed(!isFaqCollapsed)}
							title={isFaqCollapsed ? (language === 'ko' ? '펼치기' : 'Expand') : (language === 'ko' ? '접기' : 'Collapse')}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
								{isFaqCollapsed ? (
									<path d="M6 9l6 6 6-6"/>
								) : (
									<path d="M18 15l-6-6-6 6"/>
								)}
							</svg>
						</button>
					</div>
					{!isFaqCollapsed && (
						<>
							<div className="faq-header-text">
								🟦 [FAQ(High Priority FAQ)]
							</div>
							<div className="faq-items-container">
						{faqItems.map((item, idx) => (
							<div key={idx} className="faq-item">
								<div className="faq-item-header">
									<div className="faq-item-row">
										<span className="faq-label">Q{idx + 1}.</span>
										<input
											type="text"
											className="faq-question-input"
											value={item.question}
											onChange={(e) => {
												const newFaqItems = [...faqItems]
												newFaqItems[idx].question = e.target.value
												setFaqItems(newFaqItems)
											}}
											placeholder={language === 'ko' ? '질문을 입력하세요...' : 'Enter question...'}
											disabled={isLoadingAdminFeedback}
										/>
									</div>
									<button
										className="info-btn"
										onClick={() => setDetailModal({ isOpen: true, type: 'faq', index: idx })}
										title={language === 'ko' ? '상세 정보 보기' : 'View details'}
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<circle cx="12" cy="12" r="10"/>
											<path d="M12 16v-4M12 8h.01"/>
										</svg>
									</button>
								</div>
								<div className="faq-item-row">
									<span className="faq-label">답변:</span>
									<textarea
										className="faq-answer-textarea"
										value={item.answer}
										onChange={(e) => {
											const newFaqItems = [...faqItems]
											newFaqItems[idx].answer = e.target.value
											setFaqItems(newFaqItems)
										}}
										placeholder={language === 'ko' ? '답변을 입력하세요...' : 'Enter answer...'}
										rows={3}
										disabled={isLoadingAdminFeedback}
									/>
								</div>
							</div>
						))}
							{faqItems.length === 0 && !isLoadingAdminFeedback && (
								<div className="faq-empty-message">
									{language === 'ko' ? 'FAQ 항목이 없습니다.' : 'No FAQ items found.'}
								</div>
							)}
							</div>
						</>
					)}
				</div>

				{/* Section 3: All Feedback Texts */}
				<div className="feedback-section-wrapper">
					<div className="section-header-with-toggle">
						<label className="prompt-section-label">
							{language === 'ko' ? '3. 모든 피드백 텍스트 (Admin Feedback)' : '3. All Feedback Texts (Admin Feedback)'}
							<span style={{ marginLeft: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
								({feedbackItems.length} {language === 'ko' ? '개' : 'items'})
							</span>
							{isLoadingAdminFeedback && <span style={{ marginLeft: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>({language === 'ko' ? '로딩 중...' : 'Loading...'})</span>}
						</label>
						<button
							className="collapse-toggle-btn"
							onClick={() => setIsFeedbackCollapsed(!isFeedbackCollapsed)}
							title={isFeedbackCollapsed ? (language === 'ko' ? '펼치기' : 'Expand') : (language === 'ko' ? '접기' : 'Collapse')}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
								{isFeedbackCollapsed ? (
									<path d="M6 9l6 6 6-6"/>
								) : (
									<path d="M18 15l-6-6-6 6"/>
								)}
							</svg>
						</button>
					</div>
					{!isFeedbackCollapsed && (
						<div className="feedback-items-container">
						{feedbackItems.map((item, idx) => (
							<div key={idx} className="feedback-item">
								<div className="feedback-item-header">
									<span className="feedback-label">F{idx + 1}.</span>
									<button
										className="info-btn"
										onClick={() => setDetailModal({ isOpen: true, type: 'feedback', index: idx })}
										title={language === 'ko' ? '상세 정보 보기' : 'View details'}
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<circle cx="12" cy="12" r="10"/>
											<path d="M12 16v-4M12 8h.01"/>
										</svg>
									</button>
								</div>
								<textarea
									className="feedback-text-textarea"
									value={item.text}
									onChange={(e) => {
										const newFeedbackItems = [...feedbackItems]
										newFeedbackItems[idx].text = e.target.value
										setFeedbackItems(newFeedbackItems)
									}}
									placeholder={language === 'ko' ? '피드백을 입력하세요...' : 'Enter feedback...'}
									rows={4}
									disabled={isLoadingAdminFeedback}
								/>
							</div>
						))}
							{feedbackItems.length === 0 && !isLoadingAdminFeedback && (
								<div className="feedback-empty-message">
									{language === 'ko' ? '피드백 항목이 없습니다.' : 'No feedback items found.'}
								</div>
							)}
						</div>
					)}
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

			{/* Detail Modal */}
			{detailModal.isOpen && detailModal.type && detailModal.index !== null && (
				<div className="modal-overlay" onClick={() => setDetailModal({ isOpen: false, type: null, index: null })}>
					<div className="detail-modal" onClick={(e) => e.stopPropagation()}>
						<div className="detail-modal-header">
							<h3>
								{detailModal.type === 'faq' 
									? (language === 'ko' ? `Q${detailModal.index + 1} 상세 정보` : `Q${detailModal.index + 1} Details`)
									: (language === 'ko' ? `F${detailModal.index + 1} 상세 정보` : `F${detailModal.index + 1} Details`)
								}
							</h3>
							<button
								className="icon-btn"
								onClick={() => setDetailModal({ isOpen: false, type: null, index: null })}
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
									<path d="M18 6L6 18M6 6l12 12"/>
								</svg>
							</button>
						</div>
						<div className="detail-modal-content">
							{detailModal.type === 'faq' && faqItems[detailModal.index] && (
								<>
									<div className="detail-section">
										<strong>{language === 'ko' ? '질문:' : 'Question:'}</strong>
										<p>{faqItems[detailModal.index].question}</p>
									</div>
									<div className="detail-section">
										<strong>{language === 'ko' ? '답변:' : 'Answer:'}</strong>
										<p>{faqItems[detailModal.index].answer}</p>
									</div>
									{faqItems[detailModal.index].metadata && faqItems[detailModal.index].metadata!.length > 0 && (
										<div className="detail-section">
											<strong>{language === 'ko' ? '관련 Admin Feedback:' : 'Related Admin Feedback:'}</strong>
											<div className="metadata-list">
												{faqItems[detailModal.index].metadata!.map((meta, metaIdx) => (
													<div key={metaIdx} className="metadata-item">
														<div><strong>{language === 'ko' ? '생성일:' : 'Created:'}</strong> {meta.date}</div>
														{meta.chatId && <div><strong>{language === 'ko' ? 'Chat ID:' : 'Chat ID:'}</strong> {meta.chatId}</div>}
														<div><strong>{language === 'ko' ? 'Feedback ID:' : 'Feedback ID:'}</strong> {meta.feedbackId}</div>
													</div>
												))}
											</div>
										</div>
									)}
								</>
							)}
							{detailModal.type === 'feedback' && feedbackItems[detailModal.index] && (
								<>
									<div className="detail-section">
										<strong>{language === 'ko' ? '피드백 텍스트:' : 'Feedback Text:'}</strong>
										<p>{feedbackItems[detailModal.index].text}</p>
									</div>
									{feedbackItems[detailModal.index].metadata && feedbackItems[detailModal.index].metadata!.length > 0 && (
										<div className="detail-section">
											<strong>{language === 'ko' ? '관련 Admin Feedback:' : 'Related Admin Feedback:'}</strong>
											<div className="metadata-list">
												{feedbackItems[detailModal.index].metadata!.map((meta, metaIdx) => (
													<div key={metaIdx} className="metadata-item">
														<div><strong>{language === 'ko' ? '생성일:' : 'Created:'}</strong> {meta.date}</div>
														{meta.chatId && <div><strong>{language === 'ko' ? 'Chat ID:' : 'Chat ID:'}</strong> {meta.chatId}</div>}
														<div><strong>{language === 'ko' ? 'Feedback ID:' : 'Feedback ID:'}</strong> {meta.feedbackId}</div>
													</div>
												))}
											</div>
										</div>
									)}
								</>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
