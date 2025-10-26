// server.js
import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { FormData } from "formdata-node";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import Tesseract from "tesseract.js";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "500mb" })); // Increased for video uploads

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Folder to save files into (shows up in VS Code)
const SAVE_DIR = path.join(__dirname, "saved");
await fs.mkdir(SAVE_DIR, { recursive: true });

// SIM API configuration
const SIM_API_KEY = process.env.SIM_API_KEY;
const SIM_API_URL = "https://www.sim.ai/api/workflows/a8a04aa4-679b-4978-aad0-02e1ed835ae5/execute";

// BrightData API configuration
const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
const BRIGHTDATA_ENDPOINT = "https://api.brightdata.com/request";
const BRIGHTDATA_UNLOCKER_ZONE = process.env.UNLOCKER_ZONE || "unlocker";

// Serve saved files so you can open them in the browser too
app.use("/saved", express.static(SAVE_DIR));

app.post("/api/save-pdf", async (req, res) => {
  try {
    const { filename, pdfData } = req.body || {};
    if (!pdfData) return res.status(400).send("Missing PDF data");
    
    // Ensure the saved directory exists
    await fs.mkdir(SAVE_DIR, { recursive: true });
    
    const safe = (filename || "document.pdf").replace(/[^\w.\-]/g, "_");
    const full = path.join(SAVE_DIR, safe);
    
    // Convert base64 to buffer
    const buffer = Buffer.from(pdfData, 'base64');
    await fs.writeFile(full, buffer);
    
    return res.json({ 
      ok: true, 
      path: `/saved/${safe}`,
      filename: safe
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message || "Server error");
  }
});

app.post("/api/save-text", async (req, res) => {
  try {
    const { filename, text } = req.body || {};
    if (!text) return res.status(400).send("Missing text");
    
    // Ensure the saved directory exists
    await fs.mkdir(SAVE_DIR, { recursive: true });
    
    const safe = (filename || "extracted.txt").replace(/[^\w.\-]/g, "_");
    const full = path.join(SAVE_DIR, safe);
    await fs.writeFile(full, text, "utf8");
    
    let processedText = text;
    let processedPath = null;
    
    // Only send .txt files to SIM API (skip JSON, masked files, etc.)
    const shouldProcessWithSIM = SIM_API_KEY && 
                                  safe.endsWith('.txt') && 
                                  !safe.includes('_masked') && 
                                  !safe.includes('_bboxes');
    
    // Process through SIM API if API key is available and file is eligible
    if (shouldProcessWithSIM) {
      try {
        console.log("Processing text through SIM API...");
        // Send text as string input
        const response = await fetch(SIM_API_URL, {
          method: "POST",
          headers: {
            "X-API-Key": SIM_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text
          })
        });
        
        const responseText = await response.text();
        console.log("SIM API response:", response.status, responseText);
        
        if (response.ok) {
          const result = JSON.parse(responseText);
          console.log("SIM API result:", result);
          
          // Check if we got a valid response with processed text
          if (result && result.output && result.output !== null) {
            // The workflow outputs a file or processed text
            if (typeof result.output === 'string') {
              // If output is a string, save it as processed text
              processedText = result.output;
              
              const processedFilename = safe.replace('.txt', '_masked.txt');
              const processedFull = path.join(SAVE_DIR, processedFilename);
              await fs.writeFile(processedFull, processedText, "utf8");
              processedPath = `/saved/${processedFilename}`;
              
              // Also save as "extracted_masked.txt" for blur scripts
              const genericMaskedPath = path.join(SAVE_DIR, "extracted_masked.txt");
              await fs.writeFile(genericMaskedPath, processedText, "utf8");
              
              console.log("Text masked successfully through SIM API");
            } else if (result.output && result.output.fileUrl) {
              // If output contains a file URL, download and save it
              const fileResponse = await fetch(result.output.fileUrl);
              const fileContent = await fileResponse.text();
              
              const processedFilename = safe.replace('.txt', '_masked.txt');
              const processedFull = path.join(SAVE_DIR, processedFilename);
              await fs.writeFile(processedFull, fileContent, "utf8");
              processedPath = `/saved/${processedFilename}`;
              
              // Also save as "extracted_masked.txt" for blur scripts
              const genericMaskedPath = path.join(SAVE_DIR, "extracted_masked.txt");
              await fs.writeFile(genericMaskedPath, fileContent, "utf8");
              
              console.log("Masked file downloaded and saved successfully");
            } else {
              console.log("SIM API returned output but format not recognized:", result.output);
            }
          } else {
            console.log("SIM API returned empty or null output, skipping processed text");
          }
        } else {
          console.error("SIM API error:", response.status, responseText);
        }
      } catch (apiError) {
        console.error("SIM API processing failed:", apiError.message);
        // Continue with original text if API fails
      }
    }
    
    return res.json({ 
      ok: true, 
      path: `/saved/${safe}`,
      processedPath: processedPath,
      processed: !!processedPath
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message || "Server error");
  }
});

app.post("/api/blur-pdf", async (req, res) => {
  try {
    console.log("\n🔒 Starting automatic PDF blurring...");
    
    const { execSync } = await import("child_process");
    
    // Step 1: Find redacted bounding boxes
    console.log("📍 Finding redacted bounding boxes...");
    const findOutput = execSync("node find-redacted-bboxes.js", { 
      cwd: __dirname,
      encoding: "utf8"
    });
    console.log(findOutput);
    
    // Step 2: Blur the PDF
    console.log("🖊️  Blurring PDF...");
    const blurOutput = execSync("node blur-pdf-simple.js", { 
      cwd: __dirname,
      encoding: "utf8"
    });
    console.log(blurOutput);
    
    // Find the redacted PDF file
    const files = await fs.readdir(SAVE_DIR);
    const redactedPdf = files.find(f => f.includes("_REDACTED.pdf"));
    
    if (!redactedPdf) {
      throw new Error("Redacted PDF not found");
    }
    
    console.log("✅ PDF blurring complete!\n");
    
    // Clean up intermediate files (keep original PDF and redacted PDF only)
    console.log("🧹 Cleaning up intermediate files...");
    const filesToDelete = [
      "extracted.txt",
      "extracted_masked.txt", 
      "extracted_bboxes.json",
      "redacted_bboxes.json"
    ];
    
    for (const filename of filesToDelete) {
      try {
        const filepath = path.join(SAVE_DIR, filename);
        await fs.unlink(filepath);
        console.log(`   ✓ Deleted ${filename}`);
      } catch (err) {
        // File might not exist, that's okay
        if (err.code !== 'ENOENT') {
          console.warn(`   ⚠️  Could not delete ${filename}`);
        }
      }
    }
    
    // Also delete specific bboxes.json and masked.txt files
    const allFiles = await fs.readdir(SAVE_DIR);
    for (const file of allFiles) {
      if (file.endsWith('_bboxes.json') || (file.endsWith('_masked.txt') && !file.includes('REDACTED'))) {
        try {
          await fs.unlink(path.join(SAVE_DIR, file));
          console.log(`   ✓ Deleted ${file}`);
        } catch (err) {
          console.warn(`   ⚠️  Could not delete ${file}`);
        }
      }
    }
    
    console.log("✨ Cleanup complete!\n");
    
    return res.json({
      ok: true,
      message: "PDF successfully blurred",
      redactedPath: `/saved/${redactedPdf}`,
      filename: redactedPdf
    });
    
  } catch (e) {
    console.error("❌ Blur error:", e.message);
    return res.status(500).json({
      ok: false,
      error: e?.message || "Failed to blur PDF"
    });
  }
});

// BrightData PDF Scraping endpoint
app.post("/api/scrape-pdf", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).send("Missing URL");

    console.log(`\n🌐 Scraping PDF from: ${url}`);

    // Check if BrightData API key is configured
    if (!BRIGHTDATA_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "BRIGHTDATA_API_KEY not configured. Please add it to your .env file."
      });
    }

    // Step 1: Fetch PDF using BrightData
    console.log("📡 Fetching PDF via BrightData...");
    
    let brightDataResponse;
    try {
      // Try using zone-based API first
      brightDataResponse = await fetch(BRIGHTDATA_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BRIGHTDATA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          zone: BRIGHTDATA_UNLOCKER_ZONE,
          url: url,
          format: "raw"
        })
      });

      // If zone doesn't work (400 error), try direct fetch as fallback
      if (brightDataResponse.status === 400) {
        console.log(`⚠️  Zone-based fetch failed (400), trying direct fetch...`);
        console.log(`   Hint: Set up a BrightData Web Unlocker zone at https://brightdata.com/cp/zones`);
        brightDataResponse = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
          }
        });
      }
    } catch (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    if (!brightDataResponse.ok) {
      const errorText = await brightDataResponse.text().catch(() => "");
      throw new Error(`BrightData fetch failed: ${brightDataResponse.status} - ${errorText}`);
    }

    const pdfBuffer = await brightDataResponse.arrayBuffer();
    console.log(`✅ PDF fetched: ${pdfBuffer.byteLength} bytes`);

    // Step 2: Generate filename from URL
    const urlObj = new URL(url);
    let filename = path.basename(urlObj.pathname) || "scraped-document.pdf";
    if (!filename.toLowerCase().endsWith('.pdf')) {
      filename += '.pdf';
    }
    filename = filename.replace(/[^\w.\-]/g, "_");
    
    // Step 3: Save the PDF
    const pdfPath = path.join(SAVE_DIR, filename);
    await fs.writeFile(pdfPath, Buffer.from(pdfBuffer));
    console.log(`💾 Saved PDF: ${filename}`);

    // Step 4: Extract text and bounding boxes from PDF (reuse logic from frontend)
    console.log("📖 Extracting text from PDF...");
    const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    
    let pages = [];
    const allBoundingBoxes = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const content = await page.getTextContent();
      const txt = content.items.map(it => ("str" in it ? it.str : "")).join(" ").trim();
      pages.push(txt);
      
      // Extract bounding boxes for all text items
      content.items.forEach((item) => {
        if (!item.str || item.str.trim() === "") return;
        
        const tx = item.transform;
        const x = tx[4];
        const y = tx[5];
        const width = item.width;
        const height = item.height;
        
        allBoundingBoxes.push({
          page: i,
          text: item.str,
          bbox: {
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(width),
            height: Math.round(height)
          },
          pageHeight: viewport.height  // Store page height for reference
        });
      });
    }

    let finalText = pages.join("\n\n").trim();

    // Check if OCR is needed (for image-based PDFs)
    const needsOCR = finalText.replace(/\s+/g, "").length < 5;
    
    if (needsOCR) {
      console.log("📷 PDF appears to be image-based, OCR not implemented in backend yet");
      console.log("   Continuing with extracted text...");
    }

    console.log(`📝 Extracted ${finalText.length} characters from ${pdf.numPages} page(s)`);

    // Step 5: Save extracted text
    const textFilename = filename.replace(/\.pdf$/i, ".txt");
    const bboxFilename = filename.replace(/\.pdf$/i, "_bboxes.json");
    const textPath = path.join(SAVE_DIR, textFilename);
    await fs.writeFile(textPath, finalText, "utf8");
    
    // Also save as "extracted.txt" for blur scripts
    await fs.writeFile(path.join(SAVE_DIR, "extracted.txt"), finalText, "utf8");
    console.log(`💾 Saved extracted text: ${textFilename}`);

    // Step 6: Save bounding boxes
    if (allBoundingBoxes.length > 0) {
      const bboxContent = JSON.stringify({
        filename: filename,
        totalPages: pdf.numPages,
        boundingBoxes: allBoundingBoxes,
        timestamp: new Date().toISOString(),
        sourceUrl: url
      }, null, 2);
      
      await fs.writeFile(path.join(SAVE_DIR, bboxFilename), bboxContent, "utf8");
      await fs.writeFile(path.join(SAVE_DIR, "extracted_bboxes.json"), bboxContent, "utf8");
      console.log(`📦 Saved ${allBoundingBoxes.length} bounding boxes`);
    }

    // Step 7: Process through SIM API for redaction detection
    let processedPath = null;
    if (SIM_API_KEY) {
      try {
        console.log("🔍 Processing text through SIM API...");
        const simResponse = await fetch(SIM_API_URL, {
          method: "POST",
          headers: {
            "X-API-Key": SIM_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: finalText })
        });

        if (simResponse.ok) {
          const simResult = await simResponse.json();
          if (simResult && simResult.output) {
            const maskedFilename = textFilename.replace('.txt', '_masked.txt');
            const maskedText = typeof simResult.output === 'string' ? simResult.output : JSON.stringify(simResult.output);
            
            await fs.writeFile(path.join(SAVE_DIR, maskedFilename), maskedText, "utf8");
            await fs.writeFile(path.join(SAVE_DIR, "extracted_masked.txt"), maskedText, "utf8");
            processedPath = `/saved/${maskedFilename}`;
            console.log("✅ Text processed through SIM API");
          }
        }
      } catch (simError) {
        console.warn("⚠️  SIM API processing failed:", simError.message);
      }
    }

    // Step 8: Wait for SIM processing and trigger PDF blurring
    console.log("⏳ Waiting for SIM API to complete redaction...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    let redactedPath = null;
    try {
      console.log("🔒 Starting automatic PDF blurring...");
      const { execSync } = await import("child_process");
      
      // Find redacted bounding boxes
      execSync("node find-redacted-bboxes.js", { 
        cwd: __dirname,
        encoding: "utf8",
        stdio: 'pipe'
      });
      
      // Blur the PDF
      execSync("node blur-pdf-simple.js", { 
        cwd: __dirname,
        encoding: "utf8",
        stdio: 'pipe'
      });
      
      // Find the redacted PDF
      const files = await fs.readdir(SAVE_DIR);
      const redactedPdf = files.find(f => f.includes("_REDACTED.pdf"));
      
      if (redactedPdf) {
        redactedPath = `/saved/${redactedPdf}`;
        console.log(`✅ Redacted PDF created: ${redactedPdf}`);
        
        // Clean up intermediate files
        console.log("🧹 Cleaning up intermediate files...");
        const intermediateFiles = [
          "extracted.txt",
          "extracted_masked.txt",
          "extracted_bboxes.json",
          "redacted_bboxes.json",
          textFilename,
          bboxFilename
        ];
        
        for (const file of intermediateFiles) {
          if (file) {
            try {
              await fs.unlink(path.join(SAVE_DIR, file));
              console.log(`   ✓ Deleted ${file}`);
            } catch (err) {
              if (err.code !== 'ENOENT') {
                console.warn(`   ⚠️  Could not delete ${file}`);
              }
            }
          }
        }
      }
    } catch (blurError) {
      console.warn("⚠️  PDF blurring failed:", blurError.message);
    }

    console.log("🎉 PDF scraping and processing complete!\n");

    return res.json({
      ok: true,
      filename: filename,
      textPath: `/saved/${textFilename}`,
      processedPath: processedPath,
      redactedPath: redactedPath,
      stats: {
        pdfSize: pdfBuffer.byteLength,
        textLength: finalText.length,
        pages: pdf.numPages,
        boundingBoxes: allBoundingBoxes.length,
        sourceUrl: url
      }
    });

  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to scrape PDF"
    });
  }
});

