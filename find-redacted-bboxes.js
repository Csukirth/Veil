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
    // Read files - always use the generic filenames that server.js writes
    const originalText = await fs.readFile(path.join(SAVED_DIR, "extracted.txt"), "utf8");
    const maskedText = await fs.readFile(path.join(SAVED_DIR, "extracted_masked.txt"), "utf8");
    
    // Load bounding boxes from the generic file
    const bboxData = JSON.parse(
      await fs.readFile(path.join(SAVED_DIR, "extracted_bboxes.json"), "utf8")
    );
    
    // Find all redaction tags
    const tagPattern = /<([^>]+)>/g;
    const tags = [...maskedText.matchAll(tagPattern)];
    
    console.log(`🔍 Finding bounding boxes for ${tags.length} detection(s)...`);
    
    const results = [];
    const usedBboxKeys = new Map(); // Track which bboxes have been assigned to which tag types
    
    // Helper to create unique key for a bbox with tag type
    const getBboxKey = (bbox, tagType = '') => `${bbox.page}_${bbox.bbox.x}_${bbox.bbox.y}_${tagType}`;
    
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
      
      // Find ALL unused bounding boxes that match this tag/type
      const matchingBboxes = [];
      
      // First, try to find the bbox with the redacted tag itself
      for (const bbox of bboxData.boundingBoxes) {
        const key = getBboxKey(bbox, tagType);
        if (!usedBboxKeys.has(key) && (bbox.text === tag || bbox.text.includes(tag))) {
          matchingBboxes.push(bbox);
          usedBboxKeys.set(key, true);
          // Don't break - find all matches
        }
      }
      
      // If that didn't work and we have a typePattern, find ALL unused matches
      if (matchingBboxes.length === 0 && typePattern) {
        for (const bbox of bboxData.boundingBoxes) {
          const key = getBboxKey(bbox, tagType);
          typePattern.lastIndex = 0; // Reset regex
          if (!usedBboxKeys.has(key) && typePattern.test(bbox.text)) {
            matchingBboxes.push(bbox);
            usedBboxKeys.set(key, true);
            // Don't break - find all matches for this type
          }
        }
      }
      
      // If still no match and we have a specific searchPattern, try exact matching
      if (matchingBboxes.length === 0 && searchPattern) {
        for (const bbox of bboxData.boundingBoxes) {
          const key = getBboxKey(bbox, tagType);
          const regex = new RegExp(`\\b${searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
          if (!usedBboxKeys.has(key) && regex.test(bbox.text)) {
            matchingBboxes.push(bbox);
            usedBboxKeys.set(key, true);
            // Don't break - find all matches
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
      
      // Display results summary
      if (refinedBboxes.length > 0) {
        console.log(`   ✓ ${tagType}: ${refinedBboxes.length} instance(s) found`);
      }
      
      results.push({
        tag,
        type: tagType,
        originalValue,
        boundingBoxes: refinedBboxes
      });
    }
    
    // FALLBACK: Scan entire document for common patterns that SIM API might have missed
    console.log("\n🔍 Running fallback scan...");
    
    const fallbackPatterns = [
      { type: 'PHONE_FALLBACK', matchedType: 'PHONE_NUMBER', pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|(?:\d{3}[-.\s]\d{3}[-.\s]\d{4})/g, desc: 'Phone numbers' },
      { type: 'EMAIL_FALLBACK', matchedType: 'EMAIL_ADDRESS', pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, desc: 'Email addresses' },
      { type: 'SSN_FALLBACK', matchedType: 'SSN', pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, desc: 'SSN patterns' }
    ];
    
    // Mark all already-redacted bboxes as used for their specific types
    for (const result of results) {
      for (const bbox of result.boundingBoxes) {
        usedBboxKeys.set(getBboxKey(bbox, result.type), true);
      }
    }
    
    let fallbackCount = 0;
    for (const { type, matchedType, pattern, desc } of fallbackPatterns) {
      const foundBboxes = [];
      
      for (const bbox of bboxData.boundingBoxes) {
        const key = getBboxKey(bbox, type);
        const matchedKey = getBboxKey(bbox, matchedType);
        pattern.lastIndex = 0; // Reset regex
        
        // Skip if already matched by SIM API or by fallback
        if (!usedBboxKeys.has(key) && !usedBboxKeys.has(matchedKey) && pattern.test(bbox.text)) {
          foundBboxes.push(bbox);
          usedBboxKeys.set(key, true);
          fallbackCount++;
        }
      }
      
      if (foundBboxes.length > 0) {
        console.log(`   ⚠️  Found ${foundBboxes.length} missed ${desc}`);
        fallbackCount++;
        
        // Add to results
        results.push({
          tag: `<${type}>`,
          type: type,
          originalValue: desc,
          boundingBoxes: foundBboxes
        });
      }
    }
    
    if (fallbackCount === 0) {
      console.log(`   ✓ No missed items`);
    }
    
    // Save to JSON
    const jsonOutput = path.join(SAVED_DIR, "redacted_bboxes.json");
    await fs.writeFile(jsonOutput, JSON.stringify(results, null, 2), "utf8");
    
    // Count total bboxes to redact
    const totalBboxes = results.reduce((sum, r) => sum + r.boundingBoxes.length, 0);
    console.log(`\n✅ Found ${totalBboxes} item(s) to redact across ${results.length} type(s)`);
    
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

