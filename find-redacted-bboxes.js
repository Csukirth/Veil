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
    const usedBboxKeys = new Set(); // Track which bboxes have been assigned to a tag
    
    // For each tag, use regex to find what it replaced
    for (const tagMatch of tags) {
      const tag = tagMatch[0];
      const tagType = tagMatch[1];
      
      let originalValue = null;
      let searchPattern = null;
      
      // Determine what type to search for - we'll match ALL instances
      let typePattern = null;
      
      if (tagType.includes('PHONE')) {
        // Strict phone pattern: must have at least 10 digits, with optional +1 prefix and separators
        typePattern = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        originalValue = "phone number";  // Placeholder
      } else if (tagType.includes('EMAIL')) {
        typePattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;  // Any email
        originalValue = "email address";  // Placeholder
      } else if (tagType.includes('NAME')) {
        const nameMatch = originalText.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
        if (nameMatch) {
          originalValue = nameMatch[1];
          searchPattern = originalValue;
        }
      } else if (tagType.includes('SSN') || tagType.includes('SOCIAL')) {
        typePattern = /\d{3}[-]?\d{2}[-]?\d{4}/g;  // Any SSN-like pattern
        originalValue = "SSN";  // Placeholder
      } else if (tagType.includes('MONEY') || tagType.includes('SALARY') || tagType.includes('AMOUNT')) {
        typePattern = /\$[\d,]+(?:\.\d{2})?/g;  // Any money pattern
        originalValue = "amount";  // Placeholder
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
      
      // Find the FIRST unused bounding box that matches this type
      const matchingBboxes = [];
      
      // Helper to create unique key for a bbox
      const getBboxKey = (bbox) => `${bbox.page}_${bbox.bbox.x}_${bbox.bbox.y}_${bbox.text}`;
      
      // First, try to find the bbox with the redacted tag itself
      for (const bbox of bboxData.boundingBoxes) {
        const key = getBboxKey(bbox);
        if (!usedBboxKeys.has(key) && (bbox.text === tag || bbox.text.includes(tag))) {
          matchingBboxes.push(bbox);
          usedBboxKeys.add(key);
          break; // Only take one bbox per tag
        }
      }
      
      // If that didn't work and we have a typePattern, find first unused match
      if (matchingBboxes.length === 0 && typePattern) {
        for (const bbox of bboxData.boundingBoxes) {
          const key = getBboxKey(bbox);
          typePattern.lastIndex = 0; // Reset regex
          if (!usedBboxKeys.has(key) && typePattern.test(bbox.text)) {
            matchingBboxes.push(bbox);
            usedBboxKeys.add(key);
            break; // Only take one bbox per tag
          }
        }
      }
      
      // If still no match and we have a specific searchPattern, try exact matching
      if (matchingBboxes.length === 0 && searchPattern) {
        for (const bbox of bboxData.boundingBoxes) {
          const key = getBboxKey(bbox);
          const regex = new RegExp(`\\b${searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
          if (!usedBboxKeys.has(key) && regex.test(bbox.text)) {
            matchingBboxes.push(bbox);
            usedBboxKeys.add(key);
            break; // Only take one bbox per tag
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
      
      // Refine bounding boxes to only cover the sensitive value, not the full text
      const refinedBboxes = uniqueBboxes.map(bbox => {
        const fullText = bbox.text;
        
        // Extract the actual sensitive value from this bbox using the type pattern
        let actualValue = null;
        if (typePattern) {
          typePattern.lastIndex = 0;  // Reset regex
          const match = typePattern.exec(fullText);
          if (match) {
            actualValue = match[0];
          }
        } else if (searchPattern) {
          actualValue = originalValue;
        }
        
        if (!actualValue) {
          return bbox;  // Can't refine, return as-is
        }
        
        // If the bbox text exactly matches the value, use as-is
        if (fullText === actualValue) {
          return bbox;
        }
        
        // Find where the actual value appears in the full text
        const startIndex = fullText.indexOf(actualValue);
        if (startIndex !== -1) {
          // Calculate character widths (approximate)
          const charWidth = bbox.bbox.width / fullText.length;
          
          // Calculate new x position and width
          const newX = bbox.bbox.x + (startIndex * charWidth);
          const newWidth = actualValue.length * charWidth;
          
          return {
            ...bbox,
            bbox: {
              x: Math.round(newX),
              y: bbox.bbox.y,
              width: Math.round(newWidth),
              height: bbox.bbox.height
            }
          };
        }
        
        // If we can't find the value, return original bbox
        return bbox;
      });
      
      // Display results
      console.log(`${results.length + 1}. ${tag}`);
      console.log(`   Type: ${tagType}`);
      console.log(`   Original: "${originalValue}"`);
      console.log(`   Bounding Boxes: ${refinedBboxes.length}`);
      
      if (refinedBboxes.length > 0) {
        refinedBboxes.forEach((bbox, idx) => {
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
        boundingBoxes: refinedBboxes
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

