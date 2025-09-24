import { useState, useEffect } from 'react'
import { IconUpload, IconTrash, IconRefresh, IconDownload, IconAlertTriangle } from '../../ui/icons'
import { listBlobs, deleteBlob, uploadBlobFile, BlobItem, RAGApiError } from '../../lib/ragApi'
import './BlobFiles.css'

interface BlobFilesProps {
  language?: 'en' | 'ko'
}

export default function BlobFiles({ language = 'en' }: BlobFilesProps) {
  const [blobs, setBlobs] = useState<BlobItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  // Language translations
  const t = {
    en: {
      title: 'Document Files',
      subtitle: 'Manage files in blob storage (list/upload/delete). Indexing is handled in the next section.',
      uploadArea: 'Drag text files here to upload or click to select',
      supportedFormats: 'Supported formats: .txt, .md, .json, .csv, .xml, .html, .css, .js, .ts',
      fileName: 'File Name',
      size: 'Size',
      lastModified: 'Last Modified',
      contentType: 'Content Type',
      actions: 'Actions',
      upload: 'Upload',
      delete: 'Delete',
      download: 'Download',
      refresh: 'Refresh',
      loading: 'Loading...',
      uploading: 'Uploading...',
          confirmDelete: 'Are you sure you want to delete this file?',
          deleteSuccess: 'File deleted successfully',
          deleteError: 'Failed to delete file',
          uploadSuccess: 'File uploaded successfully',
          uploadError: 'Failed to upload file',
          loadError: 'Failed to load files',
          noFiles: 'No files found',
          dragOver: 'Drop files here to upload'
    },
    ko: {
      title: '문서 파일',
      subtitle: 'Blob 저장소의 파일을 관리합니다 (목록/업로드/삭제). 인덱싱은 다음 섹션에서 처리됩니다.',
      uploadArea: '텍스트 파일을 드래그하여 업로드하거나 클릭하여 선택하세요',
      supportedFormats: '지원 형식: .txt, .md, .json, .csv, .xml, .html, .css, .js, .ts',
      fileName: '파일명',
      size: '크기',
      lastModified: '수정일',
      contentType: '콘텐츠 타입',
      actions: '액션',
      upload: '업로드',
      delete: '삭제',
      download: '다운로드',
      refresh: '새로고침',
      loading: '로딩 중...',
      uploading: '업로드 중...',
          confirmDelete: '정말로 이 파일을 삭제하시겠습니까?',
          deleteSuccess: '파일이 성공적으로 삭제되었습니다',
          deleteError: '파일 삭제에 실패했습니다',
          uploadSuccess: '파일이 성공적으로 업로드되었습니다',
          uploadError: '파일 업로드에 실패했습니다',
          loadError: '파일 목록을 불러오는데 실패했습니다',
          noFiles: '파일이 없습니다',
          dragOver: '업로드하려면 파일을 여기에 놓으세요'
    }
  }

  const currentT = t[language]

  // Load blobs on component mount
  useEffect(() => {
    loadBlobs()
  }, [])

  const loadBlobs = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.debug('🔄 Loading blobs...')
      const items = await listBlobs()
      console.debug('📋 Loaded blobs:', items.length, 'items:', items.map(b => ({ name: b.name, etag: b.etag })))
      setBlobs(items)
    } catch (error) {
      console.error('Failed to load blobs:', error)
      setError(
        error instanceof RAGApiError 
          ? error.message 
          : currentT.loadError
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true)
    setError(null)
    
    const fileArray = Array.from(files)
    const results = []

    for (const file of fileArray) {
      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
        
        // Simple upload - always use blob_upload (backend handles overwrites)
        console.debug('⬆️ Uploading file:', file.name)
        await uploadBlobFile(file)
        results.push({ file: file.name, success: true, action: 'uploaded' })
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
        
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        results.push({ 
          file: file.name, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    // Show results
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    if (successful.length > 0) {
      alert(`${currentT.uploadSuccess}: ${successful.map(r => r.file).join(', ')}`)
      loadBlobs() // Refresh the list
    }

    if (failed.length > 0) {
      alert(`${currentT.uploadError}: ${failed.map(r => `${r.file} (${r.error})`).join(', ')}`)
    }

    setUploadProgress({})
    setIsUploading(false)
  }

  const handleDelete = async (blob: BlobItem) => {
    const confirmMessage = `${currentT.confirmDelete}\n\nFile: ${blob.name}`
    
    if (!confirm(confirmMessage)) return

    try {
      await deleteBlob(blob.name)
      alert(`${currentT.deleteSuccess}: ${blob.name}`)
      loadBlobs() // Refresh the list
    } catch (error) {
      console.error('Failed to delete blob:', error)
      alert(`${currentT.deleteError}: ${blob.name}`)
    }
  }

  const handleDownload = async (blob: BlobItem) => {
    const url = (blob as any).url_with_sas || blob.url
    if (!url) {
      alert('Download URL not available for this file')
      return
    }

    // Open in a new tab/window for viewing; keep current page
    try {
      const w = window.open(url, '_blank', 'noopener')
      if (!w) {
        // Popup blocked fallback
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
    } catch (e) {
      console.error('Open in new window failed:', e)
      window.open(url, '_blank')
    }
  }

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="blob-files">
      <div className="blob-header">
        <h2>{currentT.title}</h2>
        <p>{currentT.subtitle}</p>
      </div>

      {/* Upload Area */}
      <div className="upload-section">
        <div 
          className="upload-area"
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('drag-over')
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('drag-over')
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('drag-over')
            handleFileUpload(e.dataTransfer.files)
          }}
        >
          <IconUpload className="upload-icon" />
          <p>{currentT.uploadArea}</p>
          <p className="supported-formats">Supported formats: .txt, .md, .json, .csv, .xml, .html, .css, .js, .ts, .pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx</p>
          <input
            type="file"
            multiple
            accept=".txt,.md,.json,.csv,.xml,.html,.css,.js,.ts,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            className="file-input"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="controls-section">
        <button 
          onClick={loadBlobs} 
          className="refresh-btn"
          disabled={isLoading}
        >
          <IconRefresh />
          {currentT.refresh}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <IconAlertTriangle />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-message">
          {currentT.loading}
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="uploading-message">
          {currentT.uploading}
        </div>
      )}

      {/* Files Table */}
      {!isLoading && !error && (
        <div className="files-table">
          {blobs.length === 0 ? (
            <div className="no-files">
              <p>{currentT.noFiles}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{currentT.fileName}</th>
                  <th>{currentT.size}</th>
                  <th>{currentT.lastModified}</th>
                  <th>{currentT.contentType}</th>
                  <th>{currentT.actions}</th>
                </tr>
              </thead>
              <tbody>
                {blobs.map((blob) => (
                  <tr key={blob.name}>
                    <td className="file-name">{blob.name}</td>
                    <td>{formatFileSize(blob.size as any)}</td>
                    <td>{formatDate(blob.last_modified as any)}</td>
                    <td>{blob.content_type || 'Unknown'}</td>
                    <td>
                      <div className="action-buttons">
                        {(blob as any).url_with_sas || blob.url ? (
                          <button 
                            onClick={() => handleDownload(blob)}
                            title={currentT.download}
                            className="action-btn download-btn"
                          >
                            <IconDownload />
                          </button>
                        ) : null}
                        <button 
                          onClick={() => handleDelete(blob)}
                          title={currentT.delete}
                          className="action-btn delete-btn"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
