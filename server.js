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

app.post("/api/save-text", async (req, res) => {
  try {
    const { filename, text } = req.body || {};
    if (!text) return res.status(400).send("Missing text");
    
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

app.listen(3001, () => {
  console.log("Saver API on http://127.0.0.1:3001");
});
