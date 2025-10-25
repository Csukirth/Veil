# 🧾 Veil (PDF Text Extractor + PII Masking)

This project extracts text from PDFs locally (including OCR for scanned PDFs) and automatically masks PII (Personally Identifiable Information) using SIM AI.  
It also includes a live dashcam preview feature with real-time object detection.  

---

## 📋 Prerequisites

Before starting, make sure you have:

- **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **A SIM AI account** (optional, for PII masking) - [Sign up here](https://www.sim.ai/)

---

## 🔧 Setup

1. **Clone/Download the project**
   ```bash
   cd veil
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```
   
   The project uses these key dependencies:
   - `pdfjs-dist` - PDF text extraction
   - `tesseract.js` - OCR for scanned PDFs
   - `express` - Backend server
   - `node-fetch` - HTTP requests
   - `dotenv` - Environment variables
   - `formdata-node` - File uploads

3. **Configure SIM AI (Optional but Recommended)**
   - Create a `.env` file in the project root:
     ```bash
     touch .env
     ```
   - Add your SIM AI API key to the `.env` file:
     ```
     SIM_API_KEY=your_actual_sim_api_key_here
     ```
   - **Get your SIM AI API key:**
     1. Sign up at [sim.ai](https://www.sim.ai/)
     2. Create a workflow for PII masking
     3. Copy your API key from the workflow settings
   - If you don't have a SIM AI key, the app will work without PII masking

4. **Run the Project**
   ```bash
   # Terminal 1: Start the backend server
   node server.js
   
   # Terminal 2: Start the frontend (in a new terminal)
   npm run dev
   ```

5. **Access the Application**
   - **Frontend**: http://localhost:5173/ (main interface)
   - **Backend API**: http://localhost:3001/ (API endpoints)
   - **Saved files**: http://localhost:3001/saved/ (direct file access)

---

## 📁 File Locations

- **Extracted Text**: `saved/[filename].txt` (original extracted text)
- **Masked Text**: `saved/[filename]_masked.txt` (PII-masked version)
- **Web Access**: Files are accessible via download links in the UI

---

## 🚀 Features

- **PDF Text Extraction**: Extracts text from PDFs using PDF.js
- **OCR Support**: Automatically uses Tesseract.js for scanned PDFs
- **PII Masking**: Integrates with SIM AI for automatic PII detection and masking
- **Dual Output**: Provides both original and masked text files
- **Live Dashcam**: Real-time camera preview with object detection
- **Local Processing**: All processing happens on your machine

---

## 🎯 How to Use

1. **Upload a PDF**: Click "Upload & Extract Text" and select a PDF file
2. **Automatic Processing**: The system will:
   - Extract text from the PDF
   - Send text to SIM AI for PII masking
   - Create both original and masked versions
3. **Download Files**: You'll see two download links:
   - **"Open original text"** - The extracted text as-is
   - **"Open processed text"** - The PII-masked version

---

## 🔧 Troubleshooting

### Common Issues:

- **Port Conflicts**: If port 3001 is busy, kill the process: `pkill -f "node server.js"`
- **SIM AI Issues**: 
  - Check your API key in the `.env` file
  - Ensure your SIM AI workflow is properly configured
  - Verify the workflow accepts string input and outputs masked text
- **File Access**: Saved files are in the `saved/` directory and accessible via web interface
- **Dependencies**: If you get module errors, run `npm install` again

### Getting Help:

- Check the browser console for error messages
- Verify both servers are running (frontend on 5173, backend on 3001)
- Test SIM AI integration by checking the server logs