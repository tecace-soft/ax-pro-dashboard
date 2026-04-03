import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import EmailAgentPromptControl from '../components/EmailAgentPromptControl'
import EmailAgentRecipients from '../components/EmailAgentRecipients'
import { useLanguage } from '../contexts/LanguageContext'
import '../styles/dashboard.css'

export default function EmailAgent() {
	const { language } = useLanguage()
	const navigate = useNavigate()
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	const currentTime = new Date().toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	})
	const performanceScore = 89
	const performanceDate = new Date().toLocaleDateString()

	useEffect(() => {
		window.scrollTo(0, 0)
	}, [])

	const signOut = () => {
		localStorage.removeItem('authToken')
		sessionStorage.removeItem('axAccess')
		navigate('/', { replace: true })
	}

	const scrollToConversations = () => {
		navigate('/dashboard?section=recent-conversations')
	}

	const scrollToSection = (sectionId: string) => {
		navigate(`/dashboard?section=${sectionId}`)
	}

	return (
		<div className="dashboard-layout">
			<Header
				performanceScore={performanceScore}
				performanceDate={performanceDate}
				currentTime={currentTime}
				onSignOut={signOut}
			/>
			<div className="dashboard-content">
				<Sidebar
					conversations={0}
					satisfaction={94.5}
					documents={0}
					performanceScore={performanceScore}
					performanceDate={performanceDate}
					activeFilters={[]}
					onFilterChange={() => {}}
					onSearch={() => {}}
					isCollapsed={sidebarCollapsed}
					onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
					onScrollToConversations={scrollToConversations}
					onScrollToSection={scrollToSection}
					sessions={[]}
					sessionRequests={{}}
					requestDetails={{}}
				/>
				<main className="dashboard-main">
					<div className="content-module" style={{ padding: '24px' }}>
						<h1 className="h1" style={{ marginBottom: '8px' }}>
							{language === 'ko' ? '이메일 에이전트' : 'Email Agent'}
						</h1>
						<p
							className="muted"
							style={{
								marginBottom: '24px',
								textAlign: 'left',
								padding: 0,
								width: '100%',
							}}
						>
							{language === 'ko'
								? '어제의 채팅 메시지와 아래에 정의된 추출 프롬프트를 바탕으로 수신자, 제목, 본문이 포함된 이메일이 생성되어 매일 발송됩니다.'
								: "Based on yesterday's chat messages and the extraction prompt defined below an email (recipient, subject, and content) will be generated and sent daily."}
						</p>
						<div className="content-section">
							<EmailAgentRecipients />
						</div>
						<div className="content-section">
							<EmailAgentPromptControl />
						</div>
					</div>
				</main>
			</div>
		</div>
	)
}
