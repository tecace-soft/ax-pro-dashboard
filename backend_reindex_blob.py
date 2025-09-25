# reindex_blob.py - Backend Implementation
# This file contains the complete implementation for the reindex_blob operation
# Copy this to your backend Azure ML inference endpoint

from __future__ import annotations
from promptflow import tool
import requests, hashlib, math
from typing import List, Dict
from urllib.parse import quote

# Configuration - Update these with your actual values
BLOB_CONTAINER_URL = "https://yourstorageaccount.blob.core.windows.net/your-container"
BLOB_SAS = "?sv=2023-01-03&st=2024-01-01T00%3A00%3A00Z&se=2025-01-01T00%3A00%3A00Z&sr=c&sp=rl&sig=your-signature"

# --- Helper Functions ---
def _blob_sas_url(name: str) -> str:
    """Generate SAS URL for blob access"""
    clean = name.lstrip("/")
    encoded = quote(clean, safe="/")
    base = BLOB_CONTAINER_URL.rstrip("/")
    sas = BLOB_SAS if BLOB_SAS.startswith("?") else f"?{BLOB_SAS}"
    return f"{base}/{encoded}{sas}"

def _download_text(name: str) -> str:
    """Download blob content as text (UTF-8)"""
    url = _blob_sas_url(name)
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    
    # Try UTF-8 first, fallback to latin-1 if needed
    try:
        return r.content.decode("utf-8")
    except UnicodeDecodeError:
        # Fallback: latin-1 → utf-8 re-encoding
        return r.content.decode("latin-1").encode("utf-8", errors="ignore").decode("utf-8", errors="ignore")

def _chunk_text(s: str, max_tokens: int = 1800) -> List[str]:
    """Split text into chunks, respecting paragraph boundaries"""
    if not s:
        return []
    
    parts: List[str] = []
    buf: List[str] = []
    count = 0
    lines = s.splitlines(keepends=True)
    
    for line in lines:
        ln = len(line)
        if count + ln > max_tokens and buf:
            parts.append("".join(buf))
            buf, count = [], 0
        buf.append(line)
        count += ln
    
    if buf:
        parts.append("".join(buf))
    
    # Handle very long single lines
    out: List[str] = []
    for p in parts:
        if len(p) <= max_tokens:
            out.append(p)
            continue
        # Hard cut for extremely long lines
        for i in range(0, len(p), max_tokens):
            out.append(p[i:i+max_tokens])
    
    return out

def _parent_hash(name: str) -> str:
    """Generate consistent hash for parent_id"""
    return hashlib.md5(name.encode("utf-8")).hexdigest()

def _upsert_batch(docs: List[Dict]) -> Dict:
    """
    Upsert documents to Azure Search index
    Replace this with your actual Azure Search upsert implementation
    """
    # TODO: Implement actual Azure Search batch upsert
    # This should use your existing Azure Search client or REST API
    # For now, return a mock response
    return {
        "processed": len(docs),
        "success": True
    }

# --- Main Tool ---
@tool
def reindex_blob(name: str):
    """
    Reindex a blob file:
    1. Download blob content as text
    2. Split into chunks
    3. Upsert to Azure Search index with proper metadata
    """
    if not name:
        raise ValueError("reindex_blob requires 'name' parameter")
    
    try:
        # Step 1: Download and extract text
        print(f"📥 Downloading blob: {name}")
        text = _download_text(name)
        print(f"📄 Text length: {len(text)} characters")
        
        # Step 2: Split into chunks
        chunks = _chunk_text(text, max_tokens=1800)
        print(f"✂️ Created {len(chunks)} chunks")
        
        # Step 3: Prepare documents for indexing
        parent_id = name
        base_title = name.split("/")[-1] or name
        parent_hash = _parent_hash(name)
        
        docs: List[Dict] = []
        for i, chunk in enumerate(chunks):
            chunk_id = f"{parent_hash}_{i:04d}"
            docs.append({
                "id": chunk_id,
                "content": chunk,
                "title": f"{base_title} (part {i+1}/{len(chunks)})",
                "parent_id": parent_id,
                "filepath": name,
                "url": _blob_sas_url(name).split("?")[0],  # Remove SAS token from URL
            })
        
        # Step 4: Handle empty files
        if not docs:
            print("⚠️ Empty file - no chunks to index")
            return {
                "ok": True,
                "route": "reindex_blob",
                "ingest": {
                    "chunks": 0,
                    "parent_id": parent_id,
                    "name": name,
                    "message": "Empty file - no content to index"
                }
            }
        
        # Step 5: Upsert to search index
        print(f"📤 Upserting {len(docs)} documents to search index")
        result = _upsert_batch(docs)
        
        return {
            "ok": True,
            "route": "reindex_blob",
            "ingest": {
                "chunks": len(docs),
                "parent_id": parent_id,
                "name": name,
                "upserted": result.get("processed", len(docs)),
                "success": result.get("success", True)
            }
        }
        
    except Exception as e:
        print(f"❌ Error in reindex_blob: {str(e)}")
        return {
            "ok": False,
            "route": "reindex_blob",
            "error": {
                "code": "reindex_error",
                "message": str(e)
            }
        }

# --- Integration Notes ---
"""
To integrate this into your existing backend:

1. Update your router to include:
   SUPPORTED["reindex_blob"] = "reindex_blob"

2. Replace the _upsert_batch function with your actual Azure Search implementation:
   - Use your existing Azure Search client
   - Or implement REST API calls to Azure Search
   - Ensure the document schema matches your index

3. Update BLOB_CONTAINER_URL and BLOB_SAS with your actual values

4. Test with a simple text file first, then expand to support other formats

5. Consider adding support for:
   - PDF text extraction (PyPDF2, pdfplumber)
   - DOCX text extraction (python-docx)
   - HTML text extraction (BeautifulSoup)
   - Better tokenization (tiktoken, transformers)

Expected API Response Format:
{
  "ok": true,
  "route": "reindex_blob", 
  "ingest": {
    "chunks": 5,
    "parent_id": "test.txt",
    "name": "test.txt",
    "upserted": 5,
    "success": true
  }
}
"""
