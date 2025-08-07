import { groqChatCompletion } from "../utils/groqClient";
import { extractPdfTextWithUnpdf } from "./pdfParser";
import { fromBuffer } from "pdf2pic";
import * as fs from "fs";
import * as path from "path";
import { PDFDocument } from 'pdf-lib';

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    const logger = {
        info: (msg: string, data?: any) => console.log(`[PDF Extractor] ${msg}`, data || ''),
        error: (msg: string, err: any) => console.error(`[PDF Extractor Error] ${msg}:`, err)
    };

    logger.info('Starting PDF text extraction');
    
    // Get total pages first
    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();
    logger.info(`PDF has ${totalPages} pages`);

    // Try text extraction first
    let directText = "";
    try {
        logger.info('Attempting direct text extraction');
        const text = await extractPdfTextWithUnpdf(buffer);
        directText = text.trim();
        logger.info('Direct text extraction complete', { charCount: directText.length });

        // Check if direct extraction was successful and comprehensive
        const isFullyDigital = directText.length > 0 && 
                              directText.split('\n').length > 10 && // Has multiple lines
                              /\w{5,}/.test(directText); // Contains meaningful words

        if (isFullyDigital) {
            logger.info('PDF appears to be fully digital, skipping image extraction');
            return directText;
        }
    } catch (error) {
        logger.error('Text extraction failed', error);
    }

    // Only perform OCR if direct extraction was insufficient
    logger.info('Starting image-based extraction for potentially scanned content');
    let ocrResults: string[] = [];
    
    try {
        // Set up temp directory with unique name
        const uniqueId = Date.now().toString();
        const tmpDir = path.resolve(__dirname, "../tmp", uniqueId);
        fs.mkdirSync(tmpDir, { recursive: true });
        logger.info('Created temp directory', { path: tmpDir });

        try {
            // Configure PDF to image conversion
            const convert = fromBuffer(buffer, {
                density: 300,  // Higher density for better quality
                format: "png",
                width: 2000,  // Larger size for better text recognition
                height: 2800,
                savePath: tmpDir
            });

            // Convert and process each page
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                logger.info(`Processing page ${pageNum}/${totalPages}`);
                
                try {
                    const result = await convert(pageNum, { responseType: "buffer" });
                    if (!result || !result.buffer) {
                        logger.error(`Failed to convert page ${pageNum}`, 'No buffer returned');
                        continue;
                    }

                    const imageBuffer = result.buffer;
                    const imageBase64 = imageBuffer.toString("base64");
                    
                    // Enhanced OCR prompt to ensure nothing is missed
                    const pageText = await groqChatCompletion(
                        `You are an intelligent document parsing agent specialized in OCR. 
                         Extract EVERYTHING from this image, including:
                         - All visible text, no matter how small or faint
                         - Headers, footers, page numbers
                         - Tables, charts, and their contents
                         - Annotations, stamps, watermarks
                         - Numbers, symbols, special characters
                         - Any handwritten text
                         - Metadata and document properties
                         - Text in all orientations and languages
                         Preserve the exact content, formatting, and layout. Do not omit or summarize anything.`,
                        `This is page ${pageNum} of ${totalPages}. Extract EVERYTHING visible, preserving all details exactly as they appear.`,
                        imageBase64,
                        "image/png"
                    );

                    if (pageText && pageText.trim()) {
                        ocrResults.push(`=== Page ${pageNum} ===\n${pageText.trim()}`);
                        logger.info(`Successfully extracted text from page ${pageNum}`);
                    }

                } catch (pageError) {
                    logger.error(`Failed to process page ${pageNum}`, pageError);
                }
            }

        } finally {
            // Clean up temp directory
            if (fs.existsSync(tmpDir)) {
                fs.rmSync(tmpDir, { recursive: true, force: true });
                logger.info('Cleaned up temp directory');
            }
        }

    } catch (error) {
        logger.error('Image extraction failed', error);
    }

    // Combine results
    const ocrText = ocrResults.join('\n\n');
    const combinedText = [
        directText ? "=== Direct Text Extraction ===\n" + directText : "",
        ocrText ? "=== OCR Extracted Text ===\n" + ocrText : ""
    ].filter(Boolean).join('\n\n');

    if (!combinedText.trim()) {
        throw new Error('Failed to extract any text from the PDF');
    }

    logger.info('Extraction complete', {
        directTextLength: directText.length,
        ocrTextLength: ocrText.length,
        totalLength: combinedText.length
    });

    return combinedText.trim();
}

