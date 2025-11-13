#!/usr/bin/env node

/**
 * Document Conversion Script
 * Converts Markdown documentation to DOCX and PDF formats
 * 
 * Prerequisites:
 * npm install -g markdown-pdf
 * npm install -g markdown-to-docx
 * 
 * Usage:
 * node convert_docs.js
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { promisify } from 'util';
const execAsync = promisify(exec);

const docsDir = __dirname;
const outputDir = path.join(docsDir, 'output');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const documents = [
  {
    name: 'Knowledge_Management_User_Guide',
    title: 'Knowledge Management - User Guide',
    description: 'Complete user guide for the Knowledge Management system'
  },
  {
    name: 'Knowledge_Management_Technical_Guide', 
    title: 'Knowledge Management - Technical Documentation',
    description: 'Technical documentation for developers and administrators'
  },
  {
    name: 'Knowledge_Management_Quick_Reference',
    title: 'Knowledge Management - Quick Reference Card',
    description: 'Quick reference card for common tasks and troubleshooting'
  }
];

async function convertToPDF(mdFile, outputFile) {
  try {
    console.log(`Converting ${mdFile} to PDF...`);
    await execAsync(`markdown-pdf "${mdFile}" -o "${outputFile}"`);
    console.log(`✅ PDF created: ${outputFile}`);
  } catch (error) {
    console.error(`❌ Error creating PDF: ${error.message}`);
  }
}

async function convertToDOCX(mdFile, outputFile) {
  try {
    console.log(`Converting ${mdFile} to DOCX...`);
    await execAsync(`markdown-to-docx "${mdFile}" "${outputFile}"`);
    console.log(`✅ DOCX created: ${outputFile}`);
  } catch (error) {
    console.error(`❌ Error creating DOCX: ${error.message}`);
  }
}

async function createHTML(mdFile, outputFile) {
  try {
    console.log(`Creating HTML version of ${mdFile}...`);
    
    // Simple markdown to HTML conversion
    const markdown = fs.readFileSync(mdFile, 'utf8');
    
    // Basic markdown to HTML conversion
    let html = markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
      .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*)`/gim, '<code>$1</code>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>');
    
    // Wrap in proper HTML structure
    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${path.basename(mdFile, '.md')}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        h1 { border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { border-bottom: 1px solid #bdc3c7; padding-bottom: 5px; }
        code {
            background-color: #f8f9fa;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        li {
            margin-bottom: 5px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .toc {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 30px;
        }
        .toc h2 {
            margin-top: 0;
        }
        .toc ul {
            list-style-type: none;
            padding-left: 0;
        }
        .toc li {
            margin-bottom: 5px;
        }
        .toc a {
            text-decoration: none;
            color: #3498db;
        }
        .toc a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h1>${path.basename(mdFile, '.md').replace(/_/g, ' ')}</h1>
    <p>${html}</p>
</body>
</html>`;
    
    fs.writeFileSync(outputFile, fullHtml);
    console.log(`✅ HTML created: ${outputFile}`);
  } catch (error) {
    console.error(`❌ Error creating HTML: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting document conversion...\n');
  
  for (const doc of documents) {
    const mdFile = path.join(docsDir, `${doc.name}.md`);
    const pdfFile = path.join(outputDir, `${doc.name}.pdf`);
    const docxFile = path.join(outputDir, `${doc.name}.docx`);
    const htmlFile = path.join(outputDir, `${doc.name}.html`);
    
    console.log(`\n📄 Processing: ${doc.title}`);
    console.log(`📝 Description: ${doc.description}\n`);
    
    if (fs.existsSync(mdFile)) {
      // Convert to different formats
      await convertToPDF(mdFile, pdfFile);
      await convertToDOCX(mdFile, docxFile);
      await createHTML(mdFile, htmlFile);
    } else {
      console.log(`❌ Markdown file not found: ${mdFile}`);
    }
  }
  
  console.log('\n🎉 Document conversion completed!');
  console.log(`📁 Output directory: ${outputDir}`);
  console.log('\nGenerated files:');
  
  // List generated files
  const files = fs.readdirSync(outputDir);
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(2);
    console.log(`  - ${file} (${size} KB)`);
  });
  
  console.log('\n💡 Tips:');
  console.log('  - PDF files are ready for printing and sharing');
  console.log('  - DOCX files can be edited in Microsoft Word');
  console.log('  - HTML files can be opened in any web browser');
  console.log('  - All files are saved in the docs/output directory');
}

// Check if required tools are installed
async function checkDependencies() {
  try {
    await execAsync('markdown-pdf --version');
    await execAsync('markdown-to-docx --version');
    return true;
  } catch (error) {
    console.log('❌ Required tools not found. Please install:');
    console.log('   npm install -g markdown-pdf');
    console.log('   npm install -g markdown-to-docx');
    console.log('\nAlternatively, you can use the HTML versions or convert manually.');
    return false;
  }
}

// Run the conversion
checkDependencies().then(hasDeps => {
  if (hasDeps) {
    main().catch(console.error);
  } else {
    console.log('\n📝 Creating HTML versions only...');
    main().catch(console.error);
  }
});
