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

/**
 * Preprocess document text for better template matching
 * @param text Document text
 * @returns Preprocessed text with structural information
 */
function preprocessDocumentText(text: string): string {
  // Remove extra whitespace and normalize
  let processed = text.replace(/\s+/g, ' ').trim();
  
  // If we have very little content, don't try to preprocess it
  if (processed.length < 50) {
    return `Minimal content document:\n${processed}`;
  }
  
  // Check if this looks like raw PDF structure with minimal content
  if (processed.includes("%PDF-") && processed.includes("/Type")) {
    console.log("[Preprocessing] Detected raw PDF structure");
    
    // Extract metadata if available
    const metadata: any = {};
    
    // Extract common metadata fields
    const metadataFields = [
      'Creator', 'Producer', 'CreationDate', 'ModDate', 
      'Subject', 'Title', 'Author', 'Keywords'
    ];
    
    metadataFields.forEach(field => {
      const regex = new RegExp(`${field}\\s*:\\s*([^\\n\\r]+)`, 'i');
      const match = processed.match(regex);
      if (match && match[1]) {
        metadata[field.toLowerCase()] = match[1].trim();
      }
    });
    
    // Look for text content between stream objects
    const streamMatches = processed.match(/stream\s*([\s\S]*?)\s*endstream/g);
    let contentText = "";
    
    if (streamMatches && streamMatches.length > 0) {
      // Extract text from streams
      const streamTexts = streamMatches.map(match => {
        const contentMatch = match.match(/stream\s*([\s\S]*?)\s*endstream/);
        return contentMatch && contentMatch[1] ? contentMatch[1].trim() : "";
      }).filter(text => text.length > 0);
      
      if (streamTexts.length > 0) {
        contentText = streamTexts.join('\n\n');
      }
    }
    
    // If we still don't have meaningful content, create a more descriptive representation
    if (!contentText || contentText.length < 50) {
      const structuredRepresentation = `
PDF Document Analysis:
=====================

Metadata:
${Object.entries(metadata).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Document Properties:
- PDF Version: ${processed.match(/%PDF-(\d+\.\d+)/)?.[1] || 'Unknown'}
- Creator: ${metadata.creator || 'Unknown'}
- Producer: ${metadata.producer || 'Unknown'}
- Creation Date: ${metadata.creationdate || 'Unknown'}
- Modification Date: ${metadata.moddate || 'Unknown'}

Content Analysis:
- Total characters in document: ${processed.length}
- Extracted text content: ${contentText ? contentText.substring(0, 200) + (contentText.length > 200 ? '...' : '') : 'None/Minimal'}
- Page count: Unknown (structure only)
- Fonts detected: ${processed.match(/\/Font\s*<<[\s\S]*?>>/g)?.length || 0} font definitions found

Note: This document appears to be programmatically generated with minimal or no visible content. 
For better extraction results, please upload a document with actual text content.
`;
      return structuredRepresentation;
    } else {
      // We have some content, so use it
      processed = contentText;
    }
  }
  
  // For documents with reasonable content, do normal preprocessing
  if (processed.length > 50) {
    // Extract document structure information
    const lines = processed.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    // Identify potential headers (lines in uppercase with less than 10 words)
    const headers = nonEmptyLines.filter(line => {
      const trimmed = line.trim();
      return trimmed === trimmed.toUpperCase() && trimmed.split(' ').length <= 10;
    });
    
    // Identify potential data patterns (lines with colons, numbers, dates)
    const dataPatterns = nonEmptyLines.filter(line => {
      return /[:\d\-\/]/.test(line) && line.length > 10;
    });
    
    // Create a structured representation
    const structuredRepresentation = `
Document Structure:
- Total characters: ${processed.length}
- Total lines: ${lines.length}
- Content lines: ${nonEmptyLines.length}
- Headers: ${headers.length}
- Data patterns: ${dataPatterns.length}

Content Preview:
${nonEmptyLines.slice(0, 20).join('\n')}
`;
    
    return structuredRepresentation;
  }
  
  // For minimal content, just return as is
  return processed;
}

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
  // Check if text has meaningful content (not just PDF structure)
  if (!text || text.length < 50) {
    return false;
  }
  
  // Check if this looks like raw PDF structure
  const isPdfStructure = text.includes("%PDF-") && text.includes("/Type");
  
  // Additional checks for PDF structural content
  const hasPdfObjects = /(\d+\s+\d+\s+obj)/.test(text);
  const hasPdfStreams = /(stream\s*\n|endstream)/.test(text);
  const hasPdfXref = /xref\s+\d+\s+\d+/.test(text);
  
  // If it looks like PDF structure, it's not fully digital text
  if (isPdfStructure || hasPdfObjects || hasPdfStreams || hasPdfXref) {
    return false;
  }
  
  // Check if it has actual readable content
  // Look for words with 3+ characters (more realistic for actual content)
  const hasReadableContent = /[a-zA-Z]{3,}/.test(text) || /\d{3,}/.test(text);
  
  // If it has readable content, it's fully digital
  if (hasReadableContent) {
    return true;
  }
  
  // Otherwise, check if it has enough non-whitespace characters
  const nonWhitespaceChars = text.replace(/\s/g, '').length;
  return nonWhitespaceChars > 50;
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
        `You are an intelligent document parsing agent specialized in OCR for ${detectedLanguage} language documents. 
Extract EVERYTHING from this image, including:
- All visible text, no matter how small or faint
- Headers, footers, page numbers
- Tables, charts, and their contents
- Annotations, stamps, watermarks
- Numbers, symbols, special characters
- Any handwritten text
- Metadata and document properties
- Text in all orientations
Pay special attention to ${detectedLanguage} language patterns and characters.
Preserve the exact content, formatting, and layout. Do not omit or summarize anything.`,
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
  
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    logger.info(`PDF has ${totalPages} pages`);
  } catch (error) {
    logger.error('Failed to load PDF document', error);
  }

  // Try text extraction
  const directText = await extractDirectText(buffer, logger);

  // Check if we have meaningful content
  if (isFullyDigitalText(directText)) {
    logger.info('PDF appears to be fully digital with readable content');
    return directText;
  }

  logger.info('Starting image-based extraction for potentially scanned content or PDFs with minimal text');
  let ocrResults: string[] = [];
  
  try {
    const uniqueId = Date.now().toString();
    const tmpDir = path.resolve(__dirname, "../tmp", uniqueId);
    fs.mkdirSync(tmpDir, { recursive: true });
    logger.info('Created temp directory', { path: tmpDir });

    // Get page count for OCR
    let totalPages = 1;
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      totalPages = pdfDoc.getPageCount();
    } catch (error) {
      logger.error('Could not determine page count for OCR, defaulting to 1', error);
    }

    ocrResults = await performOcrExtraction(buffer, totalPages, detectedLanguage, tmpDir, logger);

  } catch (error) {
    logger.error('OCR extraction failed', error);
  } finally {
    const tmpDir = path.resolve(__dirname, "../tmp", Date.now().toString());
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      logger.info('Cleaned up temp directory');
    }
  }

  const ocrText = ocrResults.join('\n\n');
  const combinedText = combineExtractionResults(directText, ocrText, detectedLanguage);

  // If we still don't have meaningful content, try a different approach
  if (!isFullyDigitalText(combinedText)) {
    logger.info('Document has minimal content, attempting alternative extraction');
    
    // Try to extract any readable text from the buffer
    const alternativeText = await extractAlternativeText(buffer);
    if (alternativeText && alternativeText.length > combinedText.length) {
      logger.info('Alternative extraction found more content', { 
        alternativeLength: alternativeText.length, 
        combinedLength: combinedText.length 
      });
      const altTextClean = alternativeText.replace(/\0/g, '').trim();
      if (isFullyDigitalText(altTextClean)) {
        return altTextClean;
      }
    }
  }

  // If we have meaningful content now, return it
  if (isFullyDigitalText(combinedText)) {
    return combinedText;
  }

  // As a last resort, try to extract anything that looks like readable text
  if (!combinedText.trim()) {
    logger.info('No text extracted, attempting final fallback extraction');
    // Try one more approach - look for any readable text in the buffer
    const finalAttempt = buffer.toString('utf-8');
    // Extract content between parentheses which often contains readable text in PDFs
    const parentheticalContent = finalAttempt.match(/\(([^)]{10,})\)/g);
    if (parentheticalContent) {
      const extracted = parentheticalContent
        .map(match => match.slice(1, -1)) // Remove parentheses
        .join(' ')
        .replace(/\\n/g, ' ') // Replace escaped newlines with spaces
        .replace(/\\t/g, ' ') // Replace escaped tabs with spaces
        .replace(/\\\\/g, '\\') // Handle escaped backslashes
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (extracted.length > combinedText.length && isFullyDigitalText(extracted)) {
        logger.info('Final fallback extraction found readable content');
        return extracted;
      }
    }
    
    // If all else fails, return the raw buffer as string (last resort)
    logger.info('Returning raw buffer as final fallback');
    return buffer.toString('utf-8').replace(/\0/g, '').trim();
  }

  logger.info('Extraction complete', {
    language: detectedLanguage,
    directTextLength: directText.length,
    ocrTextLength: ocrText.length,
    totalLength: combinedText.length
  });

  return combinedText;
}

