import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 4173

// Environment variables
const RAG_API_URL = process.env.VITE_RAG_API_URL || 'https://hr-ax-pro-rag-management.eastus2.inference.ml.azure.com/score'
const RAG_API_KEY = process.env.VITE_RAG_API_KEY

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// RAG API Proxy
app.post('/rag-api', async (req, res) => {
  try {
    console.log('🔗 Proxying RAG API request:', req.body)
    
    if (!RAG_API_KEY) {
      return res.status(500).json({
        error: {
          code: 'NO_API_KEY',
          message: 'RAG API key is not configured'
        }
      })
    }

    const response = await fetch(RAG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAG_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error('❌ RAG API error:', response.status, data)
      return res.status(response.status).json({
        error: {
          code: 'RAG_API_ERROR',
          message: `RAG API returned ${response.status}`,
          details: data
        }
      })
    }

    console.log('✅ RAG API success')
    res.json(data)
  } catch (error) {
    console.error('❌ Proxy error:', error)
    res.status(500).json({
      error: {
        code: 'PROXY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown proxy error'
      }
    })
  }
})

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')))

// Handle React Router (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 RAG API Proxy: /rag-api -> ${RAG_API_URL}`)
  console.log(`🔑 RAG API Key configured: ${!!RAG_API_KEY}`)
})
