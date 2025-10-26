# 🤖 Agentic Search & Redaction Guide

## Overview

The Agentic Search feature uses BrightData's MCP (Model Context Protocol) to automatically:
1. Search for PDFs based on keywords
2. Intelligently select diverse sources
3. Fetch and scrape the PDFs
4. Detect sensitive information
5. Generate redacted versions

This is perfect for bulk processing, research, legal discovery, or any scenario where you need to find and redact multiple PDFs automatically.

## How It Works

```
Keywords → BrightData MCP → Google Search → Select PDFs
    ↓
Fetch each PDF → Extract text → Detect PII → Create redacted versions
    ↓
Download redacted PDFs
```

## Setup

### 1. Environment Variables

Add to your `.env` file:
```bash
# Required
BRIGHTDATA_API_KEY=your_key_here
SIM_API_KEY=your_sim_key_here

# Optional (uses defaults if not set)
UNLOCKER_ZONE=unlocker
```

### 2. Dependencies

Already installed if you ran `npm install` after the integration:
- `@langchain/mcp-adapters` - BrightData MCP client
- `@langchain/core` - Core utilities

## Usage

### Via Web Interface

1. Click **"Scrape B2B PDFs"** button
2. Select **"🤖 Agentic Search"** tab
3. Enter your search query:
   - Example: `financial reports 2024`
   - Example: `medical research diabetes`
   - Example: `legal contracts template`
4. Set max results (1-10)
5. Click **"🤖 Search & Redact"**
6. Wait for processing (30-60 seconds per PDF)
7. Download redacted PDFs

### Via API

```javascript
const response = await fetch('http://localhost:3001/api/search-and-scrape', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'financial reports 2024',
    maxResults: 5
  })
});

const result = await response.json();
// result.results contains array of processed PDFs
```

## API Reference

### POST /api/search-and-scrape

**Request:**
```json
{
  "query": "search keywords",
  "maxResults": 5
}
```

**Response:**
```json
{
  "ok": true,
  "query": "search keywords",
  "results": [
    {
      "title": "Document Title",
      "url": "https://example.com/doc.pdf",
      "domain": "example.com",
      "filename": "example_com_1.pdf",
      "textPath": "/saved/example_com_1.txt",
      "processedPath": "/saved/example_com_1_masked.txt",
      "redactedPath": "/saved/example_com_1_REDACTED.pdf",
      "stats": {
        "pages": 10,
        "textLength": 5000,
        "boundingBoxes": 250
      }
    }
  ],
  "stats": {
    "searched": 5,
    "processed": 4,
    "failed": 1
  }
}
```

## Advanced Features

### Domain Diversity

The agent automatically ensures diversity by:
- Limiting 2 PDFs per domain
- Selecting from different sources
- Avoiding duplicate content

### Intelligent Search

The system automatically:
- Adds `filetype:pdf` to your query
- Searches via Google through BrightData
- Filters for actual PDF links
- Handles redirects and blocks

### Error Handling

- If a PDF fails to fetch, it continues with others
- Partial results are returned even if some PDFs fail
- Detailed logging in terminal shows progress

## Example Queries

### Business & Finance
```
financial reports 2024
quarterly earnings statements
investment prospectus
```

### Legal
```
contract templates
court filings 2024
legal agreements
```

### Academic
```
machine learning papers
medical research diabetes
climate change studies
```

### Healthcare
```
medical records template
patient consent forms
HIPAA compliance guide
```

## Performance

### Typical Processing Time

For 5 PDFs:
- Search: 2-3 seconds
- Fetch each PDF: 3-5 seconds
- Extract text: 1-2 seconds per page
- SIM API detection: 2-5 seconds
- Generate redacted PDF: 2-5 seconds per page

**Total: 30-60 seconds for 5 PDFs (average 10 pages each)**

### Cost (BrightData)

- Search query: ~$0.001
- Fetch PDF (5MB): ~$0.001
- **Total for 5 PDFs**: ~$0.01

## Comparison: Manual URL vs Agentic Search

| Feature | Manual URL Entry | Agentic Search |
|---------|------------------|----------------|
| **Input** | Exact PDF URLs | Keywords only |
| **Discovery** | Manual | Automatic |
| **Source Diversity** | Manual | Automatic |
| **Time to Setup** | 5+ min per URL | 30 sec |
| **Scalability** | Low | High |
| **Best For** | Known documents | Research/Discovery |

