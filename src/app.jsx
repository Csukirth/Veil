import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import Tesseract from "tesseract.js";
import "./App.css";

import {
  Upload,
  FileText,
  Play,
  Square,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";

// --- PDF.js setup (client-side extraction) ---
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const { getDocument } = pdfjsLib;

function Pill({ children }) {
  return (
    <span className="pill">
      {children}
    </span>
  );
}

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
  const [downHref, setDownHref] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDocClick = () => docInputRef.current?.click();

  const onDocChange = async (e) => {
    setError("");
    setDownHref("");
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

    try {
      const buf = await f.arrayBuffer();
      const pdf = await getDocument({ data: buf }).promise;

      // 1) Try native text extraction
      let pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const txt = content.items.map(it => ("str" in it ? it.str : "")).join(" ").trim();
        pages.push(txt);
      }

      let finalText = pages.join("\n\n").trim();

      // 2) If empty/near-empty, OCR each page image instead (PDF-only OCR)
      const needsOCR = finalText.replace(/\s+/g, "").length < 5;
      if (needsOCR) {
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
        }
        finalText = ocrTexts.join("\n\n").trim();
      }

      const suggested = (docName?.replace(/\.[^.]+$/, "") || "extracted") + ".txt";

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
      setDownHref(data.path);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to process PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="uploader-container">
      <PrimaryButton onClick={handleDocClick} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
        Upload & Extract Text
      </PrimaryButton>

      <input
        ref={docInputRef}
        type="file"
        accept=".pdf"
        onChange={onDocChange}
        className="hidden-input"
      />

      {docName && !loading && !downHref && (
        <div className="doc-info">
          <Upload size={14} /> Selected doc: <span className="doc-name">{docName}</span>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}

      {downHref && (
        <a
          href={downHref}
          target="_blank"
          rel="noopener noreferrer"
          className="download-link"
        >
          <LinkIcon size={14} /> Open saved text
        </a>
      )}
    </div>
  );
}

function DashcamLive() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [boxes, setBoxes] = useState([]);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const rafRef = useRef(0);
  const frameIdRef = useRef(0);

  const drawOverlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255, 200, 0, 0.9)";
    ctx.fillStyle = "rgba(255, 200, 0, 0.15)";
    boxes.forEach((b) => {
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillRect(b.x, b.y, b.w, b.h);
    });
  };

  const pumpFrames = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    drawOverlay();
    if (wsRef.current && wsRef.current.readyState === 1) {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            frameIdRef.current += 1;
            const packet = { type: "frame", frameId: frameIdRef.current };
            wsRef.current.send(JSON.stringify(packet));
            wsRef.current.send(blob);
          }
        },
        "image/jpeg",
        0.7
      );
    }
    if (running) rafRef.current = window.setTimeout(pumpFrames, 100);
  };

  const start = async () => {
    if (running) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/redact";
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setWsStatus("connected");
      ws.onclose = () => setWsStatus("disconnected");
      ws.onerror = () => setWsStatus("error");
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "masks" && Array.isArray(msg.boxes)) setBoxes(msg.boxes);
        } catch {}
      };
      setRunning(true);
      pumpFrames();
    } catch (err) {
      alert("Camera access failed: " + (err.message || err));
      stop();
    }
  };

  const stop = () => {
    setRunning(false);
    window.clearTimeout(rafRef.current);
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setBoxes([]);
    setWsStatus("disconnected");
  };

  return (
    <div className="dashcam-container">
      <div className="dashcam-controls">
        {!running ? (
          <SecondaryButton onClick={start}>
            <Play size={16} /> Start live dashcam
            <span className="beta-badge">
              BETA
            </span>
          </SecondaryButton>
        ) : (
          <SecondaryButton onClick={stop}>
            <Square size={16} /> Stop
          </SecondaryButton>
        )}
        <Pill>WS: {wsStatus}</Pill>
      </div>
      <div className="dashcam-preview">
        <div className="dashcam-grid">
          <div className="video-container">
            <video ref={videoRef} autoPlay playsInline muted className="video-element" />
          </div>
          <div className="canvas-container">
            <canvas ref={canvasRef} className="canvas-element" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="app-container">
      <h1 className="app-title">
        <span className="letter letter-1">V</span>
        <span className="letter letter-2">E</span>
        <span className="letter letter-3">I</span>
        <span className="letter letter-4">L</span>
      </h1>

      <section className="main-section">
        <div className="main-section-content">
          <DocumentUploader />
          <DashcamLive />
        </div>
      </section>
    </div>
  );
}
