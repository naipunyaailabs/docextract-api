import { extractText } from "unpdf";
import fs from "fs/promises"; // Use promises API for better async handling
import pdf2table from "pdf2table";

// Add type definitions for better type safety
type TableRow = string[];
type TableData = TableRow[];
type JsonObject = Record<string, string | null>;

// Add error handling and logging
const logger = {
  info: (message: string) => console.log(`[PDF Parser] ${message}`),
  error: (message: string, error: unknown) => console.error(`[PDF Parser Error] ${message}:`, error)
};

export async function extractPdfTextWithUnpdf(buffer: Buffer): Promise<string> {
  try {
    logger.info('Starting PDF text extraction');
    const uint8Array = new Uint8Array(buffer);
    const result = await extractText(uint8Array);
    
    // Normalize text output
    const text = Array.isArray(result.text) 
      ? result.text.join('\n').trim() 
      : result.text.trim();
    
    logger.info('PDF text extraction completed successfully');
    return text;
  } catch (error) {
    logger.error('Failed to extract PDF text', error);
    throw new Error('PDF text extraction failed');
  }
}

export async function extractTablesFromPDF(pdfPath: string): Promise<TableData> {
  try {
    logger.info(`Extracting tables from PDF: ${pdfPath}`);
    const buffer = await fs.readFile(pdfPath);
    
    return new Promise((resolve, reject) => {
      pdf2table.parse(buffer, (err: Error | null, rows: TableData) => {
        if (err) {
          logger.error('Failed to parse PDF tables', err);
          return reject(err);
        }
        logger.info(`Successfully extracted ${rows.length} rows from PDF tables`);
        resolve(rows);
      });
    });
  } catch (error) {
    logger.error('Failed to read PDF file', error);
    throw new Error('PDF table extraction failed');
  }
}

function tableRowsToJson(rows: TableData): JsonObject[] {
  if (!rows || rows.length === 0) return [];
  
  const [headers, ...dataRows] = rows;
  if (!headers) return [];
  
  // Add validation and cleaning
  const cleanHeaders = headers.map(header => 
    header.trim().replace(/\s+/g, '_').toLowerCase()
  );
  
  return dataRows.map(row => {
    const rowData: JsonObject = {};
    cleanHeaders.forEach((header, i) => {
      rowData[header] = row[i]?.trim() || null;
    });
    return rowData;
  });
}