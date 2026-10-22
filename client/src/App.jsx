import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import MetricCards from './components/MetricCards.jsx';
import ComparisonTable from './components/ComparisonTable.jsx';
import ResponseExplorer from './components/ResponseExplorer.jsx';
import InteractivePlayground from './components/InteractivePlayground.jsx';
import PolicyUploader from './components/PolicyUploader.jsx';
import PolicyViewer from './components/PolicyViewer.jsx';

// Fallback initial benchmark summary
const DEFAULT_SUMMARY = [
  {
    config_name: 'baseline',
    overall_accuracy_pct: '33.3',
    answerable_accuracy_pct: '80.0',
    unanswerable_accuracy_pct: '0.0',
    adversarial_accuracy_pct: '0.0',
    avg_latency_seconds: '0.87',
    passed_count: '4',
    total_tests: '12',
  },
  {
    config_name: 'rule_following',
    overall_accuracy_pct: '58.3',
    answerable_accuracy_pct: '100.0',
    unanswerable_accuracy_pct: '20.0',
    adversarial_accuracy_pct: '50.0',
    avg_latency_seconds: '0.61',
    passed_count: '7',
    total_tests: '12',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('playground'); // Start with the assistant view
  const [workspaceId, setWorkspaceId] = useState('default');
  const [activePolicy, setActivePolicy] = useState(null);
  const [health, setHealth] = useState({ alive: true, model: 'qwen2.5:1.5b' });
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [details, setDetails] = useState([]);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);

  useEffect(() => {
    fetchHealth();
    fetchActivePolicy();
    setDetails([]);
  }, [workspaceId]);

  useEffect(() => {
    fetchResults();
  }, []);

  async function fetchHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {}
  }

  async function fetchActivePolicy() {
    try {
      const res = await fetch(`/api/workspace/policy?workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setActivePolicy(data.policy || null);
      }
    } catch {}
  }

  async function fetchResults() {
    try {
      const res = await fetch('/api/results');
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary?.length ? data.summary : DEFAULT_SUMMARY);
        setDetails(data.details || []);
      }
    } catch {}
  }

  async function handleRunBenchmark() {
    setIsRunningBenchmark(true);
    try {
      const res = await fetch('/api/run-benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        await fetchResults();
      }
    } catch (err) {
      console.error('Failed to run benchmark:', err);
    } finally {
      setIsRunningBenchmark(false);
    }
  }

  async function handlePolicyActivated(newPolicy) {
    setActivePolicy(newPolicy);
    // Benchmark records belong to the policy used for that run. Do not show
    // the previous policy's questions and answers after a new upload.
    setDetails([]);
    // Switch to playground so user can test their newly uploaded policy immediately!
    setActiveTab('playground');

    // Regenerate explorer data against the newly active document. Results from
    // the prior policy must never be presented as if they were current.
    try {
      const res = await fetch('/api/run-benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        await fetchResults();
      }
    } catch (err) {
      console.error('Failed to refresh policy benchmark:', err);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        activePolicy={activePolicy}
        onRunBenchmark={handleRunBenchmark}
        isRunningBenchmark={isRunningBenchmark}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {activeTab === 'playground' && (
          <InteractivePlayground
            activePolicy={activePolicy}
            workspaceId={workspaceId}
          />
        )}

        {activeTab === 'upload' && (
          <PolicyUploader
            activePolicy={activePolicy}
            workspaceId={workspaceId}
            onPolicyActivated={handlePolicyActivated}
          />
        )}

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <MetricCards summary={summary} />
            <ComparisonTable summary={summary} />
          </div>
        )}

        {activeTab === 'explorer' && (
          <ResponseExplorer
            key={activePolicy?.uploadedAt || 'no-policy'}
            details={details}
            activePolicy={activePolicy}
          />
        )}

        {activeTab === 'policy' && (
          <PolicyViewer
            activePolicy={activePolicy}
            onResetToDefault={async () => {
              try {
                const res = await fetch('/api/workspace/reset-policy', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ workspaceId }),
                });
                const data = await res.json();
                if (data.success) {
                  setActivePolicy(data.policy);
                  setDetails([]);
                }
              } catch (err) {
                console.error('Reset policy failed:', err);
              }
            }}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        AI Behavior Lab • Apple M2 Metal Inference • Client-Policy Grounded Assistant
      </footer>
    </div>
  );
}
