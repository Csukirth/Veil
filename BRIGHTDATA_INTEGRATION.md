# BrightData B2B PDF Scraping Integration

This document explains the BrightData integration for B2B PDF scraping and redaction.

## Overview

The integration allows businesses to:
1. Enter PDF URLs through a web interface
2. Automatically fetch PDFs using BrightData (bypassing blocks, CAPTCHAs, etc.)
3. Extract text and detect sensitive information
4. Generate redacted PDFs with sensitive data blacked out

## Architecture

### Frontend (`src/app.jsx`)
- Added "Scrape B2B PDFs" button next to existing upload button
- Modal dialog for entering multiple PDF URLs
- URL validation and management
- Progress tracking and result display

### Backend (`server.js`)
- New endpoint: `POST /api/scrape-pdf`
- Fetches PDFs via BrightData API
- Extracts text and bounding boxes using pdf.js
- Processes text through SIM API for sensitive data detection
- Triggers existing blur-pdf workflow
- Returns redacted PDF download links

### Workflow Steps

```
1. User enters PDF URL(s) in modal
   ↓
2. Frontend sends URL to backend
   ↓
3. Backend fetches PDF via BrightData
   ↓
4. Extract text and bounding boxes
   ↓
5. Send text to SIM API for redaction detection
   ↓
6. Match redactions to bounding boxes
   ↓
7. Generate redacted PDF with blur-pdf-simple.js
   ↓
8. Return download link to frontend
```

## Configuration

### Required Environment Variables

```bash
# Required for all functionality
SIM_API_KEY=your_sim_api_key

# Required for B2B scraping
BRIGHTDATA_API_KEY=your_brightdata_api_key
UNLOCKER_ZONE=unlocker
```

### BrightData Setup

1. Sign up at https://brightdata.com
2. Navigate to Settings → API tokens
3. Generate a new API token
4. Add token to `.env` as `BRIGHTDATA_API_KEY`
5. (Optional) Create an Unlocker zone and set `UNLOCKER_ZONE`

## API Reference

### POST /api/scrape-pdf

**Request Body:**
```json
{
  "url": "https://example.com/document.pdf"
}
```

**Response:**
```json
{
  "ok": true,
  "filename": "document.pdf",
  "textPath": "/saved/document.txt",
  "processedPath": "/saved/document_masked.txt",
  "redactedPath": "/saved/document_REDACTED.pdf",
  "stats": {
    "pdfSize": 123456,
    "textLength": 5000,
    "pages": 10,
    "boundingBoxes": 250,
    "sourceUrl": "https://example.com/document.pdf"
  }
}
```

**Error Response:**
```json
{
  "ok": false,
  "error": "Error message"
}
```

## Usage Example

### Via Web Interface

1. Start the application:
   ```bash
   node server.js  # Terminal 1
   npm run dev     # Terminal 2
   ```

2. Open http://localhost:5173

3. Click "Scrape B2B PDFs"

4. Enter PDF URLs (examples):
   - https://arxiv.org/pdf/2103.00020.pdf
   - https://example.com/resume.pdf
   - https://company.com/financial-report.pdf

5. Click "Scrape PDFs"

6. Download redacted PDFs when ready

### Programmatic Usage

```javascript
const response = await fetch('http://localhost:3001/api/scrape-pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    url: 'https://example.com/document.pdf' 
  })
});

const result = await response.json();
console.log('Redacted PDF:', result.redactedPath);
```

## Features

### BrightData Benefits
- **Bypasses anti-bot measures**: CAPTCHAs, IP blocks, rate limits
- **Reliable fetching**: Handles redirects, authentication challenges
- **Global proxy network**: Access geo-restricted content
- **Automatic retries**: Built-in error handling

### Redaction Capabilities
- Phone numbers
- Email addresses
- Names (person, organization)
- Addresses
- Social Security Numbers
- Credit card numbers
- Custom patterns (via SIM API)

### Security Features
- Original PDFs saved locally
- All processing happens server-side
- Redacted PDFs are flattened (text cannot be extracted)
- Black boxes permanently cover sensitive data

## File Structure

```
Veil-2/
├── src/
│   ├── app.jsx              # Frontend with modal UI
│   └── App.css              # Modal styling
├── server.js                # Backend with /api/scrape-pdf
├── blur-pdf-simple.js       # PDF redaction logic
├── find-redacted-bboxes.js  # Bbox matching
├── saved/                   # Output directory
│   ├── *.pdf               # Original PDFs
│   ├── *_REDACTED.pdf      # Redacted PDFs
│   ├── *.txt               # Extracted text
│   ├── *_masked.txt        # SIM API output
│   └── *_bboxes.json       # Bounding box data
├── .env.example             # Environment template
└── BRIGHTDATA_INTEGRATION.md # This file
```

## Troubleshooting

### BrightData API Errors

**Error: "BRIGHTDATA_API_KEY not configured"**
- Add `BRIGHTDATA_API_KEY` to `.env` file
- Restart `node server.js`

**Error: "BrightData fetch failed: 401"**
- Invalid API key - check your BrightData dashboard
- Generate a new API token

**Error: "BrightData fetch failed: 402"**
- Insufficient credits - add funds to BrightData account
- Check your usage at https://brightdata.com/cp/zones

**Error: "BrightData fetch failed: 403"**
- Zone not configured - create an Unlocker zone
- Update `UNLOCKER_ZONE` in `.env`

### PDF Processing Errors

**Error: "No bounding boxes found"**
- PDF might be an image (OCR not fully implemented in backend yet)
- Try uploading the PDF manually via "Upload & Extract Text"

**Error: "Ghostscript not found"**
- Install Ghostscript: `brew install ghostscript` (macOS)
- Verify: `gs --version`

**Redacted PDF is blank**
- Ghostscript version issue - try `brew reinstall ghostscript`
- Check backend terminal for detailed errors

## Performance

### Typical Processing Times
- Fetch PDF via BrightData: 2-5 seconds
- Extract text: 1-3 seconds per page
- SIM API detection: 2-5 seconds
- Generate redacted PDF: 2-5 seconds per page

### Optimization Tips
- Process PDFs in parallel (frontend handles this)
- BrightData caching reduces repeat fetches
- Consider implementing backend OCR for image PDFs

## B2B Use Cases

### Legal Document Processing
- Redact client names, case numbers, SSNs from court documents
- Process multiple documents from case management systems
- Ensure GDPR/CCPA compliance before LLM analysis

### HR Document Management
- Remove PII from resumes and applications
- Redact salary information from offer letters
- Process employee records before analysis

### Financial Services
- Strip account numbers from statements
- Redact SSNs from tax documents
- Clean customer data before ML training

### Healthcare
- Remove PHI from medical records
- Redact patient names and IDs
- HIPAA-compliant document processing

## Future Enhancements

- [ ] Backend OCR for image-based PDFs
- [ ] Batch processing queue
- [ ] Custom redaction patterns
- [ ] S3 integration for cloud storage
- [ ] Webhook notifications
- [ ] API rate limiting
- [ ] Usage analytics dashboard

## Support

For issues related to:
- **BrightData API**: https://brightdata.com/support
- **SIM API**: https://www.sim.ai/support
- **This integration**: Open an issue on GitHub

## License

Same as main project (see LICENSE file)
