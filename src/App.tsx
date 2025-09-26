import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RAGManagement from './pages/RAGManagement'
import ApiTest from './debug/ApiTest'
import ScrollToTop from './components/ScrollToTop'
import { ProfileProvider } from './contexts/ProfileContext';

function useIsAuthenticated(): boolean {
	return typeof window !== 'undefined' && sessionStorage.getItem('axAccess') === 'tecace'
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
		<ProfileProvider>
			<Routes>
				<Route path="/" element={<Login />} />
				<Route element={<Protected />}>
					<Route path="/dashboard" element={<Dashboard />} />
					<Route path="/rag-management" element={<RAGManagement />} />
					<Route path="/api-test" element={<ApiTest />} />
				</Route>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
			<ScrollToTop />
		</ProfileProvider>
	)
} 