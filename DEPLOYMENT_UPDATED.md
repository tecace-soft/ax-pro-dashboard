# Complete Deployment Configuration for All API Proxies

## Problem Solved
The application was experiencing API failures in production because ALL API endpoints (not just RAG) were trying to make direct calls that don't work in production environments. The Vite proxy configuration only works in development.

## Solution
Updated the Express.js proxy server to handle ALL API endpoints:
1. `/api/*` → `https://monitor.assistace.tecace.com/*` (auth, sessions, requests)
2. `/prompt-api/*` → `https://botda0313.azurewebsites.net/api/*` (prompt management)  
3. `/rag-api` → `https://hr-ax-pro-rag-management.eastus2.inference.ml.azure.com/score` (RAG management)

## Files Changed
- `server.js` - Updated Express proxy server to handle all API endpoints
- `package.json` - Added Express dependencies and updated start script
- `src/lib/ragApi.ts` - Updated to always use proxy endpoint
- `src/services/ragManagement.ts` - Updated to always use proxy endpoint

## Render Deployment Setup

### 1. Environment Variables
In your Render service, set these environment variables:

```
VITE_RAG_API_URL=https://hr-ax-pro-rag-management.eastus2.inference.ml.azure.com/score
VITE_RAG_API_KEY=your_actual_api_key_here
NODE_ENV=production
```

### 2. Build Command
```bash
npm install && npm run build
```

### 3. Start Command
```bash
npm start
```

### 4. Deploy from Repository
Make sure all the changed files are committed and pushed to your repository, then redeploy on Render.

## Local Development
Development continues to work as before:
- `npm run dev` - Start Vite dev server with proxy
- `npm run build` - Build for production
- `npm start` - Run production server locally (after build)

## How It Works

### Development Mode (`npm run dev`)
```
Browser → Vite Dev Server (proxy) → External APIs
```

### Production Mode (`npm start`)
```
Browser → Express Server (proxy) → External APIs
```

All endpoints now use the same proxy pattern in both development and production.

## API Endpoint Mapping

| Frontend Call | Development (Vite) | Production (Express) | Target |
|---------------|-------------------|---------------------|---------|
| `/api/*` | Vite proxy | Express proxy | `monitor.assistace.tecace.com/*` |
| `/prompt-api/*` | Vite proxy | Express proxy | `botda0313.azurewebsites.net/api/*` |
| `/rag-api` | Vite proxy | Express proxy | `hr-ax-pro-rag-management.eastus2.inference.ml.azure.com/score` |

## Testing
1. Build the application: `npm run build`
2. Start production server: `npm start`
3. Test all functionality:
   - Recent Conversations (uses `/api`)
   - Admin Feedback (uses Supabase - direct)
   - Prompt Control (uses `/prompt-api`)
   - RAG Management (uses `/rag-api`)
4. Check server logs for proxy activity
5. Check browser console for errors (should be none)

## Troubleshooting

### If Recent Conversations/Admin Feedback still doesn't work:
1. Check server logs for proxy errors
2. Verify the main API endpoint `monitor.assistace.tecace.com` is accessible
3. Check that authentication is working properly

### If Prompt Control doesn't work:
1. Check server logs for `/prompt-api` proxy errors
2. Verify `botda0313.azurewebsites.net` is accessible
3. Check if the path rewriting is working correctly

### If RAG Management doesn't work:
1. Verify `VITE_RAG_API_KEY` is set correctly in Render environment
2. Check server logs for `/rag-api` proxy errors
3. Verify the Azure ML endpoint is accessible

### General debugging:
1. Check server logs for detailed proxy information
2. Use browser dev tools to inspect network requests
3. Verify all environment variables are set in Render
4. Ensure the start command is `npm start` (not `npm run preview`)

## Important Notes
- The Express server now handles ALL API proxying, not just RAG
- All existing functionality should work exactly as in development
- No changes needed to frontend code beyond what was already done
- Supabase calls are direct (not proxied) and should continue working normally
