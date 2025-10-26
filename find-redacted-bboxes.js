// find-redacted-bboxes.js
// Simpler approach: Find what got redacted and locate their bboxes by pattern matching

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAVED_DIR = path.join(__dirname, "saved");

async function findRedactedBboxes() {
  try {
    console.log("\n🔍 Finding Bounding Boxes for Redacted Words\n");
    console.log("=".repeat(80));

    // Read files
    const originalText = await fs.readFile(path.join(SAVED_DIR, "extracted.txt"), "utf8");
    const maskedText = await fs.readFile(path.join(SAVED_DIR, "extracted_masked.txt"), "utf8");
    
    // Load bounding boxes
    const bboxFiles = await fs.readdir(SAVED_DIR);
    const bboxFile = bboxFiles.find(f => f.endsWith("_bboxes.json"));
    
    if (!bboxFile) {
      console.error("⚠️  No bounding boxes file found");
      return;
    }
    
    const bboxData = JSON.parse(
      await fs.readFile(path.join(SAVED_DIR, bboxFile), "utf8")
    );
    
    console.log(`📦 Loaded ${bboxData.boundingBoxes.length} bounding boxes\n`);
    
    // Find all redaction tags
    const tagPattern = /<([^>]+)>/g;
    const tags = [...maskedText.matchAll(tagPattern)];
    
    console.log(`Found ${tags.length} redaction tag(s)\n`);
    console.log("=".repeat(80));
    console.log("\n📊 REDACTED WORDS:\n");
    
    const results = [];
    
    // For each tag, use regex to find what it replaced
    for (const tagMatch of tags) {
      const tag = tagMatch[0];
      const tagType = tagMatch[1];
      
      let originalValue = null;
      let searchPattern = null;
      
      // Determine what to search for based on tag type
      if (tagType.includes('PHONE')) {
        // Find phone number pattern
        const phoneMatch = originalText.match(/\b(\d{3}[-.]?\d{3}[-.]?\d{4})\b/);
        if (phoneMatch) {
          originalValue = phoneMatch[1];
          searchPattern = originalValue;
        }
      } else if (tagType.includes('EMAIL')) {
        // Find email pattern
        const emailMatch = originalText.match(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i);
        if (emailMatch) {
          originalValue = emailMatch[1];
          searchPattern = originalValue;
        }
      } else if (tagType.includes('NAME')) {
        // Find name at the beginning
        const nameMatch = originalText.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
        if (nameMatch) {
          originalValue = nameMatch[1];
          searchPattern = originalValue;
        }
      } else if (tagType.includes('SSN') || tagType.includes('SOCIAL')) {
        // Find SSN pattern
        const ssnMatch = originalText.match(/\b(\d{3}[-]?\d{2}[-]?\d{4})\b/);
        if (ssnMatch) {
          originalValue = ssnMatch[1];
          searchPattern = originalValue;
        }
      } else if (tagType.includes('MONEY') || tagType.includes('SALARY') || tagType.includes('AMOUNT')) {
        // Find money pattern
        const moneyMatch = originalText.match(/\$[\d,]+(?:\.\d{2})?/);
        if (moneyMatch) {
          originalValue = moneyMatch[0];
          searchPattern = originalValue.replace('$', '\\$');
        }
      }
      
      if (!originalValue) {
        console.log(`⚠️  ${tag}: Could not determine original value`);
        results.push({
          tag,
          type: tagType,
          originalValue: null,
          boundingBoxes: []
        });
        continue;
      }
      
      // Find bounding boxes that match
      const matchingBboxes = [];
      
      // First, try to find the bbox with the redacted tag itself 
      // (in case the PDF already had redacted tags)
      for (const bbox of bboxData.boundingBoxes) {
        if (bbox.text === tag || bbox.text.includes(tag)) {
          matchingBboxes.push(bbox);
        }
      }
      
      // If that didn't work, try exact match with original value
      if (matchingBboxes.length === 0) {
        for (const bbox of bboxData.boundingBoxes) {
          if (bbox.text === originalValue) {
            matchingBboxes.push(bbox);
          }
        }
      }
      
      // If still no match, try partial matches (split into words)
      if (matchingBboxes.length === 0) {
        const words = originalValue.split(/[\s@.\-]+/).filter(w => w.length > 1);
        for (const word of words) {
          for (const bbox of bboxData.boundingBoxes) {
            if (bbox.text.includes(word) && word.length > 2) {
              matchingBboxes.push(bbox);
            }
          }
        }
      }
      
      // Remove duplicates
      const uniqueBboxes = matchingBboxes.filter((bbox, index, self) =>
        index === self.findIndex(b => 
          b.page === bbox.page && 
          b.bbox.x === bbox.bbox.x && 
          b.bbox.y === bbox.bbox.y &&
          b.text === bbox.text
        )
      );
      
      // Display results
      console.log(`${results.length + 1}. ${tag}`);
      console.log(`   Type: ${tagType}`);
      console.log(`   Original: "${originalValue}"`);
      console.log(`   Bounding Boxes: ${uniqueBboxes.length}`);
      
      if (uniqueBboxes.length > 0) {
        uniqueBboxes.forEach((bbox, idx) => {
          console.log(`      ${idx + 1}. Page ${bbox.page}: "${bbox.text}"`);
          console.log(`         Position: (x: ${bbox.bbox.x}, y: ${bbox.bbox.y})`);
          console.log(`         Size: ${bbox.bbox.width}×${bbox.bbox.height}px`);
        });
      } else {
        console.log(`      ⚠️  No bounding boxes found`);
      }
      console.log();
      
      results.push({
        tag,
        type: tagType,
        originalValue,
        boundingBoxes: uniqueBboxes
      });
    }
    
    // Save to JSON
    const jsonOutput = path.join(SAVED_DIR, "redacted_bboxes.json");
    await fs.writeFile(jsonOutput, JSON.stringify(results, null, 2), "utf8");
    
    console.log("=".repeat(80));
    console.log(`\n✅ Successfully processed ${results.length} redaction(s)`);
    console.log(`📦 JSON saved to: redacted_bboxes.json\n`);
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.code === "ENOENT") {
      console.error("\nMake sure these files exist:");
      console.error("  - extracted.txt");
      console.error("  - extracted_masked.txt");
      console.error("  - *_bboxes.json\n");
    }
  }
}

findRedactedBboxes();

