// process-dashcam-video.js
// Processes dashcam videos by detecting license plates via Colab API and blurring them

import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import fetch from "node-fetch";
import { FormData } from "formdata-node";

const COLAB_API_URL = process.env.COLAB_API_URL || "http://localhost:8000";

/**
 * Extract frames from video using ffmpeg
 */
async function extractFrames(videoPath, outputDir) {
  console.log(`📹 Extracting frames from video...`);
  
  await fs.mkdir(outputDir, { recursive: true });
  
  return new Promise((resolve, reject) => {
    // Extract at original frame rate to temporary directory
    const ffmpeg = spawn("ffmpeg", [
      "-i", videoPath,
      "-vf", "fps=30", // 30 fps
      "-q:v", "2", // High quality
      path.join(outputDir, "frame_%05d.jpg")
    ]);
    
    let stderr = "";
    
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed: ${stderr}`));
        return;
      }
      
      // Count extracted frames
      const files = await fs.readdir(outputDir);
      const frames = files.filter(f => f.startsWith("frame_") && f.endsWith(".jpg"));
      console.log(`✅ Extracted ${frames.length} frames`);
      resolve(frames.length);
    });
  });
}

/**
 * Get video FPS using ffprobe
 */
async function getVideoFPS(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=r_frame_rate",
      "-of", "default=noprint_wrappers=1:nokey=1",
      videoPath
    ]);
    
    let stdout = "";
    
    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    
    ffprobe.on("close", (code) => {
      if (code !== 0) {
        resolve(30); // default to 30fps
        return;
      }
      
      const [num, den] = stdout.trim().split("/").map(Number);
      const fps = Math.round(num / den);
      resolve(fps || 30);
    });
  });
}

/**
 * Detect license plates in a frame using Colab API
 */
async function detectLicensePlates(framePath, colabUrl) {
  try {
    const imageBuffer = await fs.readFile(framePath);
    
    const formData = new FormData();
    formData.set("file", imageBuffer, {
      filename: path.basename(framePath),
      contentType: "image/jpeg"
    });
    
    const response = await fetch(`${colabUrl}/detect`, {
      method: "POST",
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.boxes || [];
  } catch (error) {
    console.warn(`⚠️  Detection failed for ${path.basename(framePath)}: ${error.message}`);
    return [];
  }
}

/**
 * Blur a region in an image
 */
async function blurFrame(inputPath, outputPath, boxes, mode = "blur") {
  const image = await loadImage(inputPath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  
  // Draw original image
  ctx.drawImage(image, 0, 0);
  
  // Process each detected license plate
  for (const box of boxes) {
    const x = Math.floor(box.x);
    const y = Math.floor(box.y);
    const w = Math.ceil(box.w);
    const h = Math.ceil(box.h);
    
    if (mode === "blur") {
      // Get the region
      const imageData = ctx.getImageData(x, y, w, h);
      
      // Apply box blur (simple and fast)
      const blurred = boxBlur(imageData, 15);
      ctx.putImageData(blurred, x, y);
    } else if (mode === "blackout") {
      // Draw black rectangle
      ctx.fillStyle = "black";
      ctx.fillRect(x, y, w, h);
    }
  }
  
  // Save processed frame
  const buffer = canvas.toBuffer("image/jpeg", { quality: 0.95 });
  await fs.writeFile(outputPath, buffer);
}

/**
 * Simple box blur implementation
 */
function boxBlur(imageData, radius) {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const idx = (ny * width + nx) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            count++;
          }
        }
      }
      
      const idx = (y * width + x) * 4;
      output[idx] = r / count;
      output[idx + 1] = g / count;
      output[idx + 2] = b / count;
      // Alpha stays the same
    }
  }
  
  return new ImageData(output, width, height);
}

/**
 * Reassemble frames into video using ffmpeg
 */
async function reassembleVideo(framesDir, outputPath, fps) {
  console.log(`🎬 Reassembling video at ${fps} fps...`);
  
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-framerate", fps.toString(),
      "-i", path.join(framesDir, "processed_%05d.jpg"),
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-y",
      outputPath
    ]);
    
    let stderr = "";
    
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg reassemble failed: ${stderr}`));
        return;
      }
      console.log(`✅ Video saved to: ${outputPath}`);
      resolve();
    });
  });
}

/**
 * Main processing function
 */