// BrightData Agentic Search & Scrape endpoint
app.post("/api/search-and-scrape", async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body || {};
    if (!query) return res.status(400).send("Missing search query");

    console.log(`\n🔍 Agentic Search: "${query}"`);
    console.log(`📊 Looking for up to ${maxResults} PDF sources\n`);

    // Check if BrightData API key is configured
    if (!BRIGHTDATA_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "BRIGHTDATA_API_KEY not configured. Please add it to your .env file."
      });
    }

    // Step 1: Initialize BrightData MCP client
    console.log("🤖 Initializing BrightData MCP Agent...");
    const mcpClient = new MultiServerMCPClient({
      bright_data: {
        url: `https://mcp.brightdata.com/sse?token=${BRIGHTDATA_API_KEY}&pro=1`,
        transport: "sse",
      },
    });

    const allTools = await mcpClient.getTools();
    const searchTool = allTools.find(t => t.name === "search_engine");
    const scrapeTool = allTools.find(t => t.name === "scrape_as_markdown");

    if (!searchTool || !scrapeTool) {
      throw new Error("Required MCP tools not found");
    }

    console.log("✅ MCP Agent ready (search_engine, scrape_as_markdown)\n");

    // Step 2: Search for PDFs
    console.log(`🔎 Searching for: "${query}"...`);
    const searchQuery = `${query} filetype:pdf`;
    const searchResult = await searchTool.invoke({ 
      query: searchQuery, 
      engine: "google" 
    });

    let searchData;
    try {
      searchData = typeof searchResult === "string" ? JSON.parse(searchResult) : searchResult;
    } catch (e) {
      throw new Error("Failed to parse search results");
    }

    // Step 3: Extract PDF URLs with domain diversity
    const pdfUrls = [];
    const seenDomains = new Set();
    const maxPerDomain = 2;
    
    if (searchData.organic && Array.isArray(searchData.organic)) {
      for (const result of searchData.organic) {
        if (pdfUrls.length >= maxResults) break;
        
        const url = result.link || result.url;
        if (!url) continue;
        
        // Prefer .pdf URLs
        if (!url.toLowerCase().includes('.pdf')) continue;
        
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          const domainCount = seenDomains.has(domain) ? 
            Array.from(seenDomains).filter(d => d === domain).length : 0;
          
          if (domainCount < maxPerDomain) {
            pdfUrls.push({
              url,
              title: result.title || "Untitled",
              domain
            });
            seenDomains.add(domain);
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (pdfUrls.length === 0) {
      await mcpClient.close();
      return res.json({
        ok: true,
        message: "No PDF sources found for this query",
        results: [],
        query
      });
    }

    console.log(`📚 Found ${pdfUrls.length} PDF source(s) across ${seenDomains.size} domain(s)\n`);
    
    // Step 4: Process each PDF
    const processedResults = [];
    
    // Ensure saved directory exists
    await fs.mkdir(SAVE_DIR, { recursive: true });
    
    for (let i = 0; i < pdfUrls.length; i++) {
      const { url, title, domain } = pdfUrls[i];
      console.log(`\n${"=".repeat(70)}`);
      console.log(`📄 [${i + 1}/${pdfUrls.length}] Processing: ${title}`);
      console.log(`🔗 ${url}`);
      console.log(`🌐 ${domain}`);
      console.log("=".repeat(70));

      try {
        // Fetch PDF via BrightData
        console.log("📡 Fetching PDF...");
        
        let pdfResponse;
        let fetchMethod = "zone-based";
        
        try {
          // Try direct fetch first (simpler and works for most public PDFs)
          pdfResponse = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "application/pdf,*/*"
            }
          });
          
          fetchMethod = "direct";
          
          // If direct fetch fails, try BrightData zone-based API (if configured)
          if (!pdfResponse.ok && BRIGHTDATA_UNLOCKER_ZONE && BRIGHTDATA_UNLOCKER_ZONE !== "unlocker") {
            console.log(`   Direct fetch failed (${pdfResponse.status}), trying BrightData zone...`);
            pdfResponse = await fetch(BRIGHTDATA_ENDPOINT, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${BRIGHTDATA_API_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                zone: BRIGHTDATA_UNLOCKER_ZONE,
                url: url,
                format: "raw"
              })
            });
            fetchMethod = "zone-based";
          }
        } catch (fetchError) {
          console.log(`❌ Fetch error: ${fetchError.message}`);
          processedResults.push({
            title,
            url,
            domain,
            error: `Fetch failed: ${fetchError.message}`
          });
          continue;
        }

        if (!pdfResponse.ok) {
          console.log(`❌ Failed to fetch (${pdfResponse.status}) via ${fetchMethod}`);
          processedResults.push({
            title,
            url,
            domain,
            error: `HTTP ${pdfResponse.status}: ${pdfResponse.statusText || 'Failed to fetch'}`
          });
          continue;
        }
        
        const pdfBuffer = await pdfResponse.arrayBuffer();
        console.log(`✅ Fetched ${Math.round(pdfBuffer.byteLength / 1024)}KB via ${fetchMethod}`);

        // Generate filename
        let filename = `${domain.replace(/\./g, '_')}_${i + 1}.pdf`;
        const pdfPath = path.join(SAVE_DIR, filename);
        await fs.writeFile(pdfPath, Buffer.from(pdfBuffer));

        // Extract text
        console.log("📖 Extracting text...");
        const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
        
        let pages = [];
        const allBoundingBoxes = [];
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.0 });
          const content = await page.getTextContent();
          const txt = content.items.map(it => ("str" in it ? it.str : "")).join(" ").trim();
          pages.push(txt);
          
          content.items.forEach((item) => {
            if (!item.str || item.str.trim() === "") return;
            
            const tx = item.transform;
            // tx[4] = x, tx[5] = y (in PDF coordinates: bottom-left origin)
            // Store raw coordinates as pdf.js provides them
            allBoundingBoxes.push({
              page: pageNum,
              text: item.str,
              bbox: {
                x: Math.round(tx[4]),
                y: Math.round(tx[5]),
                width: Math.round(item.width),
                height: Math.round(item.height)
              },
              pageHeight: viewport.height  // Store page height for reference
            });
          });
        }

        const finalText = pages.join("\n\n").trim();
        console.log(`📝 Extracted ${finalText.length} chars from ${pdf.numPages} page(s)`);

        // Save text to GENERIC files (for redaction scripts to read)
        await fs.writeFile(path.join(SAVE_DIR, "extracted.txt"), finalText, "utf8");

        // Save bounding boxes to GENERIC file (for redaction scripts to read)
        if (allBoundingBoxes.length > 0) {
          const bboxContent = JSON.stringify({
            filename,
            totalPages: pdf.numPages,
            boundingBoxes: allBoundingBoxes,
            timestamp: new Date().toISOString(),
            sourceUrl: url,
            sourceTitle: title
          }, null, 2);
          
          await fs.writeFile(path.join(SAVE_DIR, "extracted_bboxes.json"), bboxContent, "utf8");
        }

        // Process through SIM API
        if (!SIM_API_KEY) {
          console.log("⚠️  SIM_API_KEY not configured - skipping sensitive data detection");
          processedResults.push({
            title,
            url,
            domain,
            filename,
            error: "SIM_API_KEY not configured"
          });
          continue;
        }

        console.log("🔍 Detecting sensitive information...");
        try {
          const simResponse = await fetch(SIM_API_URL, {
            method: "POST",
            headers: {
              "X-API-Key": SIM_API_KEY,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: finalText })
          });

          if (!simResponse.ok) {
            throw new Error(`SIM API error: ${simResponse.status}`);
          }

          const simResult = await simResponse.json();
          if (!simResult || !simResult.output) {
            console.log("⚠️  SIM API returned no output - no sensitive data found");
            processedResults.push({
              title,
              url,
              domain,
              filename,
              textPath: `/saved/${filename.replace('.pdf', '.txt')}`,
              stats: { pages: pdf.numPages, textLength: finalText.length }
            });
            continue;
          }

          const maskedText = typeof simResult.output === 'string' ? simResult.output : JSON.stringify(simResult.output);
          
          // Write to GENERIC file (for redaction scripts to read)
          await fs.writeFile(path.join(SAVE_DIR, "extracted_masked.txt"), maskedText, "utf8");
          
          // Count tags to show what was detected
          const tagCount = (maskedText.match(/<[^>]+>/g) || []).length;
          console.log(`✅ Sensitive data detected: ${tagCount} item(s)`);
          
        } catch (simError) {
          console.warn("⚠️  SIM API failed:", simError.message);
          processedResults.push({
            title,
            url,
            domain,
            filename,
            error: `SIM API failed: ${simError.message}`
          });
          continue;
        }

        // Generate redacted PDF
        console.log("⏳ Generating redacted PDF...");
        
        let redactedPath = null;
        try {
          const { execSync } = await import("child_process");
          
          // Run redaction scripts - they read from extracted.txt, extracted_masked.txt, extracted_bboxes.json
          console.log("   🔍 Finding redacted bounding boxes...");
          const findOutput = execSync("node find-redacted-bboxes.js", { 
            cwd: __dirname,
            encoding: "utf8"
          });
          console.log(findOutput);
          
          console.log("   🎨 Blurring PDF...");
          const blurOutput = execSync("node blur-pdf-simple.js", { 
            cwd: __dirname,
            encoding: "utf8"
          });
          console.log(blurOutput);
          
          // The redacted PDF should be filename with _REDACTED suffix
          const redactedFilename = filename.replace('.pdf', '_REDACTED.pdf');
          const redactedFilePath = path.join(SAVE_DIR, redactedFilename);
          
          // Check if redacted PDF was created
          try {
            await fs.access(redactedFilePath);
            redactedPath = `/saved/${redactedFilename}`;
            console.log(`✅ Redacted: ${redactedFilename}`);
          } catch {
            console.warn("⚠️  Redacted PDF not found");
          }
          
          // Clean up intermediate files after successful redaction
          // Keep extracted_masked.txt temporarily for debugging
          const filesToDelete = [
            "extracted.txt",
            // "extracted_masked.txt",  // Keep for debugging
            "extracted_bboxes.json",
            "redacted_bboxes.json"
          ];
          
          for (const file of filesToDelete) {
            try {
              await fs.unlink(path.join(SAVE_DIR, file));
            } catch (err) {
              // File might not exist, ignore
            }
          }
          
        } catch (blurError) {
          console.error("❌ Redaction failed:", blurError.message);
          console.error("   Stack:", blurError.stack);
          if (blurError.stderr) {
            console.error("   stderr:", blurError.stderr.toString());
          }
        }

        processedResults.push({
          title,
          url,
          domain,
          filename,
          redactedPath,
          stats: {
            pages: pdf.numPages,
            textLength: finalText.length,
            boundingBoxes: allBoundingBoxes.length
          }
        });

        console.log(`✅ Complete: ${title}\n`);

      } catch (error) {
        console.error(`❌ Failed to process ${url}:`, error.message);
        processedResults.push({
          title,
          url,
          domain,
          error: error.message
        });
      }
    }

    await mcpClient.close();

    console.log(`\n${"=".repeat(70)}`);
    console.log("🎉 Agentic Search & Scrape Complete!");
    console.log(`📊 Successfully processed: ${processedResults.filter(r => !r.error).length}/${pdfUrls.length}`);
    console.log("=".repeat(70) + "\n");

    return res.json({
      ok: true,
      query,
      results: processedResults,
      stats: {
        searched: pdfUrls.length,
        processed: processedResults.filter(r => !r.error).length,
        failed: processedResults.filter(r => r.error).length
      }
    });

  } catch (error) {
    console.error("❌ Agentic search error:", error.message);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to perform agentic search"
    });
  }
});

