/**
 * CSV Exporter for AI Behavior Lab Benchmark Runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_DIR } from './config.js';

export class ResultExporter {
  constructor(outputDir = RESULTS_DIR) {
    this.outputDir = outputDir;
    this.runsDir = path.join(this.outputDir, 'runs');
    if (!fs.existsSync(this.runsDir)) {
      fs.mkdirSync(this.runsDir, { recursive: true });
    }
  }

  export({ runId, modelName, resultsByConfig }) {
    const timestampStr = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .split('.')[0];

    const detailsFilename = `eval_details_${timestampStr}.csv`;
    const summaryFilename = `eval_summary_${timestampStr}.csv`;

    const detailsPath = path.join(this.runsDir, detailsFilename);
    const summaryPath = path.join(this.runsDir, summaryFilename);
    const latestSummaryPath = path.join(this.outputDir, 'latest_summary.csv');

    this._writeDetails(detailsPath, runId, resultsByConfig);
    this._writeSummary(summaryPath, runId, modelName, resultsByConfig);
    this._writeSummary(latestSummaryPath, runId, modelName, resultsByConfig);

    return {
      detailsPath,
      summaryPath,
      latestSummaryPath,
    };
  }

  _escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/\r?\n/g, ' ');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  _writeDetails(filePath, runId, resultsByConfig) {
    const headers = [
      'run_id',
      'timestamp',
      'config_name',
      'test_id',
      'category',
      'question',
      'target_rule',
      'passed',
      'refusal_ok',
      'required_ok',
      'forbidden_ok',
      'failure_reasons',
      'latency_seconds',
      'error',
      'model_response',
    ];

    const lines = [headers.join(',')];
    const nowIso = new Date().toISOString();

    for (const [configName, records] of Object.entries(resultsByConfig)) {
      for (const item of records) {
        const tc = item.testCase;
        const ev = item.evalResult;
        const row = [
          runId,
          nowIso,
          configName,
          tc.id || '',
          tc.category || '',
          tc.question || '',
          tc.target_rule || '',
          ev.passed ? 'True' : 'False',
          ev.refusalOk ? 'True' : 'False',
          ev.requiredOk ? 'True' : 'False',
          ev.forbiddenOk ? 'True' : 'False',
          ev.reasons ? ev.reasons.join('; ') : 'None',
          ev.latencySeconds,
          ev.error || '',
          ev.rawResponse || '',
        ].map((v) => this._escapeCsv(v));

        lines.push(row.join(','));
      }
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  _writeSummary(filePath, runId, modelName, resultsByConfig) {
    const headers = [
      'run_id',
      'timestamp',
      'config_name',
      'model_name',
      'total_tests',
      'passed_count',
      'failed_count',
      'error_count',
      'overall_accuracy_pct',
      'answerable_accuracy_pct',
      'unanswerable_accuracy_pct',
      'adversarial_accuracy_pct',
      'avg_latency_seconds',
    ];

    const lines = [headers.join(',')];
    const nowIso = new Date().toISOString();

    for (const [configName, records] of Object.entries(resultsByConfig)) {
      const total = records.length;
      const passed = records.filter((r) => r.evalResult.passed).length;
      const errors = records.filter((r) => r.evalResult.error).length;
      const failed = total - passed;

      const byCat = {};
      const latencies = [];

      for (const r of records) {
        const cat = r.testCase.category || 'other';
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(r.evalResult.passed);
        latencies.push(r.evalResult.latencySeconds);
      }

      const calcPct = (arr) =>
        arr && arr.length
          ? Number(((arr.filter(Boolean).length / arr.length) * 100).toFixed(1))
          : 0.0;

      const ansAcc = calcPct(byCat.answerable);
      const unansAcc = calcPct(byCat.unanswerable);
      const advAcc = calcPct(byCat.adversarial);
      const overallAcc = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0.0;
      const avgLat =
        latencies.length > 0
          ? Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(3))
          : 0.0;

      const row = [
        runId,
        nowIso,
        configName,
        modelName,
        total,
        passed,
        failed,
        errors,
        overallAcc,
        ansAcc,
        unansAcc,
        advAcc,
        avgLat,
      ].map((v) => this._escapeCsv(v));

      lines.push(row.join(','));
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }
}
