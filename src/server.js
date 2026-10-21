/**
 * AI Behavior Lab - Local API Server (Node 20 Native HTTP).
 * Supports Client-Policy Uploads, Isolated Workspaces, Local RAG, and Benchmark Runner.
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
  loadPolicy as loadDefaultAcmePolicy,
} from './config.js';
import { DocumentParser } from './documentParser.js';
import { OllamaClient } from './ollamaClient.js';
import { RAGAssistant } from './rag/ragAssistant.js';
import { BenchmarkRunner } from './runner.js';
import { WorkspaceManager, WORKSPACES_DIR } from './workspaceManager.js';

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
  const workspaceManager = new WorkspaceManager();
  const ragAssistant = new RAGAssistant({ client });

  const server = http.createServer(async (req, res) => {
    // CORS Preflight
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
    const searchParams = parsedUrl.searchParams;

    // 1. API: Health & Status
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

    // 2. API: Workspace List
    if (pathname === '/api/workspaces' && req.method === 'GET') {
      const workspaces = workspaceManager.listWorkspaces();
      return sendJson(res, { workspaces });
    }

    // 3. API: Get Workspace Policy
    if (pathname === '/api/workspace/policy' && req.method === 'GET') {
      const workspaceId = searchParams.get('workspaceId') || 'default';
      const info = workspaceManager.getWorkspaceInfo(workspaceId);
      return sendJson(res, info);
    }

    // 4. API: Upload Preview (Parses PDF or TXT without saving)
    if (pathname === '/api/upload-preview' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const filename = body.filename || 'document.txt';
        let buffer;

        if (body.base64Data) {
          buffer = Buffer.from(body.base64Data, 'base64');
        } else if (body.text) {
          buffer = Buffer.from(body.text, 'utf-8');
        } else {
          return sendJson(res, { error: 'No document data provided.' }, 400);
        }

        const previewResult = await DocumentParser.parse({ buffer, filename });
        return sendJson(res, { success: true, preview: previewResult });
      } catch (err) {
        return sendJson(res, { success: false, error: err.message, code: err.code || 'PARSE_ERROR' }, 400);
      }
    }

    // 5. API: Activate Policy in Workspace
    if (pathname === '/api/workspace/activate-policy' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const workspaceId = body.workspaceId || 'default';
        const { filename, text, charCount, wordCount } = body;

        if (!text || !text.trim()) {
          return sendJson(res, { error: 'Policy text cannot be empty.' }, 400);
        }

        const policy = workspaceManager.savePolicy(workspaceId, {
          filename,
          text,
          charCount,
          wordCount,
        });

        return sendJson(res, { success: true, policy });
      } catch (err) {
        return sendJson(res, { success: false, error: err.message }, 500);
      }
    }

    // 6. API: Reset Policy in Workspace
    if (pathname === '/api/workspace/reset-policy' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const workspaceId = body.workspaceId || 'default';
        const policy = workspaceManager.resetPolicy(workspaceId);
        return sendJson(res, { success: true, policy });
      } catch (err) {
        return sendJson(res, { success: false, error: err.message }, 500);
      }
    }

    // 7. API: Grounded RAG Query against Active Workspace Policy
    if (pathname === '/api/workspace/query' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const workspaceId = body.workspaceId || 'default';
        const question = (body.question || '').trim();
        const topK = body.topK ? Number(body.topK) : 3;

        if (!question) {
          return sendJson(res, { error: 'Question cannot be empty.' }, 400);
        }

        const info = workspaceManager.getWorkspaceInfo(workspaceId);
        const policyText = info.policy?.text || '';

        const ragResult = await ragAssistant.answer({
          question,
          policyText,
          topK,
        });

        return sendJson(res, {
          question,
          workspaceId,
          policyName: info.policy?.filename || 'Policy Document',
          answer: ragResult.answer,
          sources: ragResult.sources,
          isRefusal: ragResult.isRefusal,
          latencySeconds: ragResult.latencySeconds,
          error: ragResult.error,
        });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // 8. API: Legacy Policy Text (for Acme reference tab)
    if (pathname === '/api/policy' && req.method === 'GET') {
      return sendJson(res, { policy: loadDefaultAcmePolicy() });
    }

    // 9. API: Test Cases
    if (pathname === '/api/test-cases' && req.method === 'GET') {
      try {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        return sendJson(res, JSON.parse(raw));
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // 10. API: Benchmark Results
    if (pathname === '/api/results' && req.method === 'GET') {
      try {
        const summaryPath = path.join(RESULTS_DIR, 'latest_summary.csv');
        let summary = [];
        if (fs.existsSync(summaryPath)) {
          summary = parseCsv(fs.readFileSync(summaryPath, 'utf-8'));
        }

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

    // 11. API: Trigger Benchmark Run
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

    // 12. Serve Static React Build from client/dist (if built)
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

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2>AI Behavior Lab Server is Active</h2>
          <p>Ollama is connected at <code>${client.baseUrl}</code></p>
          <p>Client Policy RAG and Benchmark APIs are ready.</p>
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
    console.log('🌐 AI BEHAVIOR LAB - CLIENT-POLICY ASSISTANT & BENCHMARK SERVER');
    console.log('='.repeat(65));
    console.log(`👉 Server Running: http://localhost:${PORT}`);
    console.log(`📡 Connected to:   Ollama at http://127.0.0.1:11434`);
    console.log(`📂 Workspaces at:  ${WORKSPACES_DIR}`);
    console.log('🛑 Press Ctrl + C to stop.');
    console.log('='.repeat(65) + '\n');
  });
}
