/**
 * Local BM25 Passage Retrieval Engine (Zero-Dependency, ₹0 Cost).
 * Ranks policy passages by relevance to user questions in milliseconds.
 */

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
  'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'its',
  'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not',
  'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'were', 'weren\'t',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with',
  'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
]);

export class PassageRetriever {
  /**
   * Tokenize text into lowercased search terms.
   */
  static tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s₹$]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  }

  /**
   * Score passages against a query using BM25.
   * @param {string} query - The user's question
   * @param {Array<{id: number, passageId: string, text: string}>} passages - Numbered passages
   * @param {Object} [options]
   * @param {number} [options.topK=3] - Number of top passages to return
   * @param {number} [options.k1=1.5] - BM25 term frequency saturation parameter
   * @param {number} [options.b=0.75] - BM25 document length penalty parameter
   * @returns {Array<{passage: Object, score: number}>}
   */
  static retrieve(query, passages = [], { topK = 3, k1 = 1.5, b = 0.75 } = {}) {
    if (!query || !passages || passages.length === 0) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      // Fallback: return first passages if query has only stop words
      return passages.slice(0, topK).map((p) => ({ passage: p, score: 0.1 }));
    }

    const N = passages.length;
    const passageTokensList = passages.map((p) => this.tokenize(p.text));

    // Calculate average passage length
    const totalLength = passageTokensList.reduce((acc, t) => acc + t.length, 0);
    const avgdl = totalLength / N || 1;

    // Document frequency (how many passages contain term t)
    const df = {};
    for (const token of queryTokens) {
      let count = 0;
      for (const pTokens of passageTokensList) {
        if (pTokens.includes(token)) {
          count++;
        }
      }
      df[token] = count;
    }

    // Score each passage
    const scores = passages.map((passage, idx) => {
      const pTokens = passageTokensList[idx];
      const docLen = pTokens.length;
      let score = 0;

      // Count term frequencies in this passage
      const tf = {};
      for (const t of pTokens) {
        tf[t] = (tf[t] || 0) + 1;
      }

      for (const token of queryTokens) {
        const termFreq = tf[token] || 0;
        if (termFreq === 0) continue;

        const docFreq = df[token] || 0;
        // Standard BM25 IDF formulation with smoothing
        const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);

        const numerator = termFreq * (k1 + 1);
        const denominator = termFreq + k1 * (1 - b + b * (docLen / avgdl));
        score += idf * (numerator / denominator);
      }

      return {
        passage,
        score: Number(score.toFixed(3)),
      };
    });

    // Sort descending by score
    scores.sort((a, b) => b.score - a.score);

    // Return top K
    return scores.slice(0, topK);
  }
}
