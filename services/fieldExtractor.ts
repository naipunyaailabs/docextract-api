import { groqChatCompletion } from "../utils/groqClient";
import { extractPdfTextWithUnpdf } from "./pdfParser";
import { pdfToPng } from "pdf-to-png-converter";
import * as fs from "fs";
import * as path from "path";
import { PDFDocument } from 'pdf-lib';
import { detectLanguage } from "../utils/languageDetector";

// Type definitions
type Logger = {
  info: (msg: string, data?: any) => void;
  error: (msg: string, err?: any) => void;
};

type ExtractionResult = {
  directText: string;
  ocrText: string;
  combinedText: string;
};

// Logger factory
function createLogger(): Logger {
  return {
    info: (msg: string, data?: any) => console.log(`[PDF Extractor] ${msg}`, data || ''),
    error: (msg: string, err?: any) => console.error(`[PDF Extractor Error] ${msg}:`, err)
  };
}

async function detectDocumentLanguage(buffer: Buffer, fileName: string): Promise<{language: string, score: number}> {
    try {
        const result = await detectLanguage(buffer);
        return result;
    } catch (error) {
        console.error("[Language Detection] Failed:", error);
        return { language: "unknown", score: 0 };
    }
}

// Function to check if PDF is fully digital
function isFullyDigitalText(text: string): boolean {
  return text.length > 0 && 
         text.split('\n').length > 10 && 
         /\w{5,}/.test(text);
}

// Function to extract text directly from PDF
export async function extractDirectText(buffer: Buffer, logger: Logger): Promise<string> {
  try {
    logger.info('Attempting direct text extraction');
    const text = await extractPdfTextWithUnpdf(buffer);
    const trimmedText = text.trim();
    logger.info('Direct text extraction complete', { charCount: trimmedText.length });
    return trimmedText;
  } catch (error) {
    logger.error('Text extraction failed', error);
    return "";
  }
}

// Function to perform OCR on PDF pages
async function performOcrExtraction(
  buffer: Buffer, 
  totalPages: number, 
  detectedLanguage: string, 
  tmpDir: string,
  logger: Logger
): Promise<string[]> {
  const ocrResults: string[] = [];
  try {
    // Replace JS pdfToPng step with Python microservice call
    logger.info('Sending PDF to python microservice for PNG conversion');
    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'document.pdf');
    // Assumes fastapi service running on http://localhost:5001/convert
    const resp = await fetch('http://localhost:8001/convert', {
      method: 'POST',
      body: formData
    });
    if (!resp.ok) throw new Error(`Python service error: ${resp.status}`);
    const data = await resp.json();
    if (!Array.isArray((data as {images: string[]}).images) || (data as {images: string[]}).images.length === 0) throw new Error('Python service returned no images');
    // Each element should be a path to a PNG in a shared tmp directory, or a base64 string
    for (let pageNum = 1; pageNum <= (data as {images: string[]}).images.length; pageNum++) {
      const imagePath = (data as {images: string[]}).images[pageNum-1];
      let imgBuffer;
      if (imagePath?.startsWith('data:image/')) {
        imgBuffer = Buffer.from(imagePath?.split(',')[1] || '', 'base64');
      } else {
        imgBuffer = imagePath ? await fs.promises.readFile(imagePath) : Buffer.from([]);
      }
      logger.info(`Processing page ${pageNum}/${(data as {images: string[]}).images.length}`);
      const pageText = await groqChatCompletion(
        `You are an intelligent document parsing agent specialized in OCR for ${detectedLanguage} language documents. \nExtract EVERYTHING from this image, including:\n- All visible text, no matter how small or faint\n- Headers, footers, page numbers\n- Tables, charts, and their contents\n- Annotations, stamps, watermarks\n- Numbers, symbols, special characters\n- Any handwritten text\n- Metadata and document properties\n- Text in all orientations\nPay special attention to ${detectedLanguage} language patterns and characters.\nPreserve the exact content, formatting, and layout. Do not omit or summarize anything.`,
        `This is page ${pageNum} of ${(data as {images: string[]}).images.length} in ${detectedLanguage} language. Extract EVERYTHING visible, preserving all details exactly as they appear.`,
        imgBuffer.toString('base64'),
        'image/png'
      );
      if (pageText?.trim()) {
        ocrResults.push(`=== Page ${pageNum} ===\n${pageText.trim()}`);
        logger.info(`Successfully extracted text from page ${pageNum}`);
      }
    }
  } catch (error) {
    logger.error('Image extraction failed', error);
  }
  return ocrResults;
}

// Function to combine extraction results
function combineExtractionResults(
  directText: string, 
  ocrText: string, 
  detectedLanguage: string
): string {
  const combinedText = [
    directText ? `=== Direct Text Extraction (${detectedLanguage}) ===\n${directText}` : "",
    ocrText ? `=== OCR Extracted Text (${detectedLanguage}) ===\n${ocrText}` : ""
  ].filter(Boolean).join('\n\n');

  return combinedText.trim();
}

