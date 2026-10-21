"""Lightweight, zero-dependency client for local Ollama HTTP REST API."""

import json
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


class OllamaClientError(Exception):
    """Base exception for Ollama client errors."""
    pass


class OllamaConnectionError(OllamaClientError):
    """Raised when the Ollama server cannot be reached."""
    pass


class OllamaModelNotFoundError(OllamaClientError):
    """Raised when the requested model is not downloaded."""
    pass


class OllamaClient:
    """Communicates with Ollama running locally at http://127.0.0.1:11434."""

    def __init__(self, base_url: str = "http://127.0.0.1:11434", timeout: int = 45):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def check_connection(self) -> bool:
        """Check if the local Ollama server is running and accessible."""
        url = f"{self.base_url}/api/tags"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                return resp.status == 200
        except Exception:
            return False

    def list_installed_models(self) -> List[str]:
        """Fetch names of all installed models from Ollama."""
        url = f"{self.base_url}/api/tags"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("name", "") for m in data.get("models", [])]
                return models
        except urllib.error.URLError as e:
            raise OllamaConnectionError(
                f"Failed to connect to Ollama at {self.base_url}. "
                f"Please ensure Ollama is running. Original error: {e}"
            ) from e

    def is_model_available(self, model_name: str) -> bool:
        """Check if a specific model (e.g. 'qwen2.5:1.5b') is available locally."""
        installed = self.list_installed_models()
        # Handle exact match or tag match (e.g., 'qwen2.5:1.5b' vs 'qwen2.5:1.5b:latest')
        target = model_name.lower()
        for m in installed:
            m_lower = m.lower()
            if m_lower == target or m_lower.startswith(f"{target}:") or target.startswith(f"{m_lower}:"):
                return True
        return False

    def chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.0,
        seed: Optional[int] = 42,
    ) -> Dict[str, Any]:
        """
        Send a chat completion request to Ollama `/api/chat`.
        Returns dict with keys: 'content', 'latency_seconds', 'error'
        """
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }
        if seed is not None:
            payload["options"]["seed"] = seed

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        start_time = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                latency = round(time.perf_counter() - start_time, 3)
                result = json.loads(resp.read().decode("utf-8"))
                content = result.get("message", {}).get("content", "").strip()
                return {
                    "content": content,
                    "latency_seconds": latency,
                    "error": None,
                }
        except urllib.error.HTTPError as e:
            latency = round(time.perf_counter() - start_time, 3)
            error_body = ""
            try:
                error_body = e.read().decode("utf-8")
            except Exception:
                pass
            return {
                "content": "",
                "latency_seconds": latency,
                "error": f"HTTP {e.code}: {e.reason} - {error_body}",
            }
        except urllib.error.URLError as e:
            latency = round(time.perf_counter() - start_time, 3)
            return {
                "content": "",
                "latency_seconds": latency,
                "error": f"Connection error: Unable to reach {url}. ({e.reason})",
            }
        except Exception as e:
            latency = round(time.perf_counter() - start_time, 3)
            return {
                "content": "",
                "latency_seconds": latency,
                "error": f"Unexpected error: {str(e)}",
            }
