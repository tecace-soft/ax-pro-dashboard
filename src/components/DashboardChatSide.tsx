import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FormEvent,
	type KeyboardEvent,
} from 'react'
import { ChevronLeft, MessageSquare, Send } from 'lucide-react'
import { useProfile } from '../contexts/ProfileContext'

const STORAGE_KEY = 'dashboard-chat-side-collapsed'
const DEFAULT_AVATAR = '/default-profile-avatar.png'
const PROFILE_AVATAR_STORAGE = 'profileAvatar'

const DASHBOARD_CHAT_WEBHOOK_URL =
	'https://n8n.srv1153481.hstgr.cloud/webhook/37df8943-8d28-4533-af2d-378ad5b425ba'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
	id: string
	role: ChatRole
	text: string
	createdAt: number
}

function uid() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function pad2(n: number) {
	return String(n).padStart(2, '0')
}

function pad3(n: number) {
	return String(n).padStart(3, '0')
}

function escapeHtml(s: string) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

/** ISO 8601 in UTC (ends with Z). */
function toIsoUtc(date: Date) {
	return date.toISOString()
}

/** ISO 8601 with local timezone offset, e.g. 2026-03-30T14:30:00.000+09:00 */
function toIsoLocalWithOffset(date: Date) {
	const y = date.getFullYear()
	const m = pad2(date.getMonth() + 1)
	const d = pad2(date.getDate())
	const h = pad2(date.getHours())
	const min = pad2(date.getMinutes())
	const sec = pad2(date.getSeconds())
	const ms = pad3(date.getMilliseconds())
	const offsetMin = -date.getTimezoneOffset()
	const sign = offsetMin >= 0 ? '+' : '-'
	const abs = Math.abs(offsetMin)
	const oh = pad2(Math.floor(abs / 60))
	const om = pad2(abs % 60)
	return `${y}-${m}-${d}T${h}:${min}:${sec}.${ms}${sign}${oh}:${om}`
}

