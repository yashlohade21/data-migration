"use client";
import { DeltaReport as DeltaReportType } from "@/lib/types";
import { Bot, User, TrendingUp } from "lucide-react";

interface Props {
  report: DeltaReportType;
}

export default function DeltaReport({ report }: Props) {
  const total = Math.max(report.ai_contribution_pct + report.human_contribution_pct, 1);
  const aiWidth = (report.ai_contribution_pct / total) * 100;
  const humanWidth = (report.human_contribution_pct / total) * 100;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          Contribution Report
        </h3>
        <p className="text-sm text-gray-500 mt-1">How much work was done by the agent vs. you</p>
      </div>

      {/* Big contribution bar */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="flex items-center gap-2 font-medium text-purple-700">
            <Bot className="w-4 h-4" />
            Agent: {report.ai_contribution_pct}%
          </span>
          <span className="flex items-center gap-2 font-medium text-indigo-700">
            <User className="w-4 h-4" />
            Human: {report.human_contribution_pct}%
          </span>
        </div>
        <div className="h-5 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
          <div className="bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-700 rounded-l-full" style={{ width: `${aiWidth}%` }} />
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-700 rounded-r-full" style={{ width: `${humanWidth}%` }} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-xl p-5 text-center border border-gray-100">
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{report.total_records}</p>
          <p className="text-xs text-gray-500 mt-1.5 font-medium">Total Records</p>
        </div>
        <div className="bg-purple-50/60 rounded-xl p-5 text-center border border-purple-100">
          <p className="text-3xl font-bold text-purple-700 tabular-nums">{report.ai_auto_resolved}</p>
          <p className="text-xs text-purple-600 mt-1.5 font-medium">Agent Decisions</p>
        </div>
        <div className="bg-indigo-50/60 rounded-xl p-5 text-center border border-indigo-100">
          <p className="text-3xl font-bold text-indigo-700 tabular-nums">{report.human_resolved}</p>
          <p className="text-xs text-indigo-600 mt-1.5 font-medium">Human Decisions</p>
        </div>
      </div>

      {/* Phase breakdown */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-4">By Phase</h4>
        <div className="space-y-3">
          {Object.entries(report.phase_stats).map(([phase, stats]: [string, any]) => (
            <div key={phase} className="flex items-center gap-4">
              <span className="w-16 text-xs font-semibold capitalize text-gray-500">{phase}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                {stats.total_escalations > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all"
                    style={{ width: `${Math.min((stats.human_resolved / Math.max(stats.total_escalations, 1)) * 100, 100)}%` }}
                  />
                )}
              </div>
              <span className="text-[11px] text-gray-400 w-36 text-right tabular-nums">
                {stats.total_escalations} escalations, {stats.human_resolved} human
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* By rule */}
      {report.escalation_breakdown?.by_rule && Object.keys(report.escalation_breakdown.by_rule).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Escalation Types</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(report.escalation_breakdown.by_rule).map(([rule, count]) => (
              <div key={rule} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <span className="text-xs text-gray-600 capitalize">{rule.replace(/_/g, " ")}</span>
                <span className="text-sm font-bold text-gray-800 tabular-nums">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
