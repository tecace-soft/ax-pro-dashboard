import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import DashboardN8N from './pages/DashboardN8N'
import EmailAgent from './pages/EmailAgent'
import RAGManagementN8N from './pages/RAGManagementN8N'
import ScrollToTop from './components/ScrollToTop'
import { ProfileProvider } from './contexts/ProfileContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { ThemeProvider } from './contexts/ThemeContext'

function useIsAuthenticated(): boolean {
	const access = sessionStorage.getItem('axAccess')
	return typeof window !== 'undefined' && access === 'n8n'
}

function Protected() {
	const isAuthed = useIsAuthenticated()
	const location = useLocation()
	if (!isAuthed) {
		return <Navigate to="/" replace state={{ from: location }} />
	}
	return <Outlet />
}

export default function App() {
	return (
		<ThemeProvider>
			<LanguageProvider>
				<ProfileProvider>
					<Routes>
						<Route path="/" element={<Login />} />
						<Route element={<Protected />}>
							<Route path="/dashboard-n8n" element={<Navigate to="/dashboard" replace />} />
							<Route path="/dashboard" element={<DashboardN8N />} />
							<Route path="/rag-n8n" element={<Navigate to="/knowledge-management" replace />} />
							<Route path="/rag-management" element={<Navigate to="/knowledge-management" replace />} />
							<Route path="/knowledge-management" element={<RAGManagementN8N />} />
							<Route path="/email-agent" element={<EmailAgent />} />
						</Route>
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
					<ScrollToTop />
				</ProfileProvider>
			</LanguageProvider>
		</ThemeProvider>
	)
}
