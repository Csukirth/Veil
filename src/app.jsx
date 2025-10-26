import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import Tesseract from "tesseract.js";
import "./App.css";

import {
  Upload,
  FileText,
  Link as LinkIcon,
  Globe,
  Loader2,
  X,
  Video,
  Play,
} from "lucide-react";

// --- PDF.js setup (client-side extraction) ---
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const { getDocument } = pdfjsLib;

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-primary"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-secondary"
    >
      {children}
    </button>
  );
}

function DocumentUploader() {
  const docInputRef = useRef(null);
  const [docName, setDocName] = useState("");
  const [redactedHref, setRedactedHref] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlsToScrape, setUrlsToScrape] = useState([]);
  const [searchMode, setSearchMode] = useState("url"); // "url" or "keyword"
  const [keywordQuery, setKeywordQuery] = useState("");
  const [maxResults, setMaxResults] = useState(5);
  const [searchResults, setSearchResults] = useState([]);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [viewingPdfUrl, setViewingPdfUrl] = useState("");

  const handleDocClick = () => docInputRef.current?.click();

  const onDocChange = async (e) => {
    setError("");
    setRedactedHref("");
    setSearchResults([]);
    setProgress(0);
    setProgressText("");
    const f = e.target.files?.[0];
    if (!f) return;

    // enforce PDF-only
    const isPDF = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPDF) {
      setError("Please upload a PDF file (.pdf).");
      return;
    }

    setDocName(f.name);
    setLoading(true);
    
    // Clear saved folder first
    try {
      setProgressText("Clearing previous files...");
      await fetch("/api/clear-saved", { method: "POST" });
    } catch (err) {
      console.warn("⚠️  Could not clear saved folder:", err);
    }
    
    setProgressText("Extracting text from PDF...");

    try {
      const buf = await f.arrayBuffer();
      // Clone the buffer before PDF.js consumes it
      const bufCopy = buf.slice(0);
      const pdf = await getDocument({ data: bufCopy }).promise;

      // 1) Extract text and bounding boxes from all pages
      let pages = [];
      const allBoundingBoxes = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 }); // Use scale 1.0 for accurate coordinates
        const content = await page.getTextContent();
        const txt = content.items.map(it => ("str" in it ? it.str : "")).join(" ").trim();
        pages.push(txt);
        
        // Extract bounding boxes for all text items in PDF coordinate space
        content.items.forEach((item) => {
          if (!item.str || item.str.trim() === "") return;
          
          const tx = item.transform;
          // tx[4] = x position, tx[5] = y position (bottom-left origin)
          // tx[0] = horizontal scale, tx[3] = vertical scale (font size)
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
            }
          });
        });
      }

      let finalText = pages.join("\n\n").trim();

      // 2) If empty/near-empty, OCR each page image instead
      const needsOCR = finalText.replace(/\s+/g, "").length < 5;
      if (needsOCR) {
        console.log("📷 PDF appears to be image-based, using OCR...");
        // Clear any empty bboxes from text-based extraction
        allBoundingBoxes.length = 0;
        
        const ocrTexts = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = 2;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: ctx, viewport }).promise;

          const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
          const { data } = await Tesseract.recognize(blob, "eng", {
            logger: () => {},
          });
          ocrTexts.push((data.text || "").trim());
          
          // Extract bounding boxes from OCR results (word-level)
          if (data.words) {
            data.words.forEach((word) => {
              if (!word.text || word.text.trim() === "") return;
              
              // Tesseract bbox is in image coordinates (top-left origin)
              // We need to convert to PDF coordinates (bottom-left origin)
              const bbox = word.bbox;
              const pdfViewport = page.getViewport({ scale: 1.0 }); // Get unscaled PDF dimensions
              
              // Scale factor from rendered canvas to PDF
              const scaleX = pdfViewport.width / canvas.width;
              const scaleY = pdfViewport.height / canvas.height;
              
              // Convert coordinates
              const x = bbox.x0 * scaleX;
              const width = (bbox.x1 - bbox.x0) * scaleX;
              const height = (bbox.y1 - bbox.y0) * scaleY;
              // Convert from top-left origin (canvas) to bottom-left origin (PDF)
              const y = pdfViewport.height - (bbox.y1 * scaleY);
              
              allBoundingBoxes.push({
                page: i,
                text: word.text,
                bbox: {
                  x: Math.round(x),
                  y: Math.round(y),
                  width: Math.round(width),
                  height: Math.round(height)
                }
              });
            });
          }
        }
        finalText = ocrTexts.join("\n\n").trim();
        console.log(`📦 Extracted ${allBoundingBoxes.length} bounding boxes from OCR`);
      }

      const suggested = (docName?.replace(/\.[^.]+$/, "") || "extracted") + ".txt";

      // Save extracted text with specific filename
      const res = await fetch("/api/save-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: suggested, text: finalText }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Save failed: ${res.status}${msg ? ` - ${msg}` : ""}`);
      }

      const data = await res.json();
      setProgress(33);
      setProgressText("Detecting sensitive information...");
      
      // Also save as "extracted.txt" for blur scripts
      await fetch("/api/save-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "extracted.txt", text: finalText }),
      });
      
      // Save the original PDF file
      const base64Pdf = btoa(
        new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      await fetch("/api/save-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: f.name,
          pdfData: base64Pdf
        }),
      });
      console.log(`Saved original PDF: ${f.name}`);
      
      // Save bounding boxes for all text items
      if (allBoundingBoxes.length > 0) {
        const bboxFilename = (docName?.replace(/\.[^.]+$/, "") || "extracted") + "_bboxes.json";
        const bboxContent = JSON.stringify({
          filename: f.name,
          totalPages: pdf.numPages,
          boundingBoxes: allBoundingBoxes,
          timestamp: new Date().toISOString()
        }, null, 2);
        
        // Save with specific filename
        await fetch("/api/save-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: bboxFilename,
            text: bboxContent
          }),
        });
        console.log(`Saved ${allBoundingBoxes.length} bounding boxes to ${bboxFilename}`);
        
        // Also save as "extracted_bboxes.json" for blur scripts
        await fetch("/api/save-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: "extracted_bboxes.json",
            text: bboxContent
          }),
        });
        
        // Wait a moment for SIM API to finish processing
        console.log("⏳ Waiting for SIM API to complete redaction...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Automatically trigger PDF blurring
        console.log("🔒 Starting automatic PDF blurring...");
        setProgress(66);
        setProgressText("Creating redacted PDF...");
        try {
          const blurRes = await fetch("/api/blur-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          
          if (blurRes.ok) {
            setProgress(100);
            setProgressText("Complete!");
            const blurData = await blurRes.json();
            setRedactedHref(blurData.redactedPath);
            console.log(`✅ Redacted PDF created: ${blurData.filename}`);
            console.log(`📄 Download at: ${blurData.redactedPath}`);
          } else {
            console.warn("⚠️  PDF blurring failed, but text extraction succeeded");
          }
        } catch (blurErr) {
          console.warn("⚠️  Could not auto-blur PDF:", blurErr.message);
        }
      }

    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to process PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleScraperClick = () => {
    setShowUrlModal(true);
    setUrlInput("");
    setUrlsToScrape([]);
    setSearchMode("url");
    setKeywordQuery("");
    setRedactedHref("");
    setSearchResults([]);
    setError("");
    setMaxResults(5);
    setError("");
  };

  const handleAddUrl = () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      setError("Please enter a URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(trimmedUrl);
      setUrlsToScrape([...urlsToScrape, trimmedUrl]);
      setUrlInput("");
      setError("");
    } catch (e) {
      setError("Please enter a valid URL (e.g., https://example.com/document.pdf)");
    }
  };

  const handleRemoveUrl = (index) => {
    setUrlsToScrape(urlsToScrape.filter((_, i) => i !== index));
  };

  const handleScrapePdfs = async () => {
    if (urlsToScrape.length === 0) {
      setError("Please add at least one URL");
      return;
    }

    setLoading(true);
    setError("");
    setShowUrlModal(false);
    
    // Clear saved folder first
    try {
      setProgressText("Clearing previous files...");
      await fetch("/api/clear-saved", { method: "POST" });
    } catch (err) {
      console.warn("⚠️  Could not clear saved folder:", err);
    }

    try {
      console.log(`🌐 Scraping ${urlsToScrape.length} PDF(s) using BrightData...`);

      for (let i = 0; i < urlsToScrape.length; i++) {
        const url = urlsToScrape[i];
        console.log(`\n📥 [${i + 1}/${urlsToScrape.length}] Fetching: ${url}`);

        // Call backend to fetch PDF using BrightData
        const response = await fetch("/api/scrape-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to scrape ${url}: ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ Successfully processed: ${result.filename}`);

        // Update UI with the last processed file's results
        if (i === urlsToScrape.length - 1) {
          setDocName(result.filename);
          if (result.textPath) setDownHref(result.textPath);
          if (result.redactedPath) setRedactedHref(result.redactedPath);
        }
      }

      console.log("\n🎉 All PDFs processed successfully!");

    } catch (err) {
      console.error("❌ Scraping error:", err);
      setError(err?.message || "Failed to scrape PDFs");
    } finally {
      setLoading(false);
      setUrlsToScrape([]);
    }
  };

  const handleAgenticSearch = async () => {
    if (!keywordQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError("");
    setShowUrlModal(false);
    setProgress(10);
    setProgressText("Clearing previous files...");
    setSearchResults([]);
    
    // Clear saved folder first
    try {
      await fetch("/api/clear-saved", { method: "POST" });
    } catch (err) {
      console.warn("⚠️  Could not clear saved folder:", err);
    }

    try {
      setProgress(30);
      setProgressText("Fetching and processing PDFs...");
      console.log(`🔍 Agentic Search: "${keywordQuery}"`);
      console.log(`📊 Looking for up to ${maxResults} PDFs...`);

      // Call backend agentic search endpoint
      const response = await fetch("/api/search-and-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: keywordQuery,
          maxResults: maxResults
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agentic search failed: ${errorText}`);
      }

      const result = await response.json();
      setProgress(100);
      setProgressText("Complete!");
      console.log(`✅ Search complete!`);
      console.log(`📊 Results: ${result.stats.processed}/${result.stats.searched} processed`);

      // Store all results that were successfully fetched (have originalPath or redactedPath)
      if (result.results && result.results.length > 0) {
        const successfulResults = result.results.filter(r => r.originalPath || r.redactedPath);
        setSearchResults(successfulResults);
        setDocName(`Found ${successfulResults.length} document(s)`);
      }

      console.log("\n🎉 Agentic search & scrape complete!");

    } catch (err) {
      console.error("❌ Agentic search error:", err);
      setError(err?.message || "Failed to perform agentic search");
    } finally {
      setLoading(false);
      setKeywordQuery("");
    }
  };

  return (
    <div className="uploader-container">
      {/* Centered Button Container */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <PrimaryButton onClick={handleDocClick} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
          Veil Documents. Hide What Matters
        </PrimaryButton>

        <PrimaryButton onClick={handleScraperClick} disabled={loading}>
          <Globe size={18} />
          Veil Search. Protect the Web.
        </PrimaryButton>
      </div>

      <input
        ref={docInputRef}
        type="file"
        accept=".pdf"
        onChange={onDocChange}
        className="hidden-input"
      />

      {/* Progress Bar */}
      {loading && (
        <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9em', color: '#9ca3af' }}>{progressText}</span>
            <span style={{ fontSize: '0.9em', color: '#9ca3af' }}>{progress}%</span>
          </div>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${progress}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              transition: 'width 0.3s ease',
              borderRadius: '4px'
            }} />
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {/* Single Document Result */}
      {redactedHref && searchResults.length === 0 && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div className="download-links" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setViewingPdfUrl(redactedHref);
                setShowPdfViewer(true);
              }}
              className="download-link"
              style={{ 
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                fontSize: '1.1em',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                color: 'white'
              }}
            >
              <FileText size={18} /> View PDF
            </button>
            <a
              href={redactedHref}
              download
              className="download-link"
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                fontSize: '1.1em',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'white'
              }}
            >
              <FileText size={18} /> Download PDF
            </a>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: showPdfViewer ? 'nowrap' : 'wrap' }}>
            {/* PDF List/Grid */}
            <div style={{ 
              flex: showPdfViewer ? '0 0 280px' : '1',
              display: showPdfViewer ? 'flex' : 'grid',
              flexDirection: showPdfViewer ? 'column' : undefined,
              gap: '1rem',
              gridTemplateColumns: showPdfViewer ? undefined : 'repeat(auto-fill, minmax(300px, 1fr))'
            }}>
              {searchResults.map((result, idx) => {
                const pdfPath = result.redactedPath || result.originalPath;
                const isRedacted = !!result.redactedPath;
                
                return (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: viewingPdfUrl === pdfPath ? '2px solid #3b82f6' : '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: showPdfViewer ? '0.75rem' : '1rem',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setViewingPdfUrl(pdfPath);
                  setShowPdfViewer(true);
                }}
                >
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ fontSize: '0.75em', color: '#9ca3af' }}>
                        {result.domain || 'Unknown Source'}
                      </div>
                      <div style={{ 
                        fontSize: '0.65em',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        background: isRedacted ? 
                          'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))' : 
                          'linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(249, 115, 22, 0.2))',
                        border: isRedacted ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(251, 146, 60, 0.4)',
                        color: isRedacted ? '#10b981' : '#fb923c',
                        fontWeight: '600'
                      }}>
                        {isRedacted ? 'Protected' : 'Original'}
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: showPdfViewer ? '0.8em' : '1em', 
                      color: '#fff', 
                      fontWeight: '500',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {result.title || result.filename}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingPdfUrl(pdfPath);
                        setShowPdfViewer(true);
                      }}
                      className="download-link"
                      style={{ 
                        background: viewingPdfUrl === pdfPath ? 
                          'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 
                          'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        fontSize: '0.75em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flex: 1,
                        justifyContent: 'center',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'white',
                        padding: '0.5rem 0.75rem'
                      }}
                    >
                      <FileText size={11} /> {viewingPdfUrl === pdfPath ? 'Viewing' : 'View'}
                    </button>
                    <a
                      href={pdfPath}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="download-link"
                      style={{ 
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        fontSize: '0.75em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flex: 1,
                        justifyContent: 'center',
                        color: 'white',
                        padding: '0.5rem 0.75rem'
                      }}
                    >
                      <FileText size={11} /> Download
                    </a>
                  </div>
                </div>
              );})}
            </div>

            {/* Inline PDF Viewer for Multiple Results */}
            {showPdfViewer && (
              <div style={{ 
                flex: '1',
                minWidth: 0,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  padding: '1rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1em', color: '#3b82f6' }}>
                    PDF Preview
                  </h3>
                  <button 
                    onClick={() => setShowPdfViewer(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
                    aria-label="Close viewer"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div style={{ 
                  background: '#1f2937',
                  position: 'relative',
                  height: `${Math.min(85, 50 + (searchResults.length * 8))}vh`,
                  maxHeight: `${Math.min(1400, 600 + (searchResults.length * 120))}px`,
                  overflow: 'auto'
                }}>
                  <iframe
                    src={viewingPdfUrl}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      display: 'block'
                    }}
                    title="PDF Viewer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact PDF Viewer (for single documents only) */}
      {showPdfViewer && searchResults.length === 0 && (
        <div style={{ 
          marginTop: '2rem',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '1rem',
            background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <h3 style={{ margin: 0, fontSize: '1em', color: '#3b82f6' }}>
              Redacted PDF Preview
            </h3>
            <button 
              onClick={() => setShowPdfViewer(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
              onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
              aria-label="Close viewer"
            >
              <X size={20} />
            </button>
          </div>
          <div style={{ 
            background: '#1f2937',
            position: 'relative',
            height: '85vh',
            maxHeight: '1400px',
            overflow: 'auto'
          }}>
            <iframe
              src={viewingPdfUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block'
              }}
              title="PDF Viewer"
            />
          </div>
        </div>
      )}

      {/* URL Scraping Modal */}
      {showUrlModal && (
        <div className="modal-overlay" onClick={() => setShowUrlModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Scrape PDFs with BrightData</h2>
              <button 
                className="modal-close" 
                onClick={() => setShowUrlModal(false)}
                aria-label="Close modal"
              >
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              {/* Mode Toggle */}
              <div className="mode-toggle">
                <button
                  className={`mode-toggle-btn ${searchMode === 'url' ? 'active' : ''}`}
                  onClick={() => setSearchMode('url')}
                >
                  Enter URLs
                </button>
                <button
                  className={`mode-toggle-btn ${searchMode === 'keyword' ? 'active' : ''}`}
                  onClick={() => setSearchMode('keyword')}
                >
                  🤖 Agentic Search
                </button>
              </div>

              {/* URL Mode */}
              {searchMode === 'url' && (
                <>
                  <p className="modal-description">
                    Enter PDF URLs to scrape using BrightData. The system will fetch each PDF, 
                    extract text, detect sensitive information, and create redacted versions.
                  </p>

                  <div className="url-input-group">
                    <input
                      type="text"
                      className="url-input"
                      placeholder="https://example.com/document.pdf"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
                    />
                    <SecondaryButton onClick={handleAddUrl}>
                      Add URL
                    </SecondaryButton>
                  </div>

                  {urlsToScrape.length > 0 && (
                    <div className="url-list">
                      <h3>URLs to Scrape ({urlsToScrape.length})</h3>
                      {urlsToScrape.map((url, index) => (
                        <div key={index} className="url-item">
                          <span className="url-text">{url}</span>
                          <button
                            className="url-remove"
                            onClick={() => handleRemoveUrl(index)}
                            aria-label="Remove URL"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="modal-actions">
                    <SecondaryButton onClick={() => setShowUrlModal(false)}>
                      Cancel
                    </SecondaryButton>
                    <PrimaryButton 
                      onClick={handleScrapePdfs}
                      disabled={urlsToScrape.length === 0}
                    >
                      <LinkIcon size={18} />
                      Scrape {urlsToScrape.length > 0 ? `${urlsToScrape.length} PDF(s)` : 'PDFs'}
                    </PrimaryButton>
                  </div>
                </>
              )}

              {/* Keyword Search Mode */}
              {searchMode === 'keyword' && (
                <>
                  <p className="modal-description">
                    🤖 <strong>AI-Powered Search:</strong> Enter keywords and let BrightData's agent automatically 
                    find, scrape, and redact relevant PDFs. Perfect for research, legal discovery, or bulk processing.
                  </p>

                  <div className="keyword-input-section">
                    <label className="input-label">Search Query</label>
                    <input
                      type="text"
                      className="url-input"
                      placeholder="e.g., 'financial reports 2024' or 'medical research papers'"
                      value={keywordQuery}
                      onChange={(e) => setKeywordQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAgenticSearch()}
                    />
                  </div>

                  <div className="keyword-input-section">
                    <label className="input-label">Max Results (1-10)</label>
                    <input
                      type="number"
                      className="url-input"
                      min="1"
                      max="10"
                      value={maxResults}
                      onChange={(e) => setMaxResults(Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))}
                    />
                  </div>

                  <div className="info-box">
                    <strong>How it works:</strong>
                    <ol>
                      <li>BrightData searches Google for PDFs matching your keywords</li>
                      <li>Automatically fetches the top {maxResults} results</li>
                      <li>Extracts text and detects sensitive information</li>
                      <li>Creates redacted versions with data blacked out</li>
                    </ol>
                  </div>

                  <div className="modal-actions">
                    <SecondaryButton onClick={() => setShowUrlModal(false)}>
                      Cancel
                    </SecondaryButton>
                    <PrimaryButton 
                      onClick={handleAgenticSearch}
                      disabled={!keywordQuery.trim()}
                    >
                      <LinkIcon size={18} />
                      🤖 Search & Redact
                    </PrimaryButton>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashcamProcessor() {
  const videoInputRef = useRef(null);
  const [videoName, setVideoName] = useState("");
  const [processedVideoUrl, setProcessedVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");
  const [processingMode, setProcessingMode] = useState("blackout");
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const handleVideoClick = () => {
    videoInputRef.current?.click();
  };

  const onVideoChange = async (e) => {
    setError("");
    setProcessedVideoUrl("");
    setProgress(0);
    setProgressText("");
    const f = e.target.files?.[0];
    if (!f) return;

    // Check for video file types
    const isVideo = f.type.startsWith("video/") || 
                   f.name.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/);
    if (!isVideo) {
      setError("Please upload a video file (.mp4, .mov, .avi, etc.)");
      return;
    }

    setVideoName(f.name);
    setLoading(true);
    
    // Clear saved folder first
    try {
      setProgressText("Clearing previous files...");
      await fetch("/api/clear-saved", { method: "POST" });
    } catch (err) {
      console.warn("⚠️  Could not clear saved folder:", err);
    }
    
    setProgressText("Uploading video...");

    try {
      // Convert video to base64
      const buf = await f.arrayBuffer();
      const base64Video = btoa(
        new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      setProgress(10);
      setProgressText("Processing video with local AI...");

      // Send to backend for processing
      const res = await fetch("/api/process-dashcam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: f.name,
          videoData: base64Video,
          mode: processingMode
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Processing failed: ${res.status}`);
      }

      const data = await res.json();
      
      setProgress(100);
      setProgressText("Complete!");
      setProcessedVideoUrl(data.redactedPath);
      
      console.log(`✅ Dashcam video processed: ${data.filename}`);
      console.log(`📊 Stats:`, data.stats);

    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to process video.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="uploader-container">
      {/* Button */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <PrimaryButton onClick={handleVideoClick} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Video size={18} />}
          Veil Dashcam. Protect License Plates.
        </PrimaryButton>
      </div>

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={onVideoChange}
        className="hidden-input"
      />

      {/* Progress Bar */}
      {loading && (
        <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9em', color: '#9ca3af' }}>{progressText}</span>
            <span style={{ fontSize: '0.9em', color: '#9ca3af' }}>{progress}%</span>
          </div>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${progress}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              transition: 'width 0.3s ease',
              borderRadius: '4px'
            }} />
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {/* Processed Video Result */}
      {processedVideoUrl && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div className="download-links" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowVideoPlayer(!showVideoPlayer)}
              className="download-link"
              style={{ 
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                fontSize: '1.1em',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                color: 'white'
              }}
            >
              <Play size={18} /> {showVideoPlayer ? 'Hide' : 'View'} Video
            </button>
            <a
              href={processedVideoUrl}
              download
              className="download-link"
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                fontSize: '1.1em',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'white'
              }}
            >
              <Video size={18} /> Download Video
            </a>
          </div>

          {/* Video Player */}
          {showVideoPlayer && (
            <div style={{ 
              marginTop: '2rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              overflow: 'hidden',
              padding: '1rem'
            }}>
              <video 
                controls 
                style={{ 
                  width: '100%', 
                  maxWidth: '800px',
                  borderRadius: '8px'
                }}
                src={processedVideoUrl}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
        </div>
      )}

    </div>
  );
}


export default function App() {
  const [activeTab, setActiveTab] = useState("documents"); // "documents" or "dashcam"

  return (
    <div className="app-container">
      <h1 className="app-title">
        <span className="letter letter-1">V</span>
        <span className="letter letter-2">E</span>
        <span className="letter letter-3">I</span>
        <span className="letter letter-4">L</span>
      </h1>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '1rem', 
        marginTop: '4rem',
        marginBottom: '2rem'
      }}>
        <button
          onClick={() => setActiveTab("documents")}
          style={{
            padding: '0.75rem 2rem',
            background: activeTab === "documents" ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' : 'transparent',
            border: activeTab === "documents" ? 'none' : '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1em',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <FileText size={18} /> Documents
        </button>
        <button
          onClick={() => setActiveTab("dashcam")}
          style={{
            padding: '0.75rem 2rem',
            background: activeTab === "dashcam" ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' : 'transparent',
            border: activeTab === "dashcam" ? 'none' : '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1em',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Video size={18} /> Dashcam
        </button>
      </div>

      <section className="main-section">
        <div className="main-section-content">
          {activeTab === "documents" ? <DocumentUploader /> : <DashcamProcessor />}
        </div>
      </section>
    </div>
  );
}
