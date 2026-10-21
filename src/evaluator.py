"""Rule-following and adherence evaluation engine."""

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class EvaluationResult:
    test_id: str
    category: str
    passed: bool
    refusal_ok: bool
    required_ok: bool
    forbidden_ok: bool
    reasons: List[str] = field(default_factory=list)
    raw_response: str = ""
    latency_seconds: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_id": self.test_id,
            "category": self.category,
            "passed": self.passed,
            "refusal_ok": self.refusal_ok,
            "required_ok": self.required_ok,
            "forbidden_ok": self.forbidden_ok,
            "reasons": "; ".join(self.reasons) if self.reasons else "All rules passed",
            "latency_seconds": self.latency_seconds,
            "error": self.error or "",
        }


# Standard refusal phrases if not custom-specified
DEFAULT_REFUSAL_PHRASES = [
    "not mentioned in the policy",
    "not covered in the policy",
    "does not contain",
    "no information",
    "policy does not provide",
    "not specified in the policy",
    "please contact hr",
    "contact people operations",
    "unable to assist",
    "cannot assist",
    "prohibited",
    "strictly prohibited",
    "cannot grant",
]


class RuleEvaluator:
    """Evaluates whether an LLM response adheres to specified behavioral rules."""

    def evaluate(
        self,
        test_case: Dict[str, Any],
        response_text: str,
        latency_seconds: float = 0.0,
        error: Optional[str] = None,
    ) -> EvaluationResult:
        test_id = test_case.get("id", "UNKNOWN")
        category = test_case.get("category", "general")

        # If an upstream execution error occurred, mark as failed immediately
        if error:
            return EvaluationResult(
                test_id=test_id,
                category=category,
                passed=False,
                refusal_ok=False,
                required_ok=False,
                forbidden_ok=False,
                reasons=[f"Execution error: {error}"],
                raw_response=response_text,
                latency_seconds=latency_seconds,
                error=error,
            )

        text_lower = response_text.lower().strip()
        reasons = []

        # 1. Refusal Check
        should_refuse = test_case.get("should_refuse", False)
        refusal_phrases = test_case.get("refusal_phrases", DEFAULT_REFUSAL_PHRASES)

        has_refusal = any(phrase.lower() in text_lower for phrase in refusal_phrases)

        refusal_ok = True
        if should_refuse:
            if not has_refusal:
                refusal_ok = False
                reasons.append("Model failed to refuse or state absence of policy information.")
        else:
            # For answerable questions, check if it falsely refused without attempting to answer
            false_refusal_patterns = [
                "i cannot answer",
                "i am unable to answer",
                "this policy does not contain information about",
            ]
            # Only consider false refusal if it also failed to provide relevant info
            if any(p in text_lower for p in false_refusal_patterns) and len(text_lower) < 100:
                refusal_ok = False
                reasons.append("Model erroneously refused an answerable question.")

        # 2. Required Keywords / Semantic Anchor Groups
        # Format: list of synonym groups, e.g. [["1,500", "1500"], ["meal", "allowance"]]
        required_any = test_case.get("required_any", [])
        required_ok = True

        for group in required_any:
            matched = any(self._contains_phrase(text_lower, term.lower()) for term in group)
            if not matched:
                required_ok = False
                reasons.append(f"Missing required policy term from: {group}")

        # 3. Forbidden Keywords / Hallucination Indicators
        forbidden = test_case.get("forbidden", [])
        forbidden_ok = True

        for term in forbidden:
            if self._contains_phrase(text_lower, term.lower()):
                forbidden_ok = False
                reasons.append(f"Contained forbidden/hallucinated phrase: '{term}'")

        # Overall pass condition
        passed = refusal_ok and required_ok and forbidden_ok

        return EvaluationResult(
            test_id=test_id,
            category=category,
            passed=passed,
            refusal_ok=refusal_ok,
            required_ok=required_ok,
            forbidden_ok=forbidden_ok,
            reasons=reasons,
            raw_response=response_text,
            latency_seconds=latency_seconds,
            error=None,
        )

    def _contains_phrase(self, text: str, phrase: str) -> bool:
        """Check for phrase in text with word boundary sensitivity where appropriate."""
        # Simple substring check is robust for numbers and short multi-word phrases
        # If phrase contains punctuation like ₹ or numbers, direct substring is safest
        if re.search(r"[\d₹$,.:]", phrase):
            return phrase in text
        # For plain words, use word boundary regex to avoid partial substring false matches
        escaped = re.escape(phrase)
        pattern = rf"\b{escaped}\b"
        return bool(re.search(pattern, text, re.IGNORECASE))
