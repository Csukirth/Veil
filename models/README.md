# YOLOv8 Model Setup

This directory should contain the YOLOv8 ONNX model for license plate detection.

## Quick Start

The dashcam feature will work without a model (it just won't detect any license plates). To enable real license plate detection, you need to add a YOLOv8 ONNX model.

## Option 1: Use Pre-trained YOLOv8n Model

1. Install the Ultralytics package:
   ```bash
   pip install ultralytics
   ```

2. Export a YOLOv8 model to ONNX format:
   ```python
   from ultralytics import YOLO
   
   # Load a pre-trained model
   model = YOLO('yolov8n.pt')  # or yolov8s.pt, yolov8m.pt, etc.
   
   # Export to ONNX
   model.export(format='onnx', imgsz=640)
   ```

3. Move the generated `yolov8n.onnx` file to this directory:
   ```bash
   mv yolov8n.onnx /path/to/Veil-2/models/
   ```

## Option 2: Use a License Plate Specific Model

For better results, use a YOLOv8 model specifically trained on license plates:

1. Find a license plate detection model on:
   - [Roboflow Universe](https://universe.roboflow.com/)
   - [Ultralytics Hub](https://hub.ultralytics.com/)
   - Train your own with custom data

2. Convert the model to ONNX format (if not already):
   ```python
   from ultralytics import YOLO
   
   model = YOLO('path/to/license_plate_model.pt')
   model.export(format='onnx', imgsz=640)
   ```

3. Rename and move to this directory:
   ```bash
   mv license_plate_model.onnx models/yolov8n.onnx
   ```

## Testing Your Model

After adding the model, test it:

```bash
node local-yolo-detector.js path/to/test/image.jpg
```

## Model Requirements

- **Format**: ONNX
- **Filename**: `yolov8n.onnx`
- **Input size**: 640x640 (default YOLOv8)
- **Output**: Standard YOLOv8 detection format

## Performance Notes

- **yolov8n**: Fastest, good for real-time processing
- **yolov8s**: Balanced speed/accuracy
- **yolov8m**: Better accuracy, slower
- **yolov8l/x**: Best accuracy, slowest

For dashcam videos with many frames, we recommend **yolov8n** for speed.

## Without a Model

If no model is present, the system will:
- ✅ Still accept and process videos
- ✅ Extract frames and reassemble
- ❌ Not detect any license plates (0 detections)
- ⚠️  Log a warning about missing model

This allows you to test the entire pipeline without waiting for model setup.

