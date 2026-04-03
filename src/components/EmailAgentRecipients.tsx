import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import {
	deleteEmailAgentRecipientN8N,
	fetchEmailAgentRecipientsN8N,
	insertEmailAgentRecipientN8N,
	updateEmailAgentRecipientN8N,
} from '../services/emailAgentRecipientsN8N'
import '../styles/prompt.css'
import '../styles/emailAgent.css'

type SavedItem = { id: string | number; email_address: string }

export default function EmailAgentRecipients() {
	const { language } = useLanguage()
	const [expanded, setExpanded] = useState(false)
	const [items, setItems] = useState<SavedItem[]>([])
	const [newRowValue, setNewRowValue] = useState('')
	const [loading, setLoading] = useState(true)
	const [mutating, setMutating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(
		async (opts?: { quiet?: boolean }) => {
			const quiet = opts?.quiet === true
			if (!quiet) {
				setLoading(true)
				setError(null)
			}
			try {
				const rows = await fetchEmailAgentRecipientsN8N()
				setItems(
					rows.map((r) => ({
						id: r.id,
						email_address: r.email_address ?? '',
					})),
				)
			} catch (e) {
				console.error(e)
				if (!quiet) {
					setError(
						language === 'ko'
							? '수신자 목록을 불러오지 못했습니다.'
							: 'Could not load recipients.',
					)
					setItems([])
				}
			} finally {
				if (!quiet) setLoading(false)
			}
		},
		[language],
	)

	useEffect(() => {
		void load()
	}, [load])

	const updateSavedValue = (id: string | number, value: string) => {
		setItems((prev) =>
			prev.map((it) => (it.id === id ? { ...it, email_address: value } : it)),
		)
	}

	const handleBlurSaved = async (item: SavedItem, nextValue: string) => {
		const trimmed = nextValue.trim()
		if (trimmed === item.email_address.trim()) return
		if (!trimmed) {
			setError(
				language === 'ko'
					? '이메일 주소는 비울 수 없습니다. 삭제하려면 휴지통을 사용하세요.'
					: 'Address cannot be empty. Use delete to remove a row.',
			)
			await load({ quiet: true })
			return
		}
		setMutating(true)
		setError(null)
		try {
			await updateEmailAgentRecipientN8N(item.id, trimmed)
			updateSavedValue(item.id, trimmed)
		} catch (e) {
			console.error(e)
			setError(
				language === 'ko' ? '저장하지 못했습니다.' : 'Could not save changes.',
			)
			await load({ quiet: true })
		} finally {
			setMutating(false)
		}
	}

	const handleAddNew = async () => {
		const trimmed = newRowValue.trim()
		if (!trimmed) return
		setMutating(true)
		setError(null)
		try {
			await insertEmailAgentRecipientN8N(trimmed)
			setNewRowValue('')
			await load({ quiet: true })
		} catch (e) {
			console.error(e)
			setError(
				language === 'ko' ? '추가하지 못했습니다.' : 'Could not add recipient.',
			)
		} finally {
			setMutating(false)
		}
	}

	const handleDelete = async (item: SavedItem) => {
		setMutating(true)
		setError(null)
		try {
			await deleteEmailAgentRecipientN8N(item.id)
			setItems((prev) => prev.filter((it) => it.id !== item.id))
		} catch (e) {
			console.error(e)
			setError(
				language === 'ko' ? '삭제하지 못했습니다.' : 'Could not delete recipient.',
			)
			await load({ quiet: true })
		} finally {
			setMutating(false)
		}
	}

	const t = {
		title: language === 'ko' ? '수신자' : 'Recipients',
		toggleShow: language === 'ko' ? '수신자 목록 표시' : 'Show recipient list',
		toggleHide: language === 'ko' ? '수신자 목록 숨기기' : 'Hide recipient list',
		loading: language === 'ko' ? '불러오는 중…' : 'Loading…',
		placeholder:
			language === 'ko' ? '이메일 주소' : 'Email address',
		del: language === 'ko' ? '삭제' : 'Delete',
		add: language === 'ko' ? '수신자 추가' : 'Add recipient',
	}

	return (
		<div
			className={`card section email-agent-recipients${expanded ? '' : ' email-agent-recipients--collapsed'}`}
			aria-labelledby="email-agent-recipients-heading"
		>
			<div className="section-header">
				<div
					id="email-agent-recipients-heading"
					className="section-title email-agent-recipients__header-trigger"
					role="button"
					tabIndex={0}
					aria-expanded={expanded}
					aria-controls="email-agent-recipients-panel"
					title={expanded ? t.toggleHide : t.toggleShow}
					aria-label={expanded ? t.toggleHide : t.toggleShow}
					onClick={() => setExpanded((v) => !v)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault()
							setExpanded((v) => !v)
						}
					}}
				>
					<span className="section-title-text">{t.title}</span>
					<span className="email-agent-recipients__chevron-surface" aria-hidden>
						<ChevronDown
							className={`email-agent-recipients__chevron${expanded ? ' is-open' : ''}`}
							size={16}
							strokeWidth={2}
						/>
					</span>
				</div>
			</div>

			<div
				id="email-agent-recipients-panel"
				className={`email-agent-recipients__collapse${expanded ? ' is-open' : ''}`}
				role="region"
				aria-labelledby="email-agent-recipients-heading"
				aria-hidden={!expanded}
			>
				<div className="email-agent-recipients__collapse-inner">
					<div className="email-agent-recipients__panel">
						<div className="email-agent-recipients__body">
							{error ? <p className="email-agent-recipients__error">{error}</p> : null}

							{loading ? (
								<p className="email-agent-recipients__loading">{t.loading}</p>
							) : (
								<>
									{items.map((item) => (
										<div key={String(item.id)} className="email-agent-recipients__row">
											<input
												type="text"
												className="email-agent-recipients__input"
												value={item.email_address}
												onChange={(e) => updateSavedValue(item.id, e.target.value)}
												onBlur={(e) =>
													void handleBlurSaved(item, e.currentTarget.value)
												}
												placeholder={t.placeholder}
												disabled={mutating}
												aria-label={t.placeholder}
											/>
											<button
												type="button"
												className="email-agent-recipients__icon-btn email-agent-recipients__icon-btn--delete"
												onClick={() => void handleDelete(item)}
												disabled={mutating}
												title={t.del}
												aria-label={t.del}
											>
												<svg
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													aria-hidden
												>
													<path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
													<path d="M10 11v6M14 11v6" />
												</svg>
											</button>
										</div>
									))}

									<div className="email-agent-recipients__row">
										<input
											type="text"
											className="email-agent-recipients__input"
											value={newRowValue}
											onChange={(e) => setNewRowValue(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault()
													void handleAddNew()
												}
											}}
											placeholder={t.placeholder}
											disabled={mutating}
											aria-label={t.add}
										/>
										<button
											type="button"
											className="email-agent-recipients__icon-btn email-agent-recipients__icon-btn--add"
											onClick={() => void handleAddNew()}
											disabled={mutating || !newRowValue.trim()}
											title={t.add}
											aria-label={t.add}
										>
											<Plus size={16} strokeWidth={2} aria-hidden />
										</button>
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
