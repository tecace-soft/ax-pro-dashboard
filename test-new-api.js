// Test script for new API functionality
// Run with: node test-new-api.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables
const envPath = path.join(__dirname, '.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
  console.error('❌ Could not read .env file:', error.message);
  process.exit(1);
}

// Parse environment variables
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const RAG_API_URL = envVars.VITE_RAG_API_URL || 'https://hr-ax-pro-rag-management.eastus2.inference.ml.azure.com/score';
const RAG_API_KEY = envVars.VITE_RAG_API_KEY;

if (!RAG_API_KEY) {
  console.error('❌ VITE_RAG_API_KEY not found in .env file');
  process.exit(1);
}

console.log('🚀 Testing new API functionality...');
console.log('📍 API URL:', RAG_API_URL);
console.log('🔑 API Key:', RAG_API_KEY.substring(0, 10) + '...');

async function callAPI(payload, testName) {
  console.log(`\n🧪 Test: ${testName}`);
  console.log('📤 Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(RAG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAG_API_KEY}`,
      },
      body: JSON.stringify({ payload }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 Response:', JSON.stringify(data, null, 2));
    
    if (data.result && data.result.ok) {
      console.log('✅ Success');
      return data.result;
    } else {
      console.log('❌ API returned error');
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 API TEST SUITE - New Backend Structure');
  console.log('='.repeat(60));

  // Test 1: Blob List
  const blobListResult = await callAPI(
    { op: 'blob_list', top: 20 },
    'Blob List (top 20)'
  );

  if (!blobListResult) {
    console.log('❌ Blob list test failed - stopping tests');
    return;
  }

  // Test 2: Search (to check URL field)
  const searchResult = await callAPI(
    { 
      op: 'search', 
      q: 'parent_id:"test.txt"', 
      top: 3, 
      select: 'chunk_id,parent_id,title,filepath,url' 
    },
    'Search with URL field'
  );

  // Test 3: Clear by parent (unsync)
  const clearResult = await callAPI(
    { op: 'clear_by_parent', name: 'test.txt' },
    'Clear by parent (unsync test.txt)'
  );

  // Test 4: Reindex text file
  const reindexResult = await callAPI(
    { 
      op: 'reindex', 
      name: 'test.txt', 
      chunk_size: 1200, 
      overlap: 200, 
      make_embeddings: false 
    },
    'Reindex text file (test.txt)'
  );

  // Test 5: Search again to verify chunks were created
  const searchAfterResult = await callAPI(
    { 
      op: 'search', 
      q: 'parent_id:"test.txt"', 
      top: 5, 
      select: 'chunk_id,parent_id,title,filepath,url' 
    },
    'Search after reindex (verify chunks)'
  );

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const tests = [
    { name: 'Blob List', result: blobListResult },
    { name: 'Search (URL field)', result: searchResult },
    { name: 'Clear by Parent', result: clearResult },
    { name: 'Reindex', result: reindexResult },
    { name: 'Search After Reindex', result: searchAfterResult }
  ];

  tests.forEach(test => {
    const status = test.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.name}`);
  });

  // Check URL field in search results
  if (searchAfterResult && searchAfterResult.value) {
    const hasUrls = searchAfterResult.value.some(doc => doc.url);
    console.log(`\n🔗 URL Field Check: ${hasUrls ? '✅ URLs present' : '❌ No URLs found'}`);
    
    if (hasUrls) {
      console.log('📋 Sample URLs:');
      searchAfterResult.value.slice(0, 2).forEach(doc => {
        console.log(`  - ${doc.chunk_id}: ${doc.url ? 'Has URL' : 'No URL'}`);
      });
    }
  }

  console.log('\n🎯 Next Steps:');
  console.log('1. Check frontend Sync Status tab for updated functionality');
  console.log('2. Verify URL links work in Index tab');
  console.log('3. Test reindex button in Sync Status tab');
  console.log('4. Check that chunk counts are displayed correctly');
}

// Run the tests
runTests().catch(console.error);
