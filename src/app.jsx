import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Shield,
  FileText,
  Play,
  Square,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import OCRImage from "./OCRImage.jsx";
import { ocrImage } from "./ocrImage.js"; // ✅ keep this

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

    setDocName(f.name);
    setLoading(true);

    try {
      const isPDF =
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      const isImage = f.type.startsWith("image/");

      if (isImage) {
        // ✅ Fast local image OCR (old working path)
        const text = await ocrImage(f, () => {});
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        setDownHref(url);
      } else if (isPDF) {
        // ✅ Send PDFs to backend like before
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/redact/document", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setDownHref(url);
      } else {
        // Other types → backend
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/redact/document", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setDownHref(url);
      }
    } catch (err) {
      setError(err.message || "OCR failed");
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
        accept=".pdf,.doc,.docx,.txt,.md,.rtf,.png,.jpg,.jpeg"
        onChange={onDocChange}
        className="hidden"
      />

      {/* You had this dark block before; leaving it as-is */}
      <div className="min-h-screen bg-zinc-900 text-white">
        {docName && !loading && !downHref && (
          <div className="flex items-center gap-2">
            <Upload size={14} /> Selected doc:{" "}
            <span className="font-medium text-zinc-700">{docName}</span>
          </div>
        )}
        {error && <div className="text-red-600">{error}</div>}
        {downHref && (
          <a
            href={downHref}
            download="extracted.txt"
            className="mt-1 inline-flex items-center gap-1 text-emerald-700 underline decoration-dotted underline-offset-2"
          >
            <LinkIcon size={14} /> Download extracted text
          </a>
        )}
      </div>
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const url =
        (location.protocol === "https:" ? "wss://" : "ws://") +
        location.host +
        "/ws/redact";
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setWsStatus("connected");
      ws.onclose = () => setWsStatus("disconnected");
      ws.onerror = () => setWsStatus("error");
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "masks" && Array.isArray(msg.boxes)) {
            setBoxes(msg.boxes);
          }
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
        <p className="mt-2 text-[11px] text-zinc-500">
          Left: raw camera. Right: overlay with server-returned masks.
        </p>
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 items-start gap-10 md:grid-cols-2"
          >
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
                API-connected
              </div>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                Blur sensitive info in documents & video — automatically.
              </h1>
              <p className="max-w-prose text-sm leading-6 text-zinc-600">
                Upload a document to get a redacted copy, or start a live dashcam preview and stream frames to your backend for real-time masking.
              </p>

              <div className="flex flex-col gap-4 pt-1">
                <DocumentUploader />
                <OCRImage />
                <DashcamLive />
              </div>

              <div className="pt-2 text-[11px] text-zinc-500">
                By uploading, you agree to client-side preprocessing where possible; we only transmit anonymized data for processing.
              </div>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-zinc-100 to-transparent"></div>
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-4 shadow-inner">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Shield className="opacity-70" />
                  <p className="max-w-xs text-xs text-zinc-600">
                    This template is wired for API calls. Plug in your endpoints to start redacting documents and streaming masks for live video.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-500">
                    <Pill>PII detection</Pill>
                    <Pill>License plates</Pill>
                    <Pill>Faces</Pill>
                    <Pill>Bright Data</Pill>
                    <Pill>Lava (Beta)</Pill>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-1 py-8 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} Veil</span>
            <span>•</span>
            <a href="#" className="underline decoration-dotted underline-offset-2 hover:text-zinc-700">Privacy</a>
            <span>•</span>
            <a href="#" className="underline decoration-dotted underline-offset-2 hover:text-zinc-700">Terms</a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Powered by</span>
            <Pill>Bright Data</Pill>
            <Pill>Lava (Beta)</Pill>
          </div>
        </footer>
      </main>
    </div>
  );
}
