# Knowledge Management User Guide

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [File Library](#file-library)
4. [Knowledge Index](#knowledge-index)
5. [Sync Overview](#sync-overview)
6. [Dashboard Search](#dashboard-search)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Overview

The Knowledge Management system is a comprehensive solution for managing your organization's documents and knowledge base. It allows you to upload, organize, index, and search through various types of documents to provide intelligent responses to user queries.

### Key Features
- **File Library**: Upload and manage documents (PDF, DOCX, TXT, XLSX, etc.)
- **Knowledge Index**: Search and browse indexed content
- **Sync Overview**: Monitor synchronization between files and search index
- **Dashboard Search**: Search across all sources (conversations, feedback, knowledge)
- **Multi-language Support**: English and Korean interface

---

## Getting Started

### Accessing Knowledge Management
1. Navigate to the main dashboard
2. Click on **"Knowledge Management"** in the sidebar menu
3. You'll see three main tabs:
   - **File Library**: Manage your document files
   - **Knowledge Index**: Browse indexed content
   - **Sync Overview**: Monitor sync status

### Language Selection
- Click the language toggle button (EN/한국어) in the top-right corner
- The interface will switch between English and Korean
- All guidance text and labels will update accordingly

---

## File Library

The File Library is where you manage all your document files before they are indexed for search.

### Uploading Files
1. Click the **"Upload Files"** button
2. Select one or more files from your computer
3. Supported formats: PDF, DOCX, TXT, XLSX, PPTX, and more
4. Files will be uploaded to the cloud storage

### Managing Files
- **View**: Click the eye icon to preview file information
- **Download**: Click the download icon to save files locally
- **Delete**: Click the trash icon to remove files
- **Sync Status**: Check if files are indexed (green checkmark = synced, red X = needs indexing)

### Search Files
- Use the search box to find files by name
- Search is case-insensitive and supports partial matches
- Clear search by clicking the "×" button

### File Information
Each file shows:
- **File Name**: Original filename
- **Size**: File size in bytes/KB/MB
- **Last Modified**: Upload or modification date
- **Content Type**: MIME type (e.g., application/pdf)
- **Sync Status**: Whether the file is indexed

---

## Knowledge Index

The Knowledge Index contains all the content that has been processed and indexed for search.

### Browsing Indexed Content
1. Navigate to the **"Knowledge Index"** tab
2. View the list of indexed documents
3. Use pagination to browse through large datasets
4. Adjust items per page (default: 200)

### Searching Content
- Use the search box to find specific content
- Search across:
  - Document titles
  - File paths
  - Content text
  - Chunk IDs
- Search is case-insensitive and supports partial matches

### Viewing Content
1. Click the **"View"** button (eye icon) next to any document
2. A modal will open showing:
   - Document metadata
   - Full content preview
   - File information
3. Content loads automatically when the modal opens
4. Close the modal by clicking the "×" button

### Sync Status
- **Synced**: Document is properly indexed and searchable
- **Orphaned**: Document exists in index but source file is missing
- **Needs Indexing**: File exists but not yet indexed

### Pagination
- Use the pagination controls at the bottom
- Navigate between pages using arrow buttons
- Jump to specific pages using the page input
- Adjust items per page using the dropdown

---

## Sync Overview

The Sync Overview provides a comprehensive view of the synchronization status between your files and the search index.

### Understanding Sync Status
- **Synced**: File exists in both storage and index
- **Orphaned**: Content exists in index but source file is missing
- **Needs Indexing**: File exists but not yet processed

### Monitoring Sync
1. Navigate to the **"Sync Overview"** tab
2. View the sync status table
3. Check the last updated timestamp
4. Use the refresh button to update status

### Searching Sync Status
- Use the search box to filter by filename
- Search is case-insensitive
- Clear search to show all items

### Actions
- **Download**: Download files directly from the sync overview
- **Navigate**: Click sync status indicators to jump to other tabs

---

## Dashboard Search

The Dashboard Search allows you to search across all sources of information in your system.

### Search Sources
- **All Sources**: Search everywhere (default)
- **Recent Conversations**: Search chat history
- **User Feedback**: Search feedback data
- **Knowledge Base**: Search documents and policies

### Performing a Search
1. Go to the main dashboard
2. In the left sidebar, select your search scope
3. Type your search query in the search box
4. Press Enter or click the search button
5. View results in the popup window

### Search Features
- **Keyword-based Search**: Automatically splits search terms
- **Multi-source Search**: Searches across conversations, feedback, and knowledge
- **Recent Searches**: Quick access to previous search terms
- **Real-time Results**: Results appear as you type

### Search Results
Results are categorized by source:
- **Conversations**: Chat messages and AI responses
- **Feedback**: User feedback and comments
- **Knowledge**: Document content and metadata

Each result shows:
- Source type and timestamp
- Relevant content snippet
- Match type (user message, AI response, etc.)

---

## Troubleshooting

### Common Issues

#### Files Not Syncing
- **Problem**: Files uploaded but showing as "Needs Indexing"
- **Solution**: 
  1. Wait a few minutes for processing
  2. Click the refresh button
  3. Check if the file format is supported
  4. Contact administrator if issue persists

#### Search Not Working
- **Problem**: Search returns no results
- **Solution**:
  1. Check if files are properly synced
  2. Try different search terms
  3. Verify search scope selection
  4. Clear browser cache and refresh

#### Content Not Loading
- **Problem**: Content preview shows loading indefinitely
- **Solution**:
  1. Check internet connection
  2. Refresh the page
  3. Try opening the content again
  4. Contact support if problem continues

#### Upload Failures
- **Problem**: Files fail to upload
- **Solution**:
  1. Check file size (max 100MB recommended)
  2. Verify file format is supported
  3. Check internet connection
  4. Try uploading one file at a time

### Error Messages
- **"File too large"**: Reduce file size or split into smaller files
- **"Unsupported format"**: Convert to supported format (PDF, DOCX, TXT)
- **"Upload failed"**: Check connection and try again
- **"Sync error"**: Contact administrator for assistance

---

## Best Practices

### File Organization
1. **Use descriptive filenames**: Include relevant keywords
2. **Organize by category**: Group related documents
3. **Regular cleanup**: Remove outdated files
4. **Consistent naming**: Follow a naming convention

### Search Optimization
1. **Use specific keywords**: More specific searches yield better results
2. **Try different terms**: If one search doesn't work, try synonyms
3. **Use recent searches**: Leverage the recent searches feature
4. **Check sync status**: Ensure files are properly indexed

### Content Management
1. **Regular indexing**: Monitor sync status regularly
2. **Quality content**: Upload well-formatted, readable documents
3. **Update regularly**: Keep content current and relevant
4. **Monitor usage**: Check which content is accessed most

### Performance Tips
1. **Batch uploads**: Upload multiple files at once for efficiency
2. **Use search filters**: Narrow down results with specific searches
3. **Regular maintenance**: Clean up orphaned or outdated content
4. **Monitor system status**: Check sync overview regularly

---

## Support and Contact

### Getting Help
- Check this documentation first
- Use the troubleshooting section
- Contact your system administrator
- Report bugs through the feedback system

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Stable internet connection
- JavaScript enabled
- Pop-up blockers disabled for this site

### Data Security
- All uploaded files are stored securely
- Access is controlled by user permissions
- Regular backups are performed
- Data is encrypted in transit and at rest

---

## Version Information

- **Current Version**: 1.0
- **Last Updated**: January 2025
- **Compatible Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Support**: Responsive design for tablets and mobile devices

---

*This documentation is regularly updated. Please check for the latest version and updates.*

