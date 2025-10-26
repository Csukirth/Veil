// server.js
import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { FormData } from "formdata-node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Folder to save files into (shows up in VS Code)
const SAVE_DIR = path.join(__dirname, "saved");
await fs.mkdir(SAVE_DIR, { recursive: true });

// SIM API configuration
const SIM_API_KEY = process.env.SIM_API_KEY;
const SIM_API_URL = "https://www.sim.ai/api/workflows/a8a04aa4-679b-4978-aad0-02e1ed835ae5/execute";

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
    
    // Process through SIM API if API key is available
    if (SIM_API_KEY) {
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
              
              console.log("Text masked successfully through SIM API");
            } else if (result.output && result.output.fileUrl) {
              // If output contains a file URL, download and save it
              const fileResponse = await fetch(result.output.fileUrl);
              const fileContent = await fileResponse.text();
              
              const processedFilename = safe.replace('.txt', '_masked.txt');
              const processedFull = path.join(SAVE_DIR, processedFilename);
              await fs.writeFile(processedFull, fileContent, "utf8");
              processedPath = `/saved/${processedFilename}`;
              
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
    const blurOutput = execSync("node blur-pdf.js", { 
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
    
    // Also delete any bboxes.json files that match the pattern
    const allFiles = await fs.readdir(SAVE_DIR);
    for (const file of allFiles) {
      if (file.endsWith('_bboxes.json')) {
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

app.listen(3001, () => {
  console.log("Saver API on http://127.0.0.1:3001");
});
