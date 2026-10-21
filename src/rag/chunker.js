/**
 * Smart Document Chunker for Local RAG.
 * Splits policy documents into semantically coherent, numbered passages.
 */

export class DocumentChunker {
  /**
   * Split a document into overlapping passages.
   * @param {string} text - Full text of the policy document
   * @param {Object} options
   * @param {number} [options.targetChunkSize=450] - Target character count per passage
   * @param {number} [options.overlap=80] - Character overlap between consecutive passages
   * @returns {Array<{id: number, passageId: string, text: string, charOffset: number}>}
   */
  static chunk(text, { targetChunkSize = 450, overlap = 80 } = {}) {
    if (!text || typeof text !== 'string') return [];

    const clean = text.trim();
    if (!clean) return [];

    // Split on double-newlines first to respect natural paragraphs
    const paragraphs = clean.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    let currentOffset = 0;
    let runningOffset = 0;

    for (const para of paragraphs) {
      const trimmedPara = para.trim();

      // If adding this paragraph keeps us within target, combine it
      if (!currentChunk) {
        currentChunk = trimmedPara;
        currentOffset = runningOffset;
      } else if (currentChunk.length + trimmedPara.length + 2 <= targetChunkSize) {
        currentChunk += '\n\n' + trimmedPara;
      } else {
        // Current chunk is full, record it
        chunks.push({
          id: chunks.length + 1,
          passageId: `P-${String(chunks.length + 1).padStart(2, '0')}`,
          text: currentChunk,
          charOffset: currentOffset,
        });

        // Start new chunk with overlap from the tail of currentChunk if practical
        const tail = currentChunk.slice(-overlap);
        currentChunk = tail + '\n\n' + trimmedPara;
        currentOffset = runningOffset;
      }

      runningOffset += para.length + 2;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: chunks.length + 1,
        passageId: `P-${String(chunks.length + 1).padStart(2, '0')}`,
        text: currentChunk.trim(),
        charOffset: currentOffset,
      });
    }

    return chunks;
  }
}
