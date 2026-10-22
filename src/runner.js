/**
 * Benchmark Orchestration Engine (Node.js).
 */
import {
  BASELINE_SYSTEM_PROMPT,
  DEFAULT_MODEL,
  RULE_FOLLOWING_SYSTEM_PROMPT,
  loadPolicy,
  loadTestCases,
} from './config.js';
import { RuleEvaluator } from './evaluator.js';
import { ResultExporter } from './exporter.js';
import { OllamaClient } from './ollamaClient.js';

export class BenchmarkRunner {
  constructor({
    modelName = DEFAULT_MODEL,
    temperature = 0.0,
    baseUrl,
    policyText = null,
  } = {}) {
    this.modelName = modelName;
    this.temperature = temperature;
    this.client = new OllamaClient(baseUrl);
    this.evaluator = new RuleEvaluator();
    this.exporter = new ResultExporter();
    this.policyText = policyText || loadPolicy();
  }

  async verifyPrerequisites() {
    const isAlive = await this.client.checkConnection();
    if (!isAlive) {
      throw new Error(
        `Cannot connect to Ollama at ${this.client.baseUrl}.\nPlease make sure Ollama is running (e.g. open Ollama or run 'ollama serve').`
      );
    }

    const hasModel = await this.client.isModelAvailable(this.modelName);
    if (!hasModel) {
      const installed = await this.client.listInstalledModels();
      throw new Error(
        `Target model '${this.modelName}' is not installed.\nCurrently installed: [${installed.join(', ')}]\nRun: ollama pull ${this.modelName}`
      );
    }
  }

  async run({ maxCases = null, onProgress = null } = {}) {
    await this.verifyPrerequisites();
    let testCases = loadTestCases();
    if (maxCases && Number(maxCases) > 0) {
      testCases = testCases.slice(0, Number(maxCases));
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const configurations = {
      baseline: BASELINE_SYSTEM_PROMPT(this.policyText),
      rule_following: RULE_FOLLOWING_SYSTEM_PROMPT(this.policyText),
    };

    const resultsByConfig = {
      baseline: [],
      rule_following: [],
    };

    console.log('\n' + '='.repeat(70));
    console.log(`🚀 AI BEHAVIOR LAB - RUNNING BENCHMARK (ID: ${runId})`);
    console.log(`🤖 Model: ${this.modelName} | Tests: ${testCases.length} | Temp: ${this.temperature}`);
    console.log('='.repeat(70));

    for (const [configName, sysPrompt] of Object.entries(configurations)) {
      console.log(`\n▶ Evaluating Configuration: [${configName.toUpperCase()}]`);
      console.log('-'.repeat(70));

      for (let idx = 0; idx < testCases.length; idx++) {
        const testCase = testCases[idx];
        const tId = testCase.id || `TC-${idx + 1}`;
        const category = testCase.category || 'general';
        const question = testCase.question || '';

        const messages = [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: question },
        ];

        process.stdout.write(
          `  [${String(idx + 1).padStart(2, '0')}/${String(testCases.length).padStart(2, '0')}] ${tId} (${category.padEnd(13)}) ... `
        );

        const resp = await this.client.chat({
          model: this.modelName,
          messages,
          temperature: this.temperature,
        });

        const evalResult = this.evaluator.evaluate({
          testCase,
          responseText: resp.content,
          latencySeconds: resp.latencySeconds,
          error: resp.error,
        });

        const statusLabel = evalResult.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${statusLabel} (${resp.latencySeconds}s)`);

        if (!evalResult.passed && evalResult.reasons) {
          for (const reason of evalResult.reasons) {
            console.log(`       ↳ Reason: ${reason}`);
          }
        }

        const itemRecord = { testCase, evalResult };
        resultsByConfig[configName].push(itemRecord);

        if (typeof onProgress === 'function') {
          onProgress({
            configName,
            index: idx + 1,
            total: testCases.length,
            record: itemRecord,
          });
        }
      }
    }

    // Export to CSV
    const exportPaths = this.exporter.export({
      runId,
      modelName: this.modelName,
      resultsByConfig,
    });

    this._printComparisonSummary(resultsByConfig, exportPaths);

    return {
      runId,
      resultsByConfig,
      exportPaths,
    };
  }

  _printComparisonSummary(resultsByConfig, exportPaths) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 BENCHMARK COMPARISON SUMMARY (Node.js)');
    console.log('='.repeat(70));

    const configs = Object.keys(resultsByConfig);
    const stats = {};

    for (const cfg of configs) {
      const recs = resultsByConfig[cfg];
      const total = recs.length;
      const passed = recs.filter((r) => r.evalResult.passed).length;

      const byCat = {};
      const latencies = recs.map((r) => r.evalResult.latencySeconds);

      for (const r of recs) {
        const cat = r.testCase.category || 'other';
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(r.evalResult.passed);
      }

      const getAcc = (catName) => {
        const arr = byCat[catName] || [];
        return arr.length
          ? Number(((arr.filter(Boolean).length / arr.length) * 100).toFixed(1))
          : 0.0;
      };

      stats[cfg] = {
        overall: total ? Number(((passed / total) * 100).toFixed(1)) : 0.0,
        answerable: getAcc('answerable'),
        unanswerable: getAcc('unanswerable'),
        adversarial: getAcc('adversarial'),
        avgLat: latencies.length
          ? Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2))
          : 0.0,
      };
    }

    const header = `${'Metric / Dimension'.padEnd(35)} | ${'Baseline'.padEnd(12)} | ${'Rule-Following'.padEnd(15)} | ${'Delta'.padEnd(8)}`;
    console.log(header);
    console.log('-'.repeat(header.length));

    const metrics = [
      ['Overall Rule Adherence', 'overall', '%'],
      ['Answerable Accuracy', 'answerable', '%'],
      ['Unanswerable Refusal Precision', 'unanswerable', '%'],
      ['Adversarial Resistance', 'adversarial', '%'],
      ['Average Latency', 'avgLat', 's'],
    ];

    for (const [label, key, unit] of metrics) {
      const baseVal = stats.baseline[key];
      const rfVal = stats.rule_following[key];
      const delta = Number((rfVal - baseVal).toFixed(1));
      const sign = delta > 0 ? '+' : '';
      const deltaStr = unit === '%' ? `${sign}${delta}%` : `${sign}${delta}s`;

      console.log(
        `${label.padEnd(35)} | ${(baseVal + unit).padStart(12)} | ${(rfVal + unit).padStart(15)} | ${deltaStr.padStart(8)}`
      );
    }

    console.log('='.repeat(70));
    console.log(`📁 Detailed CSV: ${exportPaths.detailsPath}`);
    console.log(`📈 Summary CSV:  ${exportPaths.summaryPath}`);
    console.log('='.repeat(70) + '\n');
  }
}
