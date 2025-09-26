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

// Generic proxy handler
async function proxyRequest(req, res, targetUrl, options = {}) {
  try {
    console.log(`🔗 Proxying ${req.method} request to:`, targetUrl)
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }
    
    // Forward original headers if needed
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization
    }
    
    // Make the request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.json().catch(() => ({}))
    
    if (!response.ok) {
      console.error(`❌ API error (${response.status}):`, data)
      return res.status(response.status).json(data)
    }

    console.log(`✅ API success`)
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
}

// RAG API Proxy
app.post('/rag-api', async (req, res) => {
  if (!RAG_API_KEY) {
    return res.status(500).json({
      error: {
        code: 'NO_API_KEY',
        message: 'RAG API key is not configured'
      }
    })
  }

  await proxyRequest(req, res, RAG_API_URL, {
    headers: {
      'Authorization': `Bearer ${RAG_API_KEY}`,
    }
  })
})

// Main API Proxy (monitor.assistace.tecace.com)
app.use('/api', async (req, res) => {
  const targetUrl = `https://monitor.assistace.tecace.com${req.url}`
  await proxyRequest(req, res, targetUrl)
})

// Prompt API Proxy (botda0313.azurewebsites.net)
app.use('/prompt-api', async (req, res) => {
  // Rewrite path: /prompt-api/xyz -> /api/xyz
  const rewrittenPath = req.url.replace(/^\//, '/api/')
  const targetUrl = `https://botda0313.azurewebsites.net${rewrittenPath}`
  await proxyRequest(req, res, targetUrl)
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