// Dashcam Video Processing endpoint
app.post("/api/process-dashcam", async (req, res) => {
  try {
    const { filename, videoData, mode = "blur", colabUrl } = req.body || {};
    
    if (!videoData) {
      return res.status(400).json({
        ok: false,
        error: "Missing video data"
      });
    }
    
    if (!colabUrl) {
      return res.status(400).json({
        ok: false,
        error: "Missing Colab API URL. Please provide your Colab notebook URL."
      });
    }
    
    console.log(`\n🎥 Processing dashcam video: ${filename}`);
    console.log(`🔒 Mode: ${mode}`);
    console.log(`🌐 Colab API: ${colabUrl}`);
    
    // Save uploaded video
    const videoFilename = (filename || "dashcam.mp4").replace(/[^\w.\-]/g, "_");
    const inputPath = path.join(SAVE_DIR, videoFilename);
    const outputFilename = videoFilename.replace(/\.(mp4|mov|avi)$/i, "_REDACTED.mp4");
    const outputPath = path.join(SAVE_DIR, outputFilename);
    
    // Convert base64 to buffer and save
    const videoBuffer = Buffer.from(videoData, "base64");
    await fs.writeFile(inputPath, videoBuffer);
    console.log(`💾 Saved video: ${videoFilename} (${videoBuffer.length} bytes)`);
    
    // Check if Colab API is accessible (with retry)
    console.log("🔍 Checking Colab API connection...");
    let healthCheckPassed = false;
    let lastError = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/3...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased to 10 seconds
        
        const healthCheck = await fetch(`${colabUrl}/health`, { 
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (healthCheck.ok) {
          healthCheckPassed = true;
          console.log("✅ Colab API is accessible");
          break;
        }
      } catch (error) {
        lastError = error.message;
        console.warn(`   ⚠️  Attempt ${attempt} failed: ${error.message}`);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
      }
    }
    
    if (!healthCheckPassed) {
      console.error("❌ Colab API check failed after 3 attempts:", lastError);
      console.warn("⚠️  Continuing anyway - will fail at processing if Colab is really down");
      // Don't fail here - let it try processing and fail there if needed
      // return res.status(400).json({
      //   ok: false,
      //   error: `Cannot connect to Colab API at ${colabUrl}. Error: ${lastError}`
      // });
    }
    
    // Check if FFmpeg is installed
    console.log("🔍 Checking FFmpeg installation...");
    try {
      const { execSync } = await import("child_process");
      execSync("ffmpeg -version", { stdio: "ignore" });
      console.log("✅ FFmpeg is installed");
    } catch (err) {
      console.error("❌ FFmpeg not found");
      return res.status(500).json({
        ok: false,
        error: "FFmpeg is not installed. Please install it with: brew install ffmpeg"
      });
    }

    // Process video using the dashcam processor
    console.log("📥 Loading video processor module...");
    let result;
    try {
      const { processDashcamVideo } = await import("./process-dashcam-video.js");
      console.log("✅ Module loaded, starting processing...");
      
      result = await processDashcamVideo(
        inputPath,
        outputPath,
        mode,
        colabUrl,
        (progress, message) => {
          console.log(`   [${progress.toFixed(0)}%] ${message}`);
        }
      );
    } catch (procError) {
      console.error("❌ Processing error:", procError);
      console.error("Stack trace:", procError.stack);
      return res.status(500).json({
        ok: false,
        error: `Processing failed: ${procError.message}`
      });
    }
    
    // Clean up original video (keep only redacted version)
    try {
      await fs.unlink(inputPath);
      console.log(`🧹 Deleted original video: ${videoFilename}`);
    } catch (err) {
      console.warn(`⚠️  Could not delete original video: ${err.message}`);
    }
    
    console.log(`✅ Dashcam processing complete!`);
    
    return res.json({
      ok: true,
      filename: outputFilename,
      redactedPath: `/saved/${outputFilename}`,
      stats: result.stats
    });
    
  } catch (error) {
    console.error("❌ Dashcam processing error:", error.message);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to process dashcam video"
    });
  }
});

app.listen(3001, () => {
  console.log("Saver API on http://127.0.0.1:3001");
});
