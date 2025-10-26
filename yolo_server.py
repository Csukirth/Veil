import io
import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

print("Loading YOLO model...")
model = YOLO("license_plate_detector.pt")
print("✅ Model loaded")

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
    print("📸 Received /detect request")
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
        
        print(f"✅ Returned {len(boxes)} boxes")
        return JSONResponse({"boxes": boxes})
    except Exception as e:
        print("❌ Error:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting server on http://localhost:8001")
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")

