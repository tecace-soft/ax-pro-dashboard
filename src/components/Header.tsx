import { useEffect, useRef, useState } from 'react'
import {
	Menu,
	BarChart3,
	FileText,
	HelpCircle,
	MessageSquare,
	Settings,
	BookOpen,
	Mail,
	LogOut,
} from 'lucide-react'
import { IconBell, IconMoon, IconUser } from '../ui/icons'
import { useNavigate, useLocation } from 'react-router-dom'

interface HeaderProps {
	performanceScore: number
	performanceDate?: string
	currentTime: string
	onSignOut: () => void
	/** Any user_feedback with read === false (dashboard). */
	userFeedbackHasUnread?: boolean
}

export default function Header({
	performanceScore,
	performanceDate,
	currentTime,
	onSignOut,
	userFeedbackHasUnread = false,
}: HeaderProps) {
	const navigate = useNavigate()
	const location = useLocation()
	const [menuOpen, setMenuOpen] = useState(false)
	const menuWrapRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!menuOpen) return
		const onDocMouseDown = (e: MouseEvent) => {
			if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
				setMenuOpen(false)
			}
		}
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setMenuOpen(false)
		}
		document.addEventListener('mousedown', onDocMouseDown)
		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.removeEventListener('mousedown', onDocMouseDown)
			document.removeEventListener('keydown', onKeyDown)
		}
	}, [menuOpen])

	const getPerformanceLabel = (score: number) => {
		if (score >= 90) return 'Excellent'
		if (score >= 80) return 'Good'
		if (score >= 70) return 'Fair'
		return 'Poor'
	}

	const handleLogoClick = () => {
		navigate('/dashboard')
	}

	const closeMenu = () => setMenuOpen(false)

	const goPerformanceOverview = () => {
		navigate('/dashboard?section=performance-overview')
		setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
		closeMenu()
	}

	const goSection = (section: string) => {
		navigate(`/dashboard?section=${section}`)
		closeMenu()
	}

	const goPath = (path: string) => {
		navigate(path)
		closeMenu()
	}

	const handleSignOut = () => {
		closeMenu()
		onSignOut()
	}

	const navItemClass = (pathPrefix: string, section?: string) => {
		if (location.pathname === '/dashboard') {
			const q = new URLSearchParams(location.search).get('section')
			if (section === 'performance-overview') {
				if (q === 'performance-overview' || q === 'performance-radar' || q === 'daily-message-activity') {
					return 'header-nav-item header-nav-item--active'
				}
			}
			if (section === 'recent-conversations') {
				if (q === null || q === '' || q === 'recent-conversations') {
					return 'header-nav-item header-nav-item--active'
				}
			}
			if (section && q === section) return 'header-nav-item header-nav-item--active'
		}
		if (location.pathname === pathPrefix && !section) return 'header-nav-item header-nav-item--active'
		return 'header-nav-item'
	}

	return (
		<header className="dashboard-header">
			<div className="header-left">
				<div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
					<div className="logo-hexagon">
						<div className="hexagon-outer">
							<div className="hexagon-inner" />
						</div>
					</div>
					<span className="logo-text">TecAce Ax Pro</span>
				</div>
			</div>

			<div className="header-right">
				<div className="performance-indicator">
					<span className="performance-text">
						TecAce Ax Pro: {performanceScore}% ({getPerformanceLabel(performanceScore)}
						{performanceDate ? `, ${performanceDate}` : ''})
					</span>
					<span className="current-time">{currentTime}</span>
				</div>

				<div className="header-actions">
					<button type="button" className="icon-btn" aria-label="Notifications">
						<IconBell size={18} />
					</button>
					<button type="button" className="icon-btn" aria-label="Toggle theme">
						<IconMoon size={18} />
					</button>
					<button type="button" className="icon-btn" aria-label="User profile">
						<IconUser size={18} />
					</button>

					<div className="header-nav-menu-wrap" ref={menuWrapRef}>
						<button
							type="button"
							className={`icon-btn header-nav-menu-btn${menuOpen ? ' is-open' : ''}`}
							aria-label="Open navigation menu"
							aria-expanded={menuOpen}
							aria-haspopup="true"
							aria-controls="header-nav-menu"
							onClick={() => setMenuOpen((v) => !v)}
						>
							<Menu size={18} strokeWidth={2} aria-hidden />
						</button>

						{menuOpen ? (
							<div
								id="header-nav-menu"
								className="header-nav-dropdown"
								role="menu"
								aria-label="Site navigation"
							>
								<button
									type="button"
									className={navItemClass('/dashboard', 'performance-overview')}
									role="menuitem"
									onClick={goPerformanceOverview}
								>
									<BarChart3 size={18} strokeWidth={2} aria-hidden />
									<span>Performance Overview</span>
								</button>
								<button
									type="button"
									className={navItemClass('/dashboard', 'recent-conversations')}
									role="menuitem"
									onClick={() => goSection('recent-conversations')}
								>
									<FileText size={18} strokeWidth={2} aria-hidden />
									<span>Recent Conversations</span>
								</button>
								<button
									type="button"
									className={navItemClass('/dashboard', 'admin-feedback')}
									role="menuitem"
									onClick={() => goSection('admin-feedback')}
								>
									<HelpCircle size={18} strokeWidth={2} aria-hidden />
									<span>FAQ (High Priority FAQ)</span>
								</button>
								<button
									type="button"
									className={navItemClass('/dashboard', 'user-feedback')}
									role="menuitem"
									onClick={() => goSection('user-feedback')}
								>
									<MessageSquare size={18} strokeWidth={2} aria-hidden />
									<span className="header-nav-item-label">
										User Feedback
										{userFeedbackHasUnread ? (
											<span className="nav-unread-dot" title="Unread user feedback" aria-hidden />
										) : null}
									</span>
								</button>
								<button
									type="button"
									className={navItemClass('/dashboard', 'prompt-control')}
									role="menuitem"
									onClick={() => goSection('prompt-control')}
								>
									<Settings size={18} strokeWidth={2} aria-hidden />
									<span>Prompt Control</span>
								</button>
								<button
									type="button"
									className={navItemClass('/knowledge-management')}
									role="menuitem"
									onClick={() => goPath('/knowledge-management')}
								>
									<BookOpen size={18} strokeWidth={2} aria-hidden />
									<span>Knowledge Management</span>
								</button>
								<button
									type="button"
									className={navItemClass('/email-agent')}
									role="menuitem"
									onClick={() => goPath('/email-agent')}
								>
									<Mail size={18} strokeWidth={2} aria-hidden />
									<span>Email Agent</span>
								</button>

								<div className="header-nav-divider" role="separator" />

								<button
									type="button"
									className="header-nav-item header-nav-item--signout"
									role="menuitem"
									onClick={handleSignOut}
								>
									<LogOut size={18} strokeWidth={2} aria-hidden />
									<span>Sign out</span>
								</button>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</header>
	)
}
