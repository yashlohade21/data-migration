"use client";
import { useState, useEffect, use } from "react";
import { api } from "@/lib/api";
import { Loader2, Bot, User, FileText, Shield, Clock } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  phase: string;
  details: Record<string, unknown>;
  timestamp: string;
}

const ACTOR_CONFIG = {
  agent: { icon: Bot, label: "Agent", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400" },
  human: { icon: User, label: "Human", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
} as const;

const PHASE_COLORS: Record<string, string> = {
  ingest: "bg-slate-100 text-slate-600",
  map: "bg-blue-50 text-blue-700",
  clean: "bg-cyan-50 text-cyan-700",
  dedup: "bg-purple-50 text-purple-700",
  validate: "bg-amber-50 text-amber-700",
  push: "bg-emerald-50 text-emerald-700",
};

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAudit(id)
      .then(setEntries)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">No audit entries yet</p>
        <p className="text-xs text-slate-400 mt-1">Actions will be logged here as the agent processes data</p>
      </div>
    );
  }

  // Group entries by date
  const grouped: Record<string, AuditEntry[]> = {};
  entries.forEach((e) => {
    const date = formatDate(e.timestamp);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  });

  const agentCount = entries.filter((e) => e.actor === "agent").length;
  const humanCount = entries.filter((e) => e.actor === "human").length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Audit Trail</h2>
              <p className="text-xs text-slate-400 mt-0.5">Complete record of all agent and human actions</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-medium text-purple-700">{agentCount} agent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-medium text-indigo-700">{humanCount} human</span>
            </div>
            <span className="text-xs text-slate-400">{entries.length} total</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="px-6 py-4">
          {Object.entries(grouped).map(([date, dayEntries]) => (
            <div key={date} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3 h-3 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{date}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="space-y-2 ml-1">
                {dayEntries.map((entry) => {
                  const actorKey = entry.actor as keyof typeof ACTOR_CONFIG;
                  const config = ACTOR_CONFIG[actorKey] || ACTOR_CONFIG.agent;
                  const ActorIcon = config.icon;
                  return (
                    <div key={entry.id} className="flex items-start gap-3 group">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center pt-1.5">
                        <div className={`w-2 h-2 rounded-full ${config.dot} ring-2 ring-white`} />
                        <div className="w-px flex-1 bg-slate-100 group-last:hidden mt-1" />
                      </div>

                      <div className="flex-1 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${config.bg} ${config.text}`}>
                            <ActorIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                          {entry.phase && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${PHASE_COLORS[entry.phase] || "bg-slate-100 text-slate-600"}`}>
                              {entry.phase}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 tabular-nums ml-auto">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-700 mt-1">{formatAction(entry.action)}</p>
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {Object.entries(entry.details).map(([k, v]) => (
                              <span key={k} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md border border-slate-100">
                                {k}: <span className="font-medium text-slate-700">{String(v)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
