/**
 * AI Behavior Lab - Local API Server (Zero Dependencies, Node 20 Native HTTP).
 * Serves API endpoints for Ollama queries, benchmark runs, and the React frontend.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  BASELINE_SYSTEM_PROMPT,
  CLIENT_DIST,
  DATA_PATH,
  DEFAULT_MODEL,
  PORT,
  RESULTS_DIR,
  RULE_FOLLOWING_SYSTEM_PROMPT,
  loadPolicy,
} from './config.js';
import { OllamaClient } from './ollamaClient.js';
import { BenchmarkRunner } from './runner.js';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, data, status = 200) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(jsonStr);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCsvRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] !== undefined ? values[i] : '';
    });
    return obj;
  });
}

function parseCsvRow(rowStr) {
  const values = [];
  let cur = '';
  let insideQuotes = false;
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      if (insideQuotes && rowStr[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      values.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  values.push(cur.trim());
  return values;
}

export function createServer() {
  const client = new OllamaClient();

  const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // API: Health & Status
    if (pathname === '/api/health' && req.method === 'GET') {
      const isAlive = await client.checkConnection();
      let models = [];
      let hasModel = false;
      if (isAlive) {
        try {
          models = await client.listInstalledModels();
          hasModel = await client.isModelAvailable(DEFAULT_MODEL);
        } catch {}
      }
      return sendJson(res, {
        alive: isAlive,
        model: DEFAULT_MODEL,
        modelInstalled: hasModel,
        installedModels: models,
        baseUrl: client.baseUrl,
      });
    }

    // API: Policy Text
    if (pathname === '/api/policy' && req.method === 'GET') {
      return sendJson(res, { policy: loadPolicy() });
    }

    // API: Test Cases
    if (pathname === '/api/test-cases' && req.method === 'GET') {
      try {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        return sendJson(res, JSON.parse(raw));
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // API: Latest Results
    if (pathname === '/api/results' && req.method === 'GET') {
      try {
        const summaryPath = path.join(RESULTS_DIR, 'latest_summary.csv');
        let summary = [];
        if (fs.existsSync(summaryPath)) {
          summary = parseCsv(fs.readFileSync(summaryPath, 'utf-8'));
        }

        // Find the newest details CSV file in results/runs/
        const runsDir = path.join(RESULTS_DIR, 'runs');
        let details = [];
        if (fs.existsSync(runsDir)) {
          const detailFiles = fs
            .readdirSync(runsDir)
            .filter((f) => f.startsWith('eval_details_') && f.endsWith('.csv'))
            .sort()
            .reverse();

          if (detailFiles.length > 0) {
            const newestFile = path.join(runsDir, detailFiles[0]);
            details = parseCsv(fs.readFileSync(newestFile, 'utf-8'));
          }
        }

        return sendJson(res, { summary, details });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // API: Live Question Query (Baseline vs Rule-Following)
    if (pathname === '/api/query' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const question = (body.question || '').trim();
        if (!question) {
          return sendJson(res, { error: 'Empty question provided' }, 400);
        }

        const policyText = loadPolicy();
        const baseSys = BASELINE_SYSTEM_PROMPT(policyText);
        const ruleSys = RULE_FOLLOWING_SYSTEM_PROMPT(policyText);

        const [respBaseline, respRule] = await Promise.all([
          client.chat({
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: baseSys },
              { role: 'user', content: question },
            ],
            temperature: 0.0,
          }),
          client.chat({
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: ruleSys },
              { role: 'user', content: question },
            ],
            temperature: 0.0,
          }),
        ]);

        return sendJson(res, {
          question,
          baseline: {
            content: respBaseline.content,
            latency: respBaseline.latencySeconds,
            error: respBaseline.error,
          },
          ruleFollowing: {
            content: respRule.content,
            latency: respRule.latencySeconds,
            error: respRule.error,
          },
        });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // API: Trigger Benchmark Run
    if (pathname === '/api/run-benchmark' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const maxCases = body.maxCases ? Number(body.maxCases) : null;
        const runner = new BenchmarkRunner();
        const runResult = await runner.run({ maxCases });
        return sendJson(res, {
          success: true,
          runId: runResult.runId,
          exportPaths: runResult.exportPaths,
        });
      } catch (err) {
        return sendJson(res, { success: false, error: err.message }, 500);
      }
    }

    // Serve Static React Build from client/dist (if built)
    if (fs.existsSync(CLIENT_DIST)) {
      let filePath = path.join(CLIENT_DIST, pathname === '/' ? 'index.html' : pathname);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(CLIENT_DIST, 'index.html');
      }

      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      try {
        const fileContent = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fileContent);
        return;
      } catch {}
    }

    // Fallback info if client/dist is not yet built
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2>AI Behavior Lab Server is Active</h2>
          <p>Ollama is connected at <code>${client.baseUrl}</code></p>
          <p>React client is ready to be launched or built.</p>
        </body>
      </html>
    `);
  });

  return server;
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log('\n' + '='.repeat(65));
    console.log('🌐 AI BEHAVIOR LAB - NODE.JS API SERVER');
    console.log('='.repeat(65));
    console.log(`👉 Server Running: http://localhost:${PORT}`);
    console.log(`📡 Connected to:   Ollama at http://127.0.0.1:11434`);
    console.log('🛑 Press Ctrl + C to stop.');
    console.log('='.repeat(65) + '\n');
  });
}
