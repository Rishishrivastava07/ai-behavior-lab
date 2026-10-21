#!/usr/bin/env python3
"""
AI Behavior Lab - Zero-Dependency Local Web Server & API.
Runs an interactive browser UI at http://localhost:8000
"""

import http.server
import json
import socketserver
import sys
from pathlib import Path

# Add project root to sys.path
REPO_ROOT = Path(__file__).resolve().parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.config import (
    BASELINE_SYSTEM_PROMPT,
    DEFAULT_MODEL,
    RULE_FOLLOWING_SYSTEM_PROMPT,
    load_policy,
)
from src.ollama_client import OllamaClient

PORT = 8000
WEB_DIR = REPO_ROOT / "web"


class BehaviorLabHandler(http.server.SimpleHTTPRequestHandler):
    """Custom request handler serving static dashboard and interactive query API."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/query":
            self._handle_query()
        else:
            self.send_error(404, "Endpoint not found")

    def _handle_query(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode("utf-8"))
            question = payload.get("question", "").strip()

            if not question:
                self._send_json({"error": "Empty question provided"}, status=400)
                return

            client = OllamaClient()
            policy_text = load_policy()

            baseline_prompt = BASELINE_SYSTEM_PROMPT.format(policy_text=policy_text)
            rule_prompt = RULE_FOLLOWING_SYSTEM_PROMPT.format(policy_text=policy_text)

            # Query baseline
            resp_baseline = client.chat(
                model=DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": baseline_prompt},
                    {"role": "user", "content": question},
                ],
                temperature=0.0,
            )

            # Query rule-following
            resp_rule = client.chat(
                model=DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": rule_prompt},
                    {"role": "user", "content": question},
                ],
                temperature=0.0,
            )

            self._send_json({
                "question": question,
                "baseline_response": resp_baseline["content"],
                "rule_response": resp_rule["content"],
                "baseline_latency": resp_baseline["latency_seconds"],
                "rule_latency": resp_rule["latency_seconds"],
            })

        except Exception as e:
            self._send_json({"error": str(e)}, status=500)

    def _send_json(self, data, status=200):
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_bytes)


def main():
    with socketserver.TCPServer(("", PORT), BehaviorLabHandler) as httpd:
        print("\n" + "=" * 65)
        print("🌐 AI BEHAVIOR LAB - INTERACTIVE WEB DASHBOARD")
        print("=" * 65)
        print(f"👉 Local URL:   http://localhost:{PORT}")
        print("💡 Features:    Executive metrics, side-by-side response explorer,")
        print("                and a live interactive policy testing playground.")
        print("🛑 To stop:     Press Ctrl + C")
        print("=" * 65 + "\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down web server...")


if __name__ == "__main__":
    main()
