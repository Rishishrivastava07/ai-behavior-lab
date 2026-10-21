/**
 * Automated Unit Tests for Document Parser, Chunker, BM25 Retriever & Workspace Manager.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DocumentParser, DocumentParserError, MAX_FILE_SIZE_BYTES } from '../src/documentParser.js';
import { DocumentChunker } from '../src/rag/chunker.js';
import { PassageRetriever } from '../src/rag/retriever.js';
import { WorkspaceManager } from '../src/workspaceManager.js';
import { REFUSAL_PATTERNS } from '../src/rag/ragAssistant.js';

describe('DocumentParser', () => {
  it('parses valid plain text files with word and char counts', async () => {
    const content = 'Acme Innovations Operations Policy. Section 1: Core working hours are 10:00 AM to 4:00 PM IST.';
    const result = await DocumentParser.parse({
      buffer: Buffer.from(content, 'utf-8'),
      filename: 'sample_policy.txt',
    });

    assert.equal(result.charCount, content.length);
    assert.ok(result.wordCount > 10);
    assert.equal(result.filename, 'sample_policy.txt');
    assert.ok(result.preview.includes('Core working hours'));
  });

  it('rejects unsupported file formats', async () => {
    await assert.rejects(
      async () => {
        await DocumentParser.parse({
          buffer: Buffer.from('binary data'),
          filename: 'malicious_script.exe',
        });
      },
      (err) => {
        assert.ok(err instanceof DocumentParserError);
        assert.equal(err.code, 'UNSUPPORTED_FORMAT');
        return true;
      }
    );
  });

  it('rejects empty files', async () => {
    await assert.rejects(
      async () => {
        await DocumentParser.parse({
          buffer: Buffer.from(''),
          filename: 'empty.txt',
        });
      },
      (err) => {
        assert.ok(err instanceof DocumentParserError);
        assert.equal(err.code, 'EMPTY_FILE');
        return true;
      }
    );
  });

  it('enforces maximum file size limit of 5 MB', async () => {
    const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024, 'a');
    await assert.rejects(
      async () => {
        await DocumentParser.parse({
          buffer: oversizedBuffer,
          filename: 'huge_document.txt',
        });
      },
      (err) => {
        assert.ok(err instanceof DocumentParserError);
        assert.equal(err.code, 'FILE_TOO_LARGE');
        return true;
      }
    );
  });
});

describe('DocumentChunker', () => {
  it('chunks multi-paragraph document into numbered passages', () => {
    const text = `
# Section 1: Travel Policy
Employees are reimbursed up to ₹1,500 daily for meals. Domestic travel is Economy only.

# Section 2: Remote Work
Employees may work remotely 2 days per week with direct manager sign-off.

# Section 3: Gifts & Hospitality
Gifts exceeding ₹2,000 must be surrendered to People Operations immediately.
    `.trim();

    const chunks = DocumentChunker.chunk(text, { targetChunkSize: 150, overlap: 30 });
    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0].passageId, 'P-01');
    assert.equal(chunks[1].passageId, 'P-02');
    assert.ok(chunks[0].text.length > 0);
  });
});

describe('PassageRetriever (BM25)', () => {
  const passages = [
    {
      id: 1,
      passageId: 'P-01',
      text: 'Meal allowance during business travel is capped at ₹1,500 per day. Alcohol is non-reimbursable.',
    },
    {
      id: 2,
      passageId: 'P-02',
      text: 'Core office hours are 10:00 AM to 4:00 PM IST from Monday to Friday.',
    },
    {
      id: 3,
      passageId: 'P-03',
      text: 'Laptops must have full-disk encryption enabled and be locked when unattended.',
    },
  ];

  it('ranks meal allowance passage top for food reimbursement query', () => {
    const results = PassageRetriever.retrieve('What is the daily meal allowance limit?', passages, { topK: 2 });
    assert.equal(results.length, 2);
    assert.equal(results[0].passage.passageId, 'P-01');
    assert.ok(results[0].score > results[1].score);
  });

  it('ranks core office hours top for work timing query', () => {
    const results = PassageRetriever.retrieve('What are the mandatory working hours and days?', passages, { topK: 1 });
    assert.equal(results.length, 1);
    assert.equal(results[0].passage.passageId, 'P-02');
  });
});

describe('WorkspaceManager', () => {
  const tempDir = path.join(process.cwd(), 'workspaces_test_temp');
  const manager = new WorkspaceManager(tempDir);

  it('creates and lists default workspace', () => {
    const list = manager.listWorkspaces();
    assert.ok(list.some((w) => w.id === 'default'));
  });

  it('saves custom policy in isolated folder and retrieves it', () => {
    const customText = 'Client HealthCorp Policy: All patient records require HIPAA compliance.';
    manager.savePolicy('healthcorp', {
      filename: 'healthcorp_v1.txt',
      text: customText,
      charCount: customText.length,
      wordCount: 10,
    });

    const info = manager.getWorkspaceInfo('healthcorp');
    assert.equal(info.policy.filename, 'healthcorp_v1.txt');
    assert.equal(info.policy.text, customText);
    assert.equal(info.policy.isDefault, false);
  });

  it('sanitizes workspace ID to prevent directory traversal', () => {
    const dir = manager.getWorkspaceDir('../../etc');
    assert.ok(!dir.includes('..'));
  });

  // Cleanup temp dir
  it('cleans up test workspaces directory', () => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('RAG Refusal Patterns & Groundedness Gating', () => {
  it('identifies standard unsupported-answer refusal phrases', () => {
    const response = 'The provided document does not contain enough information to answer this question.';
    const isRefusal = REFUSAL_PATTERNS.some((p) => response.toLowerCase().includes(p));
    assert.equal(isRefusal, true);
  });

  it('triggers refusal when question topic is completely absent from policy', async () => {
    const { RAGAssistant } = await import('../src/rag/ragAssistant.js');
    const assistant = new RAGAssistant();
    const policy = 'Policy Section 1: Office hours are 10 AM to 4 PM.';
    const res = await assistant.answer({
      question: 'How many weeks of maternity leave are provided?',
      policyText: policy,
    });

    assert.equal(res.isRefusal, true);
    assert.ok(res.answer.includes('does not contain enough information'));
  });
});
