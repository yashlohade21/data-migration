"use client";
import { ColumnMapping, TARGET_FIELDS } from "@/lib/types";
import { api } from "@/lib/api";
import { useState } from "react";
import { Check, AlertTriangle, User, ChevronDown, Eye } from "lucide-react";

interface Props {
  mappings: ColumnMapping[];
  sessionId: string;
  onUpdate?: () => void;
  readOnly?: boolean;
}

export default function MappingTable({ mappings, sessionId, onUpdate, readOnly }: Props) {
  const [updating, setUpdating] = useState<string | null>(null);

  const handleOverride = async (mappingId: string, targetField: string) => {
    setUpdating(mappingId);
    try {
      await api.updateMapping(sessionId, mappingId, {
        target_field: targetField,
        status: "human_overridden",
      });
      onUpdate?.();
    } finally {
      setUpdating(null);
    }
  };

  const getConfidencePill = (c: number) => {
    if (c >= 0.85) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    if (c >= 0.5) return "bg-amber-50 text-amber-700 ring-amber-200";
    return "bg-red-50 text-red-700 ring-red-200";
  };

  const getStatusBadge = (status: string) => {
    if (status === "auto_accepted") return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
        <Check className="w-3 h-3" /> Auto
      </span>
    );
    if (status === "human_approved" || status === "human_overridden") return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600">
        <User className="w-3 h-3" /> Human
      </span>
    );
    if (status === "needs_review") return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
        <Eye className="w-3 h-3" /> Review
      </span>
    );
    if (status === "escalated") return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
        <AlertTriangle className="w-3 h-3" /> Escalated
      </span>
    );
    return <span className="text-[11px] text-gray-400">{status}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Source</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Target</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Confidence</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Reasoning</th>
            {!readOnly && <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Override</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {mappings.map((m) => (
            <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
              <td className="py-3 px-4">
                <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-mono">{m.source_column}</code>
              </td>
              <td className="py-3 px-4">
                {(m.human_override || m.target_field) ? (
                  <code className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-mono">
                    {m.human_override || m.target_field}
                  </code>
                ) : (
                  <span className="text-xs text-gray-400 italic">unmapped</span>
                )}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        m.confidence >= 0.85 ? "bg-emerald-500" : m.confidence >= 0.5 ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{ width: `${m.confidence * 100}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ring-1 ${getConfidencePill(m.confidence)}`}>
                    {Math.round(m.confidence * 100)}%
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">{getStatusBadge(m.status)}</td>
              <td className="py-3 px-4 max-w-48">
                <span className="text-[11px] text-gray-500 truncate block">{m.ai_reasoning}</span>
              </td>
              {!readOnly && (
                <td className="py-3 px-4">
                  <div className="relative inline-block">
                    <select
                      value={m.human_override || m.target_field || ""}
                      onChange={(e) => handleOverride(m.id, e.target.value)}
                      disabled={updating === m.id}
                      aria-label={`Override target for ${m.source_column}`}
                      className="text-xs h-8 border border-gray-200 rounded-lg pl-2.5 pr-7 appearance-none bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                    >
                      <option value="">None</option>
                      {TARGET_FIELDS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
