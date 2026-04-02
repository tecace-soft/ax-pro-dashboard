import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { triggerEmailWorkflowTestGet } from '../services/emailWorkflowTestN8N'
import {
	fetchLatestEmailExtractionPromptN8N,
	saveEmailExtractionPromptN8N,
} from '../services/promptEmailControlN8N'
import '../styles/prompt.css'

export default function EmailAgentPromptControl() {
	const { language, t } = useLanguage()
	const [promptText, setPromptText] = useState('')
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isTestingWorkflow, setIsTestingWorkflow] = useState(false)
	const [isResizing, setIsResizing] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [responseModal, setResponseModal] = useState<{
		isOpen: boolean
		message: string
		isSuccess: boolean
	}>({
		isOpen: false,
		message: '',
		isSuccess: false,
	})

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const content = await fetchLatestEmailExtractionPromptN8N()
				if (!cancelled) setPromptText(content)
			} catch (e) {
				console.error(e)
				if (!cancelled) setPromptText('')
			} finally {
				if (!cancelled) setIsLoading(false)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [])

	const handleRefresh = async () => {
		setIsRefreshing(true)
		try {
			const content = await fetchLatestEmailExtractionPromptN8N()
			setPromptText(content)
		} catch (error) {
			console.error('Failed to refresh email extraction prompt:', error)
		} finally {
			setIsRefreshing(false)
		}
	}

	const handleSave = async () => {
		setIsSaving(true)
		try {
			await saveEmailExtractionPromptN8N(promptText.trim())
			setResponseModal({
				isOpen: true,
				message:
					language === 'ko'
						? '이메일 추출 프롬프트가 저장되었습니다.'
						: 'Email extraction prompt saved successfully.',
				isSuccess: true,
			})
		} catch (error) {
			console.error('Save email extraction prompt failed:', error)
			setResponseModal({
				isOpen: true,
				message:
					error instanceof Error ? error.message : language === 'ko' ? '저장 실패' : 'Save failed',
				isSuccess: false,
			})
		} finally {
			setIsSaving(false)
		}
	}

	const TEST_WORKFLOW_TOOLTIP =
		'Click to trigger the workflow and test how the email is generated.'

	const handleTestEmailWorkflow = async () => {
		setIsTestingWorkflow(true)
		try {
			await triggerEmailWorkflowTestGet()
			setResponseModal({
				isOpen: true,
				message:
					language === 'ko'
						? '테스트 워크플로가 실행되었습니다.'
						: 'Test email workflow was triggered.',
				isSuccess: true,
			})
		} catch (error) {
			console.error('Email workflow test failed:', error)
			const detail =
				error instanceof Error ? error.message : language === 'ko' ? '알 수 없는 오류' : 'Unknown error'
			setResponseModal({
				isOpen: true,
				message:
					language === 'ko'
						? `워크플로 실행에 실패했습니다: ${detail}`
						: `Could not trigger workflow: ${detail}`,
				isSuccess: false,
			})
		} finally {
			setIsTestingWorkflow(false)
		}
	}

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault()
		setIsResizing(true)
		const startY = e.clientY
		const startHeight = textareaRef.current?.offsetHeight || 600

		const handleMouseMove = (ev: MouseEvent) => {
			if (!textareaRef.current) return
			const deltaY = ev.clientY - startY
			const newHeight = Math.max(600, startHeight + deltaY)
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
		<div className="card section" aria-labelledby="email-agent-prompt-title">
			<div className="section-header">
				<div id="email-agent-prompt-title" className="section-title">
					<span className="section-title-text">{t('promptControl')}</span>
					<button
						type="button"
						className="refresh-btn section-refresh-btn"
						onClick={handleRefresh}
						disabled={isRefreshing}
						title={
							language === 'ko' ? 'Supabase에서 새로고침' : 'Refresh prompt from Supabase'
						}
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							width="16"
							height="16"
							className={isRefreshing ? 'spinning' : ''}
						>
							<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
							<path d="M21 3v5h-5" />
							<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
							<path d="M3 21v-5h5" />
						</svg>
					</button>
				</div>
			</div>

			<div className="prompt-content">
				<div className="textarea-wrapper">
					<textarea
						ref={textareaRef}
						className="prompt-textarea font-size-medium"
						placeholder={
							isLoading
								? language === 'ko'
									? '프롬프트 로딩 중...'
									: 'Loading prompt...'
								: language === 'ko'
									? '이메일 추출용 프롬프트를 입력하세요...'
									: 'Enter the extraction prompt for daily email generation...'
						}
						value={promptText}
						onChange={(e) => setPromptText(e.target.value)}
						rows={24}
						disabled={isLoading}
					/>
					<div
						className="resize-handle"
						onMouseDown={handleMouseDown}
						style={{ cursor: isResizing ? 'ns-resize' : 'ns-resize' }}
					/>
				</div>
			</div>

			<div className="prompt-actions">
				<button
					type="button"
					className="btn btn-ghost"
					onClick={handleTestEmailWorkflow}
					disabled={isLoading || isSaving || isTestingWorkflow}
					title={TEST_WORKFLOW_TOOLTIP}
				>
					{isTestingWorkflow
						? language === 'ko'
							? '실행 중...'
							: 'Running...'
						: language === 'ko'
							? '이메일 워크플로 테스트'
							: 'Test Email Workflow'}
				</button>
				<button
					type="button"
					className="btn btn-primary"
					onClick={handleSave}
					disabled={isLoading || isSaving || isTestingWorkflow}
				>
					{isLoading
						? language === 'ko'
							? '로딩 중...'
							: 'Loading...'
						: isSaving
							? language === 'ko'
								? '저장 중...'
								: 'Saving...'
							: t('saveChanges')}
				</button>
			</div>

			{responseModal.isOpen && (
				<div className="modal-backdrop" role="dialog" aria-modal="true">
					<div className="confirmation-modal card">
						<div className="confirmation-content">
							<p>{responseModal.message}</p>
						</div>
						<button
							type="button"
							className="btn btn-primary confirmation-yes-btn"
							onClick={() =>
								setResponseModal({ isOpen: false, message: '', isSuccess: false })
							}
						>
							{language === 'ko' ? '닫기' : 'Close'}
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
