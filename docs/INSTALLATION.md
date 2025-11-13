# Documentation Installation and Usage Guide

## 📋 Overview

This guide explains how to install the necessary tools and convert the Knowledge Management documentation to different formats (PDF, DOCX, HTML).

## 🚀 Quick Start

### Option 1: Use HTML Versions (Recommended)
The HTML versions are already generated and ready to use:
- `output/Knowledge_Management_User_Guide.html`
- `output/Knowledge_Management_Technical_Guide.html`
- `output/Knowledge_Management_Quick_Reference.html`

Simply open these files in any web browser.

### Option 2: Generate All Formats
To generate PDF and DOCX versions, follow these steps:

## 📦 Installation

### Prerequisites
- Node.js 16+ installed
- npm or yarn package manager

### Install Conversion Tools
```bash
# Navigate to docs directory
cd docs

# Install tools globally
npm install -g markdown-pdf
npm install -g markdown-to-docx

# Or install locally
npm install
```

### Alternative Installation Methods

#### Using Homebrew (macOS)
```bash
# Install pandoc (alternative converter)
brew install pandoc

# Convert using pandoc
pandoc Knowledge_Management_User_Guide.md -o Knowledge_Management_User_Guide.pdf
pandoc Knowledge_Management_User_Guide.md -o Knowledge_Management_User_Guide.docx
```

#### Using Docker
```bash
# Create a Dockerfile for conversion
FROM node:18-alpine
RUN npm install -g markdown-pdf markdown-to-docx
WORKDIR /docs
COPY . .
CMD ["node", "convert_docs.js"]
```

## 🔧 Usage

### Automatic Conversion
```bash
# Run the conversion script
node convert_docs.js

# Or use npm script
npm run convert
```

### Manual Conversion

#### Convert to PDF
```bash
# Using markdown-pdf
markdown-pdf Knowledge_Management_User_Guide.md -o output/User_Guide.pdf

# Using pandoc
pandoc Knowledge_Management_User_Guide.md -o output/User_Guide.pdf
```

#### Convert to DOCX
```bash
# Using markdown-to-docx
markdown-to-docx Knowledge_Management_User_Guide.md output/User_Guide.docx

# Using pandoc
pandoc Knowledge_Management_User_Guide.md -o output/User_Guide.docx
```

#### Convert to HTML
```bash
# Using pandoc
pandoc Knowledge_Management_User_Guide.md -o output/User_Guide.html

# Using markdown-it
npx markdown-it Knowledge_Management_User_Guide.md > output/User_Guide.html
```

## 📁 Output Structure

After conversion, you'll find files in the `output/` directory:

```
output/
├── Knowledge_Management_User_Guide.html
├── Knowledge_Management_User_Guide.pdf
├── Knowledge_Management_User_Guide.docx
├── Knowledge_Management_Technical_Guide.html
├── Knowledge_Management_Technical_Guide.pdf
├── Knowledge_Management_Technical_Guide.docx
├── Knowledge_Management_Quick_Reference.html
├── Knowledge_Management_Quick_Reference.pdf
└── Knowledge_Management_Quick_Reference.docx
```

## 🎨 Customization

### Styling HTML Output
Edit the `convert_docs.js` file to modify the HTML styling:

```javascript
// Modify the CSS in the createHTML function
const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <style>
        /* Your custom CSS here */
        body { font-family: 'Your Font'; }
        h1 { color: #your-color; }
    </style>
</head>
<body>...</body>
</html>`;
```

### PDF Styling
Create a custom CSS file for PDF generation:

```bash
# Create custom.css
markdown-pdf Knowledge_Management_User_Guide.md -o output/User_Guide.pdf -c custom.css
```

### DOCX Styling
Use pandoc with custom templates:

```bash
# Create custom template
pandoc Knowledge_Management_User_Guide.md -o output/User_Guide.docx --reference-doc=custom-template.docx
```

## 🔧 Troubleshooting

### Common Issues

#### "Command not found" errors
```bash
# Check if tools are installed
which markdown-pdf
which markdown-to-docx

# Reinstall if needed
npm install -g markdown-pdf markdown-to-docx
```

#### Permission errors
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
npm install -g markdown-pdf markdown-to-docx
```

#### Node.js version issues
```bash
# Check Node.js version
node --version

# Update Node.js if needed
# Visit https://nodejs.org for latest version
```

#### Memory issues with large files
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 convert_docs.js
```

### Alternative Solutions

#### Online Converters
- [Pandoc Try](https://pandoc.org/try/)
- [Markdown to PDF](https://www.markdowntopdf.com/)
- [Dillinger](https://dillinger.io/)

#### Desktop Applications
- **Typora**: Markdown editor with export features
- **Mark Text**: Markdown editor with PDF export
- **VS Code**: With Markdown PDF extension

## 📊 File Size Guidelines

| Format | Typical Size | Best For |
|--------|-------------|----------|
| HTML | 10-20 KB | Web viewing, online sharing |
| PDF | 100-500 KB | Printing, formal distribution |
| DOCX | 50-200 KB | Editing, collaboration |

## 🔄 Automation

### GitHub Actions
Create `.github/workflows/docs.yml`:

```yaml
name: Generate Documentation
on:
  push:
    paths: ['docs/*.md']
jobs:
  convert:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: cd docs && npm install -g markdown-pdf markdown-to-docx
      - run: cd docs && node convert_docs.js
      - uses: actions/upload-artifact@v2
        with:
          name: documentation
          path: docs/output/
```

### Cron Job
```bash
# Add to crontab for daily updates
0 2 * * * cd /path/to/docs && node convert_docs.js
```

## 📞 Support

### Getting Help
- Check this installation guide
- Review error messages carefully
- Try alternative conversion methods
- Contact the development team

### Contributing
- Report issues with the conversion process
- Suggest improvements to the documentation
- Submit pull requests for fixes
- Help maintain the conversion tools

---

*This installation guide is part of the Knowledge Management documentation suite.*

