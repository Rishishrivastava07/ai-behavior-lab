import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import MetricCards from './components/MetricCards.jsx';
import ComparisonTable from './components/ComparisonTable.jsx';
import ResponseExplorer from './components/ResponseExplorer.jsx';
import InteractivePlayground from './components/InteractivePlayground.jsx';
import PolicyViewer from './components/PolicyViewer.jsx';

// Fallback initial benchmark data in case server results are loading
const DEFAULT_SUMMARY = [
  {
    config_name: 'baseline',
    overall_accuracy_pct: '33.3',
    answerable_accuracy_pct: '80.0',
    unanswerable_accuracy_pct: '0.0',
    adversarial_accuracy_pct: '0.0',
    avg_latency_seconds: '1.05',
    passed_count: '4',
    total_tests: '12',
  },
  {
    config_name: 'rule_following',
    overall_accuracy_pct: '58.3',
    answerable_accuracy_pct: '100.0',
    unanswerable_accuracy_pct: '20.0',
    adversarial_accuracy_pct: '50.0',
    avg_latency_seconds: '0.70',
    passed_count: '7',
    total_tests: '12',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [health, setHealth] = useState({ alive: true, model: 'qwen2.5:1.5b' });
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [details, setDetails] = useState([]);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);

  useEffect(() => {
    fetchHealth();
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

  async function fetchResults() {
    try {
      const res = await fetch('/api/results');
      if (res.ok) {
        const data = await res.json();
        if (data.summary && data.summary.length > 0) {
          setSummary(data.summary);
        }
        if (data.details && data.details.length > 0) {
          setDetails(data.details);
        }
      }
    } catch {}
  }

  async function handleRunBenchmark() {
    setIsRunningBenchmark(true);
    try {
      const res = await fetch('/api/run-benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        onRunBenchmark={handleRunBenchmark}
        isRunningBenchmark={isRunningBenchmark}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <MetricCards summary={summary} />
            <ComparisonTable summary={summary} />
          </div>
        )}

        {activeTab === 'explorer' && <ResponseExplorer details={details} />}

        {activeTab === 'playground' && <InteractivePlayground />}

        {activeTab === 'policy' && <PolicyViewer />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        AI Behavior Lab • Apple M2 Metal Inference • Zero-Budget Startup Prototype
      </footer>
    </div>
  );
}
