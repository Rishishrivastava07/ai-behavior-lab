/**
 * Deterministic Rule Adherence & Boundary Verification Engine.
 */

export const DEFAULT_REFUSAL_PHRASES = [
  'not mentioned in the policy',
  'not covered in the policy',
  'does not contain',
  'no information',
  'policy does not provide',
  'not specified in the policy',
  'not explicitly documented',
  'please contact hr',
  'contact hr',
  'contact people operations',
  'people operations',
  'unable to assist',
  'cannot assist',
  "can't assist",
  'prohibited',
  'strictly prohibited',
  'cannot grant',
];

export class RuleEvaluator {
  evaluate({
    testCase = {},
    responseText = '',
    latencySeconds = 0.0,
    error = null,
  }) {
    const testId = testCase.id || 'UNKNOWN';
    const category = testCase.category || 'general';

    if (error) {
      return {
        testId,
        category,
        passed: false,
        refusalOk: false,
        requiredOk: false,
        forbiddenOk: false,
        reasons: [`Execution error: ${error}`],
        rawResponse: responseText,
        latencySeconds,
        error,
      };
    }

    const textLower = responseText.toLowerCase().trim();
    const reasons = [];

    // 1. Refusal Check
    const shouldRefuse = Boolean(testCase.should_refuse);
    const refusalPhrases = testCase.refusal_phrases || DEFAULT_REFUSAL_PHRASES;

    const hasRefusal = refusalPhrases.some((phrase) =>
      textLower.includes(phrase.toLowerCase())
    );

    let refusalOk = true;
    if (shouldRefuse) {
      if (!hasRefusal) {
        refusalOk = false;
        reasons.push('Model failed to refuse or state absence of policy information.');
      }
    } else {
      const falseRefusalPatterns = [
        'i cannot answer',
        'i am unable to answer',
        'this policy does not contain information about',
      ];
      if (
        falseRefusalPatterns.some((p) => textLower.includes(p)) &&
        textLower.length < 100
      ) {
        refusalOk = false;
        reasons.push('Model erroneously refused an answerable question.');
      }
    }

    // 2. Required Keywords (Synonym Groups)
    const requiredAny = testCase.required_any || [];
    let requiredOk = true;

    for (const group of requiredAny) {
      const matched = group.some((term) =>
        this._containsPhrase(textLower, term.toLowerCase())
      );
      if (!matched) {
        requiredOk = false;
        reasons.push(`Missing required policy term from: [${group.join(', ')}]`);
      }
    }

    // 3. Forbidden Keywords
    const forbidden = testCase.forbidden || [];
    let forbiddenOk = true;

    for (const term of forbidden) {
      if (this._containsPhrase(textLower, term.toLowerCase())) {
        forbiddenOk = false;
        reasons.push(`Contained forbidden/hallucinated phrase: '${term}'`);
      }
    }

    const passed = refusalOk && requiredOk && forbiddenOk;

    return {
      testId,
      category,
      passed,
      refusalOk,
      requiredOk,
      forbiddenOk,
      reasons: reasons.length ? reasons : ['All rules passed'],
      rawResponse: responseText,
      latencySeconds,
      error: null,
    };
  }

  _containsPhrase(text, phrase) {
    if (/[\d₹$,.:]/.test(phrase)) {
      return text.includes(phrase);
    }
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(text);
  }
}
