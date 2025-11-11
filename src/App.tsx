import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardN8N from './pages/DashboardN8N'
import RAGManagement from './pages/RAGManagement'
import RAGManagementN8N from './pages/RAGManagementN8N'
import ScrollToTop from './components/ScrollToTop'
import { ProfileProvider } from './contexts/ProfileContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';

function useIsAuthenticated(): boolean {
	const access = sessionStorage.getItem('axAccess')
	return typeof window !== 'undefined' && (access === 'tecace' || access === 'n8n')
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
							<Route path="/dashboard" element={<Dashboard />} />
							<Route path="/dashboard-n8n" element={<DashboardN8N />} />
							<Route path="/rag-management" element={<RAGManagement />} />
							<Route path="/rag-n8n" element={<RAGManagementN8N />} />
						</Route>
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
					<ScrollToTop />
				</ProfileProvider>
			</LanguageProvider>
		</ThemeProvider>
	)
} 