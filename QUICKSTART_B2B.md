# Quick Start: B2B PDF Scraping

Get started with BrightData PDF scraping in 3 minutes.

## Prerequisites

✅ You already have Veil working (Ghostscript installed, `npm install` done)

## Setup (2 minutes)

### 1. Get BrightData API Key

1. Go to https://brightdata.com and sign up
2. Navigate to Settings → API tokens
3. Click "Generate new token"
4. Copy the token

### 2. Add to .env

Open your `.env` file and add:
```bash
BRIGHTDATA_API_KEY=your_token_here
UNLOCKER_ZONE=unlocker
```

### 3. Restart Server

```bash
# Stop server.js (Ctrl+C)
node server.js
```

## Usage (1 minute)

1. Open http://localhost:5173
2. Click **"Scrape B2B PDFs"** button (new button to the right)
3. Enter a PDF URL, for example:
   ```
   https://arxiv.org/pdf/2103.00020.pdf
   ```
4. Click "Add URL"
5. Click "Scrape PDFs"
6. Wait ~10-15 seconds
7. Download your redacted PDF!

## What Just Happened?

```
Your URL → BrightData → PDF Fetched → Text Extracted 
  → SIM API Detection → Redaction Applied → Redacted PDF ✅
```

## Test URLs

Try these PDF URLs:
- https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
- https://www.africau.edu/images/default/sample.pdf
- https://arxiv.org/pdf/2103.00020.pdf

## Multiple PDFs

You can add multiple URLs and process them all at once:
1. Enter URL → Click "Add URL"
2. Enter another URL → Click "Add URL"
3. Repeat as needed
4. Click "Scrape PDFs" when ready

All PDFs will be processed sequentially.

## Where Are Files?

Check the `saved/` folder:
- `document.pdf` - Original
- `document_REDACTED.pdf` - Redacted version
- `document.txt` - Extracted text
- `document_masked.txt` - SIM API output

## Troubleshooting

**"BRIGHTDATA_API_KEY not configured"**
- Add the API key to `.env`
- Restart `node server.js`

**"BrightData fetch failed: 402"**
- You need to add credits to your BrightData account
- Go to https://brightdata.com/cp/zones

**Processing takes too long**
- First fetch: 15-20 seconds is normal
- Large PDFs (100+ pages) can take 30-60 seconds
- Check backend terminal for progress

## Next Steps

- Read `BRIGHTDATA_INTEGRATION.md` for full documentation
- Check `README.md` for general troubleshooting
- Visit https://docs.brightdata.com for BrightData docs

## Cost Considerations

BrightData charges per GB of data transferred:
- Small PDF (1MB): ~$0.0001
- Medium PDF (10MB): ~$0.001  
- Large PDF (100MB): ~$0.01

Typical usage: $5-10/month for 1000+ PDFs

## B2B Benefits

Why this is valuable for business:
- ✅ No manual PDF downloads
- ✅ Bypasses CAPTCHAs and blocks
- ✅ Automatic redaction
- ✅ LLM-ready documents
- ✅ Scalable to thousands of PDFs
- ✅ GDPR/CCPA compliant

Perfect for:
- Legal document processing
- HR resume screening
- Financial document analysis
- Research paper analysis
- Any bulk PDF processing

---

**Ready to go?** Click that "Scrape B2B PDFs" button! 🚀
