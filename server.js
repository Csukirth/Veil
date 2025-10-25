// server.js
import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));

// Folder to save files into (shows up in VS Code)
const SAVE_DIR = path.join(__dirname, "saved");
await fs.mkdir(SAVE_DIR, { recursive: true });

// Serve saved files so you can open them in the browser too
app.use("/saved", express.static(SAVE_DIR));

app.post("/api/save-text", async (req, res) => {
  try {
    const { filename, text } = req.body || {};
    if (!text) return res.status(400).send("Missing text");
    const safe = (filename || "extracted.txt").replace(/[^\w.\-]/g, "_");
    const full = path.join(SAVE_DIR, safe);
    await fs.writeFile(full, text, "utf8");
    return res.json({ ok: true, path: `/saved/${safe}` });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message || "Server error");
  }
});

app.listen(3001, () => {
  console.log("Saver API on http://127.0.0.1:3001");
});
