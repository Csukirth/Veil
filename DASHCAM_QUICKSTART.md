# 🚀 Dashcam Feature - Quick Start

Get up and running with dashcam video processing in 5 minutes!

## Prerequisites Checklist

- ✅ FFmpeg installed (`brew install ffmpeg` on macOS)
- ✅ Node.js dependencies installed (`npm install`)
- ✅ Google Colab notebook running with YOLOv8 FastAPI server
- ✅ Colab public URL ready

## 1. Start Your Colab Server

Run this in Google Colab:

```python
# (Your FastAPI server code from the main setup)
# After running, get the public URL:
from google.colab import output
public_url = output.eval_js("google.colab.kernel.proxyPort(8000)")
print(f"🌐 Your API URL: {public_url}")
```

Copy the URL that looks like: `https://abc-123-xyz.trycloudflare.com`

## 2. Start Veil

```bash
# Terminal 1 - Backend
cd Veil
node server.js

# Terminal 2 - Frontend  
npm run dev
```

Open: `http://localhost:5173`

## 3. Process Your First Video

1. Click the **"Dashcam"** tab
2. Click **"Veil Dashcam. Protect License Plates."**
3. Paste your Colab URL
4. Choose **Blur** or **Blackout** mode
5. Click **"Save & Continue"**
6. Select your dashcam video
7. Wait for processing (shows real-time progress)
8. Download or preview the redacted video!

## Example Video for Testing

Test with a short dashcam clip (30 seconds recommended for first test).

## What Happens Behind the Scenes

```
Your Video → Extract Frames → Send to Colab (YOLOv8 detection) → 
Get license plate boxes → Blur/blackout regions → 
Reassemble video → Download!
```

## Expected Processing Time

| Video Length | Approx. Time |
|--------------|-------------|
| 30 seconds   | 2-3 minutes |
| 1 minute     | 4-6 minutes |
| 5 minutes    | 20-30 minutes|

## Troubleshooting

**"Cannot connect to Colab API"**
- Make sure Colab notebook is running
- Check for "Application startup complete" message
- Test: `curl YOUR_URL/health` should return `{"ok":true}`

**"FFmpeg not found"**
- Install: `brew install ffmpeg` (macOS) or `sudo apt install ffmpeg` (Linux)

**Processing too slow?**
- Use shorter videos for testing
- Check Colab GPU is enabled (Runtime → Change runtime type → GPU)
- Reduce FPS in settings (trade quality for speed)

## Need More Help?

See full documentation: `DASHCAM_SETUP.md`

---

**🎉 That's it! You're ready to protect privacy in dashcam footage!**

