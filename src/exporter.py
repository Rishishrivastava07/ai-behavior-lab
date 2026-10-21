"""Export benchmark results, evaluation details, and summary statistics to CSV."""

import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


class ResultExporter:
    """Handles writing benchmark results and aggregated stats to CSV files."""

    def __init__(self, output_dir: Path):
        self.output_dir = Path(output_dir)
        self.runs_dir = self.output_dir / "runs"
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def export(
        self,
        run_id: str,
        model_name: str,
        results_by_config: Dict[str, List[Dict[str, Any]]],
    ) -> Dict[str, Path]:
        """
        Exports both details and summary CSVs.
        Returns paths to created files.
        """
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        details_filename = f"eval_details_{timestamp_str}.csv"
        summary_filename = f"eval_summary_{timestamp_str}.csv"

        details_path = self.runs_dir / details_filename
        summary_path = self.runs_dir / summary_filename

        # Write detailed CSV
        self._write_details(details_path, run_id, results_by_config)

        # Write summary statistics CSV
        self._write_summary(summary_path, run_id, model_name, results_by_config)

        # Update a persistent latest_summary.csv in the results root for easy viewing
        latest_summary_path = self.output_dir / "latest_summary.csv"
        self._write_summary(latest_summary_path, run_id, model_name, results_by_config)

        return {
            "details_csv": details_path,
            "summary_csv": summary_path,
            "latest_summary_csv": latest_summary_path,
        }

    def _write_details(
        self,
        file_path: Path,
        run_id: str,
        results_by_config: Dict[str, List[Dict[str, Any]]],
    ) -> None:
        fieldnames = [
            "run_id",
            "timestamp",
            "config_name",
            "test_id",
            "category",
            "question",
            "target_rule",
            "passed",
            "refusal_ok",
            "required_ok",
            "forbidden_ok",
            "failure_reasons",
            "latency_seconds",
            "error",
            "model_response",
        ]

        now_iso = datetime.now().isoformat()
        with open(file_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for config_name, records in results_by_config.items():
                for item in records:
                    test_case = item["test_case"]
                    eval_res = item["eval_result"]
                    writer.writerow({
                        "run_id": run_id,
                        "timestamp": now_iso,
                        "config_name": config_name,
                        "test_id": test_case.get("id", ""),
                        "category": test_case.get("category", ""),
                        "question": test_case.get("question", ""),
                        "target_rule": test_case.get("target_rule", ""),
                        "passed": eval_res.passed,
                        "refusal_ok": eval_res.refusal_ok,
                        "required_ok": eval_res.required_ok,
                        "forbidden_ok": eval_res.forbidden_ok,
                        "failure_reasons": "; ".join(eval_res.reasons) if eval_res.reasons else "None",
                        "latency_seconds": eval_res.latency_seconds,
                        "error": eval_res.error or "",
                        "model_response": eval_res.raw_response.replace("\n", " "),
                    })

    def _write_summary(
        self,
        file_path: Path,
        run_id: str,
        model_name: str,
        results_by_config: Dict[str, List[Dict[str, Any]]],
    ) -> None:
        fieldnames = [
            "run_id",
            "timestamp",
            "config_name",
            "model_name",
            "total_tests",
            "passed_count",
            "failed_count",
            "error_count",
            "overall_accuracy_pct",
            "answerable_accuracy_pct",
            "unanswerable_accuracy_pct",
            "adversarial_accuracy_pct",
            "avg_latency_seconds",
        ]

        now_iso = datetime.now().isoformat()
        with open(file_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for config_name, records in results_by_config.items():
                total = len(records)
                passed = sum(1 for r in records if r["eval_result"].passed)
                errors = sum(1 for r in records if r["eval_result"].error)
                failed = total - passed

                # Category-specific accuracies
                by_cat: Dict[str, List[bool]] = {}
                latencies: List[float] = []

                for r in records:
                    cat = r["test_case"].get("category", "other")
                    by_cat.setdefault(cat, []).append(r["eval_result"].passed)
                    latencies.append(r["eval_result"].latency_seconds)

                def calc_pct(lst: List[bool]) -> float:
                    return round((sum(lst) / len(lst)) * 100.0, 1) if lst else 0.0

                ans_acc = calc_pct(by_cat.get("answerable", []))
                unans_acc = calc_pct(by_cat.get("unanswerable", []))
                adv_acc = calc_pct(by_cat.get("adversarial", []))
                overall_acc = round((passed / total) * 100.0, 1) if total > 0 else 0.0
                avg_lat = round(sum(latencies) / len(latencies), 3) if latencies else 0.0

                writer.writerow({
                    "run_id": run_id,
                    "timestamp": now_iso,
                    "config_name": config_name,
                    "model_name": model_name,
                    "total_tests": total,
                    "passed_count": passed,
                    "failed_count": failed,
                    "error_count": errors,
                    "overall_accuracy_pct": overall_acc,
                    "answerable_accuracy_pct": ans_acc,
                    "unanswerable_accuracy_pct": unans_acc,
                    "adversarial_accuracy_pct": adv_acc,
                    "avg_latency_seconds": avg_lat,
                })
