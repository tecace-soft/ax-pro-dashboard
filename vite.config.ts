import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			'/api': {
				target: 'https://monitor.assistace.tecace.com',
				changeOrigin: true,
				secure: true,
			},
			'/prompt-api': {
				target: 'http://localhost:3978',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/prompt-api/, '/api')
			}
		}
	}
}) 