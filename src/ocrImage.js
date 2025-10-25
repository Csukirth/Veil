import Tesseract from "tesseract.js";

export async function ocrImage(file, onProgress) {
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });
  return (data.text || "").trim();
}
