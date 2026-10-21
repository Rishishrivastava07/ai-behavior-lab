# AI Behavior Lab (Node.js & React Edition)

**AI Behavior Lab** is a zero-budget, 100% local framework for measuring whether open-weight AI models adhere to defined corporate policies and behavioral constraints.

It runs locally on macOS (optimized for Apple Silicon / M-series chips) using **Node.js (v20+)**, **React (Vite)**, and **Ollama**.

---

## 🎯 Architecture & Workflow

```
                        ┌────────────────────────┐
                        │   Acme Policy Document │
                        │      (policy.md)       │
                        └──────────┬─────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌─────────────────────┐                   ┌─────────────────────┐
   │ Baseline Config     │                   │ Rule-Following      │
   │ Standard helpful    │                   │ Strict boundary     │
   │ assistant prompt    │                   │ enforcement prompt  │
   └──────────┬──────────┘                   └──────────┬──────────┘
              │                                         │
              └────────────────────┬────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │  Local Ollama Engine  │
                       │    (qwen2.5:1.5b)     │
                       └───────────┬───────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │ Deterministic Rule    │
                       │ Evaluator Engine (JS) │
                       └───────────┬───────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌─────────────────────┐                   ┌─────────────────────┐
   │ CSV Audit Trails    │                   │ React Web Dashboard │
   │ (results/runs/)     │                   │ (http://localhost:  │
   │                     │                   │  8000 or 5173)      │
   └─────────────────────┘                   └─────────────────────┘
```

---

## ⚙️ Prerequisites

- **Mac**: Apple Silicon (M1/M2/M3/M4) or Intel Mac running macOS 12+.
- **Node.js**: v20+ (`node -v` and `npm -v`).
- **Ollama**: Free, open-source model server from [ollama.com](https://ollama.com/download).
- **Local Model**:
  ```bash
  ollama pull qwen2.5:1.5b
  ```

---

## 🚀 Quickstart Guide

### 1. Run Automated Unit Tests (Zero Network, Built-in Node Runner)
Verify the rule evaluator engine heuristics using Node 20's native test runner:
```bash
npm test
```

### 2. Verify Environment & Ollama Connection
Run the diagnostic check via Node CLI:
```bash
node run-benchmark.js --check-only
```

### 3. Run the CLI Benchmark
Run the complete side-by-side benchmark across all 12 test cases:
```bash
node run-benchmark.js
```

Optional CLI flags:
```bash
# Run quick 3-test smoke test:
node run-benchmark.js --max-cases 3

# Test with a different local model:
node run-benchmark.js --model llama3.2:1b

# Adjust temperature (default 0.0 for deterministic evaluation):
node run-benchmark.js --temperature 0.2
```

---

## 🌐 Launching the React Web Dashboard

### Production / Standalone Mode (Single Port: 8000)
Start the zero-dependency Node API server which serves the built React frontend:
```bash
npm run server
```
Then visit **[http://localhost:8000](http://localhost:8000)**!

### Frontend Dev Mode (With Hot Reloading: 5173)
If you want to edit the React components with instant hot module reloading:
```bash
# Terminal 1: Start backend API server
npm run server

# Terminal 2: Start Vite React dev server
npm run client:dev
```
Then open **[http://localhost:5173](http://localhost:5173)**!

---

## 📊 Dataset Structure (`data/test_cases.json`)

The test suite tests three critical operational categories:
1. **Answerable (`category: "answerable"`)**:
   - Tests whether the model correctly cites explicit policy rules (₹1,500 meal cap, economy class only, 14-day receipt window, ₹2,000 gift ceiling).
2. **Unanswerable (`category: "unanswerable"`)**:
   - Questions that **cannot** be answered from `policy.md` (maternity leave duration, 401(k) match, Wi-Fi passwords, leave rollover).
   - Evaluates if the model admits absence of data and redirects to HR/People Operations without hallucinating.
3. **Adversarial (`category: "adversarial"`)**:
   - Social engineering and prompt injection attempts (e.g. claiming VP rank to override gift rules, or requesting terminal commands to disable disk encryption).

---

## 📁 Output Artifacts (`results/`)

All benchmark runs produce auditable CSV records:
- **`results/runs/eval_details_<timestamp>.csv`**:
  Row-by-row log containing the input prompt, model response text, rule pass/fail status, refusal check, required keyword check, forbidden keyword check, latency, and error traces.
- **`results/runs/eval_summary_<timestamp>.csv`**:
  Aggregated statistics per configuration (overall adherence rate, answerable accuracy, refusal precision, adversarial resistance, and average inference latency).
- **`results/latest_summary.csv`**:
  Convenient pointer to the most recent run's summary.

---

## ⚠️ Evaluator Limitations & Engineering Notes

1. **Heuristic Evaluation vs. Semantic Reasoning**:
   The evaluator uses deterministic keyword, regex, and refusal-pattern heuristics. While fast, reproducible, and zero-budget, it does not perform deep semantic parsing.
2. **Prompt Steering $\neq$ Fine-Tuning**:
   Configuring a system prompt with behavioral rules is **in-context steering**, not fine-tuning. The underlying model weights remain unchanged. Fine-tuning adjusts the actual network weights via supervised training (SFT / DPO / LoRA).
3. **Hardware Boundary**:
   Running 1.5B inference on an 8 GB unified memory Mac is smooth and responsive (~0.7s latency). Attempting to run full fine-tuning locally will require quantized LoRA (QLoRA) to avoid memory swap pressure.
4. **Local Network Security**:
   Ollama is bound strictly to `127.0.0.1:11434`. Never expose this port to public networks without authentication.
