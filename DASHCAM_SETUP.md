# 🎥 Dashcam Feature Setup Guide

## Overview

The dashcam feature allows you to upload dashcam footage and automatically blur or blackout license plates using YOLOv8 license plate detection running in Google Colab.

## Architecture

```
User uploads video → Veil backend → Extracts frames → 
Sends frames to Colab API (YOLOv8) → Gets license plate bounding boxes → 
Blurs/blackouts regions → Reassembles video → Returns to user
```

## Prerequisites

### 1. FFmpeg Installation

FFmpeg is required for video processing (frame extraction and reassembly).

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH.

**Verify installation:**
```bash
ffmpeg -version
```

### 2. Node.js Dependencies

All required Node.js packages are already in `package.json`. If you haven't installed them yet:

```bash
cd Veil
npm install
```

Key dependencies:
- `canvas` - For image manipulation
- `formdata-node` - For multipart form uploads to Colab API
- `node-fetch` - For HTTP requests

### 3. Google Colab API Setup

You need to run the YOLOv8 FastAPI server in Google Colab:

#### Step 1: Create/Open Your Colab Notebook

Your Colab notebook should have the FastAPI server code (the one you provided):

```python
!pip install -q fastapi uvicorn[standard] pillow numpy ultralytics python-multipart

import io, threading
import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import uvicorn

# Kill any old server
!kill -9 $(lsof -t -i:8000) 2>/dev/null || echo "no old server"

# Load YOLOv8 model
model = YOLO("license_plate_detector.pt")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        arr = np.array(img)
        
        results = model.predict(source=arr, imgsz=640, conf=0.25, verbose=False)
        r = results[0]
        
        boxes = []
        if hasattr(r, "boxes") and r.boxes is not None and len(r.boxes) > 0:
            for b in r.boxes:
                x1, y1, x2, y2 = b.xyxy[0].tolist()
                conf = float(b.conf[0].item())
                boxes.append({
                    "x": x1,
                    "y": y1,
                    "w": x2 - x1,
                    "h": y2 - y1,
                    "conf": conf
                })
        
        return JSONResponse({"boxes": boxes})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

def run_server():
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

thread = threading.Thread(target=run_server, daemon=True)
thread.start()

from google.colab import output
output.serve_kernel_port_as_iframe(8000)
```

#### Step 2: Get the Public URL

After running the server, execute this in a new cell:

```python
from google.colab import output
public_url = output.eval_js("google.colab.kernel.proxyPort(8000)")
print(f"Your Colab API URL: {public_url}")
```

This will give you a URL like: `https://xyz-abc-123.trycloudflare.com`

#### Step 3: Test the API

Test that it's working:

```bash
curl https://your-colab-url.trycloudflare.com/health
# Should return: {"ok":true}
```

## Usage

### Starting the Veil Server

1. Navigate to the Veil directory:
```bash
cd Veil
```

2. Start the backend server:
```bash
node server.js
```

3. Start the frontend (in a new terminal):
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Processing Dashcam Videos

1. **Click the "Dashcam" tab** in the Veil web app

2. **Configure Colab API** (first time only):
   - Click "Veil Dashcam. Protect License Plates."
   - Enter your Colab API URL from the setup above
   - Choose processing mode:
     - **Blur**: Gaussian blur over license plates (less aggressive)
     - **Blackout**: Solid black rectangles over license plates
   - Click "Save & Continue"

3. **Upload Video**:
   - Select a dashcam video file (.mp4, .mov, .avi, etc.)
   - The system will automatically:
     - Extract frames from the video
     - Send each frame to Colab for license plate detection
     - Blur/blackout detected license plates
     - Reassemble the processed video
   - Progress will be shown in real-time

4. **Download/View Result**:
   - Once complete, you can preview the video in-browser
   - Download the processed video with "_REDACTED" suffix

### Supported Video Formats

- MP4 (recommended)
- MOV
- AVI
- MKV
- WebM

### Processing Time

Processing time depends on:
- Video length (frames to process)
- Video resolution
- Network latency to Colab
- Colab GPU availability

**Approximate times:**
- 30 seconds @ 1080p: ~2-3 minutes
- 1 minute @ 1080p: ~4-6 minutes
- 5 minutes @ 1080p: ~20-30 minutes

## Troubleshooting

### "Cannot connect to Colab API"

1. Make sure your Colab notebook is running
2. Check that the FastAPI server started successfully (look for "Application startup complete")
3. Verify the Colab URL is correct
4. Test the health endpoint: `curl YOUR_COLAB_URL/health`

### "FFmpeg not found"

Install FFmpeg using the instructions in Prerequisites section above.

### "Canvas module not found"

Reinstall dependencies:
```bash
npm install canvas
```

On Linux, you may need system libraries:
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### Video processing fails

1. Check video format is supported
2. Try a shorter video first (30 seconds)
3. Check server logs for detailed error messages
4. Ensure you have enough disk space for temporary files

### Low detection accuracy

The YOLOv8 model needs to be properly trained for license plate detection. Make sure:
1. You're using `license_plate_detector.pt` (trained model)
2. The model file exists in your Colab environment
3. Consider training with your own dataset for better accuracy

## Advanced Configuration

### Change Detection Threshold

In your Colab notebook, adjust the `conf` parameter:

```python
results = model.predict(source=arr, imgsz=640, conf=0.25, verbose=False)
#                                               ^^^ Lower = more detections (more false positives)
#                                                   Higher = fewer detections (miss some plates)
```

### Change Blur Strength

Edit `process-dashcam-video.js`, line with `boxBlur` function, adjust the `radius` parameter:

```javascript
const blurred = boxBlur(imageData, 15); // Increase for stronger blur
```

### Process at Different FPS

Edit the frame extraction in `process-dashcam-video.js`:

```javascript
"-vf", "fps=30",  // Change to 15 for faster processing, 60 for smoother video
```

## API Reference

### POST `/api/process-dashcam`

Process a dashcam video to blur/blackout license plates.

**Request Body:**
```json
{
  "filename": "dashcam.mp4",
  "videoData": "base64_encoded_video_data",
  "mode": "blur",  // or "blackout"
  "colabUrl": "https://your-colab-url.trycloudflare.com"
}
```

**Response:**
```json
{
  "ok": true,
  "filename": "dashcam_REDACTED.mp4",
  "redactedPath": "/saved/dashcam_REDACTED.mp4",
  "stats": {
    "framesProcessed": 900,
    "totalDetections": 45,
    "fps": 30,
    "processingTime": "180.5"
  }
}
```

## Security & Privacy

- Original videos are deleted after processing
- Only the redacted version is saved
- Colab API URL is stored in browser localStorage (not sent to server)
- All processing happens on your Colab instance (you control the compute)

## License

Same as Veil project.

