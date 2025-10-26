// local-yolo-detector.js
// Local YOLOv8 license plate detection using ONNX Runtime

import * as ort from "onnxruntime-node";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// YOLOv8 license plate detection model
const MODEL_PATH = path.join(__dirname, "models", "yolov8n.onnx");
const MODEL_INPUT_SIZE = 640; // YOLOv8 default input size
const CONFIDENCE_THRESHOLD = 0.3;
const IOU_THRESHOLD = 0.45;

let session = null;

/**
 * Initialize the ONNX model session
 */
async function initModel() {
  if (session) return session;
  
  try {
    // Check if model exists
    try {
      await fs.access(MODEL_PATH);
    } catch {
      console.warn("⚠️  YOLOv8 model not found. Using mock detection for now.");
      console.warn(`   Expected model at: ${MODEL_PATH}`);
      console.warn("   To enable real detection:");
      console.warn("   1. Download YOLOv8n ONNX model");
      console.warn("   2. Place it in the 'models' directory");
      return null;
    }
    
    console.log("🤖 Loading YOLOv8 ONNX model...");
    session = await ort.InferenceSession.create(MODEL_PATH);
    console.log("✅ Model loaded successfully");
    return session;
  } catch (error) {
    console.error("❌ Failed to load ONNX model:", error.message);
    return null;
  }
}

/**
 * Preprocess image for YOLOv8 inference
 */
async function preprocessImage(imagePath) {
  const imageBuffer = await fs.readFile(imagePath);
  
  // Get original image dimensions BEFORE resizing
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width;
  const originalHeight = metadata.height;
  
  // Resize and normalize image
  const { data } = await sharp(imageBuffer)
    .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, {
      fit: "fill"
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  // Convert to float32 and normalize [0, 255] -> [0, 1]
  const float32Data = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
  
  // YOLOv8 expects CHW format (channels, height, width)
  for (let i = 0; i < MODEL_INPUT_SIZE * MODEL_INPUT_SIZE; i++) {
    float32Data[i] = data[i * 3] / 255.0; // R
    float32Data[MODEL_INPUT_SIZE * MODEL_INPUT_SIZE + i] = data[i * 3 + 1] / 255.0; // G
    float32Data[MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 2 + i] = data[i * 3 + 2] / 255.0; // B
  }
  
  return {
    tensor: new ort.Tensor("float32", float32Data, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]),
    originalWidth: originalWidth,
    originalHeight: originalHeight
  };
}

/**
 * Non-Maximum Suppression (NMS)
 */
function nms(boxes, scores, iouThreshold) {
  const selected = [];
  const indices = scores
    .map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.idx);
  
  while (indices.length > 0) {
    const current = indices.shift();
    selected.push(current);
    
    indices.splice(0, indices.length, ...indices.filter(idx => {
      const iou = calculateIoU(boxes[current], boxes[idx]);
      return iou <= iouThreshold;
    }));
  }
  
  return selected;
}

/**
 * Calculate Intersection over Union (IoU)
 */
function calculateIoU(box1, box2) {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.w, box2.x + box2.w);
  const y2 = Math.min(box1.y + box1.h, box2.y + box2.h);
  
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = box1.w * box1.h;
  const area2 = box2.w * box2.h;
  const union = area1 + area2 - intersection;
  
  return intersection / union;
}

/**
 * Post-process YOLOv8 output
 */
function postprocess(output, originalWidth, originalHeight) {
  const boxes = [];
  const scores = [];
  
  // YOLOv8 output format: [1, 84, 8400] or similar
  // First 4 values are box coords (x, y, w, h), rest are class scores
  const data = output.data;
  const numDetections = output.dims[2] || 8400;
  
  for (let i = 0; i < numDetections; i++) {
    // Get class scores (skip first 4 box coordinates)
    let maxScore = 0;
    let maxClass = 0;
    
    for (let c = 4; c < output.dims[1]; c++) {
      const score = data[c * numDetections + i];
      if (score > maxScore) {
        maxScore = score;
        maxClass = c - 4;
      }
    }
    
    // Filter by confidence threshold
    if (maxScore >= CONFIDENCE_THRESHOLD) {
      // Get box coordinates
      const x_center = data[0 * numDetections + i];
      const y_center = data[1 * numDetections + i];
      const width = data[2 * numDetections + i];
      const height = data[3 * numDetections + i];
      
      // Convert from center coords to corner coords
      const x = (x_center - width / 2) / MODEL_INPUT_SIZE * originalWidth;
      const y = (y_center - height / 2) / MODEL_INPUT_SIZE * originalHeight;
      const w = (width / MODEL_INPUT_SIZE) * originalWidth;
      const h = (height / MODEL_INPUT_SIZE) * originalHeight;
      
      boxes.push({ x, y, w, h });
      scores.push(maxScore);
    }
  }
  
  // Apply NMS
  const selectedIndices = nms(boxes, scores, IOU_THRESHOLD);
  
  return selectedIndices.map(idx => boxes[idx]);
}

/**
 * Mock detection for when model is not available
 */
function mockDetection() {
  // Return empty array - no license plates detected
  // This allows the system to work without a model, just no detections
  return [];
}

/**
 * Detect license plates in an image
 */
export async function detectLicensePlates(imagePath) {
  try {
    // Initialize model if not already done
    const model = await initModel();
    
    // If no model available, use mock detection
    if (!model) {
      return mockDetection();
    }
    
    // Preprocess image
    const { tensor, originalWidth, originalHeight } = await preprocessImage(imagePath);
    
    // Run inference
    const feeds = { images: tensor };
    const results = await model.run(feeds);
    
    // Get output tensor (name may vary)
    const outputName = model.outputNames[0];
    const output = results[outputName];
    
    // Post-process to get bounding boxes
    const boxes = postprocess(output, originalWidth, originalHeight);
    
    return boxes;
  } catch (error) {
    console.warn(`⚠️  Detection failed for ${path.basename(imagePath)}: ${error.message}`);
    return [];
  }
}

/**
 * Test the detector with an image
 */
export async function testDetector(imagePath) {
  console.log("🧪 Testing local YOLOv8 detector...");
  console.log(`📁 Image: ${imagePath}`);
  
  const boxes = await detectLicensePlates(imagePath);
  
  console.log(`✅ Found ${boxes.length} license plates:`);
  boxes.forEach((box, idx) => {
    console.log(`   ${idx + 1}. [x:${box.x.toFixed(0)}, y:${box.y.toFixed(0)}, w:${box.w.toFixed(0)}, h:${box.h.toFixed(0)}]`);
  });
  
  return boxes;
}

