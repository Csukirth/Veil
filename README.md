# Veil

Upload a PDF with sensitive info → Download a redacted version with personal data blacked out.

## Requirements

- Node.js (v16 or higher)
- Ghostscript (for PDF processing)

## Setup

**1. Install Ghostscript:**

macOS:
```bash
brew install ghostscript
```

Linux:
```bash
sudo apt-get install ghostscript
```

Windows: Download from https://ghostscript.com/releases/gsdnld.html

**2. Install dependencies:**
```bash
npm install
```

**3. Add your SIM AI key:**

Create a file named `.env` in this folder:
```
SIM_API_KEY=your_key_here
```

Get your key at https://www.sim.ai

**4. Run:**
```bash
# Terminal 1 - Backend
node server.js

# Terminal 2 - Frontend
npm run dev
```

Open http://localhost:5173

## Usage

1. Click "Upload & Extract Text"
2. Choose a PDF file
3. Wait 5 seconds
4. Click the green "Download Redacted PDF" button

Your redacted PDF will be in the `saved/` folder.

## What Gets Redacted

- Phone numbers
- Email addresses  
- Names
- Addresses
- SSNs
- Other sensitive info (based on your SIM AI workflow)

## Troubleshooting

**"Ghostscript not found" error:**
```bash
# Verify Ghostscript is installed
gs --version

# If not installed, see Setup step 1
```

**Port already in use:**
```bash
lsof -ti :3001 | xargs kill -9
node server.js
```

**No download button appears:**
- Make sure both terminals are running
- Check that `.env` file has your SIM API key
- Wait 5-10 seconds for processing
- Verify Ghostscript is installed

**Need help?** Check the terminal logs for errors.
