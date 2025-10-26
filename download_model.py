#!/usr/bin/env python3
"""Download and export YOLOv8n model to ONNX format"""

from ultralytics import YOLO
import os

print("🤖 Downloading YOLOv8n model...")
model = YOLO('yolov8n.pt')

print("📦 Exporting to ONNX format...")
model.export(format='onnx', imgsz=640)

print("📁 Moving to models directory...")
if os.path.exists('yolov8n.onnx'):
    os.rename('yolov8n.onnx', 'models/yolov8n.onnx')
    print("✅ Model ready at: models/yolov8n.onnx")
else:
    print("❌ Export failed - yolov8n.onnx not found")

