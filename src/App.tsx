import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
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
		<Routes>
			<Route path="/" element={<Login />} />
			<Route element={<Protected />}>
				<Route path="/dashboard" element={<Dashboard />} />
			</Route>
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	)
} 