/** id format TEST_YYMMDDhhmmss (local time). */
function buildTestMessageId(date: Date) {
	const yy = String(date.getFullYear()).slice(-2)
	return `TEST_${yy}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
}

function buildChatWebhookBody(text: string) {
	const now = new Date()
	return {
		text,
		textFormat: 'plain',
		attachments: [
			{
				contentType: 'text/html',
				content: `<p>${escapeHtml(text)}</p>`,
			},
		],
		type: 'test-message',
		timestamp: toIsoUtc(now),
		localTimestamp: toIsoLocalWithOffset(now),
		id: buildTestMessageId(now),
		from: {
			id: 'hraxpro_test',
			name: 'Test Account',
		},
	}
}

/** Expects JSON `{ "response": "response text" }`. */
function parseWebhookChatResponse(raw: string): string | null {
	const trimmed = raw.trim()
	if (!trimmed) return null
	try {
		const data = JSON.parse(trimmed) as { response?: unknown }
		if (typeof data.response !== 'string') return null
		return data.response
	} catch {
		return null
	}
}

interface DashboardChatSideProps {
	language: string
}

export default function DashboardChatSide({ language }: DashboardChatSideProps) {
	const isKo = language === 'ko'
	const { currentProfile } = useProfile()

	const botAvatarSrc = useMemo(() => {
		const fromProfile = currentProfile?.avatarUrl?.trim()
		if (fromProfile) return fromProfile
		try {
			const stored = localStorage.getItem(PROFILE_AVATAR_STORAGE)?.trim()
			if (stored) return stored
		} catch {
			/* ignore */
		}
		return DEFAULT_AVATAR
	}, [currentProfile?.avatarUrl])

	const [collapsed, setCollapsed] = useState(() => {
		try {
			return localStorage.getItem(STORAGE_KEY) === '1'
		} catch {
			return false
		}
	})
	const [messages, setMessages] = useState<ChatMessage[]>(() => [
		{
			id: uid(),
			role: 'assistant',
			text: isKo
				? '안녕하세요. TecAce의 HR AX PRO 챗 어시스턴트입니다. 질문을 입력하여 시작해 주세요.'
				: 'Hi — this is the HR AX PRO chat assistant for TecAce. Ask a question to get started.',
			createdAt: Date.now(),
		},
	])
	const [draft, setDraft] = useState('')
	const [isSending, setIsSending] = useState(false)
	const listRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
		} catch {
			/* ignore */
		}
	}, [collapsed])

	const toggleCollapsed = useCallback(() => {
		setCollapsed((c) => !c)
	}, [])

	const expandChat = useCallback(() => setCollapsed(false), [])

	const onInnerKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			if (!collapsed) return
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				expandChat()
			}
		},
		[collapsed, expandChat]
	)

	useEffect(() => {
		if (collapsed || !listRef.current) return
		listRef.current.scrollTop = listRef.current.scrollHeight
	}, [messages, collapsed])

	const send = useCallback(
		async (e: FormEvent) => {
			e.preventDefault()
			const text = draft.trim()
			if (!text || isSending) return
			setDraft('')
			const userMsg: ChatMessage = { id: uid(), role: 'user', text, createdAt: Date.now() }
			setMessages((prev) => [...prev, userMsg])
			setIsSending(true)
			try {
				const res = await fetch(DASHBOARD_CHAT_WEBHOOK_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(buildChatWebhookBody(text)),
				})
				if (!res.ok) {
					throw new Error(`${res.status} ${res.statusText}`)
				}
				const raw = await res.text()
				const responseText = parseWebhookChatResponse(raw)
				const assistantText =
					responseText === null
						? isKo
							? '응답 형식을 읽을 수 없습니다.'
							: 'Could not read the assistant response.'
						: responseText.trim() ||
							(isKo ? '(응답이 비어 있습니다.)' : '(Empty response.)')
				setMessages((prev) => [
					...prev,
					{
						id: uid(),
						role: 'assistant',
						text: assistantText,
						createdAt: Date.now(),
					},
				])
			} catch (err) {
				console.error('Dashboard chat webhook:', err)
				setMessages((prev) => [
					...prev,
					{
						id: uid(),
						role: 'assistant',
						text: isKo
							? '메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
							: 'Could not send your message. Please try again.',
						createdAt: Date.now(),
					},
				])
			} finally {
				setIsSending(false)
			}
		},
		[draft, isKo, isSending]
	)

	return (
		<aside
			className={`side chat-side${collapsed ? ' chat-side--collapsed' : ''}`}
			aria-label={collapsed ? undefined : isKo ? '채팅 패널' : 'Chat panel'}
		>
			<div
				className="chat-side-inner"
				role={collapsed ? 'button' : undefined}
				tabIndex={collapsed ? 0 : undefined}
				aria-label={collapsed ? (isKo ? '채팅 패널 펼치기' : 'Expand chat panel') : undefined}
				onClick={collapsed ? expandChat : undefined}
				onKeyDown={collapsed ? onInnerKeyDown : undefined}
			>
				<div className="chat-side-toolbar">
					{!collapsed && (
						<div className="chat-side-title section-title">
							<MessageSquare size={18} strokeWidth={2} aria-hidden className="chat-side-title-icon" />
							<span className="section-title-text">{isKo ? '채팅' : 'Chat'}</span>
						</div>
					)}
					{collapsed ? (
						<div className="chat-side-collapsed-icon" aria-hidden>
							<MessageSquare size={18} strokeWidth={2} className="chat-side-title-icon" />
						</div>
					) : (
						<button
							type="button"
							className="chat-side-collapse-btn icon-btn"
							onClick={toggleCollapsed}
							aria-expanded
							aria-label={isKo ? '채팅 패널 접기' : 'Collapse chat panel'}
						>
							<ChevronLeft size={18} strokeWidth={2} aria-hidden />
						</button>
					)}
				</div>

				{!collapsed && (
					<>
						<div className="chat-side-messages" ref={listRef} role="log" aria-live="polite">
							{messages.map((m) =>
								m.role === 'assistant' ? (
									<div key={m.id} className="chat-message-row chat-message-row--assistant">
										<img
											src={botAvatarSrc}
											alt=""
											className="chat-side-bot-avatar"
											width={32}
											height={32}
											decoding="async"
										/>
										<div className="chat-bubble chat-bubble--assistant">{m.text}</div>
									</div>
								) : (
									<div key={m.id} className="chat-message-row chat-message-row--user">
										<div className="chat-bubble chat-bubble--user">{m.text}</div>
									</div>
								)
							)}
						</div>
						<form className="chat-side-composer" onSubmit={send}>
							<div className="search-control chat-side-search-control">
								<div className="search-input-wrapper">
									<input
										type="text"
										className="input"
										placeholder={isKo ? '메시지를 입력…' : 'Type a message…'}
										value={draft}
										onChange={(e) => setDraft(e.target.value)}
										autoComplete="off"
									/>
								</div>
							</div>
							<button
								type="submit"
								className="btn btn-primary export-btn chat-side-send"
								disabled={!draft.trim() || isSending}
								aria-label={isKo ? '전송' : 'Send'}
								title={isKo ? '전송' : 'Send'}
							>
								<Send size={16} strokeWidth={2} aria-hidden />
							</button>
						</form>
					</>
				)}
			</div>
		</aside>
	)
}
