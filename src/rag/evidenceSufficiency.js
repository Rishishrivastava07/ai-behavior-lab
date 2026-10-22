/**
 * Evidence Sufficiency Checker — Deterministic pre-generation gate.
 *
 * Decides whether retrieved passages contain enough evidence to attempt
 * answering a question. This is a heuristic layer; it does not guarantee
 * factual correctness of model output.
 *
 * Limitations documented inline.
 */

import { PassageRetriever } from './retriever.js';

// Words that convey question intent but are not topical content
const FRAMING_WORDS = new Set([
  'company', 'policy', 'provide', 'rules', 'employee', 'employees', 'work',
  'acme', 'tell', 'explain', 'give', 'what', 'when', 'how', 'many', 'much',
  'long', 'does', 'do', 'is', 'are', 'the', 'my', 'can', 'i', 'get',
  'which', 'where', 'who', 'please', 'me', 'us', 'our', 'their', 'this',
  'that', 'about', 'for', 'with', 'from', 'in', 'of', 'to', 'a', 'an',
  'any', 'some', 'there', 'would', 'should', 'could', 'will', 'be', 'been',
  'had', 'has', 'have', 'not', 'no', 'yes', 'if', 'then', 'also', 'per',
  'day', 'week', 'month', 'year', 'time', 'need', 'want', 'ask', 'say',
  'outside',
]);

// Synonyms / paraphrase expansions — keeps deterministic matching broader
// Format: token → [alternative tokens that mean the same thing]
const SYNONYM_MAP = {
  meal:       ['food', 'lunch', 'dinner', 'breakfast', 'eat', 'meals', 'dining'],
  food:       ['meal', 'meals', 'eat', 'dining'],
  hotel:      ['accommodation', 'lodging', 'stay', 'room', 'hotels'],
  flight:     ['fly', 'flying', 'flights', 'air', 'plane', 'airline', 'airfare'],
  travel:     ['trip', 'journey', 'business trip', 'travelling', 'traveling'],
  expense:    ['expenses', 'reimbursement', 'reimburse', 'claim', 'claims', 'cost', 'costs'],
  reimburse:  ['reimbursement', 'expense', 'claim', 'pay', 'refund'],
  allowance:  ['limit', 'cap', 'maximum', 'max', 'budget'],
  budget:      ['allowance', 'limit', 'cap', 'maximum', 'max'],
  submit:     ['submission', 'file', 'filing', 'claim', 'deadline'],
  deadline:   ['submit', 'submission', 'due', 'within', 'days'],
  receipt:    ['receipts', 'invoice', 'proof'],
  taxi:       ['cab', 'ride', 'transport', 'uber', 'ola', 'auto'],
  transport:  ['taxi', 'cab', 'ride', 'transit', 'commute'],
  alcohol:    ['beer', 'wine', 'spirits', 'liquor', 'bar', 'alcoholic'],
  approval:   ['approve', 'approved', 'authorize', 'permission', 'sign'],
  manager:    ['supervisor', 'boss', 'management', 'director', 'head'],
  book:       ['booking', 'booked', 'reserve', 'reservation'],
  economy:    ['coach', 'class'],
  business:   ['class', 'premium', 'upgrade'],
  ceo:        ['executive', 'president', 'chief', 'leadership', 'management'],
  exception:  ['override', 'waiver', 'bypass', 'excuse', 'ignore'],
  ignore:     ['bypass', 'override', 'disregard', 'skip', 'forget'],
  domestic:   ['local', 'india', 'inland'],
  international: ['abroad', 'foreign', 'overseas', 'global'],
  travelling: ['travel', 'travelling', 'traveling', 'trip', 'journey'],
  traveling: ['travel', 'travelling', 'trip', 'journey'],
  minibar:    ['bar', 'room service', 'hotel bar'],
  tip:        ['gratuity', 'tips', 'service charge'],
};

/**
 * Expand a single token to include its synonyms.
 * @param {string} token
 * @returns {string[]}
 */
function expand(token) {
  const forms = new Set([token, ...(SYNONYM_MAP[token] || [])]);
  if (token.endsWith('s')) forms.add(token.slice(0, -1));
  if (token.endsWith('ing')) forms.add(token.slice(0, -3));
  return [...forms];
}

