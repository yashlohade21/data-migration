"use client";
import { Escalation, TARGET_FIELDS } from "@/lib/types";
import { api } from "@/lib/api";
import { useState } from "react";
import {
  AlertTriangle, CheckCircle2, XCircle,
  Pencil, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";

interface Props {
  escalation: Escalation;
  sessionId: string;
  onResolved?: () => void;
  onError?: (msg: string) => void;
}

const SEVERITY_STYLES = {
  high: "border-l-red-400 bg-red-50/40",
  medium: "border-l-amber-400 bg-amber-50/30",
  low: "border-l-blue-400 bg-blue-50/30",
};

const RULE_LABELS: Record<string, string> = {
  ambiguous_mapping: "Ambiguous Mapping",
  ambiguous_date: "Ambiguous Date Format",
  duplicate_conflict: "Duplicate Conflict",
  validation_fail: "Validation Failed",
  unknown_enum: "Unknown Value",
  missing_required: "Missing Required Field",
};

const RULE_COLORS: Record<string, string> = {
  ambiguous_mapping: "bg-purple-100 text-purple-700",
  ambiguous_date: "bg-orange-100 text-orange-700",
  duplicate_conflict: "bg-rose-100 text-rose-700",
  validation_fail: "bg-red-100 text-red-700",
  unknown_enum: "bg-amber-100 text-amber-700",
  missing_required: "bg-gray-100 text-gray-700",
};

export default function EscalationCard({ escalation, sessionId, onResolved, onError }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overrideValue, setOverrideValue] = useState("");
  const [resolving, setResolving] = useState(false);

  const resolve = async (status: "approved" | "rejected" | "overridden", resolution?: string) => {
    setResolving(true);
    try {
      await api.resolveEscalation(sessionId, escalation.id, {
        status,
        human_resolution: resolution || null,
      });
      onResolved?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to resolve escalation";
      onError?.(msg);
    } finally {
      setResolving(false);
    }
  };

  if (escalation.status !== "pending") {
    return (
      <div className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50/60 flex items-center gap-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="text-sm text-gray-500 flex-1 truncate">{escalation.description}</span>
        <span className="text-[11px] font-medium bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md">
          {escalation.status}
        </span>
      </div>
    );
  }

  const ctx = escalation.context || {};

  return (
    <div className={`border border-gray-200 border-l-4 rounded-xl overflow-hidden bg-white shadow-sm ${
      SEVERITY_STYLES[escalation.severity as keyof typeof SEVERITY_STYLES] || SEVERITY_STYLES.medium
    }`}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${RULE_LABELS[escalation.rule] || escalation.rule}: ${escalation.description}`}
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
      >
        <AlertTriangle className={`w-4.5 h-4.5 shrink-0 ${
          escalation.severity === "high" ? "text-red-500" : "text-amber-500"
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              RULE_COLORS[escalation.rule] || "bg-gray-100 text-gray-600"
            }`}>
              {RULE_LABELS[escalation.rule] || escalation.rule}
            </span>
          </div>
          <p className="text-[13px] text-gray-700 leading-snug">{escalation.description}</p>
        </div>
        <div className="shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3 animate-fade-in">
          {/* Duplicate conflicts */}
          {escalation.rule === "duplicate_conflict" && ctx.conflicts && (
            <div className="text-xs space-y-1.5">
              <p className="font-semibold text-gray-600 text-[11px] uppercase tracking-wider">Conflicts</p>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Field</th>
                    <th className="text-left px-3 py-2 font-medium text-red-500">Record A</th>
                    <th className="text-left px-3 py-2 font-medium text-blue-500">Record B</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {ctx.conflicts.map((c: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-mono text-gray-600">{c.field}</td>
                        <td className="px-3 py-1.5 text-red-700">{String(c.value_a)}</td>
                        <td className="px-3 py-1.5 text-blue-700">{String(c.value_b)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mapping context */}
          {escalation.rule === "ambiguous_mapping" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">{ctx.source_column}</code>
                <span className="text-gray-400">{"→"}</span>
                <code className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">{ctx.suggested_target || "?"}</code>
              </div>
              {ctx.confidence != null && (
                <p className="text-[11px] text-red-600 font-medium">
                  Escalated: confidence {Math.round(ctx.confidence * 100)}% below threshold
                </p>
              )}
            </div>
          )}

          {/* Suggestion */}
          {escalation.ai_suggestion && (
            <div className="flex items-start gap-2 bg-indigo-50/60 rounded-lg px-3 py-2">
              <span className="text-[11px] font-medium text-indigo-500 mt-0.5 shrink-0">Suggestion:</span>
              <span className="text-[12px] text-indigo-700">{escalation.ai_suggestion}</span>
            </div>
          )}

          {/* Override input */}
          {(escalation.rule === "ambiguous_mapping" || escalation.rule === "unknown_enum") && (
            <select
              value={overrideValue}
              onChange={(e) => setOverrideValue(e.target.value)}
              aria-label="Select override value"
              className="w-full text-xs h-9 border border-gray-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            >
              <option value="">Select correct value...</option>
              {escalation.rule === "ambiguous_mapping"
                ? TARGET_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)
                : (ctx.field === "department"
                  ? ["Engineering","Marketing","Sales","Human Resources","Finance","Operations","Product","Design","Legal","Customer Support","Data Science","IT","Administration"]
                  : ["Full-time","Part-time","Contract","Intern"]
                ).map((v) => <option key={v} value={v}>{v}</option>)
              }
            </select>
          )}

          {(escalation.rule === "ambiguous_date" || escalation.rule === "validation_fail" || escalation.rule === "missing_required") && (
            <input
              type="text"
              value={overrideValue}
              onChange={(e) => setOverrideValue(e.target.value)}
              placeholder={escalation.rule === "ambiguous_date" ? "YYYY-MM-DD" : "Enter correct value"}
              className="w-full text-xs h-9 border border-gray-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => resolve("approved")}
              disabled={resolving}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
            >
              {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Accept
            </button>
            <button
              onClick={() => resolve("rejected")}
              disabled={resolving}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>
            {overrideValue && (
              <button
                onClick={() => resolve("overridden", overrideValue)}
                disabled={resolving}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
              >
                <Pencil className="w-3.5 h-3.5" />
                Override
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
