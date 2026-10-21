/**
 * Safe Document Parser for TXT and PDF files (100% local, no cloud dependencies).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit
export const SUPPORTED_EXTENSIONS = ['.txt', '.pdf', '.md'];

export class DocumentParserError extends Error {
  constructor(message, code = 'PARSE_ERROR') {
    super(message);
    this.name = 'DocumentParserError';
    this.code = code;
  }
}

export class DocumentParser {
  /**
   * Safely extract text and generate preview metadata from a Buffer or string.
   * @param {Object} options
   * @param {Buffer|string} options.buffer - Raw file buffer or text string
   * @param {string} options.filename - File name (e.g. "handbook.pdf")
   * @param {number} [options.previewLength=500] - Characters to include in preview snippet
   * @returns {Promise<{text: string, charCount: number, wordCount: number, preview: string, filename: string}>}
   */
  static async parse({ buffer, filename, previewLength = 500 }) {
    if (!filename) {
      throw new DocumentParserError('Missing filename parameter', 'INVALID_FILENAME');
    }

    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      throw new DocumentParserError(
        `Unsupported file type '${ext}'. Please upload a PDF (.pdf), plain text (.txt), or markdown (.md) document.`,
        'UNSUPPORTED_FORMAT'
      );
    }

    const rawBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '', 'utf-8');

    if (rawBuffer.length > MAX_FILE_SIZE_BYTES) {
      const mbSize = (rawBuffer.length / (1024 * 1024)).toFixed(2);
      throw new DocumentParserError(
        `File size (${mbSize} MB) exceeds maximum allowed limit of 5 MB.`,
        'FILE_TOO_LARGE'
      );
    }

    if (rawBuffer.length === 0) {
      throw new DocumentParserError('The uploaded file is empty.', 'EMPTY_FILE');
    }

    let extractedText = '';

    try {
      if (ext === '.pdf') {
        const parsed = await pdfParse(rawBuffer);
        extractedText = (parsed.text || '').trim();
      } else {
        // .txt or .md
        extractedText = rawBuffer.toString('utf-8').trim();
      }
    } catch (err) {
      throw new DocumentParserError(
        `Failed to read document: ${err.message}. The file may be password-protected or corrupted.`,
        'CORRUPTED_FILE'
      );
    }

    if (!extractedText || extractedText.length < 20) {
      throw new DocumentParserError(
        'Could not extract sufficient text from this document. Please ensure it contains readable text (not scanned images).',
        'INSUFFICIENT_TEXT'
      );
    }

    // Clean up excessive whitespace and null bytes
    const cleanText = extractedText
      .replace(/\0/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const charCount = cleanText.length;
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    const preview = cleanText.slice(0, previewLength) + (cleanText.length > previewLength ? '...' : '');

    return {
      text: cleanText,
      charCount,
      wordCount,
      preview,
      filename,
    };
  }
}