export async function processDashcamVideo(inputPath, outputPath, mode = "blur", colabUrl = COLAB_API_URL, progressCallback) {
  const startTime = Date.now();
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🎥 Processing dashcam video: ${path.basename(inputPath)}`);
  console.log(`🔒 Mode: ${mode.toUpperCase()}`);
  console.log(`🌐 Colab API: ${colabUrl}`);
  console.log("=".repeat(70));
  
  // Check if Colab API is accessible
  try {
    const healthCheck = await fetch(`${colabUrl}/health`);
    if (!healthCheck.ok) {
      throw new Error("Colab API health check failed");
    }
    console.log("✅ Colab API is accessible");
  } catch (error) {
    throw new Error(`Cannot connect to Colab API at ${colabUrl}. Make sure your Colab notebook is running and the URL is correct. Error: ${error.message}`);
  }
  
  // Create temporary directories
  const tempDir = path.join(path.dirname(outputPath), ".temp_" + Date.now());
  const framesDir = path.join(tempDir, "frames");
  const processedDir = path.join(tempDir, "processed");
  
  await fs.mkdir(framesDir, { recursive: true });
  await fs.mkdir(processedDir, { recursive: true });
  
  try {
    // Step 1: Get video FPS
    const fps = await getVideoFPS(inputPath);
    console.log(`📊 Video FPS: ${fps}`);
    
    // Step 2: Extract frames
    if (progressCallback) progressCallback(10, "Extracting frames...");
    const frameCount = await extractFrames(inputPath, framesDir);
    
    // Step 3: Process each frame
    console.log(`\n🔍 Detecting and blurring license plates...`);
    const frameFiles = await fs.readdir(framesDir);
    const sortedFrames = frameFiles
      .filter(f => f.startsWith("frame_") && f.endsWith(".jpg"))
      .sort();
    
    let totalDetections = 0;
    
    for (let i = 0; i < sortedFrames.length; i++) {
      const frameName = sortedFrames[i];
      const framePath = path.join(framesDir, frameName);
      const outputFramePath = path.join(processedDir, `processed_${frameName.replace("frame_", "")}`);
      
      // Detect license plates
      const boxes = await detectLicensePlates(framePath, colabUrl);
      totalDetections += boxes.length;
      
      // Blur or blackout detected regions
      await blurFrame(framePath, outputFramePath, boxes, mode);
      
      // Progress update
      if (i % 30 === 0 || i === sortedFrames.length - 1) {
        const progress = 10 + ((i + 1) / sortedFrames.length) * 80;
        const message = `Processing frame ${i + 1}/${sortedFrames.length} (${boxes.length} plates detected)`;
        console.log(`   ${message}`);
        if (progressCallback) progressCallback(progress, message);
      }
    }
    
    console.log(`\n📊 Total license plates detected: ${totalDetections}`);
    
    // Step 4: Reassemble video
    if (progressCallback) progressCallback(90, "Reassembling video...");
    await reassembleVideo(processedDir, outputPath, fps);
    
    // Step 5: Cleanup
    console.log(`🧹 Cleaning up temporary files...`);
    await fs.rm(tempDir, { recursive: true, force: true });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n${"=".repeat(70)}`);
    console.log(`✅ Processing complete in ${duration}s`);
    console.log(`📊 Stats: ${frameCount} frames, ${totalDetections} license plates detected`);
    console.log(`💾 Output: ${outputPath}`);
    console.log("=".repeat(70) + "\n");
    
    if (progressCallback) progressCallback(100, "Complete!");
    
    return {
      success: true,
      outputPath,
      stats: {
        framesProcessed: frameCount,
        totalDetections,
        fps,
        processingTime: duration
      }
    };
    
  } catch (error) {
    // Cleanup on error
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

// CLI usage
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [inputPath, outputPath, mode = "blur", colabUrl] = process.argv.slice(2);
  
  if (!inputPath || !outputPath) {
    console.log("Usage: node process-dashcam-video.js <input> <output> [mode] [colabUrl]");
    console.log("  mode: 'blur' (default) or 'blackout'");
    console.log("  colabUrl: Colab API URL (default: http://localhost:8000)");
    process.exit(1);
  }
  
  processDashcamVideo(inputPath, outputPath, mode, colabUrl)
    .then(result => {
      console.log("SUCCESS:", JSON.stringify(result));
      process.exit(0);
    })
    .catch(error => {
      console.error("ERROR:", error.message);
      process.exit(1);
    });
}