async function extractAlternativeText(buffer: Buffer): Promise<string> {
  try {
    // Try to extract text by looking for readable content in the buffer
    const text = buffer.toString('utf-8');
    
    // Look for content between common PDF text markers
    const textMatches = text.match(/BT[\s\S]*?ET/g);
    if (textMatches && textMatches.length > 0) {
      // Extract readable text from between BT and ET markers
      const extractedTexts = textMatches.map(match => {
        // Remove PDF operators and extract readable content
        return match.replace(/BT|ET|T[fdmws]\s*\[?[^\]]*\]?/g, '')
                   .replace(/\([^)]*\)/g, (match) => match.slice(1, -1)) // Extract text from parentheses
                   .replace(/\\[nrtbf]/g, (match) => {
                     // Handle escape sequences
                     const map: Record<string, string> = {
                       '\\n': '\n', '\\r': '\r', '\\t': '\t', 
                       '\\b': '\b', '\\f': '\f'
                     };
                     return map[match] || match;
                   })
                   .trim();
      }).filter(text => text.length > 0);
      
      return extractedTexts.join('\n\n');
    }
    
    return "";
  } catch (error) {
    console.error("[Alternative Text Extraction] Failed:", error);
    return "";
  }
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

  let extractedText = "";
  
  if (isPdfDocument(extension, type)) {
    extractedText = await extractTextFromPdf(buffer, detectedLanguage);
  } else if (isImageDocument(extension, type)) {
    extractedText = await extractTextFromImage(buffer, extension, detectedLanguage);
  } else if (isOtherSupportedDocument(extension, type)) {
    extractedText = await extractTextFromOther(buffer, extension, detectedLanguage);
  } else {
    extractedText = await extractTextFromOther(buffer, extension, detectedLanguage);
  }
  
  // Return the original extracted text for processing
  return extractedText;
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

/**
 * Extract document text and return both original and preprocessed versions
 * @param buffer Document buffer
 * @param fileName Document file name
 * @param fileType Document MIME type
 * @returns Object with original text and preprocessed text
 */
export async function extractDocWithPreprocessing(buffer: Buffer, fileName: string, fileType: string): Promise<{ originalText: string, preprocessedText: string }> {
  const originalText = await extractDoc(buffer, fileName, fileType);
  const preprocessedText = preprocessDocumentText(originalText);
  return { originalText, preprocessedText };
}