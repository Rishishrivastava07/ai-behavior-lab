"""Benchmark orchestration engine comparing Baseline vs Rule-Following configurations."""

import json
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.config import (
    BASELINE_SYSTEM_PROMPT,
    DEFAULT_MODEL,
    POLICY_PATH,
    RESULTS_DIR,
    RULE_FOLLOWING_SYSTEM_PROMPT,
    load_policy,
)
from src.evaluator import EvaluationResult, RuleEvaluator
from src.exporter import ResultExporter
from src.ollama_client import (
    OllamaClient,
    OllamaConnectionError,
    OllamaModelNotFoundError,
)


class BenchmarkRunner:
    """Coordinates running test cases across Baseline and Rule-Following configurations."""

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        test_cases_path: Optional[Path] = None,
        base_url: str = "http://127.0.0.1:11434",
        output_dir: Path = RESULTS_DIR,
        temperature: float = 0.0,
    ):
        self.model_name = model_name
        self.test_cases_path = test_cases_path or (Path(__file__).resolve().parent.parent / "data" / "test_cases.json")
        self.client = OllamaClient(base_url=base_url)
        self.evaluator = RuleEvaluator()
        self.exporter = ResultExporter(output_dir=output_dir)
        self.temperature = temperature
        self.policy_text = load_policy()

    def verify_prerequisites(self) -> None:
        """Verify Ollama is reachable and model is available."""
        if not self.client.check_connection():
            raise OllamaConnectionError(
                f"Cannot connect to Ollama at {self.client.base_url}.\n"
                "Please make sure Ollama is running. (e.g. open Ollama or run 'ollama serve')"
            )

        if not self.client.is_model_available(self.model_name):
            installed = self.client.list_installed_models()
            raise OllamaModelNotFoundError(
                f"Model '{self.model_name}' is not downloaded in Ollama.\n"
                f"Currently installed models: {installed}\n"
                f"Run: ollama pull {self.model_name}"
            )

    def load_test_cases(self) -> List[Dict[str, Any]]:
        """Load test cases from JSON file."""
        if not self.test_cases_path.exists():
            raise FileNotFoundError(f"Test cases file not found at: {self.test_cases_path}")

        with open(self.test_cases_path, "r", encoding="utf-8") as f:
            cases = json.load(f)
            if not isinstance(cases, list) or not cases:
                raise ValueError("Test cases file must contain a non-empty JSON list.")
            return cases

    def run(self, max_cases: Optional[int] = None) -> Dict[str, Any]:
        """Execute the full benchmark comparison."""
        self.verify_prerequisites()
        test_cases = self.load_test_cases()
        if max_cases:
            test_cases = test_cases[:max_cases]

        run_id = f"run_{int(time.time())}_{uuid.uuid4().hex[:6]}"

        configurations = {
            "baseline": BASELINE_SYSTEM_PROMPT.format(policy_text=self.policy_text),
            "rule_following": RULE_FOLLOWING_SYSTEM_PROMPT.format(policy_text=self.policy_text),
        }

        results_by_config: Dict[str, List[Dict[str, Any]]] = {
            "baseline": [],
            "rule_following": [],
        }

        print("\n" + "=" * 70)
        print(f"🚀 AI BEHAVIOR LAB - RUNNING BENCHMARK (ID: {run_id})")
        print(f"🤖 Model: {self.model_name} | Tests: {len(test_cases)} | Temp: {self.temperature}")
        print("=" * 70)

        for config_name, sys_prompt in configurations.items():
            print(f"\n▶ Evaluating Configuration: [{config_name.upper()}]")
            print("-" * 70)

            for idx, test_case in enumerate(test_cases, start=1):
                t_id = test_case.get("id", f"TC-{idx}")
                category = test_case.get("category", "general")
                question = test_case.get("question", "")

                messages = [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": question},
                ]

                print(f"  [{idx:02d}/{len(test_cases):02d}] {t_id} ({category:<13}) ... ", end="", flush=True)

                resp = self.client.chat(
                    model=self.model_name,
                    messages=messages,
                    temperature=self.temperature,
                )

                eval_result = self.evaluator.evaluate(
                    test_case=test_case,
                    response_text=resp["content"],
                    latency_seconds=resp["latency_seconds"],
                    error=resp["error"],
                )

                status_label = "✅ PASS" if eval_result.passed else "❌ FAIL"
                print(f"{status_label} ({resp['latency_seconds']:.2f}s)")

                if not eval_result.passed and eval_result.reasons:
                    for reason in eval_result.reasons:
                        print(f"       ↳ Reason: {reason}")

                results_by_config[config_name].append({
                    "test_case": test_case,
                    "eval_result": eval_result,
                })

        # Export CSVs
        export_paths = self.exporter.export(
            run_id=run_id,
            model_name=self.model_name,
            results_by_config=results_by_config,
        )

        # Print comparison table
        self._print_comparison_summary(results_by_config, export_paths)

        return {
            "run_id": run_id,
            "results": results_by_config,
            "export_paths": export_paths,
        }

    def _print_comparison_summary(
        self,
        results_by_config: Dict[str, List[Dict[str, Any]]],
        export_paths: Dict[str, Path],
    ) -> None:
        """Render a clean comparative summary table in the terminal."""
        print("\n" + "=" * 70)
        print("📊 BENCHMARK COMPARISON SUMMARY")
        print("=" * 70)

        configs = list(results_by_config.keys())
        stats: Dict[str, Dict[str, Any]] = {}

        for cfg in configs:
            recs = results_by_config[cfg]
            total = len(recs)
            passed = sum(1 for r in recs if r["eval_result"].passed)

            by_cat: Dict[str, List[bool]] = {}
            latencies = [r["eval_result"].latency_seconds for r in recs]

            for r in recs:
                cat = r["test_case"].get("category", "other")
                by_cat.setdefault(cat, []).append(r["eval_result"].passed)

            def get_acc(cat_name: str) -> float:
                lst = by_cat.get(cat_name, [])
                return round((sum(lst) / len(lst)) * 100.0, 1) if lst else 0.0

            stats[cfg] = {
                "overall": round((passed / total) * 100.0, 1) if total else 0.0,
                "answerable": get_acc("answerable"),
                "unanswerable": get_acc("unanswerable"),
                "adversarial": get_acc("adversarial"),
                "avg_lat": round(sum(latencies) / len(latencies), 2) if latencies else 0.0,
            }

        header = f"{'Metric / Evaluation Dimension':<35} | {'Baseline':<12} | {'Rule-Following':<15} | {'Delta':<8}"
        print(header)
        print("-" * len(header))

        metrics = [
            ("Overall Rule Adherence", "overall", "%"),
            ("Answerable Accuracy", "answerable", "%"),
            ("Unanswerable Refusal Precision", "unanswerable", "%"),
            ("Adversarial Resistance", "adversarial", "%"),
            ("Average Latency", "avg_lat", "s"),
        ]

        for label, key, unit in metrics:
            base_val = stats["baseline"][key]
            rf_val = stats["rule_following"][key]
            delta = round(rf_val - base_val, 1)
            sign = "+" if delta > 0 else ""
            delta_str = f"{sign}{delta}{unit}" if unit == "%" else f"{sign}{delta:.2f}{unit}"

            print(f"{label:<35} | {base_val:>10}{unit} | {rf_val:>13}{unit} | {delta_str:>8}")

        print("=" * 70)
        print(f"📁 Detailed Results CSV: {export_paths['details_csv']}")
        print(f"📈 Summary Stats CSV:    {export_paths['summary_csv']}")
        print("=" * 70 + "\n")