function isExplicitlyUnsupported(topicVariants, text) {
  const lines = text.toLowerCase().split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    const startsUnsupportedList = /(?:does\s+not\s+define|not\s+(?:defined|specified|covered)|does\s+not\s+(?:specify|provide))\s*:?\s*$/.test(line);
    if (startsUnsupportedList) {
      for (let next = index + 1; next < lines.length && next < index + 12; next += 1) {
        const candidate = lines[next].trim();
        if (!candidate) break;
        if (/^[-*]\s*/.test(candidate) && topicVariants.some((variant) =>
          new RegExp(`\\b${variant}\\b`, 'i').test(candidate)
        )) {
          return true;
        }
        if (/^#{1,6}\s/.test(candidate)) break;
      }
      continue;
    }

    const mentionsTopic = topicVariants.some((variant) =>
      new RegExp(`\\b${variant}\\b`, 'i').test(line)
    );
    if (!mentionsTopic) continue;

    if (/(?:does\s+not\s+define|not\s+(?:defined|specified|covered)|does\s+not\s+(?:specify|provide))/.test(line)) {
      return true;
    }

    // Policies commonly introduce an explicit unsupported-items list on one
    // line and name the individual topics on following bullet lines.
  }
  return false;
}

function hasPositiveTopicEvidence(topicVariants, text) {
  const policyTextOnly = text.split(/#\s+suggested\s+test\s+questions/i)[0];
  let inUnsupportedList = false;
  for (const rawLine of policyTextOnly.toLowerCase().split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      inUnsupportedList = false;
      continue;
    }
    if (/(?:does\s+not\s+define|not\s+(?:defined|specified|covered)|does\s+not\s+(?:specify|provide))\s*:?\s*$/.test(line)) {
      inUnsupportedList = true;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      if (/^#{1,6}\s+suggested\s+test\s+questions/i.test(line)) break;
      inUnsupportedList = false;
    }
    if (inUnsupportedList && /^[-*]\s*/.test(line)) continue;
    if (topicVariants.some((variant) => new RegExp(`\\b${variant}\\b`, 'i').test(line))) {
      return true;
    }
  }
  return false;
}

/**
 * Get the content tokens from a question, filtering out framing words.
 * @param {string} question
 * @returns {string[]}
 */
export function getTopicTokens(question) {
  const raw = PassageRetriever.tokenize(question);
  return raw.filter((t) => !FRAMING_WORDS.has(t));
}

/**
 * Check whether any of the retrieved passages contain evidence for the question.
 *
 * Algorithm:
 *  1. Extract topic tokens from the question (after removing framing words).
 *  2. For each topic token, expand to synonyms.
 *  3. A passage "covers" a token if ANY of the expanded forms appear in the passage text.
 *  4. Sufficiency = at least (coverageThreshold × topicTokens.length) tokens are covered
 *     by at least one passage, AND the top-scoring passage covers at least one topic token.
 *
 * Limitations:
 *  - Does not understand negation, tense, or conditional logic.
 *  - Synonym list is manually maintained; rare paraphrases may be missed.
 *  - A passage may superficially match a token without actually answering the question.
 *  - Does not handle multi-part questions independently.
 *
 * @param {string} question
 * @param {Array<{passageId: string, text: string, score: number}>} topPassages
 * @param {Object} [opts]
 * @param {number} [opts.coverageThreshold=0.4] — fraction of topic tokens that must be covered (0–1)
 * @param {number} [opts.minTopScore=0.2] — minimum BM25 score for the best passage to be considered relevant
 * @returns {{ sufficient: boolean, coveredCount: number, totalTopicTokens: number, reason: string }}
 */
export function checkEvidenceSufficiency(question, topPassages, {
  coverageThreshold = 0.5,
  minTopScore = 0.2,
} = {}) {
  const topicTokens = getTopicTokens(question);

  // If question has no meaningful topic tokens (e.g., all stop/framing words), be permissive
  if (topicTokens.length === 0) {
    return {
      sufficient: true,
      coveredCount: 0,
      totalTopicTokens: 0,
      reason: 'No topic tokens extracted; allowing model call.',
    };
  }

  if (!topPassages || topPassages.length === 0) {
    return {
      sufficient: false,
      coveredCount: 0,
      totalTopicTokens: topicTokens.length,
      reason: 'No passages retrieved.',
    };
  }

  // Combine all passage text for matching
  const allPassageText = topPassages.map((p) => p.text.toLowerCase()).join('\n\n');

  let coveredCount = 0;
  for (const token of topicTokens) {
    const variants = expand(token);
    if (variants.some((v) => allPassageText.includes(v))) {
      coveredCount++;
    }
  }

  const coverageRatio = coveredCount / topicTokens.length;
  const topScore = topPassages[0]?.score ?? 0;

  // A policy can mention a topic only to say that it is undefined. That is
  // evidence for a refusal, not evidence for an answer.
  const unsupportedTopic = topicTokens.find((token) => {
    const variants = expand(token).filter((variant) => variant.length > 2);
    const hasPositiveEvidence = topPassages.some((passage) =>
      hasPositiveTopicEvidence(variants, passage.text)
    );
    return !hasPositiveEvidence && isExplicitlyUnsupported(variants, allPassageText);
  });
  if (unsupportedTopic) {
    return {
      sufficient: false,
      coveredCount,
      totalTopicTokens: topicTokens.length,
      reason: `The policy explicitly does not define or specify "${unsupportedTopic}".`,
    };
  }

  if (coverageRatio < coverageThreshold) {
    return {
      sufficient: false,
      coveredCount,
      totalTopicTokens: topicTokens.length,
      reason: `Coverage too low: ${coveredCount}/${topicTokens.length} topic tokens found (need ≥${Math.ceil(coverageThreshold * topicTokens.length)}).`,
    };
  }

  if (topScore < minTopScore) {
    return {
      sufficient: false,
      coveredCount,
      totalTopicTokens: topicTokens.length,
      reason: `Top passage BM25 score (${topScore}) below minimum threshold (${minTopScore}).`,
    };
  }

  return {
    sufficient: true,
    coveredCount,
    totalTopicTokens: topicTokens.length,
    reason: `Coverage OK: ${coveredCount}/${topicTokens.length} tokens covered; top score ${topScore}.`,
  };
}

/**
 * Detect adversarial patterns in the question or policy text.
 *
 * This is a best-effort, not a security guarantee.
 * Returns { detected: boolean, reason: string }
 *
 * Limitations:
 *  - Attacker can rephrase to avoid these patterns.
 *  - Does not parse intent; may produce false positives on legitimate policy imperatives.
 */
const ADVERSARIAL_PATTERNS = [
  { re: /ignore\s+(all\s+)?(previous|prior|above|your|these)?\s*(instructions?|rules?|policy|guidelines?|constraints?)/i, label: 'prompt-injection: ignore instructions' },
  { re: /disregard\s+(all\s+)?(previous|prior|above|your)?\s*(instructions?|rules?|policy)/i, label: 'prompt-injection: disregard instructions' },
  { re: /forget\s+(all\s+)?(previous|prior|your|these)?\s*(instructions?|rules?|policy|guidelines?)/i, label: 'prompt-injection: forget instructions' },
  { re: /you\s+(are\s+now|must\s+now|should\s+now|will\s+now)\s+/i, label: 'prompt-injection: role override' },
  { re: /\bact\s+as\s+(a\s+)?(new|different|unrestricted)\b/i, label: 'prompt-injection: act-as override' },
  { re: /reveal\s+(your|the)?\s*(system\s+prompt|instructions?|prompt|rules?)/i, label: 'prompt-injection: reveal system prompt' },
  { re: /show\s+(me\s+)?(your|the)?\s*(system\s+prompt|internal\s+instructions?)/i, label: 'prompt-injection: show system prompt' },
  { re: /\bDAN\b|\bjailbreak\b/i, label: 'jailbreak attempt' },
  { re: /override\s+(the\s+)?(policy|rules?|restrictions?|constraints?)/i, label: 'explicit policy override request' },
  { re: /bypass\s+(the\s+)?(policy|rules?|restrictions?|checks?|safeguards?)/i, label: 'explicit bypass request' },
];

/**
 * @param {string} text — user question or policy text
 * @returns {{ detected: boolean, label: string|null }}
 */
export function detectAdversarialPattern(text) {
  if (!text) return { detected: false, label: null };
  for (const { re, label } of ADVERSARIAL_PATTERNS) {
    if (re.test(text)) {
      return { detected: true, label };
    }
  }
  return { detected: false, label: null };
}

/**
 * Scan uploaded policy text for embedded adversarial instructions.
 * Policy text should be treated as untrusted data, not system instructions.
 *
 * Returns the list of detected patterns (empty if clean).
 * Note: Does not modify the policy text. The caller decides how to handle findings.
 */
export function scanPolicyForInjection(policyText) {
  if (!policyText) return [];
  return ADVERSARIAL_PATTERNS
    .filter(({ re }) => re.test(policyText))
    .map(({ label }) => label);
}
