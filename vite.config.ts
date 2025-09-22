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
				target: 'https://botda0313.azurewebsites.net', // Production Environment
				// target: 'http://localhost:3978', // Test Environment
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/prompt-api/, '/api')
			},
			'/rag-api': {
				target: 'https://hr-ax-pro-rag-management.eastus2.inference.ml.azure.com',
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/rag-api/, '/score')
			}
		}
	},
	build: {
		outDir: 'dist',
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ['react', 'react-dom'],
					supabase: ['@supabase/supabase-js']
				}
			}
		}
	},
	preview: {
		host: '0.0.0.0',
		port: process.env.PORT ? parseInt(process.env.PORT) : 4173,
		allowedHosts: true
	}
}) 