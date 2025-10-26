# Veil

Upload a PDF with sensitive info → Download a redacted version with personal data blacked out.

**NEW**: B2B PDF Scraping - Automatically scrape and redact PDFs from URLs using BrightData.

## Requirements

- Node.js (v16 or higher)
- Ghostscript (for PDF processing)
- (Optional) BrightData API Key for B2B PDF scraping

## Setup

Follow these steps **IN ORDER**:

### Step 1: Install Ghostscript

**macOS:**
```bash
brew install ghostscript
gs --version  # Verify it's installed
```

**Linux:**
```bash
sudo apt-get install ghostscript
gs --version  # Verify it's installed
```

**Windows:** 
- Download from https://ghostscript.com/releases/gsdnld.html
- After install, run `gs --version` in Command Prompt to verify

⚠️ **IMPORTANT**: You MUST see a version number. If you get "command not found", Ghostscript isn't properly installed.

### Step 2: Install Node dependencies

```bash
cd Veil-2  # Make sure you're in the project folder
npm install
```

Wait for this to complete (can take 1-2 minutes).

### Step 3: Add your API keys

Create a file named `.env` in the project root folder:
```
# Required for sensitive data detection
SIM_API_KEY=your_sim_api_key_here

# Optional: For B2B PDF scraping
BRIGHTDATA_API_KEY=your_brightdata_api_key_here
UNLOCKER_ZONE=unlocker
```

**Get your keys:**
- SIM API Key: https://www.sim.ai
- BrightData API Key: https://brightdata.com (Settings → API tokens)

### Step 4: Run the app

Open **TWO separate terminals** in the project folder:

**Terminal 1 - Backend:**
```bash
node server.js
```
You should see: `🚀 Server running on port 3001`

**Terminal 2 - Frontend:**
```bash
npm run dev
```
You should see: `Local: http://localhost:5173`

Open http://localhost:5173 in your browser

## Usage

### Option 1: Upload Local PDF

1. Click "Upload & Extract Text"
2. Choose a PDF file
3. Wait 5 seconds
4. Click the green "Download Redacted PDF" button

### Option 2: B2B PDF Scraping

1. Click "Scrape B2B PDFs"
2. Choose mode:
   - **Enter URLs**: Manually provide PDF URLs
   - **🤖 Agentic Search**: Let AI find PDFs by keywords (NEW!)
3. Click "Scrape PDFs" or "🤖 Search & Redact"
4. System will automatically:
   - Fetch PDFs using BrightData (bypasses CAPTCHAs, blocks, etc.)
   - Extract text from each PDF
   - Detect sensitive information
   - Create redacted versions
5. Download the redacted PDFs from the links shown

**Agentic Search Example:**
- Query: `financial reports 2024`
- Max Results: 5
- System finds, scrapes, and redacts 5 PDFs automatically!

Your redacted PDFs will be in the `saved/` folder.

## What Gets Redacted

- Phone numbers
- Email addresses  
- Names
- Addresses
- SSNs
- Other sensitive info (based on your SIM AI workflow)

## Troubleshooting

### Redacted PDF is blank with just black boxes

This means Ghostscript isn't working. **Verify setup:**

1. **Check Ghostscript is installed:**
   ```bash
   gs --version
   ```
   Should show version 9.x or 10.x. If not, go back to Setup Step 1.

2. **Check Node dependencies are installed:**
   ```bash
   ls node_modules
   ```
   Should show hundreds of folders. If empty, run `npm install`.

3. **Try reinstalling Ghostscript:**
   ```bash
   brew reinstall ghostscript  # macOS
   ```

### No download button appears

1. **Verify both terminals are running** (backend AND frontend)
2. **Check `.env` file exists** with your SIM API key
3. **Wait 5-10 seconds** after uploading
4. **Check backend terminal** for errors

### Port already in use

```bash
lsof -ti :3001 | xargs kill -9
node server.js
```

### BrightData scraping not working

1. **Verify BrightData API key** is set in `.env`
2. **Check you have credits** in your BrightData account
3. **Check backend terminal** for BrightData error messages
4. The scraping requires an active BrightData subscription

### Still having issues?

1. Check **both terminal logs** for error messages
2. Make sure you followed ALL setup steps in order
3. Verify Ghostscript: `gs --version` should work

## B2B Use Case

The B2B PDF scraping feature is designed for businesses that need to:
- **Discover** PDFs automatically using keyword search (Agentic Mode)
- Process multiple PDFs from web sources automatically
- Remove sensitive information before feeding documents to LLMs
- Scrape and redact PDFs behind authentication, CAPTCHAs, or bot protection
- Batch process documents from various sources

**Benefits:**
- 🤖 **Agentic Search**: Find PDFs automatically with keywords (NEW!)
- No need to manually download PDFs
- BrightData bypasses blocks, CAPTCHAs, and anti-bot measures
- Automatic text extraction and redaction
- Scalable for enterprise use

## Documentation

- 📖 **Main Guide**: `README.md` (you're here)
- 🤖 **Agentic Search**: `AGENTIC_SEARCH_GUIDE.md` (keyword-based auto-discovery)
- 🌐 **BrightData Integration**: `BRIGHTDATA_INTEGRATION.md` (technical details)
- ⚡ **Quick Start**: `QUICKSTART_B2B.md` (3-minute setup)
