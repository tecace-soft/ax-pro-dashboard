# Knowledge Management - Technical Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [API Reference](#api-reference)
3. [Database Schema](#database-schema)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Monitoring](#monitoring)
7. [Security](#security)
8. [Troubleshooting](#troubleshooting)

---

## System Architecture

### Overview
The Knowledge Management system is built on a modern React-based frontend with a Node.js/Express backend, integrated with Azure services for document storage and search capabilities.

### Components

#### Frontend (React + TypeScript)
- **Dashboard**: Main application interface
- **Knowledge Management**: Document management interface
- **Search Engine**: Multi-source search functionality
- **File Upload**: Drag-and-drop file upload system

#### Backend Services
- **RAG API**: Document processing and indexing
- **Blob Storage**: Azure Blob Storage for file management
- **Search Index**: Azure Cognitive Search for content search
- **Authentication**: Token-based authentication system

#### External Integrations
- **Azure Blob Storage**: File storage and management
- **Azure Cognitive Search**: Full-text search capabilities
- **Supabase**: Database and real-time features

---

## API Reference

### RAG Management API

#### Base URL
```
/rag-api
```

#### Authentication
All API requests require authentication via Bearer token:
```http
Authorization: Bearer <token>
```

#### Endpoints

##### List Documents
```http
POST /rag-api
Content-Type: application/json

{
  "op": "list_docs",
  "top": 50,
  "skip": 0,
  "select": "chunk_id,parent_id,title,filepath,content"
}
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "index": {
      "value": [
        {
          "chunk_id": "doc1_chunk1",
          "parent_id": "document1.pdf",
          "title": "Document Title",
          "filepath": "/documents/document1.pdf",
          "content": "Document content..."
        }
      ]
    }
  }
}
```

##### Search Documents
```http
POST /rag-api
Content-Type: application/json

{
  "op": "search",
  "q": "search query",
  "top": 20,
  "filter": "parent_id eq 'document1.pdf'",
  "select": "chunk_id,parent_id,title,filepath,content"
}
```

##### Upload File
```http
POST /rag-api
Content-Type: multipart/form-data

{
  "op": "blob_upload",
  "file": <file_data>,
  "name": "document.pdf"
}
```

##### Delete File
```http
POST /rag-api
Content-Type: application/json

{
  "op": "blob_delete",
  "name": "document.pdf"
}
```

##### Reindex File
```http
POST /rag-api
Content-Type: application/json

{
  "op": "reindex",
  "name": "document.pdf"
}
```

##### Clear Index
```http
POST /rag-api
Content-Type: application/json

{
  "op": "clear_by_parent",
  "name": "document.pdf"
}
```

### Error Handling

#### Common Error Codes
- **400**: Bad Request - Invalid parameters
- **401**: Unauthorized - Invalid or missing token
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource not found
- **424**: Failed Dependency - Backend service unavailable
- **500**: Internal Server Error - Server-side error

#### Error Response Format
```json
{
  "ok": false,
  "error": "Error message",
  "code": 400,
  "details": "Additional error details"
}
```

---

## Database Schema

### Supabase Tables

#### user_feedback
```sql
CREATE TABLE user_feedback (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  conversation_id VARCHAR(255) NOT NULL,
  reaction VARCHAR(50) NOT NULL,
  feedback_text TEXT,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  chat_message TEXT,
  chat_response TEXT
);
```

#### admin_feedback
```sql
CREATE TABLE admin_feedback (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(255) UNIQUE NOT NULL,
  feedback_verdict VARCHAR(10) NOT NULL CHECK (feedback_verdict IN ('good', 'bad')),
  feedback_text TEXT NOT NULL,
  corrected_response TEXT,
  prompt_apply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Azure Search Index Schema

#### Document Index
```json
{
  "name": "documents",
  "fields": [
    {
      "name": "chunk_id",
      "type": "Edm.String",
      "key": true,
      "searchable": true,
      "filterable": true
    },
    {
      "name": "parent_id",
      "type": "Edm.String",
      "searchable": false,
      "filterable": true,
      "sortable": true
    },
    {
      "name": "title",
      "type": "Edm.String",
      "searchable": true,
      "filterable": false,
      "sortable": true
    },
    {
      "name": "filepath",
      "type": "Edm.String",
      "searchable": false,
      "filterable": true,
      "sortable": true
    },
    {
      "name": "content",
      "type": "Edm.String",
      "searchable": true,
      "filterable": false,
      "sortable": false
    }
  ]
}
```

---

## Configuration

### Environment Variables

#### Frontend (.env)
```bash
VITE_API_BASE_URL=https://your-api-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Backend (.env)
```bash
AZURE_STORAGE_CONNECTION_STRING=your-azure-storage-connection-string
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_KEY=your-search-service-key
AZURE_SEARCH_INDEX_NAME=documents
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

### Azure Configuration

#### Blob Storage
- **Container**: `hr-ax-pro`
- **Access Level**: Private
- **CORS**: Enabled for web applications

#### Cognitive Search
- **Service Tier**: Standard
- **Replicas**: 1
- **Partitions**: 1
- **Indexing**: Automatic

---

## Deployment

### Prerequisites
- Node.js 18+
- npm or yarn
- Azure account with Blob Storage and Cognitive Search
- Supabase account

### Frontend Deployment
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to your hosting service
# (e.g., Vercel, Netlify, Azure Static Web Apps)
```

### Backend Deployment
```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm start
```

### Docker Deployment
```dockerfile
# Frontend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Monitoring

### Key Metrics
- **Upload Success Rate**: Percentage of successful file uploads
- **Index Sync Rate**: Percentage of files properly synced
- **Search Response Time**: Average search query response time
- **Error Rate**: Percentage of failed API requests

### Logging
- **Frontend**: Console logs for debugging
- **Backend**: Structured logging with Winston
- **Azure**: Application Insights integration

### Health Checks
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX T XX:XX:XX.XXXZ",
  "services": {
    "database": "healthy",
    "blob_storage": "healthy",
    "search_index": "healthy"
  }
}
```

---

## Security

### Authentication
- JWT tokens for API authentication
- Session-based authentication for web interface
- Token expiration and refresh mechanisms

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- API rate limiting

### Data Protection
- HTTPS encryption for all communications
- Data encryption at rest in Azure
- Secure file upload validation
- XSS and CSRF protection

### Security Headers
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

---

## Troubleshooting

### Common Issues

#### File Upload Failures
```bash
# Check Azure Storage connection
az storage account show --name your-storage-account

# Verify container permissions
az storage container show --name hr-ax-pro --account-name your-storage-account
```

#### Search Index Issues
```bash
# Check search service status
curl -H "api-key: YOUR_SEARCH_KEY" \
  "https://your-search-service.search.windows.net/indexes/documents/stats?api-version=2023-11-01"
```

#### Database Connection Issues
```sql
-- Check Supabase connection
SELECT version();

-- Verify table structure
\d user_feedback;
\d admin_feedback;
```

### Performance Optimization

#### Frontend
- Enable code splitting
- Implement lazy loading
- Optimize bundle size
- Use CDN for static assets

#### Backend
- Implement caching strategies
- Optimize database queries
- Use connection pooling
- Monitor memory usage

#### Azure Services
- Optimize search index configuration
- Implement blob storage tiering
- Monitor service quotas
- Set up auto-scaling

### Debugging Tools
- Browser Developer Tools
- React Developer Tools
- Azure Portal monitoring
- Supabase dashboard
- Application Insights

---

## API Testing

### Using cURL
```bash
# Test file upload
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf" \
  -F "op=blob_upload" \
  -F "name=document.pdf" \
  https://your-api-domain.com/rag-api

# Test search
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"op":"search","q":"test query","top":10}' \
  https://your-api-domain.com/rag-api
```

### Using Postman
1. Import the API collection
2. Set up environment variables
3. Configure authentication
4. Run test scenarios

---

## Maintenance

### Regular Tasks
- Monitor disk usage in Azure Storage
- Check search index health
- Review error logs
- Update dependencies
- Backup database

### Backup Strategy
- **Database**: Daily automated backups
- **Files**: Azure Storage redundancy
- **Configuration**: Version control
- **Code**: Git repository

### Update Procedures
1. Test in staging environment
2. Create backup
3. Deploy to production
4. Monitor for issues
5. Rollback if necessary

---

*This technical documentation is maintained by the development team. For updates or questions, contact the system administrators.*