async function extractTextFromPdf(buffer: Buffer, detectedLanguage: string): Promise<string> {
  const logger = createLogger();
  logger.info('Starting PDF text extraction');
  
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  logger.info(`PDF has ${totalPages} pages`);

  // Try text extraction
  const directText = await extractDirectText(buffer, logger);

  // If we have sufficient digital text, use it directly
  if (isFullyDigitalText(directText)) {
    logger.info('PDF appears to be fully digital, skipping image extraction');
    return directText;
  }

  logger.info('Starting image-based extraction for potentially scanned content');
  let ocrResults: string[] = [];
  
  try {
    const uniqueId = Date.now().toString();
    const tmpDir = path.resolve(__dirname, "../tmp", uniqueId);
    fs.mkdirSync(tmpDir, { recursive: true });
    logger.info('Created temp directory', { path: tmpDir });

    ocrResults = await performOcrExtraction(buffer, totalPages, detectedLanguage, tmpDir, logger);

  } finally {
    const tmpDir = path.resolve(__dirname, "../tmp", Date.now().toString());
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      logger.info('Cleaned up temp directory');
    }
  }

  const ocrText = ocrResults.join('\n\n');
  const combinedText = combineExtractionResults(directText, ocrText, detectedLanguage);

  if (!combinedText.trim()) {
    throw new Error('Failed to extract any text from the PDF');
  }

  logger.info('Extraction complete', {
    language: detectedLanguage,
    directTextLength: directText.length,
    ocrTextLength: ocrText.length,
    totalLength: combinedText.length
  });

  return combinedText;
}

async function extractTextFromImage(buffer: Buffer, extension: string, detectedLanguage: string): Promise<string> {
  const imageMimeType = extension === "png" ? "image/png" : "image/jpeg";
  const imageBase64 = buffer.toString("base64");
  const systemPrompt = `You are an OCR agent specialized in ${detectedLanguage} language documents. Extract EVERYTHING visible in this image. Pay special attention to ${detectedLanguage} language patterns and characters. Do not omit or summarize anything.`;
  const userPrompt = `Extract EVERYTHING visible in this ${detectedLanguage} language image or document. Include all text, numbers, symbols, annotations, and any other visible content. Preserve the exact formatting and layout.`;
  return await groqChatCompletion(systemPrompt, userPrompt, imageBase64, imageMimeType);
}

async function extractTextFromOther(buffer: Buffer, extension: string, detectedLanguage: string): Promise<string> {
  const systemPrompt = `You are an intelligent document parsing agent specialized in ${detectedLanguage} language documents. Extract EVERYTHING from this document, including all text, formatting, metadata, and structural elements. Pay special attention to ${detectedLanguage} language patterns and characters.`;
  const userPrompt = `Document binary (base64):\n${buffer.toString("base64").slice(0, 4000)}...\n\nExtract ALL content exactly as it appears, preserving all details and formatting.`;
  return await groqChatCompletion(systemPrompt, userPrompt);
}

// Function to determine document type
function getDocumentType(fileName: string, fileType: string): { extension: string; type: string } {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const type = fileType?.toLowerCase() || "";
  return { extension, type };
}

// Function to check if document is PDF
function isPdfDocument(extension: string, type: string): boolean {
  return type === "application/pdf" || extension === "pdf";
}

// Function to check if document is an image
function isImageDocument(extension: string, type: string): boolean {
  return type.startsWith("image/") || ["jpg", "jpeg", "png", "bmp", "gif", "tiff"].includes(extension);
}

// Function to check if document is other supported type
function isOtherSupportedDocument(
  extension: string, 
  type: string
): boolean {
  return (
    type === "application/msword" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ["doc", "docx"].includes(extension) ||
    type === "text/html" ||
    type === "text/markdown" ||
    ["html", "md"].includes(extension)
  );
}

export async function extractDoc(buffer: Buffer, fileName: string, fileType: string): Promise<string> {
  const { extension, type } = getDocumentType(fileName, fileType);

  // Detect language first
  const { language: detectedLanguage } = await detectDocumentLanguage(buffer, fileName)
    .catch(e => {
      console.error("[Language Detection] Failed:", e);
      return { language: "unknown", score: 0 };
    });

  if (isPdfDocument(extension, type)) {
    return await extractTextFromPdf(buffer, detectedLanguage);
  }

  if (isImageDocument(extension, type)) {
    return await extractTextFromImage(buffer, extension, detectedLanguage);
  }

  if (isOtherSupportedDocument(extension, type)) {
    return await extractTextFromOther(buffer, extension, detectedLanguage);
  }

  return await extractTextFromOther(buffer, extension, detectedLanguage);
}

export async function extractDocWithLang(buffer: Buffer, fileName: string, fileType: string): Promise<{ text: string, language: string, score: number }> {
  const { language, score } = await detectDocumentLanguage(buffer, fileName)
    .catch(e => {
      console.error("[Language Detection] Failed:", e);
      return { language: "unknown", score: 0 };
    });

  const text = await extractDoc(buffer, fileName, fileType);
  return { text, language, score };
}