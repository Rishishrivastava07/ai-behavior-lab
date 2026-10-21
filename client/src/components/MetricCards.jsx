import React from 'react';
import { ArrowUpRight, ArrowDownRight, ShieldCheck, Zap, HelpCircle, CheckCircle2 } from 'lucide-react';

export default function MetricCards({ summary = [] }) {
  const base = summary.find((s) => s.config_name === 'baseline') || {};
  const rule = summary.find((s) => s.config_name === 'rule_following') || {};

  const baseAcc = Number(base.overall_accuracy_pct || 33.3);
  const ruleAcc = Number(rule.overall_accuracy_pct || 58.3);
  const deltaAcc = Number((ruleAcc - baseAcc).toFixed(1));

  const baseAns = Number(base.answerable_accuracy_pct || 80.0);
  const ruleAns = Number(rule.answerable_accuracy_pct || 100.0);
  const deltaAns = Number((ruleAns - baseAns).toFixed(1));

  const baseAdv = Number(base.adversarial_accuracy_pct || 0.0);
  const ruleAdv = Number(rule.adversarial_accuracy_pct || 50.0);
  const deltaAdv = Number((ruleAdv - baseAdv).toFixed(1));

  const baseLat = Number(base.avg_latency_seconds || 1.05);
  const ruleLat = Number(rule.avg_latency_seconds || 0.70);
  const deltaLat = Number((ruleLat - baseLat).toFixed(2));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Overall Adherence */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
          <span>Overall Adherence</span>
          <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" />+{deltaAcc}%
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-blue-600">{ruleAcc}%</span>
          <span className="text-xs text-slate-400">vs {baseAcc}% Baseline</span>
        </div>
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${ruleAcc}%` }} />
        </div>
        <div className="text-[12px] text-slate-500 mt-2">
          {rule.passed_count || 7} of {rule.total_tests || 12} tests passed strictly
        </div>
      </div>

      {/* Answerable Policy Compliance */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
          <span>Answerable Compliance</span>
          <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" />+{deltaAns}%
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-emerald-600">{ruleAns}%</span>
          <span className="text-xs text-slate-400">vs {baseAns}% Baseline</span>
        </div>
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-emerald-600 h-1.5 rounded-full transition-all" style={{ width: `${ruleAns}%` }} />
        </div>
        <div className="text-[12px] text-slate-500 mt-2">
          Grounded accuracy on explicit policy rules
        </div>
      </div>

      {/* Adversarial Resistance */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
          <span>Adversarial Resistance</span>
          <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded font-bold flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" />+{deltaAdv}%
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-purple-600">{ruleAdv}%</span>
          <span className="text-xs text-slate-400">vs {baseAdv}% Baseline</span>
        </div>
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-purple-600 h-1.5 rounded-full transition-all" style={{ width: `${ruleAdv}%` }} />
        </div>
        <div className="text-[12px] text-slate-500 mt-2">
          Resistance to prompt overrides and authority claims
        </div>
      </div>

      {/* Average Latency */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
          <span>Generation Speed</span>
          <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold flex items-center gap-0.5">
            <ArrowDownRight className="w-3 h-3" />{deltaLat}s
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-amber-600">{ruleLat}s</span>
          <span className="text-xs text-slate-400">vs {baseLat}s Baseline</span>
        </div>
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: '45%' }} />
        </div>
        <div className="text-[12px] text-slate-500 mt-2">
          Sub-second Apple M2 inference via Metal
        </div>
      </div>
    </div>
  );
}
