// compare-redactions.js
// Simple command-line tool to compare original vs redacted files
// Usage: node compare-redactions.js

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAVED_DIR = path.join(__dirname, "saved");
const ORIGINAL_FILE = "extracted.txt";
const REDACTED_FILE = "extractedCopy.txt";

async function compareRedactions() {
  try {
    console.log("\n🔍 Comparing Redactions\n");
    console.log("=".repeat(80));

    const originalPath = path.join(SAVED_DIR, ORIGINAL_FILE);
    const redactedPath = path.join(SAVED_DIR, REDACTED_FILE);

    const originalText = await fs.readFile(originalPath, "utf8");
    const redactedText = await fs.readFile(redactedPath, "utf8");

    console.log(`\n📄 Original: ${ORIGINAL_FILE}`);
    console.log(`📄 Redacted: ${REDACTED_FILE}\n`);
    console.log("=".repeat(80));
    console.log("\n");

    // Find all tags
    const tags = [...redactedText.matchAll(/<([^>]+)>/g)];
    const uniqueTags = [...new Set(tags.map(m => m[0]))];
    
    console.log(`Found ${uniqueTags.length} unique redaction tag(s):\n`);
    
    uniqueTags.forEach((tag, idx) => {
      console.log(`${idx + 1}. ${tag}`);
    });
    
    console.log("\n" + "=".repeat(80));
    console.log("\n📊 Redacted Values:\n");
    
    // Manual extraction for common patterns
    const results = [];
    
    // Extract NAME (at the very beginning)
    if (redactedText.startsWith("<NAME>")) {
      const nameMatch = originalText.match(/^([A-Z\s]+?)(?=\s{2,})/);
      if (nameMatch) {
        results.push({ tag: "<NAME>", value: nameMatch[1].trim() });
      }
    }
    
    // Extract PHONE NUMBER (pattern: digits with dashes)
    if (redactedText.includes("<PHONE NUMBER>")) {
      const phoneMatch = originalText.match(/(\d{3}-\d{3}-\d{4})/);
      if (phoneMatch) {
        results.push({ tag: "<PHONE NUMBER>", value: phoneMatch[1] });
      }
    }
    
    // Extract EMAIL (pattern: email address)
    if (redactedText.includes("<EMAIL>")) {
      const emailMatch = originalText.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
      if (emailMatch) {
        results.push({ tag: "<EMAIL>", value: emailMatch[1] });
      }
    }
    
    // Extract GPA (pattern: number after "GPA:")
    if (redactedText.includes("<GPA>")) {
      const gpaMatch = originalText.match(/GPA:\s*(\d+\.\d+)/);
      if (gpaMatch) {
        results.push({ tag: "<GPA>", value: gpaMatch[1] });
      }
    }
    
    // Extract MONEY (pattern: $X,XXX format)
    if (redactedText.includes("<MONEY>")) {
      const moneyMatch = originalText.match(/\$[\d,]+/);
      if (moneyMatch) {
        results.push({ tag: "<MONEY>", value: moneyMatch[0] });
      }
    }
    
    // Display results
    results.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.tag}`);
      console.log(`   ➜ "${result.value}"\n`);
    });
    
    console.log("=".repeat(80));
    console.log(`\n✨ Successfully identified ${results.length} redaction(s)\n`);

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    
    if (error.code === "ENOENT") {
      console.error("\n💡 Make sure both files exist in the 'saved' folder:");
      console.error(`   - ${ORIGINAL_FILE}`);
      console.error(`   - ${REDACTED_FILE}\n`);
    }
  }
}

// Run the comparison
compareRedactions();
