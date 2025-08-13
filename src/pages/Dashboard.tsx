import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconGear, IconLogout, IconX } from '../ui/icons'
import '../styles/dashboard.css'

export default function Dashboard() {
	const navigate = useNavigate()
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)

	function signOut() {
		sessionStorage.removeItem('axAccess')
		navigate('/', { replace: true })
	}

	return (
		<div className="screen">
			<header className="topbar">
				<div className="brand">TecAce Ax Pro</div>
				<div className="header-actions">
					<button className="icon-btn" aria-label="Open settings" title="Settings" onClick={() => setIsSettingsOpen(true)}>
						<IconGear />
					</button>
					<button className="icon-btn" aria-label="Sign out" title="Sign out" onClick={signOut}>
						<IconLogout />
					</button>
				</div>
			</header>
			<main className="content">
				<div className="card">
					<h1 className="h1">Dashboard</h1>
					<p className="muted">This is a placeholder. We will build HR insights here.</p>
				</div>
			</main>

			{isSettingsOpen && (
				<div className="modal-backdrop" role="dialog" aria-modal="true">
					<div className="modal card">
						<div className="modal-header">
							<h2 className="h1 modal-title">Settings</h2>
							<button className="icon-btn" aria-label="Close settings" title="Close" onClick={() => setIsSettingsOpen(false)}>
								<IconX />
							</button>
						</div>
						<div className="muted">Settings content will go here.</div>
					</div>
				</div>
			)}
		</div>
	)
} 