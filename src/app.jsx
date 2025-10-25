import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import Tesseract from "tesseract.js";

import {
  Upload,
  Shield,
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
    <span className="inline-flex items-center rounded-full border border-zinc-300/60 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700 shadow-sm">
      {children}
    </span>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-6 py-4 text-sm font-semibold shadow-lg transition-all focus:outline-none focus:ring-4 active:scale-[0.99] ${
        disabled
          ? "bg-zinc-400 text-white shadow-none cursor-not-allowed"
          : "bg-black text-white shadow-black/10 hover:shadow-xl focus:ring-black/20"
      }`}
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
      className={`relative inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-6 py-4 text-sm font-semibold text-zinc-900 shadow-sm transition-all focus:outline-none focus:ring-4 active:scale-[0.99] ${
        disabled ? "opacity-60 cursor-not-allowed" : "hover:shadow-md focus:ring-zinc-200"
      }`}
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

        // render page to offscreen canvas at higher scale for better OCR
        const scale = 2; // bump to 3 for higher quality (slower)
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        // canvas → blob → OCR
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
        const { data } = await Tesseract.recognize(blob, "eng", {
          logger: () => {}, // set to (m) => console.log(m) to see progress
        });
        ocrTexts.push((data.text || "").trim());
      }
      finalText = ocrTexts.join("\n\n").trim();
    }

    // Save text to local folder via backend
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

    const data = await res.json(); // { ok: true, path: "/saved/filename.txt" }
    setDownHref(data.path); // optional: display a link to open it

  } catch (err) {
    console.error(err);
    setError(err?.message || "Failed to process PDF.");
  } finally {
    setLoading(false);
  }
  };


  return (
    <div className="space-y-3">
      <PrimaryButton onClick={handleDocClick} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
        Upload & Extract Text
      </PrimaryButton>

      <input
        ref={docInputRef}
        type="file"
        accept=".pdf"
        onChange={onDocChange}
        className="hidden"
      />

      {docName && !loading && !downHref && (
        <div className="flex items-center gap-2 text-sm text-zinc-700">
          <Upload size={14} /> Selected doc: <span className="font-medium">{docName}</span>
        </div>
      )}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      
      {downHref && (
        <a
            href={downHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-emerald-700 underline decoration-dotted underline-offset-2 text-sm"
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
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {!running ? (
          <SecondaryButton onClick={start}>
            <Play size={16} /> Start live dashcam
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
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
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-4 shadow-inner">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-200 bg-black/5">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">Left: raw camera. Right: overlay with server-returned masks.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 text-zinc-900">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
            <Shield size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Veil</span>
          <span className="text-zinc-400">—</span>
          <span className="text-sm text-zinc-500">Sensitive Info Blurrer</span>
        </div>
        <Pill>Private-by-default</Pill>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6">
        <section className="relative isolate overflow-hidden rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="grid grid-cols-1 items-start gap-10 md:grid-cols-2">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
                API-connected
              </div>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                Blur sensitive info in documents & video — automatically.
              </h1>
              <p className="max-w-prose text-sm leading-6 text-zinc-600">
                Upload a PDF document to extract its text locally, or start a live dashcam preview and stream frames for real-time masking.
              </p>
              <div className="flex flex-col gap-4 pt-1">
                <DocumentUploader />
                <DashcamLive />
              </div>
              <div className="pt-2 text-[11px] text-zinc-500">
                By uploading, you agree to client-side processing only; no files are sent to a server.
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