async function extractTextFromImage(buffer: Buffer, extension: string): Promise<string> {
    const imageMimeType = extension === "png" ? "image/png" : "image/jpeg";
    const imageBase64 = buffer.toString("base64");
    const systemPrompt = "You are an OCR agent. Extract EVERYTHING visible in this image. Do not omit or summarize anything. Respond ONLY with the exact text you find, including all details, formatting, and layout.";
    const userPrompt = "Extract EVERYTHING visible in this image or document. Include all text, numbers, symbols, annotations, and any other visible content. Preserve the exact formatting and layout. If there is no text, reply with an empty string. Do NOT provide instructions, lists, or explanations—ONLY return the found content exactly as it appears.";
    return await groqChatCompletion(systemPrompt, userPrompt, imageBase64, imageMimeType);
}

async function extractTextFromOther(buffer: Buffer, extension: string): Promise<string> {
    const systemPrompt = `You are an intelligent document parsing agent. Extract EVERYTHING from this document, including all text, formatting, metadata, and structural elements. Do not omit or summarize anything.`;
    const userPrompt = `Document binary (base64):\n${buffer.toString("base64").slice(0, 4000)}...\n\nExtract ALL content exactly as it appears, preserving all details and formatting.`;
    return await groqChatCompletion(systemPrompt, userPrompt);
}

export async function extractDoc(buffer: Buffer, fileName: string, fileType: string): Promise<string> {
    // Prefer fileType if available, otherwise use extension
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const type = fileType?.toLowerCase() || "";

    // PDF
    if (type === "application/pdf" || extension === "pdf") {
        return await extractTextFromPdf(buffer);
    }

    // Images
    if (
        type.startsWith("image/") ||
        ["jpg", "jpeg", "png", "bmp", "gif", "tiff"].includes(extension)
    ) {
        return await extractTextFromImage(buffer, extension);
    }

    // Word Documents
    if (
        type === "application/msword" ||
        type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        ["doc", "docx"].includes(extension)
    ) {
        return await extractTextFromOther(buffer, extension);
    }

    // HTML
    if (
        type === "text/html" ||
        extension === "html"
    ) {
        return await extractTextFromOther(buffer, extension);
    }

    // Markdown
    if (
        type === "text/markdown" ||
        extension === "md"
    ) {
        return await extractTextFromOther(buffer, extension);
    }

    // Fallback for other types
    return await extractTextFromOther(buffer, extension);
}

export async function extractFieldsFromDoc(docText: string, fields: string[]) {
    const systemPrompt = `You are an intelligent document parser. Extract ALL requested fields exactly as they appear in the document. Do not omit or summarize anything. Always respond ONLY with JSON, never add explanations.`;
    const userPrompt = `Extract the following fields from the document EXACTLY as they appear:\n${fields.join(", ")}\n\nDocument:\n${docText}\n\nRespond ONLY in raw JSON format like:\n{"Field1": "exact value", "Field2": "exact value"}`;
  
    const response = await groqChatCompletion(systemPrompt, userPrompt);
    console.log(response);
  
    try {
      return JSON.parse(response);
    } catch (e: unknown) {
      console.error("Failed to parse Groq response as JSON:", response);
      throw new Error("Invalid JSON from Groq: " + (e as Error).message);
    }
}