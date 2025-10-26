// blur-pdf-simple.js
// Uses Ghostscript (system command) to convert PDF to high-quality images, then rebuilds as flattened PDF

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";
import { execSync } from "child_process";
import { createCanvas, loadImage } from "canvas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAVED_DIR = path.join(__dirname, "saved");

async function blurPDF() {
  try {
    // Load the redacted bounding boxes
    const bboxData = JSON.parse(
      await fs.readFile(path.join(SAVED_DIR, "redacted_bboxes.json"), "utf8")
    );
    
    // Flatten all bounding boxes
    const allBboxes = [];
    for (const redaction of bboxData) {
      for (const bbox of redaction.boundingBoxes) {
        allBboxes.push({
          ...bbox,
          type: redaction.type,
          originalValue: redaction.originalValue
        });
      }
    }
    
    if (allBboxes.length === 0) {
      console.error("⚠️  No bounding boxes found to blur");
      return;
    }
    
    // Get the PDF filename from extracted_bboxes.json to know which PDF to process
    const bboxesData = JSON.parse(
      await fs.readFile(path.join(SAVED_DIR, "extracted_bboxes.json"), "utf8")
    );
    const pdfFile = bboxesData.filename;
    
    if (!pdfFile) {
      console.error("⚠️  No filename found in extracted_bboxes.json");
      return;
    }
    
    console.log(`🎨 Redacting ${allBboxes.length} item(s) in ${pdfFile}...`);
    
    const pdfPath = path.join(SAVED_DIR, pdfFile);
    
    // Check if Ghostscript is available
    try {
      execSync('gs --version', { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      console.error("❌ Ghostscript not found. Please install:");
      console.error("   macOS: brew install ghostscript");
      console.error("   Linux: sudo apt-get install ghostscript");
      throw new Error("Ghostscript is required for PDF flattening");
    }
    
    // Get PDF page count
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const numPages = pdfDoc.getPageCount();
    
    // Group bounding boxes by page
    const bboxesByPage = {};
    for (const bbox of allBboxes) {
      if (!bboxesByPage[bbox.page]) {
        bboxesByPage[bbox.page] = [];
      }
      bboxesByPage[bbox.page].push(bbox);
    }
    
    // Create a new PDF document
    const newPdfDoc = await PDFDocument.create();
    
    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      
      const tempImagePath = path.join(SAVED_DIR, `temp_page_${pageNum}.png`);
      
      // Convert PDF page to image using Ghostscript (300 DPI for quality)
      const gsCommand = `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r300 -dFirstPage=${pageNum} -dLastPage=${pageNum} -sOutputFile="${tempImagePath}" "${pdfPath}"`;
      
      try {
        execSync(gsCommand, { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        console.error(`   ❌ Failed to convert page ${pageNum} to image`);
        throw err;
      }
      
      // Load the image
      let img;
      try {
        img = await loadImage(tempImagePath);
      } catch (err) {
        console.error(`   ❌ Failed to load converted image for page ${pageNum}`);
        console.error(`   This usually means Ghostscript created a corrupt/blank image`);
        throw err;
      }
      
      // Create canvas with image
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      
      // Draw the original image
      ctx.drawImage(img, 0, 0);
      
      // Draw black rectangles over sensitive areas
      const pageBboxes = bboxesByPage[pageNum] || [];
      if (pageBboxes.length > 0) {
        
        ctx.fillStyle = 'black';
        
        // Scale factor: 300 DPI = 300/72 = 4.166 scale from PDF points
        const SCALE = 300 / 72;
        const PADDING = 1 * SCALE;  // 1 PDF point of padding
        
        for (const bbox of pageBboxes) {
          // Scale factor: 300 DPI = 300/72 = 4.166 scale from PDF points
          const x = bbox.bbox.x * SCALE;
          const width = bbox.bbox.width * SCALE + (PADDING * 2);
          const height = bbox.bbox.height * SCALE + (PADDING * 2);
          
          // Convert from PDF coordinates (bottom-left origin) to canvas coordinates (top-left origin)
          // PDF: (0,0) is bottom-left, y increases upward
          // Canvas: (0,0) is top-left, y increases downward
          // Formula: canvasY = imageHeight - (pdfY + pdfHeight)
          const y = img.height - (bbox.bbox.y * SCALE) - (bbox.bbox.height * SCALE);
          
          ctx.fillRect(x, y, width, height);
        }
      }
      
      // Convert canvas to PNG buffer
      const redactedImageBuffer = canvas.toBuffer('image/png');
      
      // Embed the redacted image in the new PDF
      const pngImage = await newPdfDoc.embedPng(redactedImageBuffer);
      
      // Get original page dimensions
      const originalPage = pdfDoc.getPage(pageNum - 1);
      const { width, height } = originalPage.getSize();
      
      // Add page with original dimensions
      const newPage = newPdfDoc.addPage([width, height]);
      newPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
      
      // Clean up temp image
      await fs.unlink(tempImagePath);
    }
    
    // Save the redacted PDF
    const redactedPdfBytes = await newPdfDoc.save();
    const outputFilename = pdfFile.replace('.pdf', '_REDACTED.pdf');
    const outputPath = path.join(SAVED_DIR, outputFilename);
    await fs.writeFile(outputPath, redactedPdfBytes);
    
    console.log(`✅ Created ${outputFilename}`);
    
  } catch (error) {
    console.error("\n❌ Error during PDF blurring:", error.message);
    console.error(error.stack);
  }
}

blurPDF();

