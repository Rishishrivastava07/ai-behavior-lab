import React, { useState, useMemo } from 'react';
import { Search, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

export default function ResponseExplorer({ details = [], activePolicy }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pair baseline and rule_following records by test_id
  const pairedCases = useMemo(() => {
    const map = {};
    for (const row of details) {
      const id = row.test_id || 'UNKNOWN';
      if (!map[id]) {
        map[id] = {
          id,
          category: row.category,
          question: row.question,
          target_rule: row.target_rule,
          baseline: null,
          rule_following: null,
        };
      }
      if (row.config_name === 'baseline') {
        map[id].baseline = row;
      } else if (row.config_name === 'rule_following') {
        map[id].rule_following = row;
      }
    }
    return Object.values(map);
  }, [details]);

  const filteredCases = useMemo(() => {
    return pairedCases.filter((item) => {
      const matchCat =
        selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch =
        !searchQuery ||
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [pairedCases, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Active Policy Context Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Benchmark Grounding Document:
              </span>
              <span className="text-xs font-bold text-slate-900">
                {activePolicy?.filename || 'No policy loaded'}
              </span>
              {activePolicy?.isDefault ? (
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                  Default Benchmark Policy
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                  Active Uploaded Policy
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Side-by-side behavioral adherence log for the currently active policy.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Category Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Category:
          </span>
          {[
            { id: 'all', label: `All (${pairedCases.length})` },
            { id: 'answerable', label: 'Answerable' },
            { id: 'unanswerable', label: 'Unanswerable' },
            { id: 'adversarial', label: 'Adversarial' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions or ID..."
            className="w-full text-xs pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        {filteredCases.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <FileText className="w-9 h-9 mx-auto text-slate-400 mb-3" />
            <h3 className="font-semibold text-slate-800">No benchmark responses for this policy</h3>
            <p className="text-xs text-slate-500 mt-1">
              Run the benchmark to generate questions and answers for the active policy.
            </p>
          </div>
        )}
        {filteredCases.map((item) => {
          const catBadgeClass =
            item.category === 'answerable'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : item.category === 'unanswerable'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-purple-50 text-purple-700 border-purple-200';

          return (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    {item.id}
                  </span>
                  <span className={`text-xs uppercase font-semibold px-2 py-0.5 rounded border ${catBadgeClass}`}>
                    {item.category}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Target Rule: {item.target_rule}
                </span>
              </div>

              {/* Question */}
              <div className="text-sm font-semibold text-slate-900">
                "{item.question}"
              </div>

              {/* Side-by-side Response Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Baseline Response */}
                <div
                  className={`rounded-lg p-3 ${
                    item.baseline?.passed === 'True' || item.baseline?.passed === true
                      ? 'bg-emerald-50/50 border border-emerald-200'
                      : 'bg-rose-50/50 border border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
                    <span className="text-slate-700 flex items-center gap-1">
                      Baseline ({item.baseline?.latency_seconds || '0.00'}s)
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold text-xs ${
                        item.baseline?.passed === 'True' || item.baseline?.passed === true
                          ? 'text-emerald-700 bg-emerald-100'
                          : 'text-rose-700 bg-rose-100'
                      }`}
                    >
                      {item.baseline?.passed === 'True' || item.baseline?.passed === true
                        ? '✅ PASS'
                        : '❌ FAIL'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 italic mb-2 leading-relaxed">
                    "{item.baseline?.model_response || 'No response captured'}"
                  </p>
                  {item.baseline?.failure_reasons && item.baseline.failure_reasons !== 'None' && (
                    <p className="text-[12px] text-rose-600 font-medium">
                      ↳ {item.baseline.failure_reasons}
                    </p>
                  )}
                </div>

                {/* Rule-Following Response */}
                <div
                  className={`rounded-lg p-3 ${
                    item.rule_following?.passed === 'True' || item.rule_following?.passed === true
                      ? 'bg-emerald-50/50 border border-emerald-200'
                      : 'bg-rose-50/50 border border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
                    <span className="text-slate-800 flex items-center gap-1 font-bold">
                      Rule-Following ({item.rule_following?.latency_seconds || '0.00'}s)
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold text-xs ${
                        item.rule_following?.passed === 'True' || item.rule_following?.passed === true
                          ? 'text-emerald-700 bg-emerald-100'
                          : 'text-rose-700 bg-rose-100'
                      }`}
                    >
                      {item.rule_following?.passed === 'True' || item.rule_following?.passed === true
                        ? '✅ PASS'
                        : '❌ FAIL'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 font-medium italic mb-2 leading-relaxed">
                    "{item.rule_following?.model_response || 'No response captured'}"
                  </p>
                  {item.rule_following?.failure_reasons && item.rule_following.failure_reasons !== 'None' && (
                    <p className="text-[12px] text-rose-600 font-medium">
                      ↳ {item.rule_following.failure_reasons}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
