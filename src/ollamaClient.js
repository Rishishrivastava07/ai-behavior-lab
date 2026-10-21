/**
 * Zero-dependency Ollama API Client using Node 20 native fetch.
 */
import { OLLAMA_BASE_URL, DEFAULT_MODEL } from './config.js';

export class OllamaClient {
  constructor(baseUrl = OLLAMA_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async checkConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listInstalledModels() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from Ollama: ${res.statusText}`);
      }
      const data = await res.json();
      return (data.models || []).map((m) => m.name || '');
    } catch (err) {
      throw new Error(
        `Failed to connect to Ollama at ${this.baseUrl}. Please verify Ollama is running.\nOriginal error: ${err.message}`
      );
    }
  }

  async isModelAvailable(modelName = DEFAULT_MODEL) {
    const installed = await this.listInstalledModels();
    const target = modelName.toLowerCase();
    return installed.some((m) => {
      const mLower = m.toLowerCase();
      return (
        mLower === target ||
        mLower.startsWith(`${target}:`) ||
        target.startsWith(`${mLower}:`)
      );
    });
  }

  async chat({
    model = DEFAULT_MODEL,
    messages = [],
    temperature = 0.0,
    seed = 42,
    timeoutMs = 45000,
  }) {
    const url = `${this.baseUrl}/api/chat`;
    const payload = {
      model,
      messages,
      stream: false,
      options: {
        temperature,
      },
    };
    if (seed !== undefined && seed !== null) {
      payload.options.seed = seed;
    }

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencySeconds = Number(((performance.now() - startTime) / 1000).toFixed(3));

      if (!res.ok) {
        const errorText = await res.text();
        return {
          content: '',
          latencySeconds,
          error: `Ollama HTTP ${res.status}: ${errorText}`,
        };
      }

      const data = await res.json();
      const content = (data.message?.content || '').trim();
      return {
        content,
        latencySeconds,
        error: null,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const latencySeconds = Number(((performance.now() - startTime) / 1000).toFixed(3));
      return {
        content: '',
        latencySeconds,
        error: `Ollama request failed: ${err.message}`,
      };
    }
  }
}
