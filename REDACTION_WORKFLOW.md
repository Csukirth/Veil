# PDF Redaction Workflow

Complete workflow for redacting sensitive information from PDFs with bounding box tracking.

## Overview

This system extracts text from PDFs, identifies sensitive information via SIM AI, tracks bounding boxes, and creates redacted PDFs with sensitive areas blurred.

## Workflow Steps

### 1. Upload PDF via UI

- Open the web app and click **"Upload & Extract Text"**
- Select your PDF file

**What happens:**
- PDF text is extracted → saved to `saved/extracted.txt`
- Original PDF is saved → `saved/{filename}.pdf`
- All text bounding boxes are captured → `saved/{filename}_bboxes.json`
- Text is sent to SIM AI for redaction (if API key is configured)
- Redacted text is saved → `saved/extracted_masked.txt`

**Files Created:**
```
saved/
  ├── {filename}.pdf                 # Original PDF
  ├── extracted.txt                  # Original extracted text
  ├── extracted_masked.txt           # Redacted text with tags like <EMAIL>
  └── {filename}_bboxes.json         # All bounding boxes with coordinates
```

### 2. Find Redacted Bounding Boxes

Run the script to identify which bounding boxes correspond to redacted text:

```bash
node find-redacted-bboxes.js
```

**What it does:**
- Compares `extracted.txt` vs `extracted_masked.txt`
- Identifies what got redacted (e.g., `925-819-8725` → `<PHONE_NUMBER>`)
- Finds the bounding box coordinates for each redacted item
- Outputs results

**Files Created:**
```
saved/
  ├── redacted_bboxes.json          # Only redacted items with their bounding boxes
  └── redacted_bboxes_report.txt    # Human-readable report
```

**Example Output:**
```json
[
  {
    "tag": "<PHONE_NUMBER>",
    "type": "PHONE_NUMBER",
    "originalValue": "925-819-8725",
    "boundingBoxes": [
      {
        "page": 1,
        "text": "<PHONE_NUMBER>",
        "bbox": {
          "x": 259,
          "y": 450,
          "width": 51,
          "height": 9
        }
      }
    ]
  }
]
```

### 3. Blur the PDF

Run the script to create a redacted PDF with sensitive areas blacked out:

```bash
node blur-pdf.js
```

**What it does:**
- Loads the original PDF from `saved/{filename}.pdf`
- Reads bounding boxes from `saved/redacted_bboxes.json`
- Draws black rectangles over all sensitive areas
- Saves the redacted PDF

**Files Created:**
```
saved/
  └── {filename}_REDACTED.pdf       # Final redacted PDF with blurred areas
```

## Complete File Structure

After running all steps:

```
saved/
  ├── {original_name}.pdf                      # Original PDF
  ├── {original_name}_REDACTED.pdf             # Redacted PDF (final output)
  ├── extracted.txt                            # Original text
  ├── extracted_masked.txt                     # Text with <TAG> placeholders
  ├── {original_name}_bboxes.json              # All bounding boxes
  ├── redacted_bboxes.json                     # Only redacted bounding boxes
  └── redacted_bboxes_report.txt               # Human-readable report
```

## Configuration

### SIM AI Integration

To enable automatic redaction via SIM AI:

1. Create a `.env` file in the project root:
   ```
   SIM_API_KEY=your_api_key_here
   ```

2. Restart the server:
   ```bash
   node server.js
   ```

The SIM API will automatically:
- Receive extracted text
- Identify sensitive information
- Return redacted text with tags like `<PHONE_NUMBER>`, `<EMAIL>`, etc.

### Supported Redaction Types

The system recognizes these patterns:
- `<PHONE_NUMBER>` or `<PHONE>` - Phone numbers (e.g., 123-456-7890)
- `<EMAIL_ADDRESS>` or `<EMAIL>` - Email addresses
- `<NAME>` - Person names
- `<SSN>` or `<SOCIAL>` - Social Security Numbers
- `<MONEY>`, `<SALARY>`, `<AMOUNT>` - Monetary values

## Quick Start

```bash
# 1. Start the server
node server.js

# 2. Open the web app and upload a PDF

# 3. Find what got redacted
node find-redacted-bboxes.js

# 4. Create redacted PDF
node blur-pdf.js

# 5. Find your redacted PDF in saved/ folder!
```

## Troubleshooting

### "No PDF file found"
- Make sure you uploaded a PDF via the web UI first
- The PDF should be in the `saved/` directory

### "No bounding boxes file found"
- Upload a PDF through the UI to generate bounding boxes
- Look for `*_bboxes.json` in the `saved/` folder

### "No redacted_bboxes.json found"
- Run `node find-redacted-bboxes.js` first
- This creates the file needed for `blur-pdf.js`

### SIM API not working
- Check that `.env` file exists with `SIM_API_KEY`
- Restart the server after creating `.env`
- Check server logs for API errors

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `find-redacted-bboxes.js` | Compare original vs masked text, find bounding boxes |
| `blur-pdf.js` | Create redacted PDF with blurred sensitive areas |
| `compare-redactions.js` | (Alternative) Compare redactions with context matching |

## Notes

- Bounding boxes use pixel coordinates: `(x, y, width, height)`
- Coordinates are from top-left corner of the PDF page
- Black rectangles completely cover sensitive text
- Original PDF remains untouched; redacted version has `_REDACTED` suffix

