// blur-pdf.js
// Securely redacts the PDF by flattening pages to images with black boxes

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, Image } from "canvas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAVED_DIR = path.join(__dirname, "saved");

// Canvas factory for Node.js PDF.js rendering
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return {
      canvas,
      context,
    };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function blurPDF() {
  try {
    console.log("\n🔒 Securely Redacting PDF (Flattening to Images)\n");
    console.log("=".repeat(80));

    // Load the redacted bounding boxes
    const bboxData = JSON.parse(
      await fs.readFile(path.join(SAVED_DIR, "redacted_bboxes.json"), "utf8")
    );
    
    console.log(`📦 Loaded ${bboxData.length} redaction(s) from redacted_bboxes.json`);
    
    // Find all bounding boxes
    const allBboxes = [];
    for (const redaction of bboxData) {
      if (redaction.boundingBoxes && redaction.boundingBoxes.length > 0) {
        allBboxes.push(...redaction.boundingBoxes.map(bbox => ({
          ...bbox,
          type: redaction.type,
          originalValue: redaction.originalValue
        })));
      }
    }
    
    if (allBboxes.length === 0) {
      console.error("⚠️  No bounding boxes found to blur");
      return;
    }
    
    console.log(`🎯 Total bounding boxes to blur: ${allBboxes.length}\n`);
    
    // Find the original PDF file
    const files = await fs.readdir(SAVED_DIR);
    const pdfFile = files.find(f => f.endsWith('.pdf') && !f.includes('_REDACTED'));
    
    if (!pdfFile) {
      console.error("⚠️  No PDF file found in saved directory");
      return;
    }
    
    console.log(`📄 Original PDF: ${pdfFile}`);
    
    // Load the PDF with PDF.js for rendering
    const pdfPath = path.join(SAVED_DIR, pdfFile);
    const pdfData = await fs.readFile(pdfPath);
    const loadingTask = getDocument({ data: new Uint8Array(pdfData) });
    const pdfDoc = await loadingTask.promise;
    
    console.log(`📖 PDF has ${pdfDoc.numPages} page(s)\n`);
    
    // Group bounding boxes by page
    const bboxesByPage = {};
    for (const bbox of allBboxes) {
      if (!bboxesByPage[bbox.page]) {
        bboxesByPage[bbox.page] = [];
      }
      bboxesByPage[bbox.page].push(bbox);
    }
    
    console.log("🖼️  Flattening pages to images with redactions...\n");
    
    // Create a new PDF document
    const newPdfDoc = await PDFDocument.create();
    
    // Process each page
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      console.log(`📄 Processing Page ${pageNum}...`);
      
      const page = await pdfDoc.getPage(pageNum);
      const RENDER_SCALE = 2.0; // Higher scale for better quality
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const originalViewport = page.getViewport({ scale: 1.0 }); // Get original dimensions
      
      console.log(`   📐 Original page size: ${originalViewport.width}×${originalViewport.height}`);
      console.log(`   📐 Render size: ${viewport.width}×${viewport.height}`);
      
      // Create canvas for rendering
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Fill with white background first (PDFs default to transparent)
      context.fillStyle = 'white';
      context.fillRect(0, 0, viewport.width, viewport.height);
      
      // Render PDF page to canvas with Node.js canvas factory
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvasFactory: new NodeCanvasFactory()
      }).promise;
      
      // Draw black rectangles over sensitive areas
      const pageBboxes = bboxesByPage[pageNum] || [];
      if (pageBboxes.length > 0) {
        console.log(`   🔒 Blurring ${pageBboxes.length} sensitive item(s)`);
        
        context.fillStyle = 'black';
        
        for (const bbox of pageBboxes) {
          // Scale coordinates to match rendered viewport (scale 2.0)
          const SCALE = 2.0;
          const x = bbox.bbox.x * SCALE;
          const width = bbox.bbox.width * SCALE;
          const height = bbox.bbox.height * SCALE;
          
          // Convert from PDF coordinates (bottom-left origin) to Canvas coordinates (top-left origin)
          // Canvas Y = Canvas Height - PDF Y - Height
          const y = viewport.height - (bbox.bbox.y * SCALE) - height;
          
          // Draw black rectangle
          context.fillRect(x, y, width, height);
          
          console.log(`      ✓ ${bbox.type}: "${bbox.originalValue}" at (${Math.round(x)}, ${Math.round(y)})`);
        }
      }
      
      // Convert canvas to PNG buffer
      const imgBuffer = canvas.toBuffer('image/png');
      
      // DEBUG: Save canvas as image to check rendering
      const debugImagePath = path.join(SAVED_DIR, `debug_page_${pageNum}.png`);
      await fs.writeFile(debugImagePath, imgBuffer);
      console.log(`   🔍 DEBUG: Saved canvas to ${debugImagePath}`);
      
      // Embed the image in the new PDF
      const pngImage = await newPdfDoc.embedPng(imgBuffer);
      
      // Create page with original PDF dimensions (before scaling)
      const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);
      
      // Draw the image scaled back to original size
      newPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });
      
      console.log(`   📐 Final PDF page size: ${originalViewport.width}×${originalViewport.height}`);
      
      console.log(`   ✅ Page ${pageNum} flattened\n`);
    }
    
    // Save the redacted PDF
    const pdfBytes = await newPdfDoc.save();
    const outputFilename = pdfFile.replace('.pdf', '_REDACTED.pdf');
    const outputPath = path.join(SAVED_DIR, outputFilename);
    await fs.writeFile(outputPath, pdfBytes);
    
    console.log("=".repeat(80));
    console.log(`\n✅ Success! Securely redacted PDF saved to:`);
    console.log(`   📄 ${outputFilename}`);
    console.log(`   📍 ${outputPath}\n`);
    console.log(`🔒 Redacted ${allBboxes.length} sensitive area(s) across ${Object.keys(bboxesByPage).length} page(s)`);
    console.log(`🛡️  PDF is now flattened - text cannot be copied or extracted!\n`);
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    
    if (error.code === "ENOENT") {
      console.error("\nMake sure these files exist:");
      console.error("  - redacted_bboxes.json (from find-redacted-bboxes.js)");
      console.error("  - Original PDF file in 'saved' folder\n");
    }
  }
}

blurPDF();
