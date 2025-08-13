import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
	const [code, setCode] = useState('')
	const [error, setError] = useState('')
	const navigate = useNavigate()

	function onSubmit(e: FormEvent) {
		e.preventDefault()
		const normalized = code.trim().toLowerCase()
		if (normalized === 'tecace') {
			sessionStorage.setItem('axAccess', 'tecace')
			navigate('/dashboard', { replace: true })
			return
		}
		setError('Invalid access code')
	}

	return (
		<div className="screen">
			<div className="card login-card">
				<div className="app-title">TecAce Ax Pro</div>
				<p className="muted">Enter access code to continue</p>
				<form onSubmit={onSubmit} className="login-form">
					<input
						type="password"
						inputMode="text"
						placeholder="Access code"
						className="input"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						autoFocus
					/>
					<button className="btn btn-primary" type="submit">Login</button>
				</form>
				{error && <div className="error" role="alert">{error}</div>}
			</div>
		</div>
	)
} 