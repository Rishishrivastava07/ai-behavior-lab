#!/usr/bin/env python3
"""
AI Behavior Lab - Main Benchmark Execution CLI.
Usage:
    python3 run_benchmark.py
    python3 run_benchmark.py --check-only
    python3 run_benchmark.py --model qwen2.5:1.5b --max-cases 3
"""

import argparse
import sys
from pathlib import Path

# Add project root to sys.path so modules can be imported directly
REPO_ROOT = Path(__file__).resolve().parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.config import DEFAULT_MODEL, OLLAMA_BASE_URL
from src.ollama_client import (
    OllamaClient,
    OllamaConnectionError,
    OllamaModelNotFoundError,
)
from src.runner import BenchmarkRunner


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="AI Behavior Lab - Measure and compare rule adherence of local LLMs."
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Ollama model to evaluate (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--base-url",
        type=str,
        default=OLLAMA_BASE_URL,
        help=f"Base URL for Ollama API (default: {OLLAMA_BASE_URL})",
    )
    parser.add_argument(
        "--max-cases",
        type=int,
        default=None,
        help="Run only the first N test cases (useful for fast verification)",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature (default: 0.0 for deterministic rule evaluation)",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Only check connection to Ollama and verify model installation",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    print("\n🔍 Checking environment and Ollama connection...")
    client = OllamaClient(base_url=args.base_url)

    if not client.check_connection():
        print(
            f"\n❌ Error: Cannot connect to Ollama at {args.base_url}.\n"
            "Please start Ollama by opening Ollama.app or running 'ollama serve' in another terminal."
        )
        return 1

    print(f"✅ Ollama server is running at {args.base_url}")

    try:
        installed_models = client.list_installed_models()
        print(f"📦 Installed models found: {', '.join(installed_models) if installed_models else 'None'}")

        if not client.is_model_available(args.model):
            print(
                f"\n❌ Error: Target model '{args.model}' is not installed.\n"
                f"Please run: ollama pull {args.model}"
            )
            return 1
        print(f"✅ Model '{args.model}' is available and ready.")
    except Exception as e:
        print(f"\n❌ Error while communicating with Ollama: {e}")
        return 1

    if args.check_only:
        print("\n✨ Environment check passed successfully. Ready to benchmark.")
        return 0

    # Run the benchmark
    try:
        runner = BenchmarkRunner(
            model_name=args.model,
            base_url=args.base_url,
            temperature=args.temperature,
        )
        runner.run(max_cases=args.max_cases)
        return 0
    except (OllamaConnectionError, OllamaModelNotFoundError) as e:
        print(f"\n❌ Setup Error: {e}")
        return 1
    except KeyboardInterrupt:
        print("\n⚠️ Benchmark run cancelled by user.")
        return 130
    except Exception as e:
        print(f"\n❌ Unexpected runtime error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
