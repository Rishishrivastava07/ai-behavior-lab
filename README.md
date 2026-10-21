# AI Behavior Lab - Client-Policy AI Assistant

**AI Behavior Lab** is a zero-budget, 100% local framework for evaluating and serving client policy documents using open-weight AI models.

It runs locally on macOS (optimized for Apple Silicon / M-series chips) using **Node.js (v20+)**, **React (Vite)**, and **Ollama**.

---

## 🎯 Architecture & Capabilities

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI BEHAVIOR LAB ARCHITECTURE                    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│  Client Policy Upload Engine  │           │   Benchmark & Evaluation Lab  │
│  • PDF / TXT upload (< 5 MB)  │           │   • Baseline vs Rule-Following│
│  • Safe text preview modal    │           │   • 12 Adherence Test Cases   │
│  • Workspace folder isolation │           │   • CSV Audit Logs & Metrics  │
└──────────────┬────────────────┘           └───────────────┬───────────────┘
               │                                            │
               ▼                                            │
┌───────────────────────────────┐                           │
│ Local RAG Retrieval (BM25)    │                           │
│ • Semantic passage chunking   │                           │
│ • Sub-millisecond BM25 ranking│                           │
│ • Zero cloud / ₹0 cost        │                           │
└──────────────┬────────────────┘                           │
               │                                            │
               └────────────────────┬───────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  Local Ollama Runtime │
                        │    (qwen2.5:1.5b)     │
                        └───────────┬───────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │ Grounded AI Assistant │
                        │ • Cited Source Excerpts│
                        │ • Strict Refusals     │
                        └───────────────────────┘
```

---

## 🌟 Key Features

1. **Client Policy Document Ingestion (PDF / TXT):**
   - Upload any client handbook, travel policy, or compliance document in **PDF** or **Plain Text** format.
   - Enforces a 5 MB upload ceiling to prevent memory pressure on 8 GB RAM machines.
   - **Safe Preview Modal:** Inspect extracted text, character count, and word count before committing it to the workspace.

2. **Zero-Cloud Local Passage Retrieval (RAG):**
   - Automatically chunks long policies into numbered, overlapping passages (`[P-01]`, `[P-02]`, ...).
   - Fast BM25 keyword retrieval ranks the top relevant excerpts in milliseconds on Apple Silicon without requiring heavy vector databases.

3. **Grounded Answering & Source Attribution:**
   - Every answer cites the exact passage used.
   - **Unsupported Refusal Guarantee:** If the document does not contain the answer, the assistant refuses to guess and outputs:
     `"The provided document does not contain enough information to answer this question."`

4. **Multi-Workspace Folder Isolation:**
   - Workspaces (`workspaces/<workspaceId>/`) store client policies and settings independently.
   - *Security Note: This provides local folder-level isolation for single-user prototyping. Production multi-tenant security with RBAC and authentication will follow in future milestones.*

5. **Integrated Benchmark Suite:**
   - The original 12-test behavioral benchmark comparing Baseline and Rule-Following configurations is preserved and executable at any time.

---

## 🚀 Quickstart Guide

### 1. Launch the React Web Dashboard
```bash
npm run server
```
Then open **[http://localhost:8000](http://localhost:8000)** in your browser!

### 2. Frontend Development Mode (Hot Reloading)
```bash
# Terminal 1: Backend API
npm run server

# Terminal 2: React Dev Server (Vite)
npm run client:dev
```
Then open **[http://localhost:5173](http://localhost:5173)**.

### 3. Run Automated Unit Tests (21 Tests)
```bash
npm test
```

### 4. Run the Side-by-Side CLI Benchmark
```bash
npm run benchmark
```

---

## 📁 Workspace Directory Structure

```
workspaces/
├── default/
│   └── policy.json           # Default Acme Innovations policy
└── <custom_workspace>/
    └── policy.json           # Uploaded client policy (PDF / TXT extracted text & metadata)
```

---

## ⚠️ Engineering Notes & Evaluator Constraints

1. **Relevance & Groundedness Gating:**
   Small 1.5B models naturally attempt to please users by guessing statutory answers (e.g. maternity leave) from pre-training memory. AI Behavior Lab applies relevance gating: when the question's primary subject is absent from retrieved passages, it programmatically enforces the canonical refusal.
2. **Local Security:**
   Ollama binds strictly to `127.0.0.1:11434`. No model or uploaded document is exposed to the internet.
