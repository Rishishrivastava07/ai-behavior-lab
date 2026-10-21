#!/usr/bin/env node
/**
 * AI Behavior Lab - Node.js CLI Runner
 * Usage:
 *   node run-benchmark.js
 *   node run-benchmark.js --check-only
 *   node run-benchmark.js --max-cases 3
 */
import { DEFAULT_MODEL, OLLAMA_BASE_URL } from './src/config.js';
import { OllamaClient } from './src/ollamaClient.js';
import { BenchmarkRunner } from './src/runner.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    model: DEFAULT_MODEL,
    baseUrl: OLLAMA_BASE_URL,
    maxCases: null,
    temperature: 0.0,
    checkOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--check-only') {
      options.checkOnly = true;
    } else if (arg === '--max-cases' && args[i + 1]) {
      options.maxCases = Number(args[++i]);
    } else if (arg === '--model' && args[i + 1]) {
      options.model = args[++i];
    } else if (arg === '--temperature' && args[i + 1]) {
      options.temperature = Number(args[++i]);
    } else if (arg === '--base-url' && args[i + 1]) {
      options.baseUrl = args[++i];
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  console.log('\n🔍 Checking environment and Ollama connection...');

  const client = new OllamaClient(options.baseUrl);
  const isAlive = await client.checkConnection();

  if (!isAlive) {
    console.error(
      `\n❌ Error: Cannot connect to Ollama at ${options.baseUrl}.\n` +
      `Please ensure Ollama is running. (e.g. open Ollama or run 'ollama serve')`
    );
    process.exit(1);
  }

  console.log(`✅ Ollama server is running at ${options.baseUrl}`);

  try {
    const models = await client.listInstalledModels();
    console.log(`📦 Installed models found: ${models.join(', ') || 'None'}`);

    const hasModel = await client.isModelAvailable(options.model);
    if (!hasModel) {
      console.error(
        `\n❌ Error: Target model '${options.model}' is not installed.\n` +
        `Please run: ollama pull ${options.model}`
      );
      process.exit(1);
    }
    console.log(`✅ Model '${options.model}' is available and ready.`);
  } catch (err) {
    console.error(`\n❌ Error during Ollama check: ${err.message}`);
    process.exit(1);
  }

  if (options.checkOnly) {
    console.log('\n✨ Environment check passed successfully. Ready to benchmark.');
    process.exit(0);
  }

  try {
    const runner = new BenchmarkRunner({
      modelName: options.model,
      baseUrl: options.baseUrl,
      temperature: options.temperature,
    });
    await runner.run({ maxCases: options.maxCases });
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Benchmark runtime error: ${err.message}`);
    process.exit(1);
  }
}

main();