## Use Cases

### 1. Legal Discovery
**Query**: `patent infringement cases 2024`
- Automatically finds relevant legal documents
- Redacts party names, case numbers
- Creates LLM-ready documents for analysis

### 2. Financial Analysis
**Query**: `public company financial reports`
- Finds and downloads multiple reports
- Redacts sensitive financial data
- Enables bulk analysis

### 3. Academic Research
**Query**: `clinical trial results cancer treatment`
- Discovers research papers
- Redacts patient information
- Prepares for meta-analysis

### 4. Compliance Audits
**Query**: `privacy policy templates GDPR`
- Finds compliance documents
- Redacts company-specific info
- Enables comparison

## Troubleshooting

### No PDFs Found

**Issue**: "No PDF sources found for this query"

**Solutions**:
- Make query more specific
- Add year or context: `financial reports 2024`
- Try different keywords
- Check if PDFs exist for topic

### Search Returns Non-PDFs

The agent automatically filters for `.pdf` URLs. If you get no results:
- Your query might not have many PDFs online
- Try adding `research paper` or `report` to query

### Processing Takes Too Long

**Normal**: 30-60 seconds for 5 PDFs  
**Too Slow**: 2+ minutes

**Solutions**:
- Reduce `maxResults` to 3
- Check BrightData credits
- Ensure good internet connection
- Check backend terminal for errors

### Some PDFs Fail

**Normal**: 1-2 failures out of 5 is common  
**Reasons**:
- PDF is actually an HTML page
- Site requires authentication
- File is corrupted
- Network timeout

**The agent continues processing others and returns partial results.**

## Monitoring Progress

Watch your backend terminal (`node server.js`) for detailed logs:

```bash
🔍 Agentic Search: "financial reports 2024"
📊 Looking for up to 5 PDF sources

🤖 Initializing BrightData MCP Agent...
✅ MCP Agent ready (search_engine, scrape_as_markdown)

🔎 Searching for: "financial reports 2024 filetype:pdf"...
📚 Found 5 PDF source(s) across 4 domain(s)

======================================================================
📄 [1/5] Processing: Annual Financial Report 2024
🔗 https://example.com/report.pdf
🌐 example.com
======================================================================
📡 Fetching via BrightData...
✅ Fetched 2.5MB
📖 Extracting text...
📝 Extracted 12500 chars from 25 page(s)
🔍 Detecting sensitive information...
✅ Sensitive data detected
⏳ Generating redacted PDF...
✅ Redacted: example_com_1_REDACTED.pdf
✅ Complete: Annual Financial Report 2024
```

## Best Practices

### 1. Query Formulation
✅ **Good**: `financial reports 2024 public companies`  
❌ **Bad**: `money`

✅ **Good**: `medical research diabetes treatment`  
❌ **Bad**: `health`

### 2. Max Results
- Start with 3-5 for testing
- Increase to 10 for production
- Consider processing time

### 3. Verify Results
- Check `stats.processed` vs `stats.searched`
- Review failed PDFs in logs
- Validate redacted content

### 4. Cost Management
- Each search costs ~$0.01 for 5 PDFs
- Budget accordingly for production
- Monitor BrightData usage dashboard

## Integration with LLMs

After agentic search and redaction:

```python
# Example: Feed to LLM
import openai

# Get redacted text from saved file
with open('saved/example_com_1_masked.txt') as f:
    redacted_text = f.read()

# Safe to send to LLM
response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[{
        "role": "user",
        "content": f"Analyze this financial report: {redacted_text}"
    }]
)
```

No PII leakage to LLM! ✅

## Future Enhancements

Planned features:
- [ ] Custom search engines (Bing, DuckDuckGo)
- [ ] Advanced filtering (date range, file size)
- [ ] Batch processing queue
- [ ] Email notifications on completion
- [ ] S3 integration for storage
- [ ] Webhook support for automation
- [ ] Custom redaction rules per query

## Support

- **BrightData Issues**: https://brightdata.com/support
- **SIM API Issues**: https://www.sim.ai/support
- **General Issues**: Check `BRIGHTDATA_INTEGRATION.md`

## Summary

**Agentic Search** = Automated PDF discovery + scraping + redaction

Perfect for:
- 🔍 Research and discovery
- ⚖️ Legal document processing
- 💼 Business intelligence
- 🏥 Healthcare compliance
- 📚 Academic research

**Saves hours of manual work while ensuring data privacy!**
